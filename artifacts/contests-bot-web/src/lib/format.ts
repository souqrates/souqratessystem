export const fmtInt = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("ar-EG");
};

export const fmtSkz = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const pct = (part: number, total: number): number => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (part * 100) / total));
};
