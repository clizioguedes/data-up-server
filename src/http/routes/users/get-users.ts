import { count } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { users } from '../../../db/schema/users.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createPaginatedResponse,
  paginatedResponseSchema,
  paginationQuerySchema,
} from '../../../types/api-response.ts';

export function getUsers(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Listar todos os usuários com paginação',
        querystring: paginationQuerySchema,
        response: {
          200: paginatedResponseSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
              role: z.enum(['admin', 'colaborador', 'visualizador']),
              createdAt: z.string().datetime(),
              updatedAt: z.string().datetime(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const { page, limit } = request.query;

      // Contar total de registros
      const [totalResult] = await db.select({ count: count() }).from(users);

      const total = totalResult.count;
      const offset = calculateOffset(page, limit);

      // Buscar dados paginados
      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .limit(limit)
        .offset(offset);

      const formattedUsers = result.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }));

      const meta = calculatePaginationMeta(page, limit, total);
      const response = createPaginatedResponse(formattedUsers, meta);

      return reply.send(response);
    }
  );
}
