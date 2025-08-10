import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const fileStatusEnum = pgEnum('file_status', ['ativo', 'lixeira']);

export const files = pgTable('files', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  type: text().notNull(),
  size: bigint({
    mode: 'bigint',
  }).notNull(),
  storagePath: text().notNull(),
  folderId: uuid(),
  ownerId: uuid().notNull(),
  status: fileStatusEnum().notNull(),
  createdAt: timestamp({ withTimezone: false }).notNull().defaultNow(),
  createdBy: uuid().notNull(),
});
