import {
  pgTable,
  serial,
  timestamp,
  integer,
  numeric,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "restrict" }),
  balanceSkz: numeric("balance_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  referralBalanceSkz: numeric("referral_balance_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  totalEarnedFromReferralsSkz: numeric("total_earned_from_referrals_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  balanceStars: numeric("balance_stars", { precision: 18, scale: 0 }).notNull().default("0"),
  balanceUsdt: numeric("balance_usdt", { precision: 18, scale: 6 }).notNull().default("0"),
  balanceTon: numeric("balance_ton", { precision: 18, scale: 9 }).notNull().default("0"),
  totalEarnedSkz: numeric("total_earned_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  totalWithdrawnSkz: numeric("total_withdrawn_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  totalEarned: numeric("total_earned", { precision: 18, scale: 6 }).notNull().default("0"),
  totalWithdrawn: numeric("total_withdrawn", { precision: 18, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  walletsUserIdx: index("wallets_user_idx").on(t.userId),
  balSkzCheck:    check("wallets_bal_skz_gte_zero",     sql`${t.balanceSkz} >= 0`),
  refBalSkzCheck: check("wallets_ref_bal_skz_gte_zero", sql`${t.referralBalanceSkz} >= 0`),
  balStarsCheck:  check("wallets_bal_stars_gte_zero",   sql`${t.balanceStars} >= 0`),
  balUsdtCheck:   check("wallets_bal_usdt_gte_zero",    sql`${t.balanceUsdt} >= 0`),
  balTonCheck:    check("wallets_bal_ton_gte_zero",     sql`${t.balanceTon} >= 0`),
}));

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
