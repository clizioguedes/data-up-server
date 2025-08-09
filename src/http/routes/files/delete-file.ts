import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';

export function deleteFile(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/files/:id',
    {
      schema: {
        tags: ['files'],
        summary: 'Deletar arquivo',
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.object({}),
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await db.delete(files).where(eq(files.id, id)).returning({
        id: files.id,
      });

      if (result.length === 0) {
        return reply.status(404).send({ message: 'Arquivo não encontrado' });
      }

      return reply.status(204).send();
    }
  );
}
