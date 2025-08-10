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

export function createFile(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/files',
    {
      schema: {
        description:
          'Upload de arquivo com metadados usando multipart/form-data',
        tags: ['files'],
        consumes: ['multipart/form-data'],
        response: {
          201: z.object({
            success: z.boolean(),
            file: z.object({
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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: true
  async function multipartUploadHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    logger.info('=== MULTIPART UPLOAD INICIADO ===');

    try {
      // Verificar se é multipart
      if (!request.isMultipart()) {
        return reply.status(400).send({
          success: false,
          error: 'Request deve ser multipart/form-data',
        });
      }

      const data: Record<string, string> = {};
      let file: MultipartFile | null = null;

      // Processar partes do multipart usando for await (abordagem recomendada)
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (file) {
            return reply.status(400).send({
              success: false,
              error: 'Apenas um arquivo por upload é permitido',
            });
          }

          if (!part.filename) {
            return reply.status(400).send({
              success: false,
              error: 'Nome do arquivo é obrigatório',
            });
          }

          logger.info(`Arquivo recebido: ${part.filename} (${part.mimetype})`);
          file = part;
        } else {
          // Campo de formulário
          data[part.fieldname] = part.value as string;
        }
      }

      if (!file) {
        return reply.status(400).send({
          success: false,
          error: 'Arquivo não foi enviado',
        });
      }

      // Validar e processar
      const result = await processFileUpload(file, data);

      logger.info(`Upload concluído com sucesso: ${result.id}`);

      return reply.status(201).send({
        success: true,
        file: result,
      });
    } catch (error) {
      return handleUploadError(error, reply);
    }
  }

  // Função auxiliar para processar upload (comum para todas as abordagens)
  async function processFileUpload(
    file: MultipartFile,
    data: Record<string, string>
  ) {
    // Validar campos obrigatórios
    const validatedFields = multipartFieldsSchema.parse(data);

    // Validar tipo de arquivo
    validateFileType(file);

    // Fazer upload do arquivo
    logger.info(`Iniciando upload: ${file.filename}`);
    const uploadResult = await uploadService.uploadFile(file);

    // Salvar no banco de dados
    return await saveFileToDatabase(uploadResult, validatedFields);
  }

  // Função para validar tipo de arquivo
  function validateFileType(file: MultipartFile) {
    if (!uploadService.validateFileType(file.mimetype, ALLOWED_FILE_TYPES)) {
      throw new Error(`Tipo de arquivo não suportado: ${file.mimetype}`);
    }

    logger.info(`Tipo de arquivo validado: ${file.mimetype}`);
  }

  // Função para salvar no banco de dados
  async function saveFileToDatabase(
    uploadResult: UploadFileResult,
    validatedFields: MultipartFields
  ) {
    logger.info('Salvando arquivo no banco de dados...');

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
    logger.error('Erro no upload:', error);

    // Handle Zod validation errors specifically
    if (error instanceof ZodError) {
      const validationErrors = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      return reply.status(400).send({
        success: false,
        error: `Erro de validação: ${validationErrors}`,
      });
    }

    const message =
      error instanceof Error ? error.message : 'Erro interno do servidor';
    const statusCode = isValidationError(error) ? 400 : 500;

    return reply.status(statusCode).send({
      success: false,
      error: message,
    });
  }

  // Função para verificar se é erro de validação
  function isValidationError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('obrigatório') ||
        message.includes('faltando') ||
        message.includes('não suportado') ||
        message.includes('não foi enviado') ||
        message.includes('uuid') ||
        message.includes('invalid')
      );
    }
    return false;
  }
}
