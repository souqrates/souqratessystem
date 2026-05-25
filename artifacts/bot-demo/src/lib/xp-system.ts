export interface Rank {
  name: string;
  icon: string;
  minLevel: number;
  maxLevel: number;
  color: string;
  glow: string;
  gradient: string;
}

export const RANKS: Rank[] = [
  { name: "Ghost",    icon: "👻", minLevel: 1,  maxLevel: 3,  color: "#9ca3af", glow: "rgba(156,163,175,0.3)", gradient: "linear-gradient(135deg,#4b5563,#6b7280)" },
  { name: "Scout",    icon: "🔍", minLevel: 4,  maxLevel: 7,  color: "#34d399", glow: "rgba(52,211,153,0.3)",  gradient: "linear-gradient(135deg,#059669,#34d399)" },
  { name: "Trader",   icon: "📈", minLevel: 8,  maxLevel: 12, color: "#60a5fa", glow: "rgba(96,165,250,0.3)",  gradient: "linear-gradient(135deg,#2563eb,#60a5fa)" },
  { name: "Shark",    icon: "🦈", minLevel: 13, maxLevel: 18, color: "#22d3ee", glow: "rgba(34,211,238,0.3)",  gradient: "linear-gradient(135deg,#0891b2,#22d3ee)" },
  { name: "Veteran",  icon: "⚡", minLevel: 19, maxLevel: 25, color: "#a78bfa", glow: "rgba(167,139,250,0.3)", gradient: "linear-gradient(135deg,#7c3aed,#a78bfa)" },
  { name: "Elite",    icon: "💎", minLevel: 26, maxLevel: 35, color: "#f472b6", glow: "rgba(244,114,182,0.3)", gradient: "linear-gradient(135deg,#db2777,#f472b6)" },
  { name: "Legend",   icon: "🔱", minLevel: 36, maxLevel: 45, color: "#fbbf24", glow: "rgba(251,191,36,0.3)",  gradient: "linear-gradient(135deg,#d97706,#fbbf24)" },
  { name: "Mythic",   icon: "👑", minLevel: 46, maxLevel: 50, color: "#c084fc", glow: "rgba(192,132,252,0.4)", gradient: "linear-gradient(135deg,#9333ea,#c084fc,#22d3ee)" },
];

/** Total XP required to reach a given level */
export function xpThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(120 * Math.pow(level - 1, 1.65));
}

/** XP needed for just this level span */
export function xpForLevelSpan(level: number): number {
  return xpThreshold(level + 1) - xpThreshold(level);
}

/** Derive level from total XP */
export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (xpThreshold(level + 1) <= totalXp) level++;
  return Math.min(level, 50);
}

export function getRankForLevel(level: number): Rank {
  return RANKS.find((r) => level >= r.minLevel && level <= r.maxLevel) ?? RANKS[0];
}

/** XP progress within current level [0..1] */
export function xpProgress(totalXp: number): number {
  const level = levelFromXp(totalXp);
  if (level >= 50) return 1;
  const base = xpThreshold(level);
  const next = xpThreshold(level + 1);
  return (totalXp - base) / (next - base);
}

export function xpInLevel(totalXp: number): number {
  const level = levelFromXp(totalXp);
  return totalXp - xpThreshold(level);
}

export function xpToNextLevel(totalXp: number): number {
  const level = levelFromXp(totalXp);
  if (level >= 50) return 0;
  return xpThreshold(level + 1) - totalXp;
}

// ── XP rewards per action ─────────────────────────────────
export const XP_REWARDS: Record<string, { xp: number; label: string; icon: string }> = {
  deposit:       { xp: 50,  label: "Deposit",          icon: "📥" },
  withdraw:      { xp: 30,  label: "Withdrawal",        icon: "📤" },
  referral:      { xp: 150, label: "Referral Joined",   icon: "👥" },
  games_win:     { xp: 40,  label: "Games Win",         icon: "🎮" },
  games_play:    { xp: 15,  label: "Games Played",      icon: "🎮" },
  video_watch:   { xp: 10,  label: "Video Watched",     icon: "🎬" },
  store_buy:     { xp: 45,  label: "Store Purchase",    icon: "🛒" },
  voice_join:    { xp: 20,  label: "Voice Room",        icon: "🎙" },
  ai_use:        { xp: 12,  label: "AI Usage",          icon: "🤖" },
  contest_entry: { xp: 35,  label: "Contest Entry",     icon: "🏆" },
  contest_win:   { xp: 200, label: "Contest Won",       icon: "🏆" },
  daily_login:   { xp: 25,  label: "Daily Login",       icon: "📅" },
};
