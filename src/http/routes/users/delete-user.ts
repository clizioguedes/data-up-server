import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { users } from "../../../db/schema/users.ts";

export async function deleteUser(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().delete(
		"/users/:id",
		{
			schema: {
				tags: ["users"],
				summary: "Deletar usuário",
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

			const result = await db.delete(users).where(eq(users.id, id)).returning({
				id: users.id,
			});

			if (result.length === 0) {
				return reply.status(404).send({ message: "Usuário não encontrado" });
			}

			return reply.status(204).send();
		},
	);
}
