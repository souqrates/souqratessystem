import {
  pgTable,
  text,
  serial,
  timestamp,
  bigint,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const commissionOverridesTable = pgTable(
  "commission_overrides",
  {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
    botSlug: text("bot_slug").notNull(),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniqUserBot: uniqueIndex("commission_overrides_user_bot_uniq").on(t.telegramId, t.botSlug),
  }),
);

export type CommissionOverride = typeof commissionOverridesTable.$inferSelect;
export type InsertCommissionOverride = typeof commissionOverridesTable.$inferInsert;
