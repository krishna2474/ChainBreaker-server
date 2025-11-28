import { pgTable, text, varchar, uuid, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

// CHAT TABLE
export const chat = pgTable("chat", {
  id: uuid("id").defaultRandom().primaryKey(),
  chat_id: varchar("chat_id").notNull().unique(),
  chat_name: text("chat_name"),
  platform: text("platform").default("telegram"),
});

// RUMOUR TABLE
export const rumour = pgTable("rumour", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_table_id").references(() => chat.id),
  msg_content: text("msg_content").notNull(),
  embedding: jsonb("embedding"),
  status: text("status").default("pending"),
  factCheckSource: text("factCheckSource"),
  factCheckResult: text("factCheckResult"),
  source_link: text("source_link"),
  riskScore: integer("riskScore"),
  rumour_location: text("rumour_location"),
  createdAt: timestamp("created_at").defaultNow(),
});

// RUMOUR MATCH
export const rumourMatch = pgTable("rumour_match", {
  id: uuid("id").defaultRandom().primaryKey(),
  similarity: integer("similarity"),
  count: integer("count").default(1),
  createdAt: timestamp("createdAt").defaultNow(),
  rumourId: uuid("rumourId").references(() => rumour.id),
});

// MESSAGE LOG
export const messageLog = pgTable("message_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_table_id").references(() => chat.id),
  message_id: text("message_id"),
  content: text("content"),
  ai_response: text("ai_response"),
  processed: boolean("processed").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});
