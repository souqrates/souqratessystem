import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  botSlug: text("bot_slug").notNull().default("mother-bot"),
  audience: text("audience").notNull(), // "all" | "bot" | "single"
  targetValue: text("target_value"),     // bot slug for "bot", telegram id for "single"
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"), // pending|sending|completed|failed
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  error: text("error"),
  createdBy: text("created_by").notNull().default("superadmin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Broadcast = typeof broadcastsTable.$inferSelect;
