import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { files } from "../../../db/schema/files.ts";

export async function restoreFile(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().patch(
		"/files/:id/restore",
		{
			schema: {
				tags: ["files"],
				summary: "Restaurar arquivo da lixeira",
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
					status: "ativo",
				})
				.where(eq(files.id, id))
				.returning({
					id: files.id,
				});

			if (result.length === 0) {
				return reply.status(404).send({ message: "Arquivo não encontrado" });
			}

			return reply.send({ message: "Arquivo restaurado com sucesso" });
		},
	);
}
