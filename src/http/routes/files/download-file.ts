import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import { LocalStorageProvider } from '../../../services/storage/local-storage.provider.ts';
import { getStorageProvider } from '../../../services/storage/storage.factory.ts';
import { logger } from '../../../utils/logger.ts';

export function downloadFile(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/files/:id/download',
    {
      schema: {
        tags: ['files'],
        summary: 'Download de arquivo',
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: z.any().describe('Arquivo para download'),
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        // Buscar o arquivo no banco
        const [file] = await db.select().from(files).where(eq(files.id, id));

        if (!file) {
          return reply.status(404).send({
            message: 'Arquivo não encontrado',
          });
        }

        const storageProvider = getStorageProvider();

        // Verificar se o arquivo existe no storage
        const exists = await storageProvider.exists(file.storagePath);
        if (!exists) {
          return reply.status(404).send({
            message: 'Arquivo não encontrado no storage',
          });
        }

        // Para o provider local, criar stream de leitura
        if (storageProvider instanceof LocalStorageProvider) {
          const readStream = storageProvider.createReadStream(file.storagePath);

          reply.header('Content-Type', file.type);
          reply.header(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(file.name)}"`
          );
          reply.header('Content-Length', file.size.toString());

          return reply.send(readStream);
        }

        // Para outros providers (futuro S3), redirecionar para URL
        const downloadUrl = await storageProvider.getUrl(file.storagePath);
        return reply.redirect(downloadUrl);
      } catch (error) {
        logger.error('Erro ao fazer download do arquivo:', error);
        return reply.status(500).send({
          message: 'Erro interno do servidor',
        });
      }
    }
  );
}
