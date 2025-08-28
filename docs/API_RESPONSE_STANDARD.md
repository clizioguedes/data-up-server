# API Response Standardization

Este documento descreve o padrão padronizado de respostas da API implementado seguindo princípios de Clean Architecture.

## Padrão de Resposta

Todas as respostas da API seguem o seguinte formato:

```typescript
interface ApiResponse {
  success: boolean;
  data: T | null;
  status: string;
  message: string;
}
```

### Estrutura Base

- **success**: Booleano indicando se a operação foi bem-sucedida
- **data**: Os dados da resposta (tipo genérico T) ou null em caso de erro
- **status**: Código de status HTTP como string
- **message**: Mensagem descritiva da operação

### Tipos de Resposta

#### Resposta de Sucesso

```typescript
{
  "success": true,
  "data": {...},
  "status": "200",
  "message": "Operation completed successfully"
}
```

#### Resposta Paginada

```typescript
{
  "success": true,
  "data": {
    "items": [...],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "status": "200",
  "message": "Data retrieved successfully"
}
```

#### Resposta de Erro

```typescript
{
  "success": false,
  "data": null,
  "status": "404",
  "message": "Resource not found"
}
```

## Como Usar

### 1. Usando ResponseHelper (Recomendado)

```typescript
import { createResponseHelper } from '../../helpers/response.helper.ts';

export function getFileById(app: FastifyInstance) {
  app.get('/files/:id', async (request, reply) => {
    const responseHelper = createResponseHelper(reply);
    
    // Para sucesso
    return await responseHelper.success(data, 'Arquivo encontrado');
    
    // Para criação
    return await responseHelper.created(data, 'Arquivo criado');
    
    // Para erro 404
    return await responseHelper.notFound('Arquivo não encontrado');
    
    // Para erro 400
    return await responseHelper.badRequest('Dados inválidos');
    
    // Para paginação
    return await responseHelper.paginated(items, meta, 'Dados recuperados');
  });
}
```

### 2. Usando Funções Diretas

```typescript
import {
  createApiSuccessResponse,
  createApiErrorResponse,
  createNotFoundResponse,
  HTTP_STATUS
} from '../../../types/api-response.ts';

export function getFileById(app: FastifyInstance) {
  app.get('/files/:id', async (request, reply) => {
    // Para sucesso
    const response = createApiSuccessResponse(data, 'Arquivo encontrado');
    return reply.status(HTTP_STATUS.OK).send(response);
    
    // Para erro
    const errorResponse = createNotFoundResponse('Arquivo não encontrado');
    return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse);
  });
}
```

### 3. Schemas para Documentação

```typescript
import {
  createSuccessResponseSchema,
  createErrorResponseSchema,
  createPaginatedResponseSchema
} from '../../../types/api-response.ts';

export function getFileById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/files/:id', {
    schema: {
      response: {
        200: createSuccessResponseSchema(
          z.object({
            id: z.string(),
            name: z.string(),
            // ... outros campos
          })
        ),
        404: createErrorResponseSchema(),
      },
    },
  }, handler);
}
```

## Códigos de Status HTTP

O sistema inclui constantes para códigos de status comuns:

```typescript
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
```

## Utilitários de Paginação

### Calculando Metadados de Paginação

```typescript
import { calculatePaginationMeta, calculateOffset } from '../../../types/api-response.ts';

const page = 1;
const limit = 10;
const total = 100;

const offset = calculateOffset(page, limit); // 0
const meta = calculatePaginationMeta(page, limit, total);
// Resultado:
// {
//   page: 1,
//   limit: 10,
//   total: 100,
//   totalPages: 10,
//   hasNext: true,
//   hasPrev: false
// }
```

## Tratamento de Erros

### Middleware de Erro Padrão

```typescript
import { errorResponseMiddleware } from '../../middleware/error-response.ts';

// No arquivo principal do servidor
app.setErrorHandler(errorResponseMiddleware());
```

### Tratamento de Erros Específicos

```typescript
import { handleDatabaseError, handleValidationError } from '../../middleware/error-response.ts';

try {
  // operação que pode falhar
} catch (error) {
  if (error instanceof ZodError) {
    handleValidationError(error);
  } else {
    handleDatabaseError(error);
  }
}
```

## Exemplos Práticos

### Endpoint de Listagem com Paginação

```typescript
export function getFiles(app: FastifyInstance) {
  app.get('/files', async (request, reply) => {
    const { page, limit } = request.query;
    const responseHelper = createResponseHelper(reply);
    
    // Buscar dados
    const [items, totalResult] = await Promise.all([
      db.select().from(files).limit(limit).offset(calculateOffset(page, limit)),
      db.select({ count: count() }).from(files)
    ]);
    
    const total = totalResult[0].count;
    const meta = calculatePaginationMeta(page, limit, total);
    
    return await responseHelper.paginated(items, meta);
  });
}
```

### Endpoint de Criação

```typescript
export function createFile(app: FastifyInstance) {
  app.post('/files', async (request, reply) => {
    const responseHelper = createResponseHelper(reply);
    
    try {
      const file = await createFileInDatabase(request.body);
      return await responseHelper.created(file, 'Arquivo criado com sucesso');
    } catch (error) {
      if (error.message.includes('duplicate')) {
        return await responseHelper.conflict('Arquivo já existe');
      }
      throw error; // Deixa o middleware global tratar
    }
  });
}
```

### Endpoint de Busca por ID

```typescript
export function getFileById(app: FastifyInstance) {
  app.get('/files/:id', async (request, reply) => {
    const { id } = request.params;
    const responseHelper = createResponseHelper(reply);
    
    const file = await db.select().from(files).where(eq(files.id, id));
    
    if (!file.length) {
      return await responseHelper.notFound('Arquivo não encontrado');
    }
    
    return await responseHelper.success(file[0], 'Arquivo encontrado');
  });
}
```

## Migração de Código Existente

### Antes (Código Antigo)

```typescript
// ❌ Inconsistente
return reply.send({ file: data });
return reply.status(404).send({ error: 'Not found' });
return reply.send({ success: true, data: items });
```

### Depois (Código Padronizado)

```typescript
// ✅ Consistente e padronizado
const responseHelper = createResponseHelper(reply);
return await responseHelper.success(data, 'Arquivo encontrado');
return await responseHelper.notFound('Arquivo não encontrado');
return await responseHelper.paginated(items, meta, 'Dados recuperados');
```

## Benefícios

1. **Consistência**: Todas as respostas seguem o mesmo formato
2. **Tipagem**: TypeScript garante type safety em compile time
3. **Documentação**: Schemas automáticos para OpenAPI/Swagger
4. **Manutenibilidade**: Fácil de atualizar e estender
5. **Debuggabilidade**: Códigos de status e mensagens padronizadas
6. **Clean Architecture**: Separação clara de responsabilidades

## Compatibilidade Reversa

Funções legacy são mantidas por compatibilidade, mas marcadas como deprecated:

```typescript
// ⚠️ Deprecated - use createApiSuccessResponse
export const createSuccessResponse = createApiSuccessResponse;
```

Recomenda-se migrar para as novas funções e o ResponseHelper nas próximas atualizações.
