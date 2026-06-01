/**
 * SOUQRATES SCRATCHY economy config — the authoritative source of truth for
 * ticket prices, prize tables, win weights and the jackpot formula.
 *
 * Stored as a single JSON blob in `platform_settings` under the key
 * `scratchy_config` so the super-admin can edit every knob live (no restart).
 * Reads go through the two-tier `cached()` layer (60s TTL); every write MUST
 * call `invalidateScratchyConfig()` in the same handler — same contract as
 * getSkzRates / invalidateFinanceCache.
 *
 * SECURITY: this is the ONLY place the server learns a ticket's cost and the
 * prize roll weights. `/api/scratchy/play` reads from here and rolls the
 * prize server-side — the client never supplies cost or prize. A malformed
 * stored blob falls back to DEFAULT_SCRATCHY_CONFIG rather than crashing the
 * money path.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";
import { cached, cacheDel } from "./cache";

export const SCRATCHY_CONFIG_KEY = "scratchy_config";
const CK_SCRATCHY_CONFIG = "scratchy_config";

/** Number of prize buckets per tier (bucket 0 is the "no win" outcome). */
export const PRIZE_BUCKETS = 5;

export interface ScratchyTier {
  id: string;
  label: string;
  icon: string;
  cost: number;
  prizes: number[];
  weights: number[];
}

export interface ScratchyConfig {
  tiers: ScratchyTier[];
  jackpotBase: number;
  jackpotMultiplier: number;
}

// ── Canonical defaults ────────────────────────────────────────────────────
// Mirrors the original hardcoded SCRATCH_TIERS + bot-demo/src/lib/games-data
// labels. Used when no row exists yet or a stored blob fails validation.
export const DEFAULT_SCRATCHY_CONFIG: ScratchyConfig = {
  tiers: [
    { id: "t1", label: "برونزي", icon: "◈", cost: 1,   prizes: [0, 2, 3, 5, 10],            weights: [0.55, 0.22, 0.12, 0.08, 0.03] },
    { id: "t2", label: "فضي",   icon: "◆", cost: 5,   prizes: [0, 8, 15, 25, 50],          weights: [0.53, 0.23, 0.12, 0.08, 0.04] },
    { id: "t3", label: "ذهبي",  icon: "★", cost: 20,  prizes: [0, 35, 80, 140, 200],       weights: [0.50, 0.25, 0.13, 0.08, 0.04] },
    { id: "t4", label: "ملكي",  icon: "✦", cost: 100, prizes: [0, 175, 400, 700, 1000],    weights: [0.48, 0.26, 0.14, 0.08, 0.04] },
    { id: "t5", label: "ماسي",  icon: "◉", cost: 500, prizes: [0, 900, 2000, 3500, 5000],  weights: [0.45, 0.28, 0.14, 0.09, 0.04] },
  ],
  jackpotBase: 5000,
  jackpotMultiplier: 3,
};

// ── Validation schema ─────────────────────────────────────────────────────
const tierSchema = z.object({
  id: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(8),
  cost: z.number().positive().max(1_000_000),
  prizes: z.array(z.number().min(0).max(100_000_000)).length(PRIZE_BUCKETS),
  weights: z.array(z.number().min(0).max(1)).length(PRIZE_BUCKETS),
});

export const scratchyConfigSchema = z
  .object({
    tiers: z.array(tierSchema).min(1).max(10),
    jackpotBase: z.number().min(0).max(100_000_000),
    jackpotMultiplier: z.number().min(0).max(10_000),
  })
  .refine(
    (cfg) => new Set(cfg.tiers.map((t) => t.id)).size === cfg.tiers.length,
    { message: "معرّفات الفئات (id) يجب أن تكون فريدة", path: ["tiers"] },
  )
  .refine(
    (cfg) =>
      cfg.tiers.every((t) => {
        const sum = t.weights.reduce((a, b) => a + b, 0);
        return sum > 0 && sum <= 1.0001;
      }),
    {
      message: "مجموع الاحتمالات لكل فئة يجب أن يكون أكبر من 0 وألا يتجاوز 1",
      path: ["tiers"],
    },
  );

export type ScratchyConfigInput = z.infer<typeof scratchyConfigSchema>;

/**
 * Read the live economy config. Falls back to DEFAULT_SCRATCHY_CONFIG when no
 * row exists or the stored blob is corrupt — never throws on the money path.
 */
export async function getScratchyConfig(): Promise<ScratchyConfig> {
  return cached(CK_SCRATCHY_CONFIG, 60, async () => {
    const [row] = await db
      .select({ value: platformSettingsTable.value })
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, SCRATCHY_CONFIG_KEY));

    if (!row?.value) return DEFAULT_SCRATCHY_CONFIG;
    try {
      return scratchyConfigSchema.parse(JSON.parse(row.value)) as ScratchyConfig;
    } catch {
      return DEFAULT_SCRATCHY_CONFIG;
    }
  });
}

/** Persist a validated config and drop the cache so the next read re-hydrates. */
export async function saveScratchyConfig(cfg: ScratchyConfig): Promise<void> {
  const value = JSON.stringify(cfg);
  await db
    .insert(platformSettingsTable)
    .values({ key: SCRATCHY_CONFIG_KEY, value, description: "SCRATCHY economy: tiers, prizes, weights, jackpot" })
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
  await invalidateScratchyConfig();
}

export async function invalidateScratchyConfig(): Promise<void> {
  await cacheDel(CK_SCRATCHY_CONFIG);
}

/** Derived helpers for display — P(win) and expected return-to-player. */
export function tierWinRate(tier: ScratchyTier): number {
  return tier.weights.reduce((acc, w, i) => acc + (tier.prizes[i] > 0 ? w : 0), 0);
}

export function tierRtp(tier: ScratchyTier): number {
  if (tier.cost <= 0) return 0;
  const expected = tier.weights.reduce((acc, w, i) => acc + w * tier.prizes[i], 0);
  return expected / tier.cost;
}
