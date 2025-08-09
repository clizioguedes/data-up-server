import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
	"admin",
	"colaborador",
	"visualizador",
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	passwordHash: text().notNull(),
	role: userRoleEnum().notNull(),
	createdAt: timestamp({ withTimezone: false }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: false }).notNull().defaultNow(),
});
