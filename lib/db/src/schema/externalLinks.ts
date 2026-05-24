import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const externalLinksTable = pgTable("external_links", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull().default("general"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ExternalLink = typeof externalLinksTable.$inferSelect;
