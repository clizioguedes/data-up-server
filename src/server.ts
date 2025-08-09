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
  getFolderContents,
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
  (instance) => {
    // Register user routes
    instance.register(getUsers);
    instance.register(getUserById);
    instance.register(createUser);
    instance.register(updateUser);
    instance.register(deleteUser);

    // Register folder routes
    instance.register(getFolders);
    instance.register(getFolderById);
    instance.register(getFolderContents);
    instance.register(createFolder);
    instance.register(updateFolder);
    instance.register(deleteFolder);

    // Register file routes
    instance.register(getFiles);
    instance.register(getFileById);
    instance.register(createFile);
    instance.register(updateFile);
    instance.register(deleteFile);
    instance.register(moveFileToTrash);
    instance.register(restoreFile);

    // Register log routes
    instance.register(getLogs);
    instance.register(getLogById);
    instance.register(createLog);
    instance.register(deleteLog);
    instance.register(getLogsByUser);
  },
  { prefix: '/api/v1' }
);

app.listen({ port: env.PORT });
