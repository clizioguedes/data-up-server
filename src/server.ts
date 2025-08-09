import { fastifyCors } from "@fastify/cors";
import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./env.ts";
import {
	createFile,
	deleteFile,
	getFileById,
	getFiles,
	moveFileToTrash,
	restoreFile,
	updateFile,
} from "./http/routes/files/index.ts";
import {
	createFolder,
	deleteFolder,
	getFolderById,
	getFolders,
	updateFolder,
} from "./http/routes/folders/index.ts";
import {
	createLog,
	deleteLog,
	getLogById,
	getLogs,
	getLogsByUser,
} from "./http/routes/logs/index.ts";
// Import routes
import {
	createUser,
	deleteUser,
	getUserById,
	getUsers,
	updateUser,
} from "./http/routes/users/index.ts";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.register(fastifyCors, {
	origin: "*",
});

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.get("/health", async () => {
	return { status: "ok" };
});

// Register user routes
app.register(getUsers);
app.register(getUserById);
app.register(createUser);
app.register(updateUser);
app.register(deleteUser);

// Register folder routes
app.register(getFolders);
app.register(getFolderById);
app.register(createFolder);
app.register(updateFolder);
app.register(deleteFolder);

// Register file routes
app.register(getFiles);
app.register(getFileById);
app.register(createFile);
app.register(updateFile);
app.register(deleteFile);
app.register(moveFileToTrash);
app.register(restoreFile);

// Register log routes
app.register(getLogs);
app.register(getLogById);
app.register(createLog);
app.register(deleteLog);
app.register(getLogsByUser);

app.listen({ port: env.PORT });
