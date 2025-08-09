import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { logs } from "../../../db/schema/logs.ts";

export async function deleteLog(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().delete(
		"/logs/:id",
		{
			schema: {
				tags: ["logs"],
				summary: "Deletar log",
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

			const result = await db.delete(logs).where(eq(logs.id, id)).returning({
				id: logs.id,
			});

			if (result.length === 0) {
				return reply.status(404).send({ message: "Log não encontrado" });
			}

			return reply.status(204).send();
		},
	);
}
