import type { FastifyReply } from 'fastify';
import {
  createApiCreatedResponse,
  createApiPaginatedResponse,
  createApiSuccessResponse,
  createBadRequestResponse,
  createNotFoundResponse,
  HTTP_STATUS,
  type PaginationMeta,
} from '../../types/api-response.ts';

/**
 * Response Helper Class
 * Provides convenient methods for sending standardized API responses
 */
export class ResponseHelper {
  private readonly reply: FastifyReply;

  constructor(reply: FastifyReply) {
    this.reply = reply;
  }

  /**
   * Send a successful response with data
   */
  async success<T>(
    data: T,
    message = 'Operation completed successfully'
  ): Promise<void> {
    const response = createApiSuccessResponse(data, message);
    await this.reply.status(HTTP_STATUS.OK).send(response);
  }

  /**
   * Send a successful response for created resources
   */
  async created<T>(
    data: T,
    message = 'Resource created successfully'
  ): Promise<void> {
    const response = createApiCreatedResponse(data, message);
    await this.reply.status(HTTP_STATUS.CREATED).send(response);
  }

  /**
   * Send a paginated response
   */
  async paginated<T>(
    items: T[],
    meta: PaginationMeta,
    message = 'Data retrieved successfully'
  ): Promise<void> {
    const response = createApiPaginatedResponse(items, meta, message);
    await this.reply.status(HTTP_STATUS.OK).send(response);
  }

  /**
   * Send a not found error response
   */
  async notFound(message = 'Resource not found'): Promise<void> {
    const response = createNotFoundResponse(message);
    await this.reply.status(HTTP_STATUS.NOT_FOUND).send(response);
  }

  /**
   * Send a bad request error response
   */
  async badRequest(message = 'Invalid request data'): Promise<void> {
    const response = createBadRequestResponse(message);
    await this.reply.status(HTTP_STATUS.BAD_REQUEST).send(response);
  }

  /**
   * Send a no content response (for successful deletions)
   */
  async noContent(): Promise<void> {
    await this.reply.status(HTTP_STATUS.NO_CONTENT).send();
  }
}

/**
 * Factory function to create a ResponseHelper instance
 */
export function createResponseHelper(reply: FastifyReply): ResponseHelper {
  return new ResponseHelper(reply);
}

/**
 * Utility functions for direct use without helper class
 */
export async function sendSuccessResponse<T>(
  reply: FastifyReply,
  data: T,
  message?: string
): Promise<void> {
  const response = createApiSuccessResponse(data, message);
  await reply.status(HTTP_STATUS.OK).send(response);
}

export async function sendCreatedResponse<T>(
  reply: FastifyReply,
  data: T,
  message?: string
): Promise<void> {
  const response = createApiCreatedResponse(data, message);
  await reply.status(HTTP_STATUS.CREATED).send(response);
}

export async function sendPaginatedResponse<T>(
  reply: FastifyReply,
  items: T[],
  meta: PaginationMeta,
  message?: string
): Promise<void> {
  const response = createApiPaginatedResponse(items, meta, message);
  await reply.status(HTTP_STATUS.OK).send(response);
}

export async function sendNotFoundResponse(
  reply: FastifyReply,
  message?: string
): Promise<void> {
  const response = createNotFoundResponse(message);
  await reply.status(HTTP_STATUS.NOT_FOUND).send(response);
}

export async function sendBadRequestResponse(
  reply: FastifyReply,
  message?: string
): Promise<void> {
  const response = createBadRequestResponse(message);
  await reply.status(HTTP_STATUS.BAD_REQUEST).send(response);
}
