import { z } from 'zod';

// Schema para parâmetros de paginação
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Schema para metadados de paginação na resposta
export const paginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// Schema para resposta paginada padrão
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    data: z.array(dataSchema),
    meta: paginationMetaSchema,
    success: z.boolean().default(true),
    message: z.string().optional(),
  });

// Schema para resposta única padrão
export const singleResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean().default(true),
    message: z.string().optional(),
  });

// Schema para resposta de erro padrão
export const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  message: z.string(),
  error: z.string().optional(),
  statusCode: z.number().int(),
});

// Tipos TypeScript
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  success: boolean;
  message?: string;
}

export interface SingleResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  statusCode: number;
}

// Utilitário para calcular metadados de paginação
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

// Utilitário para calcular offset
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

// Utilitário para criar resposta paginada
export function createPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message?: string
): PaginatedResponse<T> {
  return {
    data,
    meta,
    success: true,
    message,
  };
}

// Utilitário para criar resposta única
export function createSingleResponse<T>(
  data: T,
  message?: string
): SingleResponse<T> {
  return {
    data,
    success: true,
    message,
  };
}

// Utilitário para criar resposta de erro
export function createErrorResponse(
  message: string,
  statusCode: number,
  error?: string
): ErrorResponse {
  return {
    success: false,
    message,
    error,
    statusCode,
  };
}
