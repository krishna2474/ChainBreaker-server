import { pgTable, unique, uuid, varchar, text, foreignKey, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const appChat = pgTable("app_chat", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: varchar("chat_id").notNull(),
	chatName: text("chat_name"),
	platform: text().default('telegram'),
}, (table) => [
	unique("app_chat_chat_id_unique").on(table.chatId),
]);

export const appMessageLog = pgTable("app_message_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatTableId: uuid("chat_table_id"),
	messageId: text("message_id"),
	content: text(),
	aiResponse: text("ai_response"),
	processed: boolean().default(false),
	createdAt: timestamp({ mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.chatTableId],
			foreignColumns: [appChat.id],
			name: "app_message_log_chat_table_id_app_chat_id_fk"
		}).onDelete("cascade"),
]);

export const appRumour = pgTable("app_rumour", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatTableId: uuid("chat_table_id"),
	msgContent: text("msg_content").notNull(),
	embedding: jsonb(),
	status: text().default('pending'),
	factCheckSource: text(),
	factCheckResult: text(),
	sourceLink: text("source_link"),
	riskScore: integer(),
	rumourLocation: text("rumour_location"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.chatTableId],
			foreignColumns: [appChat.id],
			name: "app_rumour_chat_table_id_app_chat_id_fk"
		}).onDelete("cascade"),
]);

export const appRumourMatch = pgTable("app_rumour_match", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	similarity: integer(),
	count: integer().default(1),
	createdAt: timestamp({ mode: 'string' }).defaultNow(),
	rumourId: uuid(),
}, (table) => [
	foreignKey({
			columns: [table.rumourId],
			foreignColumns: [appRumour.id],
			name: "app_rumour_match_rumourId_app_rumour_id_fk"
		}).onDelete("cascade"),
]);
