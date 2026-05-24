import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull(),
  botSlug: text("bot_slug").notNull(),
  userId: integer("user_id").notNull(),
  gameId: integer("game_id"),
  grossAmount: numeric("gross_amount", { precision: 18, scale: 9 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 18, scale: 9 }).notNull(),
  netAmount: numeric("net_amount", { precision: 18, scale: 9 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("settled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissionsTable.$inferSelect;
