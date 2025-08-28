import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import {
  createApiSuccessResponse,
  createErrorResponseSchema,
  createNotFoundResponse,
  createSuccessResponseSchema,
  HTTP_STATUS,
} from '../../../types/api-response.ts';

export function getFileById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/files/:id',
    {
      schema: {
        tags: ['files'],
        summary: 'Buscar arquivo por ID',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: createSuccessResponseSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              size: z.string(),
              storagePath: z.string(),
              folderId: z.string().nullable(),
              ownerId: z.string(),
              status: z.enum(['ativo', 'lixeira']),
              createdAt: z.string().datetime(),
              createdBy: z.string(),
            })
          ),
          404: createErrorResponseSchema(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await db
        .select({
          id: files.id,
          name: files.name,
          type: files.type,
          size: files.size,
          storagePath: files.storagePath,
          folderId: files.folderId,
          ownerId: files.ownerId,
          status: files.status,
          createdAt: files.createdAt,
          createdBy: files.createdBy,
        })
        .from(files)
        .where(eq(files.id, id));

      if (result.length === 0) {
        const errorResponse = createNotFoundResponse('Arquivo não encontrado');
        return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse);
      }

      const file = {
        ...result[0],
        size: result[0].size.toString(),
        createdAt: result[0].createdAt.toISOString(),
      };

      const response = createApiSuccessResponse(file, 'Arquivo encontrado');
      return reply.status(HTTP_STATUS.OK).send(response);
    }
  );
}
