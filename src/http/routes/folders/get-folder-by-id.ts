import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { folders } from "../../../db/schema/folders.ts";

export async function getFolderById(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/folders/:id",
		{
			schema: {
				tags: ["folders"],
				summary: "Buscar pasta por ID",
				params: z.object({
					id: z.string(),
				}),
				response: {
					200: z.object({
						folder: z.object({
							id: z.string(),
							name: z.string(),
							parentId: z.string().nullable(),
							createdAt: z.string().datetime(),
							createdBy: z.string(),
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
					id: folders.id,
					name: folders.name,
					parentId: folders.parentId,
					createdAt: folders.createdAt,
					createdBy: folders.createdBy,
				})
				.from(folders)
				.where(eq(folders.id, id));

			if (result.length === 0) {
				return reply.status(404).send({ message: "Pasta não encontrada" });
			}

			const folder = {
				...result[0],
				createdAt: result[0].createdAt.toISOString(),
			};

			return reply.send({ folder });
		},
	);
}
