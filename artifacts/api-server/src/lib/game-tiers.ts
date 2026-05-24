export interface PriceTier {
  label: string;
  entryFee: number;
  winAmount: number;
}

export const DEFAULT_TIER_LABELS = ["مبتدئ", "عادي", "متقدم", "محترف", "VIP"];
export const DEFAULT_TIER_MULTIPLIERS = [1, 5, 10, 25, 100];

// Last-resort base values when a config row has corrupt/non-finite
// entryFee/winAmount. Chosen to mirror the catalog defaults used by the
// seed function so behaviour is consistent with a never-edited game.
const SAFE_BASE_FEE = 10;
const SAFE_BASE_WIN = 30;

/**
 * Normalize raw stored price-tier JSON into exactly 5 valid tiers.
 *
 * IMPORTANT: This MUST be applied identically wherever tiers are read.
 * If `/games/configs` (read by the client to render the tier picker)
 * normalizes but `/internal/game/charge-entry` (which validates the
 * amount the client sends) does NOT, the client will offer tiers the
 * server rejects — which is the "only the first tier works" bug.
 *
 * Missing/invalid entries are filled from `baseFee × multiplier` and
 * `baseWin × multiplier` using the default multipliers (1, 5, 10, 25, 100).
 * Non-finite or negative base values are clamped to SAFE_BASE_* so the
 * output is always 5 finite, non-negative tiers — never NaN — which would
 * otherwise silently break charge-entry tier matching.
 */
export function normalizeTiers(
  raw: unknown,
  baseFee: number,
  baseWin: number,
): PriceTier[] {
  const sf = Number.isFinite(baseFee) && baseFee >= 0 ? baseFee : SAFE_BASE_FEE;
  const sw = Number.isFinite(baseWin) && baseWin >= 0 ? baseWin : SAFE_BASE_WIN;
  const arr = Array.isArray(raw) ? raw : [];
  const out: PriceTier[] = [];
  for (let i = 0; i < 5; i++) {
    const t = (arr[i] ?? {}) as Record<string, unknown>;
    const fallbackFee = +(sf * DEFAULT_TIER_MULTIPLIERS[i]).toFixed(2);
    const fallbackWin = +(sw * DEFAULT_TIER_MULTIPLIERS[i]).toFixed(2);
    const fee =
      typeof t.entryFee === "number"
        ? t.entryFee
        : typeof t.entryFee === "string"
          ? parseFloat(t.entryFee)
          : fallbackFee;
    const win =
      typeof t.winAmount === "number"
        ? t.winAmount
        : typeof t.winAmount === "string"
          ? parseFloat(t.winAmount)
          : fallbackWin;
    const label =
      typeof t.label === "string" && t.label.trim()
        ? t.label.trim()
        : DEFAULT_TIER_LABELS[i];
    out.push({
      label,
      entryFee: Number.isFinite(fee) && fee >= 0 ? fee : fallbackFee,
      winAmount: Number.isFinite(win) && win >= 0 ? win : fallbackWin,
    });
  }
  return out;
}
