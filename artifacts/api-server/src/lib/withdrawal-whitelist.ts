import { and, eq } from "drizzle-orm";
import { db, withdrawalAddressesTable } from "@workspace/db";

/**
 * Cooldown applied to any never-before-seen withdrawal address. The first
 * attempt to withdraw to a new address registers it AND is rejected — the
 * user must wait this many hours before retrying. Override via env for tests.
 */
const COOLDOWN_HOURS = Number(process.env.WITHDRAWAL_NEW_ADDR_COOLDOWN_HOURS ?? 24);

export type AddressCheck =
  | { ok: true }
  | { ok: false; reason: "new_address_cooldown"; usableAt: Date }
  | { ok: false; reason: "address_revoked" };

/**
 * Ensure a withdrawal address is registered and past its cooldown.
 *
 * Behaviour:
 *  - First time seeing this (user, network, address) → insert with
 *    usableAt = now() + COOLDOWN_HOURS and return cooldown rejection.
 *  - Already registered, revoked by admin → reject.
 *  - Already registered, before usableAt → reject with usableAt.
 *  - Already registered, after usableAt → accept.
 *
 * Uses INSERT … ON CONFLICT DO NOTHING + a follow-up SELECT so concurrent
 * attempts from the same user to the same address always converge on a
 * single row.
 */
export async function checkAndRegisterWithdrawalAddress(
  userId: number,
  network: string,
  address: string,
): Promise<AddressCheck> {
  const usableAt = new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000);

  await db
    .insert(withdrawalAddressesTable)
    .values({ userId, network, address, usableAt })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(withdrawalAddressesTable)
    .where(
      and(
        eq(withdrawalAddressesTable.userId, userId),
        eq(withdrawalAddressesTable.network, network),
        eq(withdrawalAddressesTable.address, address),
      ),
    )
    .limit(1);

  if (!row) {
    // Shouldn't happen — the insert above either created it or it existed.
    // Fail closed.
    return { ok: false, reason: "new_address_cooldown", usableAt };
  }

  if (row.revokedAt) return { ok: false, reason: "address_revoked" };

  const now = Date.now();
  if (now < row.usableAt.getTime()) {
    return { ok: false, reason: "new_address_cooldown", usableAt: row.usableAt };
  }
  return { ok: true };
}
