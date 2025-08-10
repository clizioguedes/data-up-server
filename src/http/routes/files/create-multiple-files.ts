import type { MultipartFile } from '@fastify/multipart';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ZodError, z } from 'zod';
import { ALLOWED_FILE_TYPES } from '../../../constants/files.ts';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import {
  FileUploadService,
  type UploadFileResult,
} from '../../../services/file-upload.service.ts';
import { logger } from '../../../utils/logger.ts';

const uploadService = new FileUploadService();

const multipartFieldsSchema = z.object({
  ownerId: z.uuid('ownerId deve ser um UUID válido'),
  createdBy: z.uuid('createdBy deve ser um UUID válido'),
  folderId: z.uuid('folderId deve ser um UUID válido').optional(),
  status: z.enum(['ativo', 'lixeira']).default('ativo'),
});

type MultipartFields = z.infer<typeof multipartFieldsSchema>;

interface FileUploadResult {
  success: boolean;
  file?: {
    id: string;
    name: string;
    type: string;
    size: string;
    checksum: string | null;
    storagePath: string;
    downloadUrl: string;
    folderId: string | null;
    ownerId: string;
    status: 'ativo' | 'lixeira';
    createdAt: string;
    createdBy: string;
  };
  error?: string;
}

type UploadTask = { filename: string; promise: Promise<UploadFileResult> };

export function createMultipleFiles(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/files/bulk',
    {
      schema: {
        description:
          'Upload de múltiplos arquivos com metadados usando multipart/form-data',
        tags: ['files'],
        consumes: ['multipart/form-data'],
        response: {
          200: z.object({
            success: z.boolean(),
            results: z.array(
              z.object({
                success: z.boolean(),
                file: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                    size: z.string(),
                    checksum: z.string().nullable(),
                    storagePath: z.string(),
                    downloadUrl: z.string(),
                    folderId: z.string().nullable(),
                    ownerId: z.string(),
                    status: z.enum(['ativo', 'lixeira']),
                    createdAt: z.string(),
                    createdBy: z.string(),
                  })
                  .optional(),
                error: z.string().optional(),
              })
            ),
            summary: z.object({
              total: z.number(),
              successful: z.number(),
              failed: z.number(),
            }),
          }),
          400: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
          500: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
    multipartUploadHandler
  );

  async function multipartUploadHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    logger.info('=== MULTIPART BULK UPLOAD INICIADO ===');

    try {
      // Verificar se é multipart
      if (!request.isMultipart()) {
        logger.error('Request não é multipart/form-data');
        return reply.status(400).send({
          success: false,
          error: 'Request deve ser multipart/form-data',
        });
      }

      const {
        data,
        tasks: uploadTasks,
        immediateErrors,
      } = await collectMultipartParts(request);

      if (uploadTasks.length === 0 && immediateErrors.length === 0) {
        logger.error('Nenhum arquivo foi encontrado no upload');
        return reply.status(400).send({
          success: false,
          error: 'Nenhum arquivo foi enviado',
        });
      }

      logger.info(
        `Total de arquivos para processar: ${uploadTasks.length} | erros imediatos: ${immediateErrors.length}`
      );

      // Validar campos uma única vez APÓS leitura de todas as partes
      const parsed = multipartFieldsSchema.safeParse(data);
      if (!parsed.success) {
        logger.error(
          'Falha na validação de campos. Limpando uploads concluídos...'
        );
        const settled = await Promise.allSettled(
          uploadTasks.map((t) => t.promise)
        );
        await cleanupUploadedFilesOnValidationFailure(settled);

        const validationErrors = parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');

        return reply.status(400).send({
          success: false,
          error: `Erro de validação: ${validationErrors}`,
        });
      }

      const validatedFields = parsed.data;

      // Aguarda conclusão dos uploads e persiste no banco (evitar await em loop)
      const settled = await Promise.allSettled(
        uploadTasks.map((t) => t.promise)
      );
      const persisted = await persistSettledUploads(
        settled,
        uploadTasks,
        validatedFields
      );
      const results: FileUploadResult[] = [...immediateErrors, ...persisted];

      // Calcular estatísticas
      const successful = results.filter(
        (r: FileUploadResult) => r.success
      ).length;
      const failed = results.length - successful;

      logger.info(
        `Upload em lote concluído - Sucessos: ${successful}, Falhas: ${failed}`
      );

      return reply.status(200).send({
        success: true,
        results,
        summary: {
          total: results.length,
          successful,
          failed,
        },
      });
    } catch (error) {
      return handleUploadError(error, reply);
    }
  }

  // Coleta partes do multipart e inicia uploads imediatamente
  async function collectMultipartParts(request: FastifyRequest): Promise<{
    data: Record<string, string>;
    tasks: UploadTask[];
    immediateErrors: FileUploadResult[];
  }> {
    const data: Record<string, string> = {};
    const tasks: UploadTask[] = [];
    const immediateErrors: FileUploadResult[] = [];
    let fileCount = 0;
    const MAX_CONCURRENT_UPLOADS = 3;
    const inflight = new Set<Promise<unknown>>();

    for await (const part of request.parts()) {
      if (part.type !== 'file') {
        handleFieldPart(part, data);
        continue;
      }

      const allowed = enforceFileCountLimit(part, fileCount, immediateErrors);
      if (!allowed) {
        continue;
      }

      const r = createUploadTaskFromPart(
        part,
        inflight,
        MAX_CONCURRENT_UPLOADS
      );
      if (r.error) {
        immediateErrors.push(r.error);
      }
      if (r.task) {
        tasks.push(r.task);
        fileCount++;
      }
    }

    return { data, tasks, immediateErrors };
  }

  function handleFieldPart(
    part: { fieldname: string; value: unknown },
    data: Record<string, string>
  ) {
    data[part.fieldname] = part.value as string;
  }

  function handleFilePart(part: MultipartFile): {
    task?: UploadTask;
    error?: FileUploadResult;
  } {
    if (!part.filename) {
      logger.warn('Arquivo sem nome detectado, ignorando...');
      return {};
    }

    logger.info(`Arquivo recebido: ${part.filename} (${part.mimetype})`);

    // Detecta truncamento (arquivo maior que limite configurado)
    type TruncatableStream = NodeJS.ReadableStream & { truncated?: boolean };
    const isTruncated = (part.file as TruncatableStream).truncated === true;
    if (isTruncated) {
      return {
        error: {
          success: false,
          error: `${part.filename}: Arquivo excedeu o limite de 10MB`,
        },
      };
    }

    try {
      validateFileType(part);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tipo inválido';
      return {
        error: { success: false, error: `${part.filename}: ${msg}` },
      };
    }

    const promise = uploadService.uploadFile(part).then((res) => {
      logger.info(`Upload concluído com sucesso: ${part.filename}`);
      return res;
    });
    return { task: { filename: part.filename, promise } };
  }

  function enforceFileCountLimit(
    part: MultipartFile,
    fileCount: number,
    immediateErrors: FileUploadResult[]
  ): boolean {
    if (fileCount < 10) {
      return true;
    }
    const name = part.filename ?? 'arquivo';
    immediateErrors.push({
      success: false,
      error: `${name}: Limite de 10 arquivos por requisição atingido`,
    });
    // Drenar o stream em background para não travar a pipeline
    (async () => {
      await drainStream(part.file);
    })();
    return false;
  }

  function createUploadTaskFromPart(
    part: MultipartFile,
    inflight: Set<Promise<unknown>>,
    maxConcurrent: number
  ): { task?: UploadTask; error?: FileUploadResult } {
    const res = handleFilePart(part);
    if (!res.task) {
      return res;
    }

    // Se já atingiu o limite, cria um gate que espera um inflight terminar antes de completar
    const original = res.task.promise;
    const gate =
      inflight.size >= maxConcurrent
        ? Promise.race(inflight)
        : Promise.resolve();
    const wrapped = gate
      .catch(() => {
        // ignore
      })
      .then(() => original)
      .then((v) => v)
      .finally(() => {
        inflight.delete(wrapped);
      });
    inflight.add(wrapped);
    return { task: { filename: res.task.filename, promise: wrapped } };
  }

  async function drainStream(stream: NodeJS.ReadableStream) {
    for await (const _chunk of stream) {
      // no-op
    }
  }

  async function cleanupUploadedFilesOnValidationFailure(
    settled: PromiseSettledResult<UploadFileResult>[]
  ) {
    const deletions = settled
      .filter(
        (s): s is PromiseFulfilledResult<UploadFileResult> =>
          s.status === 'fulfilled'
      )
      .map((s) =>
        uploadService
          .deleteFile(s.value.storagePath)
          .catch(() => logger.warn('Falha ao limpar arquivo após validação'))
      );
    await Promise.all(deletions);
  }

  async function persistSettledUploads(
    settled: PromiseSettledResult<UploadFileResult>[],
    uploadTasks: UploadTask[],
    validatedFields: MultipartFields
  ): Promise<FileUploadResult[]> {
    const savePromises = settled.map((s, idx) => {
      const filename = uploadTasks[idx]?.filename ?? 'arquivo';
      if (s.status === 'fulfilled') {
        return saveFileToDatabase(s.value, validatedFields)
          .then(
            (record) => ({ success: true, file: record }) as FileUploadResult
          )
          .catch(async (e) => {
            const msg =
              e instanceof Error ? e.message : 'Erro ao salvar no banco';
            await uploadService
              .deleteFile(s.value.storagePath)
              .catch(() =>
                logger.warn('Falha ao limpar arquivo após erro de BD')
              );
            return {
              success: false,
              error: `${filename}: ${msg}`,
            } as FileUploadResult;
          });
      }
      const reason = (s as PromiseRejectedResult).reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : String(reason ?? 'Falha no upload');
      return Promise.resolve({
        success: false,
        error: `${filename}: ${msg}`,
      } as FileUploadResult);
    });
    return await Promise.all(savePromises);
  }

  // Função para validar tipo de arquivo
  function validateFileType(file: MultipartFile) {
    if (!uploadService.validateFileType(file.mimetype, ALLOWED_FILE_TYPES)) {
      throw new Error(`Tipo de arquivo não suportado: ${file.mimetype}`);
    }
  }

  // Função para salvar no banco de dados
  async function saveFileToDatabase(
    uploadResult: UploadFileResult,
    validatedFields: MultipartFields
  ) {
    const result = await db
      .insert(files)
      .values({
        name: uploadResult.originalName,
        type: uploadResult.mimeType,
        size: BigInt(uploadResult.size),
        checksum: uploadResult.checksum,
        storagePath: uploadResult.storagePath,
        folderId: validatedFields.folderId || null,
        ownerId: validatedFields.ownerId,
        status: validatedFields.status,
        createdBy: validatedFields.createdBy,
      })
      .returning({
        id: files.id,
        name: files.name,
        type: files.type,
        size: files.size,
        checksum: files.checksum,
        storagePath: files.storagePath,
        folderId: files.folderId,
        ownerId: files.ownerId,
        status: files.status,
        createdAt: files.createdAt,
        createdBy: files.createdBy,
      });

    const fileRecord = {
      ...result[0],
      size: result[0].size.toString(),
      createdAt: result[0].createdAt.toISOString(),
      downloadUrl: `/files/${result[0].id}/download`,
    };

    return fileRecord;
  }

  // Função para tratar erros de upload
  function handleUploadError(error: unknown, reply: FastifyReply) {
    logger.error('=== ERRO NO UPLOAD EM LOTE ===');
    logger.error('Detalhes do erro:', error);

    // Handle Zod validation errors specifically
    if (error instanceof ZodError) {
      const validationErrors = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      logger.error(`Erro de validação Zod: ${validationErrors}`);
      return reply.status(400).send({
        success: false,
        error: `Erro de validação: ${validationErrors}`,
      });
    }

    const message =
      error instanceof Error ? error.message : 'Erro interno do servidor';

    logger.error(`Erro final: ${message}`);

    return reply.status(500).send({
      success: false,
      error: message,
    });
  }
}
