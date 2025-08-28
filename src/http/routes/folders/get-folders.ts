import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { folders } from '../../../db/schema/folders.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createPaginatedResponse,
  createPaginatedResponseSchema,
  paginationQuerySchema,
} from '../../../types/api-response.ts';

export function getFolders(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/folders',
    {
      schema: {
        tags: ['folders'],
        summary: 'Listar todas as pastas com paginação e busca',
        querystring: paginationQuerySchema.extend({
          parentId: z.string().optional(),
          query: z.string().optional().describe('Buscar por nome da pasta'),
          sortBy: z
            .enum(['name', 'createdAt'])
            .optional()
            .default('createdAt')
            .describe('Campo para ordenação'),
          sortOrder: z
            .enum(['asc', 'desc'])
            .optional()
            .default('desc')
            .describe('Direção da ordenação'),
        }),
        response: {
          200: createPaginatedResponseSchema(
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
      const { page, limit, parentId, query, sortBy, sortOrder } = request.query;

      const conditions: Parameters<typeof and> = [];

      if (parentId) {
        conditions.push(eq(folders.parentId, parentId));
      }

      if (query) {
        // Buscar no nome da pasta usando ilike (case-insensitive)
        const searchTerm = `%${query}%`;
        conditions.push(ilike(folders.name, searchTerm));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Configurar ordenação
      const orderByColumn =
        sortBy === 'name' ? folders.name : folders.createdAt;
      const orderByDirection = sortOrder === 'asc' ? asc : desc;

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
        .orderBy(orderByDirection(orderByColumn))
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
