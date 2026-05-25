import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Whitelist of withdrawal destination addresses per user.
 *
 * Safety model: any never-seen address for a user is auto-registered with
 * `usableAt = now() + 24h`. Withdrawals to that address are refused until
 * the cooldown elapses. This kills the "account-takeover → drain to new
 * attacker address" attack: even if the attacker reads the session, they
 * cannot withdraw to a fresh address for 24h, giving the legitimate user
 * a window to react. Removing/revoking is admin-only.
 *
 * `network` is the chain identifier ("trc20" | "ton"). The (userId, network,
 * address) triple is unique — re-using the same address keeps the original
 * cooldown timestamp (so reuse after 24h is instant).
 */
export const withdrawalAddressesTable = pgTable(
  "withdrawal_addresses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    label: text("label"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    /** Earliest moment at which this address can be used in a withdrawal. */
    usableAt: timestamp("usable_at", { withTimezone: true }).notNull(),
    /** Admin-revoked: set non-null to disable address regardless of cooldown. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    addrUniq: uniqueIndex("withdrawal_addresses_user_net_addr_uniq").on(
      t.userId,
      t.network,
      t.address,
    ),
    addrUserIdx: index("withdrawal_addresses_user_idx").on(t.userId),
  }),
);

export const insertWithdrawalAddressSchema = createInsertSchema(
  withdrawalAddressesTable,
).omit({ id: true, addedAt: true });
export type InsertWithdrawalAddress = z.infer<typeof insertWithdrawalAddressSchema>;
export type WithdrawalAddress = typeof withdrawalAddressesTable.$inferSelect;
