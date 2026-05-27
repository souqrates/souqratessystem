/**
 * Shared financial helpers used by both /api/internal/* and /api/games/* routes.
 * Keep this file pure DB logic — no Express types.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  platformSettingsTable,
  commissionOverridesTable,
} from "@workspace/db";
import { cached, cacheDel } from "./cache";

// Cache TTLs are short on purpose: admins edit rates in /superadmin and
// must see the change reflected in money flows quickly. 60s is the cap;
// the explicit invalidate hook below cuts that to ~0 after a settings
// write. Cache keys are module-scoped so the invalidation contract is
// kept in one place.
const CK_SKZ_RATES = "fin:skz_rates";
const CK_REFERRAL_RATES = "fin:referral_rates";

export async function getSkzRates(): Promise<{ perUsdt: number; perStar: number; perTon: number }> {
  return cached(CK_SKZ_RATES, 60, async () => {
    const settings = await db
      .select()
      .from(platformSettingsTable)
      .where(inArray(platformSettingsTable.key, ["skz_per_usdt", "skz_per_star", "skz_per_ton"]));
    const map: Record<string, number> = {};
    for (const s of settings) map[s.key] = parseFloat(s.value);
    return {
      perUsdt: map["skz_per_usdt"] ?? 100,
      perStar: map["skz_per_star"] ?? 1,
      perTon:  map["skz_per_ton"]  ?? 500,
    };
  });
}

export async function getReferralRates(): Promise<number[]> {
  return cached(CK_REFERRAL_RATES, 60, async () => {
    const rows = await db
      .select()
      .from(platformSettingsTable)
      .where(inArray(platformSettingsTable.key, ["referral_l1_percent", "referral_l2_percent", "referral_l3_percent"]));
    const map: Record<string, number> = {};
    for (const r of rows) map[r.key] = parseFloat(r.value);
    return [
      (map["referral_l1_percent"] ?? 5)  / 100,
      (map["referral_l2_percent"] ?? 2)  / 100,
      (map["referral_l3_percent"] ?? 1)  / 100,
    ];
  });
}

/**
 * Call after ANY write to platform_settings keys that feed the cached
 * getters above. Safe to call when the write touched unrelated keys —
 * worst case is a single uncached refresh.
 */
export async function invalidateFinanceCache(): Promise<void> {
  await cacheDel(CK_SKZ_RATES, CK_REFERRAL_RATES);
}

// ── Commission override cache ─────────────────────────────────────────
// We cache ONLY the override-lookup result (per user+bot). The default
// rate comes from the `bots` row the caller already loaded via
// requireBot, so editing `bots.commissionRate` takes effect on the next
// request without any cache flush. Override edits are admin-only and we
// invalidate explicitly below. TTL is short on purpose: even if an
// invalidation is missed, the stale window is bounded.
const CK_COMM_OVERRIDE = (tg: bigint | string | number, slug: string): string =>
  `fin:comm:${String(tg)}:${slug}`;

export async function getEffectiveCommissionRate(
  telegramId: bigint,
  botSlug: string,
  defaultRate: string | number,
): Promise<number> {
  const hit = await cached<{ rate: string | null }>(
    CK_COMM_OVERRIDE(telegramId, botSlug),
    30,
    async () => {
      const [override] = await db
        .select({ rate: commissionOverridesTable.commissionRate })
        .from(commissionOverridesTable)
        .where(and(
          eq(commissionOverridesTable.telegramId, telegramId),
          eq(commissionOverridesTable.botSlug, botSlug),
        ))
        .limit(1);
      return { rate: override?.rate ?? null };
    },
  );
  return parseFloat(String(hit.rate ?? defaultRate));
}

export async function invalidateCommissionOverride(
  telegramId: bigint | string | number,
  botSlug: string,
): Promise<void> {
  await cacheDel(CK_COMM_OVERRIDE(telegramId, botSlug));
}

/**
 * Walk up the referral chain and credit bonuses to each referrer.
 * Returns list of paid bonuses (for logging/response).
 */
export async function distributeReferralBonuses(
  sourceUserId:       number,
  netEarned:          number,
  sourceTransactionId: number,
  botSlug:            string,
  rates:              number[],
): Promise<Array<{ level: number; referrerId: number; bonus: number }>> {
  const paid: Array<{ level: number; referrerId: number; bonus: number }> = [];
  let currentUserId = sourceUserId;

  for (let level = 0; level < rates.length; level++) {
    const rate = rates[level];
    if (!rate || rate <= 0) break;

    const [currentUser] = await db
      .select({ referrerId: usersTable.referrerId })
      .from(usersTable)
      .where(eq(usersTable.id, currentUserId));

    if (!currentUser?.referrerId) break;

    const referrerId = currentUser.referrerId;
    const bonus = parseFloat((netEarned * rate).toFixed(2));
    if (bonus <= 0) break;

    // Atomic SQL increment into the SEPARATE referral sub-balance + ledger
    // row inside one transaction — wallet and ledger can never drift apart.
    // Referral earnings accumulate here until the user clicks "transfer to
    // main wallet" in the bot; they are NOT spendable or withdrawable until
    // transferred. Pattern mirrors the rest of the codebase (numeric(18,2),
    // no JS read-modify-write).
    const ok = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(walletsTable)
        .set({
          referralBalanceSkz:          sql`${walletsTable.referralBalanceSkz}          + ${bonus}`,
          totalEarnedFromReferralsSkz: sql`${walletsTable.totalEarnedFromReferralsSkz} + ${bonus}`,
        })
        .where(eq(walletsTable.userId, referrerId))
        .returning({ id: walletsTable.id });

      if (!updated) return false;

      await tx.insert(transactionsTable).values({
        userId:      referrerId,
        type:        "referral_bonus",
        currency:    "skz",
        amount:      String(bonus),
        fee:         "0",
        status:      "completed",
        sourceBot:   botSlug,
        referenceId: String(sourceTransactionId),
        description: `إحالة مستوى ${level + 1} — مكافأة ${rate * 100}% من ربح مُحالك`,
      });
      return true;
    });

    if (!ok) { currentUserId = referrerId; continue; }

    paid.push({ level: level + 1, referrerId, bonus });
    currentUserId = referrerId;
  }

  return paid;
}
