import { supabase } from './supabase';
import { getSessionId } from './session';

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

const GAME_NAMES = {
  41: 'Blitz Tap', 42: 'Sky Race', 43: 'Word Storm', 44: 'Math King',
  45: 'Color War', 46: 'Reflex King', 47: 'Asteroid Field', 48: 'Bubble Burst',
  49: 'Neon Snake', 50: 'Memory Flash', 51: 'Gravity Ball', 52: 'Pixel Art',
  53: 'Laser Maze', 54: 'Tower Build', 55: 'Rhythm Battle',
  71: 'Plasma Catch', 72: 'Photon Trace', 73: 'Ion Storm',
  74: 'Glyph Forge', 75: 'Vortex Hunt',
};

function gameName(id) {
  return GAME_NAMES[id] || 'Group Game';
}

export async function createTournament(gameId, gameNameArg, _playerId, playerName, durationSeconds = 60, betAmount = 0, isPrivate = false) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('tour_create_room', {
    p_session_id: sid,
    p_game_id: gameId,
    p_game_name: gameNameArg || gameName(gameId),
    p_duration_seconds: durationSeconds,
    p_bet_amount: betAmount,
    p_host_name: playerName || '',
    p_is_private: isPrivate,
  });
}

export async function joinTournament(roomId, _playerId, playerName) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('tour_join_room', {
    p_session_id: sid,
    p_room_id: roomId,
    p_player_name: playerName || '',
  });
}

export async function startTournament(roomId) {
  const sid = await getSessionId();
  if (!sid) throw new Error('session_required');
  return await rpc('tour_start', { p_session_id: sid, p_room_id: roomId });
}

export function isTournamentExpired(room) {
  if (!room?.ends_at) return false;
  return Date.now() > new Date(room.ends_at).getTime();
}

export async function submitTournamentScore(roomId, _playerId, score) {
  try {
    const sid = await getSessionId();
    if (!sid) return { ok: false, reason: 'session_required' };
    await rpc('tour_submit_score', {
      p_session_id: sid,
      p_room_id: roomId,
      p_score: Math.max(0, Math.floor(Number(score) || 0)),
    });
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('tournament_expired') || msg.includes('tournament_ended')) return { ok: false, reason: 'expired' };
    if (msg.includes('not_joined')) return { ok: false, reason: 'not_joined' };
    return { ok: false, reason: msg };
  }
}

export async function finishTournament(roomId) {
  try {
    const sid = await getSessionId();
    if (!sid) return;
    await rpc('tour_finish', { p_session_id: sid, p_room_id: roomId });
  } catch { /* ignore */ }
}

export async function getLeaderboard(roomId, limit = 50) {
  const { data, error } = await supabase
    .from('tournament_players')
    .select('player_id, player_name, score, rank, joined_at')
    .eq('room_id', roomId)
    .order('score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getTournamentRoom(roomId) {
  const { data } = await supabase
    .from('tournament_rooms')
    .select()
    .eq('id', roomId)
    .maybeSingle();
  return data;
}

export async function quickJoinTournament(gameId, playerId, playerName, durationSeconds = 60, betAmount = 0) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: rooms } = await supabase
    .from('tournament_rooms')
    .select()
    .eq('game_id', gameId)
    .eq('status', 'waiting')
    .eq('bet_amount', betAmount)
    .eq('is_private', false)
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false })
    .limit(3);

  if (rooms && rooms.length > 0) {
    for (const room of rooms) {
      try {
        return await joinTournament(room.id, playerId, playerName);
      } catch { continue; }
    }
  }
  return await createTournament(gameId, gameName(gameId), playerId, playerName, durationSeconds, betAmount);
}

export function subscribeToTournament(roomId, onRoomUpdate, onPlayerUpdate, onEvent) {
  return supabase
    .channel(`tournament:${roomId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tournament_rooms',
      filter: `id=eq.${roomId}`,
    }, (payload) => onRoomUpdate && onRoomUpdate(payload.new))
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tournament_players',
      filter: `room_id=eq.${roomId}`,
    }, (payload) => onPlayerUpdate && onPlayerUpdate(payload.new))
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'tournament_events',
      filter: `room_id=eq.${roomId}`,
    }, (payload) => onEvent && onEvent(payload.new))
    .subscribe();
}

export function unsubscribeTournament(channel) {
  if (channel) supabase.removeChannel(channel);
}

export async function sendTournamentEvent(roomId, playerId, eventType, payload = {}) {
  await supabase.from('tournament_events').insert({
    room_id: roomId, player_id: playerId, event_type: eventType, payload,
  });
}

export async function cancelTournament(roomId) {
  try {
    const sid = await getSessionId();
    if (!sid) return;
    await rpc('tour_cancel_room', { p_session_id: sid, p_room_id: roomId });
  } catch { /* ignore */ }
}
