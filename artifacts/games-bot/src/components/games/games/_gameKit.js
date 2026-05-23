// Shared mini-engine helpers for the new game pack.
// Audio uses a single shared AudioContext to avoid leaks.
let _ac = null;
function ctx() {
  if (typeof window === 'undefined') return null;
  if (_ac) return _ac;
  try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { _ac = null; }
  return _ac;
}

export function beep({ freq = 440, dur = 0.12, vol = 0.18, type = 'sine', sweepTo = null } = {}) {
  const ac = ctx(); if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  } catch {}
}

export function chord(freqs = [523, 659, 784], dur = 0.18, vol = 0.16, type = 'triangle') {
  const ac = ctx(); if (!ac) return;
  freqs.forEach((f, i) => {
    setTimeout(() => beep({ freq: f, dur, vol, type }), i * 50);
  });
}

export function noise({ dur = 0.15, vol = 0.18 } = {}) {
  const ac = ctx(); if (!ac) return;
  try {
    const bufSize = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf;
    src.connect(g); g.connect(ac.destination);
    g.gain.value = vol;
    src.start();
  } catch {}
}

export function rand(min, max) { return min + Math.random() * (max - min); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Compute a difficulty level (0..maxLevel) from elapsed time and score.
 * Ramps up every `secPerStep` seconds OR every `scorePerStep` score points,
 * whichever comes first. Each step bumps difficulty by 1.
 *
 *   const lvl = difficultyLevel({ elapsedMs, score });   // 0,1,2,3,…
 *   const speed = baseSpeed * difficultyMul(lvl);
 *
 * Defaults: every 5 seconds OR every 5 score points adds one level.
 */
export function difficultyLevel({
  elapsedMs = 0,
  score = 0,
  secPerStep = 5,
  scorePerStep = 5,
  maxLevel = 20,
} = {}) {
  const byTime  = Math.floor((elapsedMs / 1000) / secPerStep);
  const byScore = Math.floor(score / scorePerStep);
  return Math.min(maxLevel, byTime + byScore);
}

/**
 * Convert a difficulty level into a smooth multiplier.
 * Default: starts at 1.0, +12% per step, capped at ~3x.
 */
export function difficultyMul(level, perStep = 0.12, cap = 3) {
  return Math.min(cap, 1 + level * perStep);
}

/**
 * Inverse multiplier — useful for spawn intervals or reaction windows
 * that should SHRINK as difficulty grows.
 *   const spawnMs = baseSpawn / difficultyMul(lvl);  // gets faster
 * or equivalently:
 *   const spawnMs = baseSpawn * difficultyShrink(lvl);
 */
export function difficultyShrink(level, perStep = 0.08, floor = 0.3) {
  return Math.max(floor, 1 - level * perStep);
}
