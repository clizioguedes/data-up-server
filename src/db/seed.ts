import { reset, seed } from "drizzle-seed";
import { db, sql } from "./connection.ts";
import { schema } from "./schema/index.ts";

await reset(db, schema);

await seed(db, schema).refine((f) => {
	return {
		folders: {
			count: 20,
			columns: {
				id: f.uuid(),
				name: f.companyName(),
				parentId: f.uuid(),
				createdAt: f.timestamp(),
				createdBy: f.uuid(),
			},
		},
		files: {
			count: 100,
			columns: {
				id: f.uuid(),
				name: f.jobTitle(),
				type: f.string(),
				size: f.int({ minValue: 100, maxValue: 10000 }),
				storagePath: f.string(),
				ownerId: f.uuid(),
				status: f.valuesFromArray({ values: ["ativo", "lixeira"] }),
				folderId: f.uuid(),
				createdAt: f.timestamp(),
				createdBy: f.uuid(),
			},
		},
		users: {
			count: 10,
			columns: {
				id: f.uuid(),
				name: f.fullName(),
				email: f.email(),
				passwordHash: f.string(),
				role: f.valuesFromArray({
					values: ["admin", "colaborador", "visualizador"],
				}),
				createdAt: f.timestamp(),
			},
		},
		logs: {
			count: 100,
			columns: {
				id: f.uuid(),
				action: f.string(),
				fileId: f.uuid(),
				folderId: f.uuid(),
				actionType: f.valuesFromArray({
					values: [
						"upload",
						"download",
						"view",
						"delete",
						"restore",
						"create_folder",
					],
				}),
				userId: f.uuid(),
				timestamp: f.timestamp(),
			},
		},
	};
});

await sql.end();

console.log("Database reset and seeded successfully.");
