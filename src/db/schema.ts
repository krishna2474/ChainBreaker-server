import {
  pgTable,
  text,
  varchar,
  uuid,
  integer,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

// NOTE: exported names match controller imports: appChat, appRumour, appRumourMatch, appMessageLog

// CHAT TABLE (app_chat)
export const appChat = pgTable("app_chat", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: varchar("chat_id").notNull().unique(), // string chat id (telegram group id or user id)
  chatName: text("chat_name"),
  platform: text("platform").default("telegram"),
  createdAt: timestamp("created_at").defaultNow(),
});

// RUMOUR TABLE (app_rumour)
export const appRumour = pgTable("app_rumour", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatTableId: uuid("chat_table_id")
    .references(() => appChat.id, { onDelete: "cascade" }), // which chat first reported it
  msgContent: text("msg_content").notNull(),
  embedding: jsonb("embedding"),
  status: text("status").default("pending"),
  factCheckSource: text("fact_check_source"),
  factCheckResult: text("fact_check_result"),
  sourceLink: text("source_link"),
  riskScore: integer("risk_score"),
  rumourLocation: text("rumour_location"),
  createdAt: timestamp("created_at").defaultNow(),
});

// RUMOUR MATCH TABLE (app_rumour_match)
// used to aggregate similar rumours, track counts, and a broadcast flag
export const appRumourMatch = pgTable("app_rumour_match", {
  id: uuid("id").defaultRandom().primaryKey(),
  // normalized text for equality / simple similarity match
  normalized: text("normalized").notNull().unique(),
  similarity: integer("similarity"),
  count: integer("count").default(1),
  broadcasted: boolean("broadcasted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  // store a representative rumourId (first one) for reference
  rumourId: uuid("rumour_id").references(() => appRumour.id, { onDelete: "cascade" }),
});

// MESSAGE LOG (app_message_log)
export const appMessageLog = pgTable("app_message_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatTableId: uuid("chat_table_id")
    .references(() => appChat.id, { onDelete: "cascade" }),
  messageId: text("message_id"),
  content: text("content"),
  aiResponse: text("ai_response"),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
