import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Star, Flame, Sword, Shield, Zap, Crown, Users, Award, User,
  Target, Medal, Sparkles, Wallet, ArrowUp, UserPlus, Calendar, Gamepad2,
  Lock, ChevronDown,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { rankProgress } from '../lib/ranks';
import { fetchGamification, fetchStreak } from '../lib/gamification';

const ICON_MAP = {
  sword: Sword, flame: Flame, shield: Shield, trophy: Trophy,
  zap: Zap, crown: Crown, users: Users, award: Award, user: User,
  target: Target, star: Star, sparkles: Sparkles, medal: Medal,
  calendar: Calendar, 'gamepad-2': Gamepad2, wallet: Wallet,
  'arrow-up': ArrowUp, 'user-plus': UserPlus,
};

// Static achievement catalog — milestones driven by central API data (XP, games, streak)
const STATIC_ACHIEVEMENTS = [
  // Gaming milestones
  { id: 'first_win',    category: 'gaming',    icon: 'sword',    name: 'First Blood',       desc: 'Win your first game',              threshold: { field: 'total_wins',  value: 1    } },
  { id: 'wins_10',      category: 'gaming',    icon: 'shield',   name: 'Warrior',           desc: 'Win 10 games',                     threshold: { field: 'total_wins',  value: 10   } },
  { id: 'wins_50',      category: 'gaming',    icon: 'target',   name: 'Veteran Fighter',   desc: 'Win 50 games',                     threshold: { field: 'total_wins',  value: 50   } },
  { id: 'wins_100',     category: 'gaming',    icon: 'trophy',   name: 'Champion',          desc: 'Win 100 games',                    threshold: { field: 'total_wins',  value: 100  } },
  { id: 'games_5',      category: 'gaming',    icon: 'gamepad-2',name: 'Active Player',     desc: 'Play 5 games',                     threshold: { field: 'total_games', value: 5    } },
  { id: 'games_25',     category: 'gaming',    icon: 'zap',      name: 'Regular',           desc: 'Play 25 games',                    threshold: { field: 'total_games', value: 25   } },
  // XP / rank milestones
  { id: 'xp_450',       category: 'milestone', icon: 'arrow-up', name: 'Level 2',           desc: 'Reach 450 XP',                     threshold: { field: 'xp',          value: 450  } },
  { id: 'xp_1608',      category: 'milestone', icon: 'sparkles', name: 'Level 4',           desc: 'Reach 1608 XP',                    threshold: { field: 'xp',          value: 1608 } },
  { id: 'xp_6900',      category: 'milestone', icon: 'star',     name: 'Level 9',           desc: 'Reach 6900 XP',                    threshold: { field: 'xp',          value: 6900 } },
  { id: 'xp_19006',     category: 'milestone', icon: 'crown',    name: 'Level 14 — Ace',    desc: 'Reach 19 006 XP',                  threshold: { field: 'xp',          value: 19006} },
  { id: 'xp_55562',     category: 'milestone', icon: 'medal',    name: 'Sovereign',         desc: 'Reach the highest rank',           threshold: { field: 'xp',          value: 55562} },
  // Streak milestones
  { id: 'streak_3',     category: 'special',   icon: 'flame',    name: 'Consistent',        desc: 'Maintain a 3-day streak',          threshold: { field: 'streak',      value: 3    } },
  { id: 'streak_7',     category: 'special',   icon: 'flame',    name: 'On Fire',           desc: 'Maintain a 7-day streak',          threshold: { field: 'streak',      value: 7    } },
  { id: 'streak_30',    category: 'special',   icon: 'flame',    name: 'Unstoppable',       desc: 'Maintain a 30-day streak',         threshold: { field: 'streak',      value: 30   } },
  { id: 'streak_longest_7', category: 'special', icon: 'calendar','name': 'Week Warrior',   desc: 'Achieve a longest streak of 7',    threshold: { field: 'longest',     value: 7    } },
];

const CATEGORIES = [
  { id: 'all',       label: 'All',        icon: Trophy },
  { id: 'gaming',    label: 'Gaming',     icon: Gamepad2 },
  { id: 'milestone', label: 'Milestones', icon: Star },
  { id: 'special',   label: 'Streaks',    icon: Flame },
];

function isUnlocked(ach, stats) {
  if (!stats) return false;
  const { field, value } = ach.threshold;
  switch (field) {
    case 'total_wins':  return (stats.totalWins  || 0) >= value;
    case 'total_games': return (stats.totalGames || 0) >= value;
    case 'xp':          return (stats.xp         || 0) >= value;
    case 'streak':      return (stats.streak      || 0) >= value;
    case 'longest':     return (stats.longest     || 0) >= value;
    default:            return false;
  }
}

function getProgress(ach, stats) {
  if (!stats) return { pct: 0, current: 0 };
  const { field, value } = ach.threshold;
  let current = 0;
  switch (field) {
    case 'total_wins':  current = stats.totalWins  || 0; break;
    case 'total_games': current = stats.totalGames || 0; break;
    case 'xp':          current = stats.xp         || 0; break;
    case 'streak':      current = stats.streak      || 0; break;
    case 'longest':     current = stats.longest     || 0; break;
  }
  return { pct: Math.min(100, Math.round((current / value) * 100)), current };
}

const card = {
  initial: { opacity: 0, scale: 0.94, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

export default function Achievements() {
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [gami, streak] = await Promise.all([fetchGamification(), fetchStreak()]);
        if (!cancelled) {
          setStats({
            xp:         gami?.xp         ?? 0,
            totalGames: gami?.total_games ?? 0,
            totalWins:  gami?.total_wins  ?? 0,
            streak:     streak?.current_streak  ?? 0,
            longest:    streak?.longest_streak  ?? 0,
          });
        }
      } catch { /* non-fatal */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const visible = filter === 'all'
    ? STATIC_ACHIEVEMENTS
    : STATIC_ACHIEVEMENTS.filter((a) => a.category === filter);

  const unlockedCount = stats ? STATIC_ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).length : 0;
  const totalCount    = STATIC_ACHIEVEMENTS.length;

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-primary, #0f172a)', color: '#f1f5f9' }}>

      {/* Header */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-orbitron text-xl font-black tracking-wide" style={{ color: '#eab308' }}>
            ACHIEVEMENTS
          </h1>
          {!loading && (
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
              {unlockedCount} / {totalCount}
            </span>
          )}
        </div>

        {/* Overall progress bar */}
        {!loading && (
          <div className="mb-4">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#eab308,#f97316)' }}
                initial={{ width: 0 }}
                animate={{ width: `${totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(148,163,184,0.6)' }}>
              {totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0}% complete
            </p>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: filter === id ? 'rgba(234,179,8,0.18)' : 'rgba(255,255,255,0.04)',
                color:      filter === id ? '#eab308' : 'rgba(148,163,184,0.7)',
                border:     `1px solid ${filter === id ? 'rgba(234,179,8,0.4)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement cards */}
      <div className="px-4 space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))
        ) : (
          <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.04 }}>
            {visible.map((ach) => {
              const unlocked = isUnlocked(ach, stats);
              const { pct, current } = getProgress(ach, stats);
              const Icon = ICON_MAP[ach.icon] ?? Trophy;
              return (
                <motion.div key={ach.id} variants={card} transition={{ duration: 0.25 }}>
                  <div
                    className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                    style={{
                      background: unlocked ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${unlocked ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: unlocked ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${unlocked ? 'rgba(234,179,8,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      {unlocked
                        ? <Icon size={18} style={{ color: '#eab308' }} />
                        : <Lock size={14} style={{ color: 'rgba(148,163,184,0.4)' }} />
                      }
                    </div>

                    {/* Text + progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate"
                          style={{ color: unlocked ? '#f1f5f9' : 'rgba(148,163,184,0.5)' }}>
                          {ach.name}
                        </p>
                        {unlocked
                          ? <span className="text-[10px] font-black" style={{ color: '#eab308' }}>✓ DONE</span>
                          : <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>{pct}%</span>
                        }
                      </div>
                      <p className="text-[11px] truncate" style={{ color: 'rgba(148,163,184,0.45)' }}>
                        {ach.desc}
                      </p>
                      {!unlocked && (
                        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
