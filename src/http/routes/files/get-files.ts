import { and, count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createPaginatedResponse,
  paginatedResponseSchema,
  paginationQuerySchema,
} from '../../types/api-response.ts';

export function getFiles(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/files',
    {
      schema: {
        tags: ['files'],
        summary: 'Listar todos os arquivos com paginação',
        querystring: paginationQuerySchema.extend({
          folderId: z.string().optional(),
          status: z.enum(['ativo', 'lixeira']).optional(),
        }),
        response: {
          200: paginatedResponseSchema(
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
        },
      },
    },
    async (request, reply) => {
      const { page, limit, folderId, status } = request.query;

      const conditions: Parameters<typeof and> = [];

      if (folderId) {
        conditions.push(eq(files.folderId, folderId));
      }
      if (status) {
        conditions.push(eq(files.status, status));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Contar total de registros
      const [totalResult] = await db
        .select({ count: count() })
        .from(files)
        .where(whereClause);

      const total = totalResult.count;
      const offset = calculateOffset(page, limit);

      // Buscar dados paginados
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
        .where(whereClause)
        .limit(limit)
        .offset(offset);

      const formattedFiles = result.map((file) => ({
        ...file,
        size: file.size.toString(),
        createdAt: file.createdAt.toISOString(),
      }));

      const meta = calculatePaginationMeta(page, limit, total);
      const response = createPaginatedResponse(formattedFiles, meta);

      return reply.send(response);
    }
  );
}
