/**
 * Shared financial helpers used by both /api/internal/* and /api/games/* routes.
 * Keep this file pure DB logic — no Express types.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  platformSettingsTable,
} from "@workspace/db";

export async function getSkzRates(): Promise<{ perUsdt: number; perStar: number; perTon: number }> {
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
}

export async function getReferralRates(): Promise<number[]> {
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

    const [referrerWallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, referrerId));

    if (!referrerWallet) { currentUserId = referrerId; continue; }

    const newBalance     = (parseFloat(referrerWallet.balanceSkz)     + bonus).toFixed(2);
    const newTotalEarned = (parseFloat(referrerWallet.totalEarnedSkz) + bonus).toFixed(2);

    await db
      .update(walletsTable)
      .set({ balanceSkz: newBalance, totalEarnedSkz: newTotalEarned })
      .where(eq(walletsTable.id, referrerWallet.id));

    await db.insert(transactionsTable).values({
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

    paid.push({ level: level + 1, referrerId, bonus });
    currentUserId = referrerId;
  }

  return paid;
}
