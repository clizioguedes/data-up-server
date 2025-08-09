import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { logs } from "../../../db/schema/logs.ts";

export async function getLogById(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/logs/:id",
		{
			schema: {
				tags: ["logs"],
				summary: "Buscar log por ID",
				params: z.object({
					id: z.string(),
				}),
				response: {
					200: z.object({
						log: z.object({
							id: z.string(),
							userId: z.string(),
							fileId: z.string().nullable(),
							folderId: z.string().nullable(),
							actionType: z.enum([
								"upload",
								"download",
								"view",
								"delete",
								"restore",
								"create_folder",
							]),
							timestamp: z.string().datetime(),
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
					id: logs.id,
					userId: logs.userId,
					fileId: logs.fileId,
					folderId: logs.folderId,
					actionType: logs.actionType,
					timestamp: logs.timestamp,
				})
				.from(logs)
				.where(eq(logs.id, id));

			if (result.length === 0) {
				return reply.status(404).send({ message: "Log não encontrado" });
			}

			const log = {
				...result[0],
				timestamp: result[0].timestamp.toISOString(),
			};

			return reply.send({ log });
		},
	);
}
