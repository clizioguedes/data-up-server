import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.ts';
import { logger } from '../utils/logger.ts';
import { schema } from './schema/index.ts';

logger.info(
  `Conectando ao banco de dados: ${env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@')}`
);

export const sql = postgres(env.DATABASE_URL, {
  onnotice: (notice) => {
    logger.info(`PostgreSQL Notice: ${notice.message}`);
  },
  debug: (_, query) => {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`SQL Query: ${query}`);
    }
  },
});

export const db = drizzle(sql, {
  schema,
  casing: 'snake_case',
});

// Testar conexão na inicialização
async function testConnection() {
  try {
    await sql`SELECT 1 as test`;
    logger.info('✅ Conexão com o banco de dados estabelecida com sucesso');
  } catch (error) {
    logger.error('❌ Erro ao conectar com o banco de dados', error);
    throw error;
  }
}

testConnection();
