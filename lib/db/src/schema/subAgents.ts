import {
  pgTable,
  serial,
  text,
  bigint,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * SOUQRATES SUB-AGENTS — wholesale/partner program.
 *
 * Flow:
 *   1. User applies via Mini App → row inserted with status="pending"
 *   2. Super-admin reviews ID photo + details → approves/rejects
 *   3. Approved agent gets a dashboard inside the bot:
 *      - Wallet balances (re-uses the unified mother-bot wallet)
 *      - Sales stats (totalSalesSkz, totalCustomers)
 *      - "Sell SKZ to customer" action → atomic SKZ transfer
 *      - Tier ladder: more sales/customers → bigger discount on SKZ buy price
 *
 * Tier rates are stored in `sub_agent_tiers` (7 rows, admin-configurable).
 * Sales are logged in `sub_agent_sales` for the audit/ledger trail and to
 * recompute totals if needed.
 */
export const subAgentsTable = pgTable(
  "sub_agents",
  {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),

    // Application form
    fullName: text("full_name").notNull(),
    dob: date("dob").notNull(),
    country: text("country").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address").notNull(),
    idPhotoPath: text("id_photo_path").notNull(), // object storage path

    // Status: pending | approved | rejected | suspended
    status: text("status").notNull().default("pending"),

    // Tier 1..7 (NULL until approved). Re-computed by /recompute-tier endpoint.
    tierLevel: integer("tier_level"),

    // Cached aggregates (updated atomically inside /sell route)
    totalSalesSkz: numeric("total_sales_skz", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    totalCustomers: integer("total_customers").notNull().default(0),

    // Review trail
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),

    notes: text("notes"), // admin-only freeform

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    uniqTg: uniqueIndex("sub_agents_telegram_id_uniq").on(t.telegramId),
    idxStatus: index("sub_agents_status_idx").on(t.status),
  }),
);

export const insertSubAgentSchema = createInsertSchema(subAgentsTable).omit({
  id: true,
  status: true,
  tierLevel: true,
  totalSalesSkz: true,
  totalCustomers: true,
  approvedAt: true,
  approvedBy: true,
  rejectedAt: true,
  rejectedReason: true,
  createdAt: true,
  updatedAt: true,
});
export type SubAgent = typeof subAgentsTable.$inferSelect;
export type InsertSubAgent = z.infer<typeof insertSubAgentSchema>;

/**
 * 7 tiers, level 1..7. Seeded with sensible defaults; admin can edit
 * thresholds + discountRate live from /subagents/tiers in superadmin.
 *
 * `discountRate` is the % discount the agent gets when BUYING SKZ from the
 * platform (e.g. 0.05 = 5% off, so 100 SKZ costs them 95 SKZ-equivalent USDT).
 */
export const subAgentTiersTable = pgTable("sub_agent_tiers", {
  level: integer("level").primaryKey(), // 1..7
  name: text("name").notNull(),
  color: text("color").notNull().default("#888"),
  minSalesSkz: numeric("min_sales_skz", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  minCustomers: integer("min_customers").notNull().default(0),
  discountRate: numeric("discount_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0"),
  perks: jsonb("perks").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export type SubAgentTier = typeof subAgentTiersTable.$inferSelect;

/**
 * One row per SKZ sale from an agent to a customer.
 * Created inside the /sell transaction together with the wallet transfer.
 */
export const subAgentSalesTable = pgTable(
  "sub_agent_sales",
  {
    id: serial("id").primaryKey(),
    subAgentId: integer("sub_agent_id").notNull(),
    customerTelegramId: bigint("customer_telegram_id", { mode: "bigint" }).notNull(),
    skzAmount: numeric("skz_amount", { precision: 18, scale: 2 }).notNull(),
    // Link to the canonical transactions ledger row (debit on agent)
    transactionId: integer("transaction_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxAgent: index("sub_agent_sales_agent_idx").on(t.subAgentId),
    idxCustomer: index("sub_agent_sales_customer_idx").on(t.customerTelegramId),
  }),
);
export type SubAgentSale = typeof subAgentSalesTable.$inferSelect;
