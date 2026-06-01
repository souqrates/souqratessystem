import {
  pgTable,
  serial,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * scratch_cards — catalogue of scratch-and-win card types.
 * Each row is one purchasable card the player can scratch.
 * The admin can create/toggle/edit card economics from the superadmin panel.
 */
export const scratchCardsTable = pgTable("scratch_cards", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  /** Price the player pays in SKZ to scratch one card. */
  buyPriceSKZ: numeric("buy_price_skz", { precision: 18, scale: 6 }).notNull().default("10"),
  /** Probability of winning any prize (0.0000 – 1.0000). */
  winRate: numeric("win_rate", { precision: 5, scale: 4 }).notNull().default("0.3000"),
  /** Maximum non-jackpot prize in SKZ. */
  maxPrizeSKZ: numeric("max_prize_skz", { precision: 18, scale: 6 }).notNull().default("100"),
  /** Jackpot prize value in SKZ (rare top prize). */
  jackpotValueSKZ: numeric("jackpot_value_skz", { precision: 18, scale: 6 }).notNull().default("1000"),
  /** UI sort order (lower = shown first). */
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertScratchCardSchema = createInsertSchema(scratchCardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScratchCard = z.infer<typeof insertScratchCardSchema>;
export type ScratchCard = typeof scratchCardsTable.$inferSelect;
