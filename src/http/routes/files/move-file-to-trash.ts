import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';

export function moveFileToTrash(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/files/:id/trash',
    {
      schema: {
        tags: ['files'],
        summary: 'Mover arquivo para a lixeira',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await db
        .update(files)
        .set({
          status: 'lixeira',
        })
        .where(eq(files.id, id))
        .returning({
          id: files.id,
        });

      if (result.length === 0) {
        return reply.status(404).send({ message: 'Arquivo não encontrado' });
      }

      return reply.send({ message: 'Arquivo movido para a lixeira' });
    }
  );
}
