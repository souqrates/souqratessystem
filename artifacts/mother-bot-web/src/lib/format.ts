export function fmtInt(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("ar-EG").format(Math.floor(v));
}

export function fmtSkz(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(v);
}

export function pct(x: number): string {
  return `${Math.max(0, Math.min(100, Math.round(x)))}٪`;
}

export function xpProgress(
  xp: number,
  currentMinXp: number,
  nextMinXp: number | null,
): number {
  if (!nextMinXp || nextMinXp <= currentMinXp) return 100;
  const range = nextMinXp - currentMinXp;
  const got = xp - currentMinXp;
  return (got / range) * 100;
}
