import {
  pgTable,
  integer,
  text,
  boolean,
  numeric,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Per-game configuration for SOUQRATES SKILLZ (games-bot).
 *
 * Draft/Published workflow (mirrors botTexts):
 * - Admin saves edits to `draft_*` columns.
 * - "Publish" copies the entire draft state into the `published_*` columns.
 * - The games-bot reads ONLY `published_*` columns at runtime (with 60s cache).
 *
 * Fields are split into two groups:
 *  - First-class columns: economy + visibility (the levers the admin tweaks most).
 *  - `texts` JSONB: arbitrary in-game copy (title, subtitle, rules, winLabel, loseLabel, ctaLabel, …)
 *    and `params` for game-specific knobs we did not pre-model.
 *
 * `gameId` is the canonical id used everywhere in the games-bot client (`GAMES` array).
 */
export const gameConfigsTable = pgTable(
  "game_configs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id").notNull(),

    // Static catalog metadata (rarely edited; kept editable anyway)
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default(""),
    difficulty: text("difficulty").notNull().default("Medium"),
    color: text("color").notNull().default(""),

    // ── DRAFT state ──────────────────────────────────────────────
    draftIsVisible: boolean("draft_is_visible").notNull().default(true),
    draftImageUrl: text("draft_image_url").notNull().default(""),
    draftDescription: text("draft_description").notNull().default(""),
    draftEntryFee: numeric("draft_entry_fee", { precision: 18, scale: 4 }).notNull().default("10"),
    draftWinAmount: numeric("draft_win_amount", { precision: 18, scale: 4 }).notNull().default("30"),
    draftTargetScore: integer("draft_target_score").notNull().default(0),
    draftMaxScore: integer("draft_max_score").notNull().default(0),
    draftScorePerCorrect: integer("draft_score_per_correct").notNull().default(1),
    draftScorePerWrong: integer("draft_score_per_wrong").notNull().default(0),
    // Arbitrary in-game texts: { title, subtitle, rules, winLabel, loseLabel, ctaLabel, ... }
    draftTexts: jsonb("draft_texts").notNull().default({}),
    // Optional extra params (game-specific knobs not modelled above)
    draftParams: jsonb("draft_params").notNull().default({}),

    // ── PUBLISHED state (what the live bot reads) ────────────────
    publishedIsVisible: boolean("published_is_visible").notNull().default(true),
    publishedImageUrl: text("published_image_url").notNull().default(""),
    publishedDescription: text("published_description").notNull().default(""),
    publishedEntryFee: numeric("published_entry_fee", { precision: 18, scale: 4 }).notNull().default("10"),
    publishedWinAmount: numeric("published_win_amount", { precision: 18, scale: 4 }).notNull().default("30"),
    publishedTargetScore: integer("published_target_score").notNull().default(0),
    publishedMaxScore: integer("published_max_score").notNull().default(0),
    publishedScorePerCorrect: integer("published_score_per_correct").notNull().default(1),
    publishedScorePerWrong: integer("published_score_per_wrong").notNull().default(0),
    publishedTexts: jsonb("published_texts").notNull().default({}),
    publishedParams: jsonb("published_params").notNull().default({}),

    hasUnpublishedChanges: boolean("has_unpublished_changes").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => ({
    uniqGameId: uniqueIndex("game_configs_game_id_uniq").on(t.gameId),
  }),
);

export type GameConfig = typeof gameConfigsTable.$inferSelect;
export type InsertGameConfig = typeof gameConfigsTable.$inferInsert;
