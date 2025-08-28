import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
  createApiErrorResponse,
  createBadRequestResponse,
  createConflictResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
  createUnprocessableEntityResponse,
  HTTP_STATUS,
  type HttpStatusCode,
} from '../../types/api-response.ts';

/**
 * Error Response Middleware
 * Standardizes all API error responses
 */
export function errorResponseMiddleware() {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    error: FastifyError
  ): Promise<void> => {
    const statusCode = (error.statusCode ||
      HTTP_STATUS.INTERNAL_SERVER_ERROR) as HttpStatusCode;

    // Log internal server errors
    if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      request.log.error(
        {
          error: error.message,
          stack: error.stack,
          url: request.url,
          method: request.method,
        },
        'Internal Server Error'
      );
    }

    let response: ReturnType<typeof createApiErrorResponse>;

    switch (statusCode) {
      case HTTP_STATUS.BAD_REQUEST: {
        response = createBadRequestResponse(error.message);
        break;
      }
      case HTTP_STATUS.UNAUTHORIZED: {
        response = createUnauthorizedResponse(error.message);
        break;
      }
      case HTTP_STATUS.FORBIDDEN: {
        response = createForbiddenResponse(error.message);
        break;
      }
      case HTTP_STATUS.NOT_FOUND: {
        response = createNotFoundResponse(error.message);
        break;
      }
      case HTTP_STATUS.CONFLICT: {
        response = createConflictResponse(error.message);
        break;
      }
      case HTTP_STATUS.UNPROCESSABLE_ENTITY: {
        response = createUnprocessableEntityResponse(error.message);
        break;
      }
      default: {
        response = createApiErrorResponse(
          statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR
            ? 'Internal Server Error'
            : error.message,
          statusCode
        );
        break;
      }
    }

    await reply.status(statusCode).send(response);
  };
}

/**
 * Database Error Handler
 * Handles specific database-related errors
 */
export function handleDatabaseError(error: Error): never {
  if (
    error.message.includes('duplicate key') ||
    error.message.includes('UNIQUE constraint')
  ) {
    const conflictError = new Error('Resource already exists') as FastifyError;
    conflictError.statusCode = HTTP_STATUS.CONFLICT;
    throw conflictError;
  }

  if (
    error.message.includes('foreign key constraint') ||
    error.message.includes('FOREIGN KEY constraint')
  ) {
    const badRequestError = new Error(
      'Invalid reference to related resource'
    ) as FastifyError;
    badRequestError.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw badRequestError;
  }

  if (
    error.message.includes('not found') ||
    error.message.includes('NOT FOUND')
  ) {
    const notFoundError = new Error('Resource not found') as FastifyError;
    notFoundError.statusCode = HTTP_STATUS.NOT_FOUND;
    throw notFoundError;
  }

  // Re-throw original error if not handled
  throw error;
}

/**
 * Validation Error Handler
 * Transforms validation errors into standardized format
 */
export function handleValidationError(error: Error): never {
  const validationError = new Error(
    `Validation failed: ${error.message}`
  ) as FastifyError;
  validationError.statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
  throw validationError;
}

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch and format errors
 */
export function asyncErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof Error) {
        handleDatabaseError(error);
      }
      throw error;
    }
  };
}
