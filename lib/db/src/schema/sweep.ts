/**
 * SOUQRATES SWEEP — sweep-bot schema.
 *
 * Five tables:
 *  - sweep_game_types    — catalog of 10 games (price, prize tiers, theme)
 *  - sweep_tickets       — individual play tickets with Provably Fair seeds
 *  - sweep_lotto_draws   — weekly lottery draws
 *  - sweep_lotto_entries — user entries per draw (6 chosen numbers)
 *  - sweep_jackpot_pool  — single-row accumulator for the progressive jackpot
 *
 * Provably Fair:
 *  - serverSeedHash is revealed BEFORE play so the user can verify the server
 *    didn't change the seed after seeing the client seed.
 *  - serverSeed is revealed AFTER play so any third party can reproduce the result
 *    by running: SHA256(serverSeed || ":" || clientSeed) and comparing to the
 *    stored result.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  numeric,
  jsonb,
  timestamp,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Game Types ───────────────────────────────────────────────────────────────
export const sweepGameTypesTable = pgTable(
  "sweep_game_types",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull().default(""),
    description: text("description").notNull().default(""),
    emoji: text("emoji").notNull().default("🎰"),
    theme: text("theme").notNull().default("default"),
    priceSKZ: numeric("price_skz", { precision: 18, scale: 2 }).notNull().default("10"),
    // JSONB array: [{ matchCount: number, multiplier: number, label: string }]
    // multiplier is applied to priceSKZ to compute prize
    prizeTiers: jsonb("prize_tiers").notNull().default([]),
    // % of each ticket price that feeds the jackpot pool (0.10 = 10%)
    jackpotContributionRate: numeric("jackpot_contribution_rate", { precision: 5, scale: 4 }).notNull().default("0.1000"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugUniq: uniqueIndex("sweep_game_types_slug_uniq").on(t.slug),
    activeIdx: index("sweep_game_types_active_idx").on(t.isActive),
  }),
);

// ── Play Tickets ─────────────────────────────────────────────────────────────
export const sweepTicketsTable = pgTable(
  "sweep_tickets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    gameTypeId: integer("game_type_id").notNull(),
    priceSKZ: numeric("price_skz", { precision: 18, scale: 2 }).notNull(),
    // Provably Fair — hash shown BEFORE play
    serverSeedHash: text("server_seed_hash").notNull(),
    // Provably Fair — raw seed revealed AFTER play
    serverSeed: text("server_seed"),
    clientSeed: text("client_seed").notNull().default(""),
    // JSONB: game-specific result payload (symbols, numbers, outcome string, …)
    result: jsonb("result"),
    prizeSkz: numeric("prize_skz", { precision: 18, scale: 2 }).notNull().default("0"),
    isWin: boolean("is_win").notNull().default(false),
    // pending → played
    status: text("status").notNull().default("pending"),
    transactionId: integer("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    playedAt: timestamp("played_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("sweep_tickets_user_idx").on(t.userId),
    gameTypeIdx: index("sweep_tickets_game_type_idx").on(t.gameTypeId),
    statusIdx: index("sweep_tickets_status_idx").on(t.status),
    createdAtIdx: index("sweep_tickets_created_at_idx").on(t.createdAt),
  }),
);

// ── Lotto Draws ──────────────────────────────────────────────────────────────
export const sweepLottoDrawsTable = pgTable(
  "sweep_lotto_draws",
  {
    id: serial("id").primaryKey(),
    drawNumber: integer("draw_number").notNull(),
    // open → closed → drawn
    status: text("status").notNull().default("open"),
    // JSONB: [number, number, number, number, number, number] — 6 winning numbers 1-49
    winningNumbers: jsonb("winning_numbers"),
    serverSeedHash: text("server_seed_hash").notNull().default(""),
    serverSeed: text("server_seed"),
    jackpotAmountSkz: numeric("jackpot_amount_skz", { precision: 18, scale: 2 }).notNull().default("0"),
    totalEntries: integer("total_entries").notNull().default(0),
    totalPaidOutSkz: numeric("total_paid_out_skz", { precision: 18, scale: 2 }).notNull().default("0"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull().defaultNow(),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    drawnAt: timestamp("drawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    drawNumberUniq: uniqueIndex("sweep_lotto_draws_number_uniq").on(t.drawNumber),
    statusIdx: index("sweep_lotto_draws_status_idx").on(t.status),
  }),
);

// ── Lotto Entries ────────────────────────────────────────────────────────────
export const sweepLottoEntriesTable = pgTable(
  "sweep_lotto_entries",
  {
    id: serial("id").primaryKey(),
    drawId: integer("draw_id").notNull(),
    userId: integer("user_id").notNull(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
    // JSONB: [number, number, number, number, number, number] — 6 chosen numbers 1-49
    chosenNumbers: jsonb("chosen_numbers").notNull(),
    priceSKZ: numeric("price_skz", { precision: 18, scale: 2 }).notNull(),
    matchCount: integer("match_count"),
    prizeSkz: numeric("prize_skz", { precision: 18, scale: 2 }).notNull().default("0"),
    isJackpot: boolean("is_jackpot").notNull().default(false),
    transactionId: integer("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    drawIdx: index("sweep_lotto_entries_draw_idx").on(t.drawId),
    userIdx: index("sweep_lotto_entries_user_idx").on(t.userId),
    drawUserIdx: index("sweep_lotto_entries_draw_user_idx").on(t.drawId, t.userId),
  }),
);

// ── Jackpot Pool ─────────────────────────────────────────────────────────────
// Single row (id=1). Atomic SQL increments only — never JS read-modify-write.
export const sweepJackpotPoolTable = pgTable("sweep_jackpot_pool", {
  id: serial("id").primaryKey(),
  balanceSkz: numeric("balance_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  totalContributedSkz: numeric("total_contributed_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  totalPaidOutSkz: numeric("total_paid_out_skz", { precision: 18, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SweepGameType = typeof sweepGameTypesTable.$inferSelect;
export type SweepTicket = typeof sweepTicketsTable.$inferSelect;
export type SweepLottoDraw = typeof sweepLottoDrawsTable.$inferSelect;
export type SweepLottoEntry = typeof sweepLottoEntriesTable.$inferSelect;
export type SweepJackpotPool = typeof sweepJackpotPoolTable.$inferSelect;
