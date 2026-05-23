import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botsTable = pgTable("bots", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.1000"),
  isActive: boolean("is_active").default(true),
  apiKey: text("api_key").notNull().unique(),
  webhookSecret: text("webhook_secret").notNull(),
  totalVolumeUsdt: numeric("total_volume_usdt", { precision: 18, scale: 6 }).notNull().default("0"),
  totalCommissionUsdt: numeric("total_commission_usdt", { precision: 18, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Bot = typeof botsTable.$inferSelect;
