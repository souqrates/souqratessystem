import { pgTable, text, serial, timestamp, jsonb, bigint, boolean } from "drizzle-orm/pg-core";

export const errorLogsTable = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  level: text("level").notNull().default("error"),
  message: text("message").notNull(),
  stack: text("stack"),
  metadata: jsonb("metadata"),
  userTelegramId: bigint("user_telegram_id", { mode: "bigint" }),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ErrorLog = typeof errorLogsTable.$inferSelect;
