import { count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { folders } from '../../../db/schema/folders.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createPaginatedResponse,
  paginatedResponseSchema,
  paginationQuerySchema,
} from '../../../types/api-response.ts';

export function getFolders(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/folders',
    {
      schema: {
        tags: ['folders'],
        summary: 'Listar todas as pastas com paginação',
        querystring: paginationQuerySchema.extend({
          parentId: z.string().optional(),
        }),
        response: {
          200: paginatedResponseSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              parentId: z.string().nullable(),
              createdAt: z.string().datetime(),
              createdBy: z.string(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const { page, limit, parentId } = request.query;

      const whereClause = parentId ? eq(folders.parentId, parentId) : undefined;

      // Contar total de registros
      const [totalResult] = await db
        .select({ count: count() })
        .from(folders)
        .where(whereClause);

      const total = totalResult.count;
      const offset = calculateOffset(page, limit);

      // Buscar dados paginados
      const result = await db
        .select({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
          createdBy: folders.createdBy,
        })
        .from(folders)
        .where(whereClause)
        .limit(limit)
        .offset(offset);

      const formattedFolders = result.map((folder) => ({
        ...folder,
        createdAt: folder.createdAt.toISOString(),
      }));

      const meta = calculatePaginationMeta(page, limit, total);
      const response = createPaginatedResponse(formattedFolders, meta);

      return reply.send(response);
    }
  );
}
