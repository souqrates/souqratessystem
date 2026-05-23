import { SUPABASE_CONFIG } from '../constants';
import { getSessionId } from './session';

const EDGE_URL = `${SUPABASE_CONFIG.url}/functions/v1/bot_fill`;
const ANON_KEY = SUPABASE_CONFIG.anonKey;

async function call(body) {
  try {
    const sid = await getSessionId();
    if (!sid) return { ok: false, error: 'session_required' };
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'Apikey': ANON_KEY,
      },
      body: JSON.stringify({ ...body, session_id: sid }),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

// 2-player: add one bot during waiting phase
export function addBot2P(roomId) {
  return call({ type: 'add_bot_2p', room_id: roomId });
}

// 2-player: submit bot score after game ends
export function submitBotScore2P(roomId, gameId, difficulty = 'medium') {
  return call({ type: 'submit_bot_score_2p', room_id: roomId, game_id: gameId, difficulty });
}

// 4-player: start adding bots one by one in background (returns immediately)
export function addBots4P(roomId) {
  return call({ type: 'add_bots_4p', room_id: roomId });
}

// 4-player: force start now (fills remaining empty slots + sets playing)
export function forceStart4P(roomId) {
  return call({ type: 'force_start_4p', room_id: roomId });
}

// 4-player: submit bot scores after game ends
export function submitBotScores4P(roomId, gameId, difficulty = 'medium') {
  return call({ type: 'submit_bot_scores_4p', room_id: roomId, game_id: gameId, difficulty });
}

// Group: start adding bots in background (returns immediately)
export function addBotsGroup(roomId, count = 5) {
  return call({ type: 'add_bots_group', room_id: roomId, count });
}

// Group: force start now (fills bots if needed + starts tournament)
export function forceStartGroup(roomId) {
  return call({ type: 'force_start_group', room_id: roomId });
}

// Group: submit bot scores after game ends
export function submitBotScoresGroup(roomId, gameId, difficulty = 'medium') {
  return call({ type: 'submit_bot_scores_group', room_id: roomId, game_id: gameId, difficulty });
}

// Private 2-player room: force start with current players only (no bots)
export function forceStart2P(roomId) {
  return call({ type: 'force_start_2p_private', room_id: roomId });
}

// Private 4-player room: force start with whoever joined (no bots added)
export function forceStart4PPrivate(roomId) {
  return call({ type: 'force_start_4p_private', room_id: roomId });
}
