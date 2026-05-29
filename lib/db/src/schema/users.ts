import {
  pgTable,
  text,
  serial,
  timestamp,
  bigint,
  boolean,
  integer,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
  username: text("username"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  languageCode: text("language_code").default("ar"),
  isPremium: boolean("is_premium").default(false),
  isBlocked: boolean("is_blocked").default(false),
  referrerId: integer("referrer_id"),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  totalGamesPlayed: integer("total_games_played").notNull().default(0),
  totalGamesWon: integer("total_games_won").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  streakLastClaimAt: timestamp("streak_last_claim_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // A user cannot be their own referrer. Enforced at the DB layer so no app
  // bug or admin SQL fix-up can ever insert a self-loop into the graph.
  noSelfReferral: check("users_no_self_referral", sql`${t.id} <> ${t.referrerId}`),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
