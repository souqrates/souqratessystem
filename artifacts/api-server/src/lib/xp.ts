import { db } from "@workspace/db";
import {
  usersTable,
  xpRulesTable,
  xpEventsTable,
  rankTitlesTable,
} from "@workspace/db";
import { eq, sql, desc, asc, lte } from "drizzle-orm";

/**
 * XP awarding + rank computation helpers.
 *
 * Call awardXp() from any successful action (spend, vote, purchase, …).
 * It looks up the configured xp_per_unit for the eventKind, multiplies by
 * units, writes an audit row, and atomically increments users.xp.
 *
 * If the user crosses a rank threshold their users.level is updated too.
 */

export type EventKind =
  | "skz_spend"
  | "contest_vote"
  | "game_play"
  | "game_win"
  | "book_purchase"
  | "daily_login"
  | "referral";

const ruleCache = new Map<string, { xpPerUnit: number; isActive: boolean; at: number }>();
const RULE_TTL_MS = 30_000;

async function getRule(eventKind: string): Promise<{ xpPerUnit: number; isActive: boolean }> {
  const cached = ruleCache.get(eventKind);
  if (cached && Date.now() - cached.at < RULE_TTL_MS) return cached;
  const [row] = await db
    .select({ xpPerUnit: xpRulesTable.xpPerUnit, isActive: xpRulesTable.isActive })
    .from(xpRulesTable)
    .where(eq(xpRulesTable.eventKind, eventKind));
  const out = row
    ? { xpPerUnit: row.xpPerUnit, isActive: row.isActive }
    : { xpPerUnit: 0, isActive: false };
  ruleCache.set(eventKind, { ...out, at: Date.now() });
  return out;
}

export function invalidateXpRuleCache(): void {
  ruleCache.clear();
}

export async function computeLevelForXp(xp: number): Promise<number> {
  const [row] = await db
    .select({ level: rankTitlesTable.level })
    .from(rankTitlesTable)
    .where(lte(rankTitlesTable.minXp, xp))
    .orderBy(desc(rankTitlesTable.level))
    .limit(1);
  return row?.level ?? 1;
}

export async function awardXp(opts: {
  telegramId: bigint | string | number;
  eventKind: EventKind | string;
  units: number;
  sourceBotSlug?: string | null;
  refType?: string | null;
  refId?: string | null;
}): Promise<{ awarded: number; newXp: number; newLevel: number } | null> {
  const tg = typeof opts.telegramId === "bigint" ? opts.telegramId : BigInt(opts.telegramId);
  const units = Math.max(0, Math.floor(opts.units));
  if (!units) return null;

  const rule = await getRule(opts.eventKind);
  if (!rule.isActive || rule.xpPerUnit <= 0) return null;

  const amount = units * rule.xpPerUnit;

  // Write audit row + increment users.xp atomically (best-effort)
  await db.insert(xpEventsTable).values({
    telegramId: tg,
    eventKind: opts.eventKind,
    sourceBotSlug: opts.sourceBotSlug ?? null,
    amountXp: amount,
    refType: opts.refType ?? null,
    refId: opts.refId ?? null,
  });

  const [updated] = await db
    .update(usersTable)
    .set({ xp: sql`${usersTable.xp} + ${amount}` })
    .where(eq(usersTable.telegramId, tg))
    .returning({ newXp: usersTable.xp, currentLevel: usersTable.level });

  if (!updated) return null;

  const newLevel = await computeLevelForXp(updated.newXp);
  if (newLevel !== updated.currentLevel) {
    await db
      .update(usersTable)
      .set({ level: newLevel })
      .where(eq(usersTable.telegramId, tg));
  }
  return { awarded: amount, newXp: updated.newXp, newLevel };
}

/** Fetch next-level threshold for a given xp value. Returns null at level 100. */
export async function getNextLevelInfo(xp: number): Promise<{
  currentLevel: number;
  currentMinXp: number;
  nextLevel: number | null;
  nextMinXp: number | null;
  rankTitle: string;
  rankColor: string;
  rankIcon: string;
}> {
  const [cur] = await db
    .select()
    .from(rankTitlesTable)
    .where(lte(rankTitlesTable.minXp, xp))
    .orderBy(desc(rankTitlesTable.level))
    .limit(1);
  const currentLevel = cur?.level ?? 1;
  const currentMinXp = cur?.minXp ?? 0;
  const [next] = await db
    .select()
    .from(rankTitlesTable)
    .where(sql`${rankTitlesTable.level} > ${currentLevel}`)
    .orderBy(asc(rankTitlesTable.level))
    .limit(1);
  return {
    currentLevel,
    currentMinXp,
    nextLevel: next?.level ?? null,
    nextMinXp: next?.minXp ?? null,
    rankTitle: cur?.title ?? "مبتدئ",
    rankColor: cur?.color ?? "#eab308",
    rankIcon: cur?.icon ?? "★",
  };
}
