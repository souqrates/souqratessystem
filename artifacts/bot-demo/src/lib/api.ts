/**
 * Sweep Mini App API client.
 * Sends X-Telegram-Init-Data on every request for authentication.
 * Falls back to X-Dev-Telegram-Id in dev (when initData is empty).
 */

const BASE = "/api/sweep";
const DEV_TELEGRAM_ID = "999999999"; // stable dev user

const BOT_API_KEY = import.meta.env.VITE_SWEEP_BOT_API_KEY as string | undefined;

function headers(initData: string): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (initData) {
    h["X-Telegram-Init-Data"] = initData;
  } else {
    h["X-Dev-Telegram-Id"] = DEV_TELEGRAM_ID;
  }
  if (BOT_API_KEY) {
    h["X-Bot-Api-Key"] = BOT_API_KEY;
  }
  return h;
}

async function get<T>(path: string, initData: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.href);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: headers(initData) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, initData: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(initData),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (b as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Response types ────────────────────────────────────────────────────────────

export interface SweepGameType {
  id: number;
  slug: string;
  name: string;
  nameAr: string;
  emoji: string;
  theme: string;
  priceSKZ: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BuyTicketResponse {
  ticketId: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  isWinner: boolean;
  prizeSkz: number;
  outcome: string[];
}

export interface SweepTicketRow {
  ticket: {
    id: number;
    isWin: boolean;
    prizeSkz: string;
    serverSeedHash: string;
    serverSeed: string;
    clientSeed: string;
    result: { outcome?: string[]; isWinner?: boolean; multiplier?: number } | null;
    createdAt: string;
  };
  gameSlug: string | null;
  gameName: string | null;
  gameNameAr: string | null;
  gameEmoji: string | null;
}

export interface LottoDraw {
  id: number;
  drawNumber: number;
  status: string;
  jackpotAmountSkz: string;
  totalEntries: number;
  closesAt: string | null;
  winningNumbers: number[] | null;
}

export interface LottoEntry {
  entry: {
    id: number;
    chosenNumbers: number[];
    matchCount: number | null;
    prizeSkz: string;
    isJackpot: boolean | null;
    createdAt: string;
  };
  drawNumber: number | null;
  drawStatus: string | null;
  winningNumbers: number[] | null;
  closesAt: string | null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export function getBalance(initData: string) {
  return get<{ balanceSkz: string }>("/balance", initData);
}

export function getGameTypes(initData: string) {
  return get<{ data: SweepGameType[]; jackpotBalanceSkz: string }>("/game-types", initData);
}

export function buyTicket(
  initData: string,
  gameSlug: string,
  clientSeed?: string,
  qty?: number,
) {
  return post<BuyTicketResponse>("/buy-ticket", initData, { gameSlug, clientSeed, qty });
}

export function getMyTickets(initData: string, limit = 30) {
  return get<{ data: SweepTicketRow[] }>("/my-tickets", initData, { limit: String(limit) });
}

export function getLottoCurrent(initData: string) {
  return get<{ draw: LottoDraw | null; jackpotBalanceSkz: string; entryPriceSKZ: number; closesAt: string | null }>("/lotto/current", initData);
}

export function enterLotto(initData: string, chosenNumbers: number[]) {
  return post<{ entry: LottoEntry["entry"]; drawId: number; drawNumber: number; entryPriceSKZ: number }>(
    "/lotto/enter",
    initData,
    { chosenNumbers },
  );
}

export function getMyLottoEntries(initData: string) {
  return get<{ data: LottoEntry[] }>("/lotto/my-entries", initData);
}
