import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { users } from "../../../db/schema/users.ts";

export async function getUserById(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/users/:id",
		{
			schema: {
				tags: ["users"],
				summary: "Buscar usuário por ID",
				params: z.object({
					id: z.string(),
				}),
				response: {
					200: z.object({
						user: z.object({
							id: z.string(),
							name: z.string(),
							email: z.string().email(),
							role: z.enum(["admin", "colaborador", "visualizador"]),
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
				.where(eq(users.id, id));

			if (result.length === 0) {
				return reply.status(404).send({ message: "Usuário não encontrado" });
			}

			const user = {
				...result[0],
				createdAt: result[0].createdAt.toISOString(),
				updatedAt: result[0].updatedAt.toISOString(),
			};

			return reply.send({ user });
		},
	);
}
