import {
  pgTable,
  text,
  serial,
  timestamp,
  bigint,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Policies (Terms, Privacy, FAQ, …) — admin-managed multi-section content ──
export const policiesTable = pgTable("policies", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export const insertPolicySchema = createInsertSchema(policiesTable).omit({
  id: true,
  updatedAt: true,
});
export type Policy = typeof policiesTable.$inferSelect;

// ── Platform links — contact info + social accounts ────────────────────────
// kind: tiktok | instagram | telegram | whatsapp | youtube | email | phone | website | custom
export const platformLinksTable = pgTable("platform_links", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export const insertPlatformLinkSchema = createInsertSchema(
  platformLinksTable,
).omit({ id: true, updatedAt: true });
export type PlatformLink = typeof platformLinksTable.$inferSelect;

// ── XP rules — configurable XP per action ──────────────────────────────────
// eventKind examples:
//   skz_spend     — units = whole SKZ spent (debit)
//   contest_vote  — units = number of votes cast
//   game_play     — units = 1 per game
//   game_win      — units = 1 per win
//   book_purchase — units = 1 per purchase
//   daily_login   — units = 1
//   referral      — units = 1 per referred user
export const xpRulesTable = pgTable("xp_rules", {
  id: serial("id").primaryKey(),
  eventKind: text("event_kind").notNull().unique(),
  xpPerUnit: integer("xp_per_unit").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export const insertXpRuleSchema = createInsertSchema(xpRulesTable).omit({
  id: true,
  updatedAt: true,
});
export type XpRule = typeof xpRulesTable.$inferSelect;

// ── Rank titles — 100 levels with admin-editable Arabic names + colors ────
export const rankTitlesTable = pgTable("rank_titles", {
  level: integer("level").primaryKey(), // 1..100
  title: text("title").notNull(),
  minXp: bigint("min_xp", { mode: "number" }).notNull(),
  color: text("color").notNull().default("#eab308"),
  icon: text("icon").notNull().default("★"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export type RankTitle = typeof rankTitlesTable.$inferSelect;

// ── XP events — audit trail; also feeds leaderboards ──────────────────────
export const xpEventsTable = pgTable("xp_events", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
  eventKind: text("event_kind").notNull(),
  sourceBotSlug: text("source_bot_slug"),
  amountXp: integer("amount_xp").notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type XpEvent = typeof xpEventsTable.$inferSelect;
