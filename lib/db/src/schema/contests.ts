/**
 * SOUQRATES STAGE — contests-bot schema.
 *
 * Product rules baked into the schema:
 *   - One contest "active" at a time (app-enforced; DB allows history of past contests).
 *   - One FREE vote per user per UTC day, GLOBALLY across contests (unique idx on
 *     (telegramId, voteDateUtc) in daily_free_vote_usage).
 *   - Paid votes come from vote_grants — purchasing a vote_pack creates a grant row;
 *     each cast vote decrements votesUsed on the grant.
 *   - vote_packs can carry an optional bonus file (admin-uploaded e.g. a PDF book),
 *     turning the pack into a bundle. No coupling to digital_products — bundles live
 *     entirely inside contests-bot.
 *   - votes table is the auth log; voteCount on contestants and totalVotes on
 *     contests are denormalized counters maintained atomically in the route handler
 *     (SQL increments, never JS read-modify-write).
 */
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  bigint,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

// ── Contests ────────────────────────────────────────────────────────────────
export const contestsTable = pgTable(
  "contests",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    // draft | active | ended
    status: text("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    // Denormalized totals (kept in sync atomically inside the vote transaction).
    totalVotes: integer("total_votes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    byStatus: index("contests_status_idx").on(t.status),
    // DB-level invariant: at most one row may have status='active' at any time.
    // Mirrored from the manual SQL migration; ensures `drizzle-kit push` keeps it.
    oneActive: uniqueIndex("contests_one_active_uniq").on(t.status).where(sql`status = 'active'`),
  }),
);

// ── Contestants ─────────────────────────────────────────────────────────────
export const contestantsTable = pgTable(
  "contestants",
  {
    id: serial("id").primaryKey(),
    contestId: integer("contest_id").notNull(),
    name: text("name").notNull(),
    bio: text("bio").notNull().default(""),
    photoUrl: text("photo_url"),
    voteCount: integer("vote_count").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    isDisqualified: boolean("is_disqualified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byContest: index("contestants_contest_idx").on(t.contestId),
  }),
);

// ── Vote packs (admin-only catalog) ─────────────────────────────────────────
// A vote_pack with a bonusFileUrl IS the "bundle" — buyer gets votes + file.
export const votePacksTable = pgTable("vote_packs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  votes: integer("votes").notNull(),
  bonusVotes: integer("bonus_votes").notNull().default(0),
  priceSkz: numeric("price_skz", { precision: 18, scale: 2 }).notNull(),
  // Optional digital bonus delivered alongside the votes (admin-uploaded).
  bonusFileUrl: text("bonus_file_url"),
  bonusFileName: text("bonus_file_name"),
  bonusDescription: text("bonus_description"),
  // Optional cover for the pack card (otherwise rendered by generic styling).
  coverUrl: text("cover_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ── Vote grants (a user's available paid votes) ─────────────────────────────
export const voteGrantsTable = pgTable(
  "vote_grants",
  {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
    // 'pack' | 'admin' | 'bonus'
    source: text("source").notNull(),
    packId: integer("pack_id"),
    refId: text("ref_id"),
    votesGranted: integer("votes_granted").notNull(),
    votesUsed: integer("votes_used").notNull().default(0),
    pricePaid: numeric("price_paid", { precision: 18, scale: 2 }).notNull().default("0"),
    // Snapshot of the bonus file at purchase time, so revoking the pack later
    // doesn't break buyer's download right.
    bonusFileUrl: text("bonus_file_url"),
    bonusFileName: text("bonus_file_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("vote_grants_user_idx").on(t.telegramId),
  }),
);

// ── Votes ledger ────────────────────────────────────────────────────────────
export const votesTable = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    contestId: integer("contest_id").notNull(),
    contestantId: integer("contestant_id").notNull(),
    voterTelegramId: bigint("voter_telegram_id", { mode: "bigint" }).notNull(),
    voteCount: integer("vote_count").notNull(),
    // 'free' | 'paid' | 'admin'
    source: text("source").notNull(),
    grantId: integer("grant_id"),
    ipHash: text("ip_hash"),
    isVoid: boolean("is_void").notNull().default(false),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byContest: index("votes_contest_idx").on(t.contestId),
    byContestant: index("votes_contestant_idx").on(t.contestantId),
    byVoter: index("votes_voter_idx").on(t.voterTelegramId),
    byCreated: index("votes_created_idx").on(t.createdAt),
  }),
);

// ── Daily free-vote usage (GLOBAL: one free vote/user/day across all contests) ──
export const dailyFreeVoteUsageTable = pgTable(
  "daily_free_vote_usage",
  {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
    voteDateUtc: text("vote_date_utc").notNull(), // 'YYYY-MM-DD' (UTC)
    contestId: integer("contest_id").notNull(),
    voteId: integer("vote_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserDate: uniqueIndex("daily_free_vote_user_date_uniq").on(t.telegramId, t.voteDateUtc),
  }),
);

// ── Insert schemas (Zod) ────────────────────────────────────────────────────
export const insertContestSchema = createInsertSchema(contestsTable).omit({
  id: true,
  totalVotes: true,
  createdAt: true,
  updatedAt: true,
});
export const insertContestantSchema = createInsertSchema(contestantsTable).omit({
  id: true,
  voteCount: true,
  createdAt: true,
});
export const insertVotePackSchema = createInsertSchema(votePacksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Contest = typeof contestsTable.$inferSelect;
export type Contestant = typeof contestantsTable.$inferSelect;
export type VotePack = typeof votePacksTable.$inferSelect;
export type VoteGrant = typeof voteGrantsTable.$inferSelect;
export type Vote = typeof votesTable.$inferSelect;
export type InsertContest = z.infer<typeof insertContestSchema>;
export type InsertContestant = z.infer<typeof insertContestantSchema>;
export type InsertVotePack = z.infer<typeof insertVotePackSchema>;
