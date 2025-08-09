import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { users } from '../../../db/schema/users.ts';

export function createUser(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Criar novo usuário',
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
          passwordHash: z.string().min(6),
          role: z.enum(['admin', 'colaborador', 'visualizador']),
        }),
        response: {
          201: z.object({
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
              role: z.enum(['admin', 'colaborador', 'visualizador']),
              createdAt: z.string().datetime(),
              updatedAt: z.string().datetime(),
            }),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, email, passwordHash, role } = request.body;

      try {
        const result = await db
          .insert(users)
          .values({
            name,
            email,
            passwordHash,
            role,
          })
          .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          });

        const user = {
          ...result[0],
          createdAt: result[0].createdAt.toISOString(),
          updatedAt: result[0].updatedAt.toISOString(),
        };

        return reply.status(201).send({ user });
      } catch {
        return reply.status(400).send({ message: 'Erro ao criar usuário' });
      }
    }
  );
}
