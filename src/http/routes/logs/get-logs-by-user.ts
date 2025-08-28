import { count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { logs } from '../../../db/schema/logs.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createApiPaginatedResponse,
  createPaginatedResponseSchema,
  paginationQuerySchema,
} from '../../../types/api-response.ts';

export function getLogsByUser(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/users/:userId/logs',
    {
      schema: {
        tags: ['logs'],
        summary: 'Listar logs de um usuário específico com paginação',
        params: z.object({
          userId: z.string(),
        }),
        querystring: paginationQuerySchema,
        response: {
          200: createPaginatedResponseSchema(
            z.object({
              id: z.string(),
              userId: z.string(),
              fileId: z.string().nullable(),
              folderId: z.string().nullable(),
              actionType: z.enum([
                'upload',
                'download',
                'view',
                'delete',
                'restore',
                'create_folder',
              ]),
              timestamp: z.string().datetime(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { page, limit } = request.query;

      const whereClause = eq(logs.userId, userId);

      // Contar total de registros
      const [totalResult] = await db
        .select({ count: count() })
        .from(logs)
        .where(whereClause);

      const total = totalResult.count;
      const offset = calculateOffset(page, limit);

      // Buscar dados paginados
      const result = await db
        .select({
          id: logs.id,
          userId: logs.userId,
          fileId: logs.fileId,
          folderId: logs.folderId,
          actionType: logs.actionType,
          timestamp: logs.timestamp,
        })
        .from(logs)
        .where(whereClause)
        .limit(limit)
        .offset(offset);

      const formattedLogs = result.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      }));

      const meta = calculatePaginationMeta(page, limit, total);
      const response = createApiPaginatedResponse(formattedLogs, meta);

      return reply.send(response);
    }
  );
}
