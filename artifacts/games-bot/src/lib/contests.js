import { supabase } from './supabase';
import { getSessionId } from './session';

const BROADCAST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score_snapshotter/broadcast`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export const HOUSE_CUT_PERCENT = 30;

export async function createContest({
  gameId,
  gameName,
  title,
  maxSeats,
  entryFee,
  durationSeconds,
  startAt,
}) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_create', {
    p_session_id: sid,
    p_game_id: Number(gameId),
    p_game_name: gameName || 'Group Game',
    p_title: title || gameName || 'Contest',
    p_max_seats: Math.max(2, Math.min(1200, Number(maxSeats) || 50)),
    p_entry_fee: Number(entryFee) || 0,
    p_duration_seconds: Math.max(15, Math.min(1800, Number(durationSeconds) || 60)),
    p_start_at: startAt ? new Date(startAt).toISOString() : null,
  });
}

export async function joinContestByToken(token) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_join', { p_session_id: sid, p_share_token: token });
}

export async function joinContestById(roomId) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_join_by_id', { p_session_id: sid, p_room_id: roomId });
}

export async function leaveContest(roomId) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_leave', { p_session_id: sid, p_room_id: roomId });
}

export async function startContestNow(roomId) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_start_now', { p_session_id: sid, p_room_id: roomId });
}

export async function autoStartContest(roomId) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_auto_start', { p_session_id: sid, p_room_id: roomId });
}

export async function finalizeContest(roomId) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('contest_finalize', { p_session_id: sid, p_room_id: roomId });
}

export async function listOpenContests(limit = 50) {
  const { data, error } = await supabase.rpc('contest_list_open', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function getContest(roomId) {
  const { data } = await supabase
    .from('tournament_rooms')
    .select()
    .eq('id', roomId)
    .maybeSingle();
  return data;
}

export async function getContestParticipants(roomId, limit = 200) {
  const { data } = await supabase
    .from('tournament_players')
    .select('player_id, player_name, score, rank, joined_at')
    .eq('room_id', roomId)
    .order('score', { ascending: false })
    .limit(limit);
  return data || [];
}

// Subscribes to contest room changes.
// Room status changes use postgres_changes (low frequency).
// Live score updates use broadcast (sub-100ms, no DB replication overhead).
export function subscribeContest(roomId, onRoom, onPlayers) {
  return supabase
    .channel(`contest:${roomId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tournament_rooms',
      filter: `id=eq.${roomId}`,
    }, (p) => onRoom && onRoom(p.new))
    // DB changes still capture join/leave/final scores
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'tournament_players',
      filter: `room_id=eq.${roomId}`,
    }, (p) => onPlayers && onPlayers(p.new))
    // Broadcast for live score updates during gameplay (no DB write per tick)
    .on('broadcast', { event: 'score_update' }, (msg) => {
      onPlayers && onPlayers(msg.payload);
    })
    .subscribe();
}

export function unsubscribeContest(channel) {
  if (channel) supabase.removeChannel(channel);
}

// Submit score to DB (authoritative) — throttled to once per 3s by caller
export async function submitContestScore(roomId, score) {
  const sid = await getSessionId();
  if (!sid) return { ok: false, reason: 'session_required' };
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const { data, error } = await supabase.rpc('contest_submit_score', {
    p_session_id: sid,
    p_room_id: roomId,
    p_score: safeScore,
  });
  if (error) return { ok: false, reason: error.message };
  return data || { ok: true };
}

// Broadcast live score (fire-and-forget, no DB write)
export function broadcastContestScore(roomId, playerId, playerName, score) {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  fetch(BROADCAST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ room_id: roomId, player_id: playerId, player_name: playerName || '', score: safeScore, slot: 0 }),
  }).catch(() => {});
}

export function buildShareUrl(token, botUsername = 'Souqrates_skillz_bot') {
  const base = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
  const webUrl = `${base}?contest=${encodeURIComponent(token)}`;
  const tgUrl = `https://t.me/${botUsername}?startapp=contest_${token}`;
  return { webUrl, tgUrl };
}

export function contestStatusLabel(s) {
  switch (s) {
    case 'waiting':   return 'Open';
    case 'countdown': return 'Starting';
    case 'playing':   return 'Live';
    case 'finished':  return 'Ended';
    case 'cancelled': return 'Cancelled';
    default: return s || '—';
  }
}

export function contestStatusColor(s) {
  switch (s) {
    case 'waiting':   return '#22d3ee';
    case 'countdown': return '#f59e0b';
    case 'playing':   return '#10b981';
    case 'finished':  return '#94a3b8';
    case 'cancelled': return '#ef4444';
    default: return '#94a3b8';
  }
}
