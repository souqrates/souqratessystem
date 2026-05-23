import { supabase } from './supabase';
import { getVerifiedSession } from './telegram';
import { rankProgress, levelFromXp as rankLevelFromXp, RANK_THRESHOLDS } from './ranks';

let _userStateCache = null;
let _userStateCacheAt = 0;
const USER_STATE_TTL = 5000;

async function fetchUserState() {
  const now = Date.now();
  if (_userStateCache && now - _userStateCacheAt < USER_STATE_TTL) return _userStateCache;
  const sid = getVerifiedSession()?.session_id;
  if (!sid) return null;
  const { data, error } = await supabase.rpc('gm_get_user_state', { p_session_id: sid });
  if (error) return null;
  _userStateCache = data || null;
  _userStateCacheAt = now;
  return _userStateCache;
}

export function xpForLevel(level) {
  const idx = Math.min(RANK_THRESHOLDS.length, Math.max(1, level)) - 1;
  return RANK_THRESHOLDS[idx];
}

export function levelFromXp(xp) {
  return rankLevelFromXp(xp);
}

export function xpProgressToNext(xp) {
  const p = rankProgress(xp);
  return { level: p.level, inLevel: p.inLevel, span: p.span, pct: p.pct, nextAt: p.nextAt };
}

export async function fetchGamification() {
  const state = await fetchUserState();
  const gam = state?.gamification;
  return gam && Object.keys(gam).length ? gam : null;
}

export async function fetchStreak() {
  const state = await fetchUserState();
  const streak = state?.streak;
  return streak && Object.keys(streak).length ? streak : null;
}

export async function claimDailyStreak(telegramId) {
  if (!telegramId) return null;
  const { data, error } = await supabase.rpc('claim_daily_streak', { p_telegram_id: telegramId });
  if (error) return null;
  return Array.isArray(data) ? data[0] : data;
}

export async function awardXp(telegramId, amount) {
  if (!telegramId || !amount || amount <= 0) return null;
  const { data, error } = await supabase.rpc('award_xp', { p_telegram_id: telegramId, p_amount: amount });
  if (error) return null;
  return Array.isArray(data) ? data[0] : data;
}

export async function unlockAchievement(telegramId, code) {
  if (!telegramId || !code) return null;
  const { data, error } = await supabase.rpc('unlock_achievement', { p_telegram_id: telegramId, p_code: code });
  if (error) return null;
  return Array.isArray(data) ? data[0] : data;
}

export async function recordGameEnd(telegramId, won, difficulty = 'Medium') {
  if (!telegramId) return null;
  const { data, error } = await supabase.rpc('record_game_end', {
    p_telegram_id: telegramId,
    p_won: !!won,
    p_difficulty: String(difficulty || 'Medium'),
  });
  if (error) return null;
  // Signal subscribers (rank card, dashboard) that XP changed so they re-fetch.
  try {
    const mod = await import('../store/appStore');
    mod.default.getState().bumpGamification?.();
  } catch { /* non-fatal */ }
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchAchievementsCatalog() {
  const { data } = await supabase
    .from('achievements_catalog')
    .select('*')
    .order('sort_order', { ascending: true });
  return data || [];
}

export async function fetchUserAchievements() {
  const state = await fetchUserState();
  return Array.isArray(state?.achievements) ? state.achievements : [];
}

export function streakClaimedToday(streak) {
  if (!streak?.last_claim_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return streak.last_claim_date === today;
}
