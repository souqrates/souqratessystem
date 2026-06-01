const TOKEN_KEY = "superadmin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, withAuth = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withAuth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  loginUnauthed: <T>(path: string, body: unknown) => request<T>("POST", path, body, false),
};

// ─── Domain types ───────────────────────────────────────────────
export interface Bot {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  commissionRate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommissionOverride {
  id: number;
  telegramId: string | number;
  botSlug: string;
  commissionRate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  userFirstName?: string | null;
  userUsername?: string | null;
}

export interface BotText {
  id: number;
  botSlug: string;
  key: string;
  label: string;
  draftValue: string;
  publishedValue: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface SuperUser {
  id: number;
  telegramId: string | number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  isBlocked: boolean | null;
  isPremium: boolean | null;
  createdAt: string;
  balanceSkz: string | null;
  totalEarnedSkz: string | null;
}

export interface SuperWallet {
  id: number;
  userId: number;
  balanceSkz: string;
  balanceStars: string;
  balanceUsdt: string;
  balanceTon: string;
  totalEarnedSkz: string;
  totalWithdrawnSkz: string;
}

export interface SuperTransaction {
  id: number;
  userId: number;
  type: string;
  currency: string;
  amount: string;
  fee: string;
  status: string;
  sourceBot: string | null;
  description: string | null;
  createdAt: string;
  userTelegramId?: string | number | null;
  userFirstName?: string | null;
  userUsername?: string | null;
}

export interface SuperBroadcast {
  id: number;
  botSlug: string;
  audience: "all" | "bot" | "single" | string;
  targetValue: string | null;
  body: string;
  status: string;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SuperLink {
  id: number;
  key: string;
  label: string;
  url: string;
  category: string;
  isActive: boolean;
  notes: string | null;
  updatedAt: string;
}

export interface SuperErrorLog {
  id: number;
  source: string;
  level: string;
  message: string;
  stack: string | null;
  metadata: unknown;
  userTelegramId: string | number | null;
  resolved: boolean;
  createdAt: string;
}

export interface SuperWithdrawal {
  id: number;
  userId: number;
  currency: string;
  amount: string;
  fee: string;
  netAmount: string;
  method: string;
  address: string | null;
  txHash: string | null;
  status: string;
  rejectedReason: string | null;
  createdAt: string;
  processedAt: string | null;
  userTelegramId: string | number | null;
  userFirstName: string | null;
  userUsername: string | null;
}

export interface SkzRates {
  skzPerUsdt: string;
  skzPerStar: string;
  skzPerTon: string;
  updatedAt: string;
}

// ─── SCRATCHY economy config ───────────────────────────────────
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

export interface ScratchyConfigResponse {
  config: ScratchyConfig;
  defaults: ScratchyConfig;
}

// ─── Referral rates (L1/L2/L3) ─────────────────────────────────
export interface ReferralRates {
  l1Percent: string;
  l2Percent: string;
  l3Percent: string;
}

// ─── Daily financial report ────────────────────────────────────
export interface ReportDailyPoint {
  day: string;
  revenue: number;
  deposits: number;
  withdrawals: number;
  newUsers: number;
}

export interface ReportDailyResponse {
  from: string;
  to: string;
  series: ReportDailyPoint[];
  totals: {
    revenue: number;
    deposits: number;
    withdrawals: number;
    newUsers: number;
  };
}

// ─── Bot heartbeats (live up/down) ─────────────────────────────
export interface BotHealth {
  botSlug: string;
  status: "online" | "offline";
  reportedStatus: string | null;
  version: string | null;
  lastSeenAt: string | null;
  ageSec: number;
}
