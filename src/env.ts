import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z
    .string()
    .startsWith('postgres://')
    .default('postgres://docker:docker@localhost:5433/data_monitor'),
});

export const env = envSchema.parse(process.env);
