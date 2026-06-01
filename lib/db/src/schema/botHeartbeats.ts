import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per child bot. Each bot POSTs to /internal/heartbeat on a short
 * interval; the superadmin panel reads these rows to show live up/down state
 * for the Python bots (which run as separate processes and aren't covered by
 * the API server's own /readyz check).
 */
export const botHeartbeatsTable = pgTable("bot_heartbeats", {
  id: serial("id").primaryKey(),
  botSlug: text("bot_slug").notNull().unique(),
  status: text("status").notNull().default("online"),
  version: text("version"),
  meta: jsonb("meta"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBotHeartbeatSchema = createInsertSchema(botHeartbeatsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBotHeartbeat = z.infer<typeof insertBotHeartbeatSchema>;
export type BotHeartbeat = typeof botHeartbeatsTable.$inferSelect;
