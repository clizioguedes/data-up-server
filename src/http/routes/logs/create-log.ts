import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { logs } from '../../../db/schema/logs.ts';

export function createLog(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/logs',
    {
      schema: {
        tags: ['logs'],
        summary: 'Criar novo log',
        body: z.object({
          userId: z.string(),
          fileId: z.string().optional(),
          folderId: z.string().optional(),
          actionType: z.enum([
            'upload',
            'download',
            'view',
            'delete',
            'restore',
            'create_folder',
          ]),
        }),
        response: {
          201: z.object({
            log: z.object({
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
            }),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { userId, fileId, folderId, actionType } = request.body;

      try {
        const result = await db
          .insert(logs)
          .values({
            userId,
            fileId: fileId || null,
            folderId: folderId || null,
            actionType,
          })
          .returning({
            id: logs.id,
            userId: logs.userId,
            fileId: logs.fileId,
            folderId: logs.folderId,
            actionType: logs.actionType,
            timestamp: logs.timestamp,
          });

        const log = {
          ...result[0],
          timestamp: result[0].timestamp.toISOString(),
        };

        return reply.status(201).send({ log });
      } catch {
        return reply.status(400).send({ message: 'Erro ao criar log' });
      }
    }
  );
}
