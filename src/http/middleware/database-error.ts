import type { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger.ts';

interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  hostname?: string;
}

export function setupDatabaseErrorHandling(app: FastifyInstance) {
  // Hook para interceptar erros de conexão com banco
  app.addHook('onError', (request, reply, error, done) => {
    // Verificar se é erro relacionado ao banco
    if (
      error.message.includes('connect') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('database') ||
      error.message.includes('postgres')
    ) {
      const dbError = error as DatabaseError;

      logger.error(
        `🔥 ERRO DE BANCO DE DADOS detectado na rota ${request.method} ${request.url}:`,
        {
          message: error.message,
          code: dbError.code,
          errno: dbError.errno,
          syscall: dbError.syscall,
          hostname: dbError.hostname,
          stack: error.stack,
        }
      );

      // Verificar se ainda não foi enviada uma resposta
      if (!reply.sent) {
        reply.status(503).send({
          error: 'Database Connection Error',
          message:
            'Não foi possível conectar ao banco de dados. Tente novamente em alguns momentos.',
          timestamp: new Date().toISOString(),
        });
      }
    }
    done();
  });
}
