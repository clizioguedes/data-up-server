import { and, count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { logs } from '../../../db/schema/logs.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createPaginatedResponse,
  paginatedResponseSchema,
  paginationQuerySchema,
} from '../../types/api-response.ts';

export function getLogs(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/logs',
    {
      schema: {
        tags: ['logs'],
        summary: 'Listar todos os logs com paginação',
        querystring: paginationQuerySchema.extend({
          userId: z.string().optional(),
          fileId: z.string().optional(),
          folderId: z.string().optional(),
          actionType: z
            .enum([
              'upload',
              'download',
              'view',
              'delete',
              'restore',
              'create_folder',
            ])
            .optional(),
        }),
        response: {
          200: paginatedResponseSchema(
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
      const { page, limit, userId, fileId, folderId, actionType } =
        request.query;

      const conditions: Parameters<typeof and> = [];

      if (userId) {
        conditions.push(eq(logs.userId, userId));
      }
      if (fileId) {
        conditions.push(eq(logs.fileId, fileId));
      }
      if (folderId) {
        conditions.push(eq(logs.folderId, folderId));
      }
      if (actionType) {
        conditions.push(eq(logs.actionType, actionType));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

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
      const response = createPaginatedResponse(formattedLogs, meta);

      return reply.send(response);
    }
  );
}
