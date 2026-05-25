import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 18, scale: 9 }).notNull(),
  fee: numeric("fee", { precision: 18, scale: 9 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 18, scale: 9 }).notNull(),
  method: text("method").notNull(),
  address: text("address"),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  // Caller-supplied dedupe key (X-Idempotency-Key header). A retried request
  // with the same (sourceBot, idempotencyKey) returns the original row
  // instead of creating a duplicate pending withdrawal.
  sourceBot: text("source_bot"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  withdrawalIdemUniq: uniqueIndex("withdrawals_idem_uniq")
    .on(t.sourceBot, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
}));

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
