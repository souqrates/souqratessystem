import {
  pgTable,
  text,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Editable bot copy with a draft/published workflow.
 *
 * Each (bot_slug, key) pair is a single editable string. Saving updates
 * `draft_value`. A separate "Publish" action copies `draft_value` into
 * `published_value`. Bots should read `published_value` at runtime; the
 * draft is only visible inside the super-admin panel.
 */
export const botTextsTable = pgTable(
  "bot_texts",
  {
    id: serial("id").primaryKey(),
    botSlug: text("bot_slug").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    draftValue: text("draft_value").notNull().default(""),
    publishedValue: text("published_value").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => ({
    uniqBotKey: uniqueIndex("bot_texts_bot_key_uniq").on(t.botSlug, t.key),
  }),
);

export type BotText = typeof botTextsTable.$inferSelect;
export type InsertBotText = typeof botTextsTable.$inferInsert;
