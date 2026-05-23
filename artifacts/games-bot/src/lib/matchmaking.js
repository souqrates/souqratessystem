import { supabase } from './supabase';
import { getSessionId } from './session';

export const DEFAULT_MATCH_DURATION_SECONDS = 60;

// ─── Server clock sync ────────────────────────────────────────────────────────
// clockOffset = server_ms - local_ms, computed once per session
let _clockOffset = 0;
let _clockSynced = false;

export async function syncServerClock() {
  try {
    const localBefore = Date.now();
    const { data } = await supabase.rpc('match_get_server_time');
    const localAfter = Date.now();
    if (data?.server_ms) {
      const rtt = localAfter - localBefore;
      _clockOffset = data.server_ms - (localBefore + rtt / 2);
      _clockSynced = true;
    }
  } catch { /* fallback: offset stays 0 */ }
}

export function serverNow() {
  return Date.now() + _clockOffset;
}

export function isClockSynced() {
  return _clockSynced;
}

const TRANSIENT_PATTERNS = [/network/i, /timeout/i, /fetch/i, /503/, /502/, /504/, /ECONNRESET/i];

function isTransient(err) {
  const msg = String(err?.message || err);
  if (err?.code === 'PGRST301') return false;
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}

async function rpc(name, params, { retries = 3, baseDelay = 250 } = {}) {
  let attempt = 0;
  while (true) {
    const { data, error } = await supabase.rpc(name, params);
    if (!error) return data;
    if (attempt >= retries || !isTransient(error)) throw error;
    const jitter = Math.floor(Math.random() * 100);
    await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt + jitter));
    attempt++;
  }
}

export async function createRoom(gameId, _playerId, playerName, betAmount = 0, maxPlayers = 2, durationSeconds = DEFAULT_MATCH_DURATION_SECONDS, isPrivate = false, houseCutPercent = null) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  const params = {
    p_session_id: sid,
    p_game_id: gameId,
    p_bet_amount: betAmount,
    p_max_players: maxPlayers,
    p_duration_seconds: durationSeconds,
    p_player_name: playerName || '',
    p_is_private: isPrivate,
  };
  if (houseCutPercent !== null) params.p_house_cut_percent = houseCutPercent;
  return await rpc('match_create_room', params);
}

export function roomDeadlineMs(room) {
  if (!room?.started_at) return null;
  const dur = Number(room.match_duration_seconds) || DEFAULT_MATCH_DURATION_SECONDS;
  return new Date(room.started_at).getTime() + dur * 1000;
}

export function roomRemainingMs(room) {
  const dl = roomDeadlineMs(room);
  if (dl == null) return Infinity;
  return dl - serverNow();
}

export function isRoomExpired(room) {
  if (!room?.started_at) return false;
  return roomRemainingMs(room) <= 0;
}

// Fetch authoritative scores + server time for reconnect / fallback
export async function getServerRoomScores(roomId) {
  try {
    const { data } = await supabase.rpc('match_get_room_scores', { p_room_id: roomId });
    return data;
  } catch {
    return null;
  }
}

export async function joinRoom(roomId, _playerId, playerName) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  // DB resolves short codes, stripped UUIDs, and full UUIDs internally
  return await rpc('match_join_room', {
    p_session_id: sid,
    p_room_id: String(roomId),
    p_player_name: playerName || '',
  });
}

export async function forceStart4PlayerRoom(roomId) {
  try {
    const sid = await getSessionId();
    if (!sid) return null;
    return await rpc('match_force_start', { p_session_id: sid, p_room_id: roomId });
  } catch {
    return null;
  }
}

// ─── Broadcast relay URL ──────────────────────────────────────────────────────
const BROADCAST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score_snapshotter/broadcast`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sends score via Broadcast (sub-100ms) AND DB (every DB_WRITE_INTERVAL_MS)
// roomMeta: { playerName, slot } — used for broadcast payload
const DB_WRITE_INTERVAL_MS    = 3000;
const BROADCAST_THROTTLE_MS   = 500; // min gap between broadcast messages per room
const _dbWriteTimers          = new Map(); // roomId → last DB write timestamp
const _broadcastTimers        = new Map(); // roomId → last broadcast timestamp

// Remove room from throttle maps once done to prevent unbounded growth
export function clearRoomThrottle(roomId) {
  _dbWriteTimers.delete(roomId);
  _broadcastTimers.delete(roomId);
}

export async function updateLiveScore(roomId, _playerId, score, roomMeta = {}) {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const now = Date.now();

  // 1. Broadcast — throttled to BROADCAST_THROTTLE_MS to prevent flooding Realtime.
  //    Without throttling, 100K players scoring continuously floods the channel.
  const lastBroadcast = _broadcastTimers.get(roomId) || 0;
  if (roomMeta.slot != null && _playerId != null && now - lastBroadcast >= BROADCAST_THROTTLE_MS) {
    _broadcastTimers.set(roomId, now);
    fetch(BROADCAST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({
        room_id: roomId,
        player_id: _playerId,
        player_name: roomMeta.playerName || '',
        score: safeScore,
        slot: roomMeta.slot,
      }),
    }).catch(() => {});
  }

  // 2. Write to DB at most every DB_WRITE_INTERVAL_MS
  const lastWrite = _dbWriteTimers.get(roomId) || 0;
  if (now - lastWrite < DB_WRITE_INTERVAL_MS) {
    return { ok: true, deferred: true };
  }
  _dbWriteTimers.set(roomId, now);

  try {
    const sid = await getSessionId();
    if (!sid) return { ok: false, reason: 'session_required' };
    const result = await rpc('match_update_live_score', {
      p_session_id: sid,
      p_room_id: roomId,
      p_score: safeScore,
    });
    return result || { ok: true };
  } catch (e) {
    return { ok: false, reason: 'network' };
  }
}

export async function submitScore(roomId, _playerId, score) {
  try {
    const sid = await getSessionId();
    if (!sid) return { ok: false, reason: 'session_required' };
    const safeScore = Math.max(0, Math.floor(Number(score) || 0));
    await rpc('match_submit_score', {
      p_session_id: sid,
      p_room_id: roomId,
      p_score: safeScore,
    });
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('match_expired')) return { ok: false, reason: 'expired' };
    if (msg.includes('match_finished')) return { ok: false, reason: 'finished' };
    if (msg.includes('not_in_room')) return { ok: false, reason: 'not_joined' };
    return { ok: false, reason: msg };
  }
}

export async function sendEvent(roomId, playerId, eventType, payload = {}) {
  try {
    await supabase.from('match_events').insert({
      room_id: roomId,
      player_id: playerId,
      event_type: eventType,
      payload,
    });
  } catch {}
}

export function subscribeToRoom(roomId, onUpdate) {
  return supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'match_rooms',
      filter: `id=eq.${roomId}`,
    }, (payload) => onUpdate('room', payload.new))
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'match_events',
      filter: `room_id=eq.${roomId}`,
    }, (payload) => onUpdate('event', payload.new))
    // Broadcast channel for sub-100ms live score updates (no DB write)
    .on('broadcast', { event: 'score_update' }, (payload) => {
      onUpdate('broadcast_score', payload.payload);
    })
    .subscribe();
}

export function unsubscribeChannel(channel) {
  if (channel) supabase.removeChannel(channel);
}

export async function cancelRoom(roomId) {
  try {
    const sid = await getSessionId();
    if (!sid) return;
    await rpc('match_cancel_room', { p_session_id: sid, p_room_id: roomId });
  } catch { /* ignore */ }
}

// Minimum time a room must have remaining after join before we consider it playable
const MIN_ROOM_REMAINING_MS = 8000;

export async function quickMatch(gameId, playerId, playerName, maxPlayers = 2, betAmount = 0, durationSeconds = DEFAULT_MATCH_DURATION_SECONDS) {
  // Sync clock before scanning rooms so remaining-time checks are accurate
  if (!isClockSynced()) await syncServerClock();

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: rooms } = await supabase
    .from('match_rooms')
    .select()
    .eq('game_id', gameId)
    .eq('status', 'waiting')
    .eq('max_players', maxPlayers)
    .eq('bet_amount', betAmount)
    .eq('is_private', false)
    .neq('player1_id', playerId)
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: true })
    .limit(5);

  if (rooms && rooms.length > 0) {
    for (const room of rooms) {
      // Skip rooms where the game has already started and is nearly over
      if (room.started_at && roomRemainingMs(room) < MIN_ROOM_REMAINING_MS) continue;
      try {
        return await joinRoom(room.id, playerId, playerName);
      } catch {
        continue;
      }
    }
  }
  return await createRoom(gameId, playerId, playerName, betAmount, maxPlayers, durationSeconds, false);
}
