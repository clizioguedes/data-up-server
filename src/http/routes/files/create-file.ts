import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../../../db/connection.ts";
import { files } from "../../../db/schema/files.ts";

export async function createFile(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/files",
		{
			schema: {
				tags: ["files"],
				summary: "Criar novo arquivo",
				body: z.object({
					name: z.string().min(1),
					type: z.string().min(1),
					size: z.string(),
					storagePath: z.string().min(1),
					folderId: z.string().optional(),
					ownerId: z.string(),
					status: z.enum(["ativo", "lixeira"]),
					createdBy: z.string(),
				}),
				response: {
					201: z.object({
						file: z.object({
							id: z.string(),
							name: z.string(),
							type: z.string(),
							size: z.string(),
							storagePath: z.string(),
							folderId: z.string().nullable(),
							ownerId: z.string(),
							status: z.enum(["ativo", "lixeira"]),
							createdAt: z.string().datetime(),
							createdBy: z.string(),
						}),
					}),
					400: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const {
				name,
				type,
				size,
				storagePath,
				folderId,
				ownerId,
				status,
				createdBy,
			} = request.body;

			try {
				const result = await db
					.insert(files)
					.values({
						name,
						type,
						size: BigInt(size),
						storagePath,
						folderId: folderId || null,
						ownerId,
						status,
						createdBy,
					})
					.returning({
						id: files.id,
						name: files.name,
						type: files.type,
						size: files.size,
						storagePath: files.storagePath,
						folderId: files.folderId,
						ownerId: files.ownerId,
						status: files.status,
						createdAt: files.createdAt,
						createdBy: files.createdBy,
					});

				const file = {
					...result[0],
					size: result[0].size.toString(),
					createdAt: result[0].createdAt.toISOString(),
				};

				return reply.status(201).send({ file });
			} catch {
				return reply.status(400).send({ message: "Erro ao criar arquivo" });
			}
		},
	);
}
