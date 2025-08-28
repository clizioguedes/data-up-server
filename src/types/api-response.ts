import { z } from 'zod';

/**
 * HTTP Status Codes constants
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/**
 * Pagination Types and Schemas
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Core API Response Types
 */
export interface BaseApiResponse {
  success: boolean;
  status: string;
  message: string;
}

export interface ApiSuccessResponse<T = unknown> extends BaseApiResponse {
  success: true;
  data: T;
}

export interface ApiErrorResponse extends BaseApiResponse {
  success: false;
  data: null;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiPaginatedResponse<T = unknown> extends BaseApiResponse {
  success: true;
  data: PaginatedData<T>;
}

export type ApiResponse<T = unknown> =
  | ApiSuccessResponse<T>
  | ApiPaginatedResponse<T>
  | ApiErrorResponse;

/**
 * Zod Schemas for API Responses
 */
export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    status: z.string(),
    message: z.string(),
  });

export const createErrorResponseSchema = () =>
  z.object({
    success: z.literal(false),
    data: z.null(),
    status: z.string(),
    message: z.string(),
  });

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(itemSchema),
      meta: paginationMetaSchema,
    }),
    status: z.string(),
    message: z.string(),
  });

/**
 * Response Builder Functions - Clean Architecture Pattern
 */

/**
 * Creates a successful response with data
 */
export function createApiSuccessResponse<T>(
  data: T,
  message = 'Operation completed successfully',
  statusCode: HttpStatusCode = HTTP_STATUS.OK
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    status: statusCode.toString(),
    message,
  };
}

/**
 * Creates a successful response for created resources
 */
export function createApiCreatedResponse<T>(
  data: T,
  message = 'Resource created successfully'
): ApiSuccessResponse<T> {
  return createApiSuccessResponse(data, message, HTTP_STATUS.CREATED);
}

/**
 * Creates a paginated response
 */
export function createApiPaginatedResponse<T>(
  items: T[],
  meta: PaginationMeta,
  message = 'Data retrieved successfully',
  statusCode: HttpStatusCode = HTTP_STATUS.OK
): ApiPaginatedResponse<T> {
  return {
    success: true,
    data: { items, meta },
    status: statusCode.toString(),
    message,
  };
}

/**
 * Creates an error response
 */
export function createApiErrorResponse(
  message: string,
  statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR
): ApiErrorResponse {
  return {
    success: false,
    data: null,
    status: statusCode.toString(),
    message,
  };
}

/**
 * Creates a not found error response
 */
export function createNotFoundResponse(
  message = 'Resource not found'
): ApiErrorResponse {
  return createApiErrorResponse(message, HTTP_STATUS.NOT_FOUND);
}

/**
 * Creates a bad request error response
 */
export function createBadRequestResponse(
  message = 'Invalid request data'
): ApiErrorResponse {
  return createApiErrorResponse(message, HTTP_STATUS.BAD_REQUEST);
}

/**
 * Creates a conflict error response
 */
export function createConflictResponse(
  message = 'Resource already exists'
): ApiErrorResponse {
  return createApiErrorResponse(message, HTTP_STATUS.CONFLICT);
}

/**
 * Creates an unauthorized error response
 */
export function createUnauthorizedResponse(
  message = 'Unauthorized access'
): ApiErrorResponse {
  return createApiErrorResponse(message, HTTP_STATUS.UNAUTHORIZED);
}

/**
 * Creates a forbidden error response
 */
export function createForbiddenResponse(
  message = 'Access forbidden'
): ApiErrorResponse {
  return createApiErrorResponse(message, HTTP_STATUS.FORBIDDEN);
}

/**
 * Creates an unprocessable entity error response
 */
export function createUnprocessableEntityResponse(
  message = 'Validation failed'
): ApiErrorResponse {
  return createApiErrorResponse(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
}

/**
 * Pagination Utilities
 */

/**
 * Calculates pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
}

/**
 * Calculates database offset for pagination
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(page: number, limit: number): void {
  if (page < 1) {
    throw new Error('Page must be greater than 0');
  }
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }
}

/**
 * Legacy function aliases for backward compatibility
 * @deprecated Use createApiSuccessResponse instead
 */
export const createSuccessResponse = <T>(
  data: T,
  message?: string
): ApiSuccessResponse<T> => createApiSuccessResponse(data, message);

/**
 * @deprecated Use createApiErrorResponse instead
 */
export const createErrorResponse = (
  message: string,
  statusCode?: HttpStatusCode
): ApiErrorResponse => createApiErrorResponse(message, statusCode);

/**
 * @deprecated Use createApiPaginatedResponse instead
 */
export const createPaginatedResponse = <T>(
  items: T[],
  meta: PaginationMeta,
  message?: string
): ApiPaginatedResponse<T> => createApiPaginatedResponse(items, meta, message);
