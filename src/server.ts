import { fastifyCors } from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fastify } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { join } from 'node:path';
import { env } from './env.ts';
import {
  createFile,
  deleteFile,
  downloadFile,
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
import { logger } from './utils/logger.ts';

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.register(fastifyCors, {
  origin: '*',
});

// Registrar plugin para upload de arquivos
app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    fieldNameSize: 200,
    fieldSize: 10 * 1024, // 10KB para campos
    fields: 20,
    headerPairs: 5000,
    parts: 1000,
  },
  throwFileSizeLimit: false,
  preservePath: false,
});

// Registrar plugin para servir arquivos estáticos
app.register(fastifyStatic, {
  root: join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
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
    instance.register(createFolder);
    instance.register(updateFolder);
    instance.register(deleteFolder);

    // Register file routes
    instance.register(getFiles);
    instance.register(getFileById);
    instance.register(createFile);
    instance.register(updateFile);
    instance.register(deleteFile);
    instance.register(downloadFile);
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

app.listen({ port: env.PORT }, (err, address) => {
  if (err) {
    logger.error(`Error starting server: ${err.message}`);
    process.exit(1);
  }
  logger.info(`Server listening at ${address}`);
});
