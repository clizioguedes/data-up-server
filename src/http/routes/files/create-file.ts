import type { MultipartFile } from '@fastify/multipart';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ZodError, z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import {
  FileUploadService,
  type UploadFileResult,
} from '../../../services/file-upload.service.ts';
import { logger } from '../../../utils/logger.ts';

const uploadService = new FileUploadService();

// Schema de validação para os campos do formulário
const multipartFieldsSchema = z.object({
  ownerId: z.string().uuid('ownerId deve ser um UUID válido'),
  createdBy: z.string().uuid('createdBy deve ser um UUID válido'),
  folderId: z.string().uuid('folderId deve ser um UUID válido').optional(),
  status: z.enum(['ativo', 'lixeira']).default('ativo'),
});

type MultipartFields = z.infer<typeof multipartFieldsSchema>;

// Tipos de arquivos permitidos para upload
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/html',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function createFile(app: FastifyInstance) {
  // Abordagem 1: Upload padrão com multipart/form-data
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

  // Abordagem 2: Upload direto de arquivo (binary)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/files/binary',
    {
      schema: {
        description: 'Upload direto de arquivo como binary',
        tags: ['files'],
        consumes: ['application/octet-stream'],
        headers: z.object({
          'content-type': z.literal('application/octet-stream'),
          'x-filename': z.string(),
          'x-owner-id': z.string().uuid(),
          'x-created-by': z.string().uuid(),
          'x-folder-id': z.string().uuid().optional(),
        }),
        response: {
          201: z.object({
            success: z.boolean(),
            file: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              size: z.string(),
              downloadUrl: z.string(),
            }),
          }),
        },
      },
    },
    binaryUploadHandler
  );

  // Abordagem 3: Upload com Base64 (para casos especiais)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/files/base64',
    {
      schema: {
        description: 'Upload de arquivo codificado em Base64',
        tags: ['files'],
        body: z.object({
          fileName: z.string(),
          mimeType: z.string(),
          fileData: z.string(), // Base64 encoded
          ownerId: z.string().uuid(),
          createdBy: z.string().uuid(),
          folderId: z.string().uuid().optional(),
        }),
        response: {
          201: z.object({
            success: z.boolean(),
            file: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              size: z.string(),
              downloadUrl: z.string(),
            }),
          }),
        },
      },
    },
    base64UploadHandler
  );
}

// ABORDAGEM 1: Multipart/form-data (Recomendada)
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

// ABORDAGEM 2: Binary upload
async function binaryUploadHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  logger.info('=== BINARY UPLOAD INICIADO ===');

  try {
    const headers = request.headers as {
      'x-filename': string;
      'x-owner-id': string;
      'x-created-by': string;
      'x-folder-id'?: string;
    };

    // Simular MultipartFile para compatibilidade
    const fakeFile = {
      filename: headers['x-filename'],
      mimetype: 'application/octet-stream',
      file: request.raw,
      type: 'file' as const,
      fieldname: 'file',
      encoding: 'binary',
      fields: {},
      toBuffer: async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of request.raw) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      },
    } as unknown as MultipartFile;

    const data = {
      ownerId: headers['x-owner-id'],
      createdBy: headers['x-created-by'],
      folderId: headers['x-folder-id'] || '',
      status: 'ativo',
    };

    const result = await processFileUpload(fakeFile, data);

    return reply.status(201).send({
      success: true,
      file: {
        id: result.id,
        name: result.name,
        type: result.type,
        size: result.size,
        downloadUrl: result.downloadUrl,
      },
    });
  } catch (error) {
    return handleUploadError(error, reply);
  }
}

// ABORDAGEM 3: Base64 upload
async function base64UploadHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  logger.info('=== BASE64 UPLOAD INICIADO ===');

  try {
    const body = request.body as {
      fileName: string;
      mimeType: string;
      fileData: string;
      ownerId: string;
      createdBy: string;
      folderId?: string;
    };

    // Converter Base64 para Buffer e criar stream
    const buffer = Buffer.from(body.fileData, 'base64');
    const { Readable } = await import('node:stream');
    const stream = Readable.from(buffer);

    // Simular MultipartFile
    const fakeFile = {
      filename: body.fileName,
      mimetype: body.mimeType,
      file: stream,
    } as MultipartFile;

    const data = {
      ownerId: body.ownerId,
      createdBy: body.createdBy,
      folderId: body.folderId || '',
      status: 'ativo',
    };

    const result = await processFileUpload(fakeFile, data);

    return reply.status(201).send({
      success: true,
      file: {
        id: result.id,
        name: result.name,
        type: result.type,
        size: result.size,
        downloadUrl: result.downloadUrl,
      },
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
export function isValidationError(error: unknown): boolean {
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
