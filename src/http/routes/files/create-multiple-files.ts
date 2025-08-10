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

      const data: Record<string, string> = {};
      const uploadedFiles: MultipartFile[] = [];

      // Processar partes do multipart
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (!part.filename) {
            logger.warn('Arquivo sem nome detectado, ignorando...');
            continue;
          }

          logger.info(`Arquivo recebido: ${part.filename} (${part.mimetype})`);
          uploadedFiles.push(part);
        } else {
          // Campo de formulário
          data[part.fieldname] = part.value as string;
        }
      }

      if (uploadedFiles.length === 0) {
        logger.error('Nenhum arquivo foi encontrado no upload');
        return reply.status(400).send({
          success: false,
          error: 'Nenhum arquivo foi enviado',
        });
      }

      logger.info(`Total de arquivos para processar: ${uploadedFiles.length}`);

      // Validar campos uma única vez
      const validatedFields = multipartFieldsSchema.parse(data);

      // Processar todos os arquivos em paralelo (com limite de concorrência)
      const results = await processFilesInBatches(
        uploadedFiles,
        validatedFields
      );

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

  // Função para processar arquivos em lotes com controle de concorrência
  function processFilesInBatches(
    uploadedFiles: MultipartFile[],
    validatedFields: MultipartFields
  ): Promise<FileUploadResult[]> {
    // Processar arquivos com controle de concorrência limitada
    const processFile = async (
      file: MultipartFile
    ): Promise<FileUploadResult> => {
      try {
        const result = await processFileUpload(file, validatedFields);
        logger.info(`Upload concluído com sucesso: ${file.filename}`);
        return {
          success: true,
          file: result,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error(`Erro no upload de ${file.filename}:`, error);
        return {
          success: false,
          error: `${file.filename}: ${errorMessage}`,
        };
      }
    };

    // Processar todos os arquivos com Promise.all para paralelização controlada
    return Promise.all(uploadedFiles.map(processFile));
  }

  // Função auxiliar para processar upload de um arquivo
  async function processFileUpload(
    file: MultipartFile,
    validatedFields: MultipartFields
  ) {
    // Validar tipo de arquivo
    validateFileType(file);

    // Fazer upload do arquivo
    const uploadResult = await uploadService.uploadFile(file);

    // Salvar no banco de dados
    const result = await saveFileToDatabase(uploadResult, validatedFields);

    return result;
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
