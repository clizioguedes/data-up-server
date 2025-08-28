import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../../db/connection.ts';
import { files } from '../../../db/schema/files.ts';
import {
  createErrorResponseSchema,
  createSuccessResponseSchema,
} from '../../../types/api-response.ts';
import { createResponseHelper } from '../../helpers/response.helper.ts';

export function updateFile(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/files/:id',
    {
      schema: {
        tags: ['files'],
        summary: 'Atualizar arquivo',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          name: z.string().min(1).optional(),
          type: z.string().min(1).optional(),
          size: z.string().optional(),
          storagePath: z.string().min(1).optional(),
          folderId: z.string().optional(),
          status: z.enum(['ativo', 'lixeira']).optional(),
        }),
        response: {
          200: createSuccessResponseSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              size: z.string(),
              storagePath: z.string(),
              folderId: z.string().nullable(),
              ownerId: z.string(),
              status: z.enum(['ativo', 'lixeira']),
              createdAt: z.string().datetime(),
              createdBy: z.string(),
            })
          ),
          404: createErrorResponseSchema(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { size, ...otherUpdateData } = request.body;
      const responseHelper = createResponseHelper(reply);

      // Prepare update data with proper type conversion
      const updateData = {
        ...otherUpdateData,
        ...(size && { size: BigInt(size) }),
      };

      const result = await db
        .update(files)
        .set(updateData)
        .where(eq(files.id, id))
        .returning({
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
        });

      if (result.length === 0) {
        return await responseHelper.notFound('Arquivo não encontrado');
      }

      const file = {
        ...result[0],
        size: result[0].size.toString(),
        createdAt: result[0].createdAt.toISOString(),
      };

      return await responseHelper.success(
        file,
        'Arquivo atualizado com sucesso'
      );
    }
  );
}
