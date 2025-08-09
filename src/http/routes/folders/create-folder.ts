import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { folders } from '../../../db/schema/folders.ts';

export function createFolder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/folders',
    {
      schema: {
        tags: ['folders'],
        summary: 'Criar nova pasta',
        body: z.object({
          name: z.string().min(1),
          parentId: z.string().optional(),
          createdBy: z.string(),
        }),
        response: {
          201: z.object({
            folder: z.object({
              id: z.string(),
              name: z.string(),
              parentId: z.string().nullable(),
              createdAt: z.string().datetime(),
              createdBy: z.string(),
            }),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, parentId, createdBy } = request.body;

      try {
        const result = await db
          .insert(folders)
          .values({
            name,
            parentId: parentId || null,
            createdBy,
          })
          .returning({
            id: folders.id,
            name: folders.name,
            parentId: folders.parentId,
            createdAt: folders.createdAt,
            createdBy: folders.createdBy,
          });

        const folder = {
          ...result[0],
          createdAt: result[0].createdAt.toISOString(),
        };

        return reply.status(201).send({ folder });
      } catch {
        return reply.status(400).send({ message: 'Erro ao criar pasta' });
      }
    }
  );
}
