import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

// ========================================
// 1) CHAT TABLE
// ========================================
export const appChat = pgTable(
  "app_chat",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    chatId: varchar("chat_id").notNull(),
    chatName: text("chat_name"),
    platform: text("platform").default("telegram"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    unique("app_chat_chat_id_unique").on(table.chatId),
  ]
);

// ========================================
// 2) RUMOUR TABLE
// ========================================
export const appRumour = pgTable(
  "app_rumour",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    chatTableId: uuid("chat_table_id"),
    msgContent: text("msg_content").notNull(),
    embedding: jsonb(),
    status: text().default("pending"),
    factCheckSource: text("fact_check_source"),
    factCheckResult: text("fact_check_result"),
    sourceLink: text("source_link"),
    riskScore: integer("risk_score"),
    rumourLocation: text("rumour_location"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.chatTableId],
      foreignColumns: [appChat.id],
      name: "app_rumour_chat_table_id_app_chat_id_fk",
    }).onDelete("cascade"),
  ]
);

// ========================================
// 3) RUMOUR MATCH TABLE
// ========================================
export const appRumourMatch = pgTable(
  "app_rumour_match",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    similarity: integer(),
    count: integer().default(1),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    rumourId: uuid("rumour_id").notNull(),
    normalized: text("normalized").notNull(),
    broadcasted: boolean("broadcasted").default(false),
  },
  (table) => [
    foreignKey({
      columns: [table.rumourId],
      foreignColumns: [appRumour.id],
      name: "app_rumour_match_rumour_id_app_rumour_id_fk",
    }).onDelete("cascade"),

    unique("app_rumour_match_normalized_unique").on(table.normalized),
  ]
);

// ========================================
// 4) MESSAGE LOG TABLE
// ========================================
export const appMessageLog = pgTable(
  "app_message_log",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    chatTableId: uuid("chat_table_id"),
    messageId: text("message_id"),
    content: text(),
    aiResponse: text("ai_response"),
    processed: boolean().default(false),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.chatTableId],
      foreignColumns: [appChat.id],
      name: "app_message_log_chat_table_id_app_chat_id_fk",
    }).onDelete("cascade"),
  ]
);
