import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 18, scale: 9 }).notNull(),
  fee: numeric("fee", { precision: 18, scale: 9 }).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  sourceBot: text("source_bot"),
  referenceId: text("reference_id"),
  // Caller-supplied dedupe key. A retried POST with the same key + sourceBot
  // returns the original transaction instead of inserting a duplicate.
  // Partial unique index below allows NULL for legacy/internal-only calls.
  idempotencyKey: text("idempotency_key"),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // (source_bot, idempotency_key) is unique ONLY when the key is supplied.
  // Partial index — NULLs are not considered duplicates.
  txIdempotencyUniq: uniqueIndex("tx_idempotency_uniq")
    .on(t.sourceBot, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
  // Ledger reads always filter by user and order by recency.
  txUserCreatedIdx: index("tx_user_created_idx").on(t.userId, t.createdAt),
  // Cross-bot reconciliation + admin filters by bot.
  txBotCreatedIdx: index("tx_bot_created_idx").on(t.sourceBot, t.createdAt),
  // referenceId lookups in game/credit-reward, refund-entry etc.
  txUserRefIdx: index("tx_user_ref_idx").on(t.userId, t.referenceId),
}));

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
