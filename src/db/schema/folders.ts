import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const folders = pgTable('folders', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  parentId: uuid(),
  createdAt: timestamp().notNull().defaultNow(),
  createdBy: uuid().notNull(),
});
