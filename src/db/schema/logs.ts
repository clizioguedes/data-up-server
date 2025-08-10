import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const logActionTypeEnum = pgEnum('log_action_type', [
  'upload',
  'download',
  'view',
  'delete',
  'restore',
  'create_folder',
]);

export const logs = pgTable('logs', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid().notNull(),
  fileId: uuid(),
  folderId: uuid(),
  actionType: logActionTypeEnum().notNull(),
  timestamp: timestamp({ withTimezone: false }).notNull().defaultNow(),
});
