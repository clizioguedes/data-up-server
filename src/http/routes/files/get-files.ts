import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import {
  calculateOffset,
  calculatePaginationMeta,
  createPaginatedResponseSchema,
  paginationQuerySchema,
} from '../../../types/api-response.ts';
import { logger } from '../../../utils/logger.ts';
import { createResponseHelper } from '../../helpers/response.helper.ts';

export function getFiles(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/files',
    {
      schema: {
        tags: ['files'],
        summary: 'Listar todos os arquivos com paginação e busca',
        querystring: paginationQuerySchema.extend({
          folderId: z.string().optional(),
          status: z.enum(['ativo', 'lixeira']).optional(),
          query: z
            .string()
            .optional()
            .describe('Buscar por nome, tipo ou caminho do arquivo'),
          sortBy: z
            .enum(['name', 'type', 'size', 'createdAt'])
            .optional()
            .default('createdAt')
            .describe('Campo para ordenação'),
          sortOrder: z
            .enum(['asc', 'desc'])
            .optional()
            .default('desc')
            .describe('Direção da ordenação'),
        }),
        response: {
          200: createPaginatedResponseSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              size: z.string(),
              storagePath: z.string(),
              folderId: z.string().nullable(),
              ownerId: z.string(),
              status: z.enum(['ativo', 'lixeira']),
              createdAt: z.string(),
              createdBy: z.string(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      try {
        const { page, limit, folderId, status, query, sortBy, sortOrder } =
          request.query;

        logger.info(
          `GET /files - Parâmetros recebidos: ${JSON.stringify(request.query)}`
        );

        const conditions: Parameters<typeof and> = [];

        if (folderId) {
          conditions.push(eq(files.folderId, folderId));
          logger.info(`Filtro aplicado - folderId: ${folderId}`);
        }

        if (status) {
          conditions.push(eq(files.status, status));
          logger.info(`Filtro aplicado - status: ${status}`);
        }

        if (query) {
          // Buscar em múltiplas colunas usando OR e ilike (case-insensitive)
          const searchTerm = `%${query}%`;
          conditions.push(
            or(
              ilike(files.name, searchTerm),
              ilike(files.type, searchTerm),
              ilike(files.storagePath, searchTerm)
            )
          );
          logger.info(`Filtro aplicado - busca: ${query}`);
        }

        logger.info(
          `Construindo whereClause com ${conditions.length} condições`
        );

        const whereClause =
          conditions.length > 0 ? and(...conditions) : undefined;

        // Configurar ordenação
        const getOrderByColumn = () => {
          switch (sortBy) {
            case 'name':
              return files.name;
            case 'type':
              return files.type;
            case 'size':
              return files.size;
            default:
              return files.createdAt;
          }
        };

        const orderByColumn = getOrderByColumn();
        const orderByDirection = sortOrder === 'asc' ? asc : desc;

        logger.info(`Ordenação: ${sortBy} ${sortOrder}`);

        // Contar total de registros
        logger.info('Executando query para contar registros...');
        const [totalResult] = await db
          .select({ count: count() })
          .from(files)
          .where(whereClause);

        const total = totalResult.count;
        const offset = calculateOffset(page, limit);

        logger.info(`Total de registros encontrados: ${total}`);
        logger.info(
          `Paginação: página ${page}, limite ${limit}, offset ${offset}`
        );

        // Buscar dados paginados
        logger.info('Executando query para buscar dados paginados...');
        const result = await db
          .select({
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
          })
          .from(files)
          .where(whereClause)
          .orderBy(orderByDirection(orderByColumn))
          .limit(limit)
          .offset(offset);

        logger.info(`Dados recuperados: ${result.length} registros`);

        const formattedFiles = result.map((file) => ({
          ...file,
          size: file.size.toString(),
          createdAt: file.createdAt.toISOString(),
        }));

        const meta = calculatePaginationMeta(page, limit, total);
        const responseHelper = createResponseHelper(reply);

        logger.info(
          `Resposta enviada com sucesso - ${formattedFiles.length} arquivos`
        );
        return await responseHelper.paginated(
          formattedFiles,
          meta,
          'Arquivos recuperados com sucesso'
        );
      } catch (error) {
        logger.error('Erro ao buscar arquivos:', error);
        throw error; // Deixa o error handler global tratar
      }
    }
  );
}
