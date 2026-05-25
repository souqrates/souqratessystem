import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // Top-balance leaderboards / admin filters benefit from a btree on balance.
  walletsUserIdx: index("wallets_user_idx").on(t.userId),
}));

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
