import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { folders } from '../../../db/schema/folders.ts';
import {
  createApiSuccessResponse,
  createErrorResponseSchema,
  createNotFoundResponse,
} from '../../../types/api-response.ts';

export function deleteFolder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/folders/:id',
    {
      schema: {
        tags: ['folders'],
        summary: 'Deletar pasta',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: createApiSuccessResponse(null, 'Pasta deletada com sucesso'),
          404: createErrorResponseSchema(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await db
        .delete(folders)
        .where(eq(folders.id, id))
        .returning({
          id: folders.id,
        });

      if (result.length === 0) {
        return reply
          .status(404)
          .send(createNotFoundResponse('Pasta não encontrada'));
      }

      return reply.send(
        createApiSuccessResponse(null, 'Pasta deletada com sucesso')
      );
    }
  );
}
