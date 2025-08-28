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
import { setupDatabaseErrorHandling } from './http/middleware/database-error.ts';

import {
  createFile,
  createMultipleFiles,
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

const app = fastify({
  logger: false, // Usar nosso logger customizado
  bodyLimit: 50 * 1024 * 1024, // 50MB body limit
  keepAliveTimeout: 60 * 1000, // 60 segundos
  requestTimeout: 60 * 1000, // 60 segundos timeout
}).withTypeProvider<ZodTypeProvider>();

// Error handler global
app.setErrorHandler((error, request, reply) => {
  logger.error(`Erro na rota ${request.method} ${request.url}:`, {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    validation: error.validation,
    body: request.body,
    query: request.query,
    params: request.params,
  });

  // Se for erro de validação do Zod
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Dados inválidos fornecidos',
      details: error.validation,
    });
  }

  // Se for erro do Fastify com statusCode
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.name || 'Error',
      message: error.message,
    });
  }

  // Erro interno do servidor
  return reply.status(500).send({
    error: 'Internal Server Error',
    message: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { details: error.message }),
  });
});

// Log de todas as requisições
app.addHook('onRequest', (request, _, done) => {
  logger.info(`📥 ${request.method} ${request.url} - IP: ${request.ip}`);
  done();
});

// Log de todas as respostas
app.addHook('onSend', (request, reply, __, done) => {
  logger.info(
    `📤 ${request.method} ${request.url} - Status: ${reply.statusCode}`
  );
  done();
});

app.register(fastifyCors, {
  origin: '*',
});

// Configurar middleware de erro de banco
setupDatabaseErrorHandling(app);

// Registrar plugin para upload de arquivos
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 10, // Máximo 10 arquivos por requisição
    fieldNameSize: 200,
    fieldSize: 2 * 1024 * 1024, // 2MB por campo textual
    fields: 50, // mais campos de metadados
    headerPairs: 5000,
    parts: 2000,
  },
  throwFileSizeLimit: false,
  preservePath: false,
  attachFieldsToBody: false, // Não anexar campos ao body automaticamente
});

// Registrar plugin para servir arquivos estáticos
app.register(fastifyStatic, {
  root: join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
});

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.get('/health', async () => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'unknown',
  };

  try {
    const { sql } = await import('./db/connection.ts');
    await sql`SELECT 1 as health_check`;
    health.database = 'connected';
    logger.info('✅ Health check - Banco conectado');
  } catch (dbError) {
    health.database = 'disconnected';
    logger.error('❌ Health check - Erro de conexão com banco:', dbError);
  }

  return health;
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
    instance.register(createMultipleFiles);
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

app.listen({ port: env.PORT }, async (err, address) => {
  if (err) {
    logger.error(`Error starting server: ${err.message}`);
    process.exit(1);
  }

  // Testar conexão com banco após o servidor iniciar
  try {
    const { sql } = await import('./db/connection.ts');
    await sql`SELECT 1 as connectivity_test`;
    logger.info('✅ Teste de conectividade com banco bem-sucedido');
  } catch (dbError) {
    logger.error('❌ Falha no teste de conectividade com banco:', dbError);
  }

  logger.info(`🚀 Server listening at ${address}`);
});
