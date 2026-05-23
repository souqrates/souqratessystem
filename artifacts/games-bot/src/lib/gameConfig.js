import { supabase } from './supabase';

const _cache = new Map();

export async function loadGameConfig(gameId) {
  if (_cache.has(gameId)) return _cache.get(gameId);
  try {
    const { data, error } = await supabase.rpc('get_game_config', { p_game_id: gameId });
    if (error) throw error;
    const cfg = data || { game_id: gameId, enabled: true, params: {} };
    _cache.set(gameId, cfg);
    return cfg;
  } catch {
    const fallback = { game_id: gameId, enabled: true, params: {} };
    _cache.set(gameId, fallback);
    return fallback;
  }
}

export function clearGameConfigCache() {
  _cache.clear();
}

export function paramOr(cfg, key, fallback) {
  if (!cfg || !cfg.params) return fallback;
  const v = cfg.params[key];
  return v === undefined || v === null ? fallback : v;
}
