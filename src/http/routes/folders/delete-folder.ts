import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { folders } from "../../../db/schema/folders.ts";

export async function deleteFolder(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().delete(
		"/folders/:id",
		{
			schema: {
				tags: ["folders"],
				summary: "Deletar pasta",
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

			const result = await db
				.delete(folders)
				.where(eq(folders.id, id))
				.returning({
					id: folders.id,
				});

			if (result.length === 0) {
				return reply.status(404).send({ message: "Pasta não encontrada" });
			}

			return reply.status(204).send();
		},
	);
}
