import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const agreementSettingsTable = pgTable("agreement_settings", {
  id:        integer("id").primaryKey().default(1),
  content:   text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agreementSignaturesTable = pgTable("agreement_signatures", {
  id:               serial("id").primaryKey(),
  name:             text("name").notNull(),
  email:            text("email").notNull(),
  phone:            text("phone"),
  notes:            text("notes"),
  signatureDataUrl: text("signature_data_url").notNull(),
  agreementContent: text("agreement_content").notNull(),
  ipAddress:        text("ip_address"),
  userAgent:        text("user_agent"),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
