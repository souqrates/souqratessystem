import { getInitData, getDevUserId, getUnsafeUser } from "./telegram";

const BASE = "/api";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const init = getInitData();
  if (init) {
    h["X-Telegram-Init-Data"] = init;
  } else {
    // Browser preview fallback
    const dev = getDevUserId();
    if (dev) {
      h["X-Dev-User-Id"] = dev;
      const u = getUnsafeUser();
      if (u?.first_name) h["X-Dev-User-Name"] = u.first_name;
    }
  }
  return h;
}

async function jget<T>(path: string, withAuth = false): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: withAuth ? authHeaders() : { Accept: "application/json" },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HTTP ${r.status}: ${text}`);
  }
  return (await r.json()) as T;
}

async function jpatch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HTTP ${r.status}: ${text}`);
  }
  return (await r.json()) as T;
}

export type ProfileMe = {
  profile: {
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    languageCode: string | null;
    xp: number;
    level: number;
    isBlocked: boolean;
  };
  wallet: {
    balanceSkz: string;
    balanceUsdt: string;
    balanceStars: number;
    balanceTon: string;
  };
  rank: {
    currentLevel: number;
    currentMinXp: number;
    nextLevel: number | null;
    nextMinXp: number | null;
    rankTitle: string;
    rankColor: string;
    rankIcon: string;
  };
};

export type Policy = {
  id: number;
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
};

export type PlatformLink = {
  id: number;
  kind: string;
  label: string;
  url: string;
  sortOrder: number;
  isVisible: boolean;
};

export type RankTitle = {
  level: number;
  title: string;
  minXp: number;
  color: string;
  icon: string;
};

export type LeaderboardScope = "xp" | "spend" | "votes" | "games";
export type LeaderboardEntry = {
  telegramId: string;
  displayName: string | null;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  metric: string;
};

export const getMe = () => jget<ProfileMe>("/profile/me", true);
export const updateMe = (patch: { displayName?: string; avatarUrl?: string }) =>
  jpatch<{ ok: boolean }>("/profile/me", patch);

export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("avatar", file);
  const r = await fetch(`${BASE}/profile/avatar/upload`, {
    method: "POST",
    headers: authHeaders(), // no Content-Type → browser sets multipart boundary
    body: fd,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HTTP ${r.status}: ${text}`);
  }
  return (await r.json()) as { url: string };
}

export const getPolicies = () =>
  jget<{ data: Policy[] }>("/policies").then((r) => r.data);
export const getPlatformLinks = () =>
  jget<{ data: PlatformLink[] }>("/platform-links").then((r) => r.data);
export const getRanks = () =>
  jget<{ data: RankTitle[] }>("/ranks").then((r) => r.data);
export const getLeaderboard = (scope: LeaderboardScope, limit = 50) =>
  jget<{ scope: string; data: LeaderboardEntry[] }>(
    `/leaderboard?scope=${scope}&limit=${limit}`,
  ).then((r) => r.data);
