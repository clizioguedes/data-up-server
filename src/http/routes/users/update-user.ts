import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { users } from '../../../db/schema/users.ts';

export function updateUser(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Atualizar usuário',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          passwordHash: z.string().min(6).optional(),
          role: z.enum(['admin', 'colaborador', 'visualizador']).optional(),
        }),
        response: {
          200: z.object({
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
              role: z.enum(['admin', 'colaborador', 'visualizador']),
              createdAt: z.string().datetime(),
              updatedAt: z.string().datetime(),
            }),
          }),
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updateData = request.body;

      const result = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (result.length === 0) {
        return reply.status(404).send({ message: 'Usuário não encontrado' });
      }

      const user = {
        ...result[0],
        createdAt: result[0].createdAt.toISOString(),
        updatedAt: result[0].updatedAt.toISOString(),
      };

      return reply.send({ user });
    }
  );
}
