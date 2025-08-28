import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { folders } from '../../../db/schema/folders.ts';
import {
  createApiCreatedResponse,
  createErrorResponseSchema,
  createNotFoundResponse,
  createSuccessResponseSchema,
} from '../../../types/api-response.ts';

export function getFolderById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/folders/:id',
    {
      schema: {
        tags: ['folders'],
        summary: 'Buscar pasta por ID',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: createSuccessResponseSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              parentId: z.string().nullable(),
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
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
          createdBy: folders.createdBy,
        })
        .from(folders)
        .where(eq(folders.id, id));

      if (result.length === 0) {
        return reply
          .status(404)
          .send(createNotFoundResponse('Pasta não encontrada'));
      }

      const folder = {
        ...result[0],
        createdAt: result[0].createdAt.toISOString(),
      };

      return reply.send(createApiCreatedResponse(folder, 'Pasta encontrada'));
    }
  );
}
