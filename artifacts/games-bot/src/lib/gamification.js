/**
 * Central gamification adapter — XP / ranks / streak data comes from the
 * SOUQRATES SYSTEM API (/api/games/gamification) instead of Supabase.
 * Exported API surface is identical to the old version so components need
 * zero changes.
 */
import { rankProgress, levelFromXp as rankLevelFromXp, RANK_THRESHOLDS } from './ranks';

// ── Internal fetch helper ────────────────────────────────────────────────────

function getInitData() {
  try { return window.Telegram?.WebApp?.initData ?? ''; }
  catch { return ''; }
}

async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Cache (5 s TTL) ───────────────────────────────────────────────────────────

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5_000;

export function invalidateUserState() {
  _cache = null;
  _cacheAt = 0;
  try {
    import('../store/appStore').then(m => m.default.getState().bumpGamification?.()).catch(() => {});
  } catch { /* non-fatal */ }
}

async function fetchFromApi({ force = false } = {}) {
  const now = Date.now();
  if (!force && _cache && now - _cacheAt < CACHE_TTL) return _cache;
  try {
    const data = await apiCall('GET', '/api/games/gamification');
    _cache = data;
    _cacheAt = now;
    return data;
  } catch {
    return null;
  }
}

// ── Public API (same signatures as old Supabase version) ─────────────────────

/** Returns { xp, total_games, total_wins } — shape expected by GamificationCard / PlayerRankCard. */
export async function fetchGamification() {
  const d = await fetchFromApi();
  if (!d) return null;
  return {
    xp:          d.xp         ?? 0,
    total_games: d.totalGames ?? 0,
    total_wins:  d.totalWins  ?? 0,
  };
}

/** Returns { current_streak, longest_streak, last_claim_date, can_claim }. */
export async function fetchStreak() {
  const d = await fetchFromApi();
  if (!d) return null;
  return {
    current_streak:  d.streakDays    ?? 0,
    longest_streak:  d.longestStreak ?? 0,
    last_claim_date: d.streakLastClaimAt ? String(d.streakLastClaimAt).slice(0, 10) : null,
    can_claim:       !!d.canClaimStreak,
  };
}

/** Claim daily streak. Returns updated streak object. */
export async function claimDailyStreak(_telegramId) {
  const res = await apiCall('POST', '/api/games/claim-streak');
  invalidateUserState();
  return {
    current_streak:  res.streakDays    ?? 0,
    longest_streak:  res.longestStreak ?? 0,
    last_claim_date: new Date().toISOString().slice(0, 10),
    can_claim:       false,
  };
}

/** Award XP for a game result — replaces Supabase recordGameEnd. */
export async function recordGameEnd(_telegramId, won, difficulty = 'Medium') {
  try {
    await apiCall('POST', '/api/games/award-xp', {
      won:        !!won,
      difficulty: String(difficulty || 'Medium'),
    });
    invalidateUserState();
  } catch { /* non-fatal */ }
}

/** True if user already claimed today. */
export function streakClaimedToday(streak) {
  if (!streak?.last_claim_date) return false;
  return streak.last_claim_date === new Date().toISOString().slice(0, 10);
}

// ── XP math helpers (pure, no API calls) ─────────────────────────────────────

export function xpForLevel(level) {
  const idx = Math.min(RANK_THRESHOLDS.length, Math.max(1, level)) - 1;
  return RANK_THRESHOLDS[idx];
}

export function levelFromXp(xp) { return rankLevelFromXp(xp); }

export function xpProgressToNext(xp) {
  const p = rankProgress(xp);
  return { level: p.level, inLevel: p.inLevel, span: p.span, pct: p.pct, nextAt: p.nextAt };
}

// Stubs kept for backward-compat
export async function awardXp() { return null; }
export async function unlockAchievement() { return null; }
export async function fetchAchievementsCatalog() { return []; }
export async function fetchUserAchievements() { return []; }
