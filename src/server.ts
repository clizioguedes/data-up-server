import { fastifyCors } from '@fastify/cors';
import { fastify } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env.ts';
import {
  createFile,
  deleteFile,
  getFileById,
  getFiles,
  moveFileToTrash,
  restoreFile,
  updateFile,
} from './http/routes/files/index.ts';
import {
  createFolder,
  deleteFolder,
  getFolderById,
  getFolders,
  updateFolder,
} from './http/routes/folders/index.ts';
import {
  createLog,
  deleteLog,
  getLogById,
  getLogs,
  getLogsByUser,
} from './http/routes/logs/index.ts';
// Import routes
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  updateUser,
} from './http/routes/users/index.ts';

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.register(fastifyCors, {
  origin: '*',
});

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.get('/health', () => {
  return { status: 'ok' };
});

// Register API v1 routes with prefix
app.register(
  (fastifyInstance) => {
    // Register user routes
    fastifyInstance.register(getUsers);
    fastifyInstance.register(getUserById);
    fastifyInstance.register(createUser);
    fastifyInstance.register(updateUser);
    fastifyInstance.register(deleteUser);

    // Register folder routes
    fastifyInstance.register(getFolders);
    fastifyInstance.register(getFolderById);
    fastifyInstance.register(createFolder);
    fastifyInstance.register(updateFolder);
    fastifyInstance.register(deleteFolder);

    // Register file routes
    fastifyInstance.register(getFiles);
    fastifyInstance.register(getFileById);
    fastifyInstance.register(createFile);
    fastifyInstance.register(updateFile);
    fastifyInstance.register(deleteFile);
    fastifyInstance.register(moveFileToTrash);
    fastifyInstance.register(restoreFile);

    // Register log routes
    fastifyInstance.register(getLogs);
    fastifyInstance.register(getLogById);
    fastifyInstance.register(createLog);
    fastifyInstance.register(deleteLog);
    fastifyInstance.register(getLogsByUser);
  },
  { prefix: '/api/v1' }
);

app.listen({ port: env.PORT });
