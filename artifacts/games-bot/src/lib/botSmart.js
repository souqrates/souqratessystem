import { supabase } from './supabase';

const DEFAULTS = {
  enable_pvp: true,
  enable_quad: true,
  enable_group: true,
  pvp_join_probability: 0.85,
  quad_join_probability: 0.9,
  group_join_probability: 0.95,
  pvp_min_wait_ms: 3000,
  pvp_max_wait_ms: 9000,
  quad_min_wait_ms: 3000,
  quad_max_wait_ms: 8000,
  group_min_wait_ms: 2000,
  group_max_wait_ms: 8000,
  peak_hours: [18, 19, 20, 21, 22],
  peak_probability_multiplier: 0.45,
};

let cache = null;
let cacheAt = 0;
const TTL = 45_000;

export async function getBotSmartConfig() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL) return cache;
  try {
    const { data, error } = await supabase.rpc('get_bot_smart_config');
    if (error || !data) {
      cache = DEFAULTS;
    } else {
      cache = { ...DEFAULTS, ...data };
    }
  } catch {
    cache = DEFAULTS;
  }
  cacheAt = now;
  return cache;
}

export function invalidateBotSmartConfig() {
  cache = null;
  cacheAt = 0;
}

function rand(min, max) {
  return Math.floor(min + Math.random() * Math.max(1, max - min));
}

export async function decideBotEntry(mode) {
  const cfg = await getBotSmartConfig();
  const enabled = mode === 'pvp' ? cfg.enable_pvp : mode === 'quad' ? cfg.enable_quad : cfg.enable_group;
  if (!enabled) return { shouldEnter: false, delayMs: 0 };

  let prob = mode === 'pvp' ? cfg.pvp_join_probability : mode === 'quad' ? cfg.quad_join_probability : cfg.group_join_probability;

  const hour = new Date().getHours();
  const peakHours = Array.isArray(cfg.peak_hours) ? cfg.peak_hours : [];
  if (peakHours.includes(hour)) {
    // During peak hours boost probability toward 1 rather than multiplying down
    const bonus = Number(cfg.peak_probability_multiplier ?? 0.45);
    prob = Math.min(1, prob + (1 - prob) * bonus);
  }

  const minMs = mode === 'pvp' ? cfg.pvp_min_wait_ms : mode === 'quad' ? cfg.quad_min_wait_ms : cfg.group_min_wait_ms;
  const maxMs = mode === 'pvp' ? cfg.pvp_max_wait_ms : mode === 'quad' ? cfg.quad_max_wait_ms : cfg.group_max_wait_ms;

  const roll = Math.random();
  const fastFill = roll <= prob;
  const baseMin = Number(minMs) || 3000;
  const baseMax = Number(maxMs) || 9000;

  // ALWAYS fill bots so 4-player / group rooms never stall. If the probability
  // roll "fails", just wait longer to keep the matchmaking feeling organic.
  const delayMs = fastFill
    ? rand(baseMin, baseMax)
    : rand(baseMax + 4000, baseMax + 15000);

  return { shouldEnter: true, delayMs };
}
