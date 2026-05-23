// 20-rank tier system. Mirrors the cumulative XP thresholds defined in
// supabase/migrations/20260512_rank_system_v2.sql (function xp_required_for_level).
// Each tier carries its own visual identity (color, gradient, glow, icon name)
// used by the dashboard rank card, leaderboard, profile, and chat badges.

export const RANKS = [
  { lvl: 1,  name: 'Beginner',     short: 'BGN', tier: 'starter',  hex: '#94a3b8', glow: 'rgba(148,163,184,0.45)', grad: 'linear-gradient(135deg,#cbd5e1,#64748b)', icon: 'sprout' },
  { lvl: 2,  name: 'Apprentice',   short: 'APR', tier: 'starter',  hex: '#a3a3a3', glow: 'rgba(163,163,163,0.45)', grad: 'linear-gradient(135deg,#d4d4d4,#737373)', icon: 'sparkles' },
  { lvl: 3,  name: 'Rookie',       short: 'RKE', tier: 'novice',   hex: '#22d3ee', glow: 'rgba(34,211,238,0.45)',  grad: 'linear-gradient(135deg,#67e8f9,#06b6d4)', icon: 'rocket' },
  { lvl: 4,  name: 'Challenger',   short: 'CHL', tier: 'novice',   hex: '#38bdf8', glow: 'rgba(56,189,248,0.45)',  grad: 'linear-gradient(135deg,#7dd3fc,#0ea5e9)', icon: 'swords' },
  { lvl: 5,  name: 'Contender',    short: 'CON', tier: 'novice',   hex: '#3b82f6', glow: 'rgba(59,130,246,0.45)',  grad: 'linear-gradient(135deg,#60a5fa,#2563eb)', icon: 'shield' },
  { lvl: 6,  name: 'Striker',      short: 'STK', tier: 'fighter',  hex: '#10b981', glow: 'rgba(16,185,129,0.45)',  grad: 'linear-gradient(135deg,#34d399,#059669)', icon: 'zap' },
  { lvl: 7,  name: 'Tactician',    short: 'TAC', tier: 'fighter',  hex: '#14b8a6', glow: 'rgba(20,184,166,0.45)',  grad: 'linear-gradient(135deg,#2dd4bf,#0d9488)', icon: 'target' },
  { lvl: 8,  name: 'Specialist',   short: 'SPC', tier: 'fighter',  hex: '#06b6d4', glow: 'rgba(6,182,212,0.45)',   grad: 'linear-gradient(135deg,#22d3ee,#0891b2)', icon: 'crosshair' },
  { lvl: 9,  name: 'Veteran',      short: 'VET', tier: 'elite',    hex: '#f59e0b', glow: 'rgba(245,158,11,0.45)',  grad: 'linear-gradient(135deg,#fbbf24,#d97706)', icon: 'medal' },
  { lvl: 10, name: 'Elite',        short: 'ELT', tier: 'elite',    hex: '#f97316', glow: 'rgba(249,115,22,0.45)',  grad: 'linear-gradient(135deg,#fb923c,#ea580c)', icon: 'flame' },
  { lvl: 11, name: 'Hunter',       short: 'HNT', tier: 'elite',    hex: '#ef4444', glow: 'rgba(239,68,68,0.45)',   grad: 'linear-gradient(135deg,#f87171,#dc2626)', icon: 'bow-arrow' },
  { lvl: 12, name: 'Gladiator',    short: 'GLD', tier: 'champion', hex: '#dc2626', glow: 'rgba(220,38,38,0.45)',   grad: 'linear-gradient(135deg,#ef4444,#991b1b)', icon: 'sword' },
  { lvl: 13, name: 'Champion',     short: 'CHP', tier: 'champion', hex: '#e11d48', glow: 'rgba(225,29,72,0.45)',   grad: 'linear-gradient(135deg,#fb7185,#be123c)', icon: 'trophy' },
  { lvl: 14, name: 'Ace',          short: 'ACE', tier: 'champion', hex: '#eab308', glow: 'rgba(234,179,8,0.55)',   grad: 'linear-gradient(135deg,#facc15,#a16207)', icon: 'star' },
  { lvl: 15, name: 'Master',       short: 'MST', tier: 'master',   hex: '#facc15', glow: 'rgba(250,204,21,0.6)',   grad: 'linear-gradient(135deg,#fde047,#ca8a04)', icon: 'crown' },
  { lvl: 16, name: 'Grandmaster',  short: 'GMS', tier: 'master',   hex: '#fbbf24', glow: 'rgba(251,191,36,0.65)',  grad: 'linear-gradient(135deg,#fcd34d,#b45309)', icon: 'gem' },
  { lvl: 17, name: 'Phantom',      short: 'PHM', tier: 'legend',   hex: '#22d3ee', glow: 'rgba(34,211,238,0.7)',   grad: 'linear-gradient(135deg,#a5f3fc,#0e7490)', icon: 'ghost' },
  { lvl: 18, name: 'Legend',       short: 'LGD', tier: 'legend',   hex: '#fde047', glow: 'rgba(253,224,71,0.75)',  grad: 'linear-gradient(135deg,#fef08a,#a16207)', icon: 'sun' },
  { lvl: 19, name: 'Mythic',       short: 'MYT', tier: 'legend',   hex: '#fb7185', glow: 'rgba(251,113,133,0.8)',  grad: 'linear-gradient(135deg,#fda4af,#9f1239)', icon: 'flame' },
  { lvl: 20, name: 'Sovereign',    short: 'SVR', tier: 'mythic',   hex: '#fbbf24', glow: 'rgba(251,191,36,0.9)',   grad: 'linear-gradient(135deg,#fef3c7,#92400e,#fbbf24)', icon: 'crown' },
];

// Cumulative XP required to enter each level. Must mirror SQL.
export const RANK_THRESHOLDS = [
  0, 450, 981, 1608, 2348, 3221, 4251, 5466, 6900, 8592,
  10589, 12945, 15725, 19006, 22877, 27445, 32835, 39196, 46703, 55562,
];

export const MAX_LEVEL = 20;

export function levelFromXp(xp) {
  const v = Math.max(0, Number(xp) || 0);
  for (let i = MAX_LEVEL; i >= 1; i--) {
    if (v >= RANK_THRESHOLDS[i - 1]) return i;
  }
  return 1;
}

export function rankFor(level) {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, Number(level) || 1));
  return RANKS[lvl - 1];
}

export function rankProgress(xp) {
  const v = Math.max(0, Number(xp) || 0);
  const level = levelFromXp(v);
  const base = RANK_THRESHOLDS[level - 1];
  const isMax = level >= MAX_LEVEL;
  const next = isMax ? base : RANK_THRESHOLDS[level];
  const span = isMax ? 1 : (next - base);
  const inLevel = isMax ? 1 : (v - base);
  const pct = isMax ? 100 : Math.min(100, Math.max(0, (inLevel / span) * 100));
  return {
    level,
    rank: RANKS[level - 1],
    nextRank: isMax ? null : RANKS[level],
    inLevel,
    span,
    pct,
    nextAt: isMax ? base : next,
    xp: v,
    isMax,
  };
}

export function xpRewardFor(difficulty, won) {
  const d = String(difficulty || '').toLowerCase();
  if (d === 'easy')  return won ? 150 : 60;
  if (d === 'hard')  return won ? 500 : 200;
  return won ? 250 : 100; // medium / default
}
