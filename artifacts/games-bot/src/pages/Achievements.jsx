import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Flame, Sword, Shield, Zap, Crown, Users, Award, User, Target, Medal, Sparkles, Wallet, ArrowUp, UserPlus, Calendar, Gamepad2, Lock, CircleCheck as CheckCircle2, ChevronDown } from 'lucide-react';
import useAppStore from '../store/appStore';
import { supabase } from '../lib/supabase';
import { getVerifiedSession } from '../lib/telegram';
import { rankProgress } from '../lib/ranks';

// Map icon name → Lucide component
const ICON_MAP = {
  sword: Sword, flame: Flame, shield: Shield, trophy: Trophy,
  zap: Zap, crown: Crown, users: Users, award: Award, user: User,
  swords: Sword, target: Target, star: Star, sparkles: Sparkles,
  medal: Medal, gem: Star, calendar: Calendar, 'gamepad-2': Gamepad2,
  wallet: Wallet, 'arrow-up': ArrowUp, 'user-plus': UserPlus,
  megaphone: Zap, 'bow-arrow': Target, crosshair: Target, ghost: Star, sun: Star,
};

const CATEGORIES = [
  { id: 'all',       label: 'All',        icon: Trophy },
  { id: 'gaming',    label: 'Gaming',     icon: Gamepad2 },
  { id: 'milestone', label: 'Milestones', icon: Star },
  { id: 'special',   label: 'Streaks',    icon: Flame },
  { id: 'social',    label: 'Social',     icon: Users },
  { id: 'financial', label: 'Finance',    icon: Wallet },
];

const container = { animate: { transition: { staggerChildren: 0.04 } } };
const cardAnim = {
  initial: { opacity: 0, scale: 0.94, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

function ConfettiPop({ color }) {
  const pieces = Array.from({ length: 10 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: 'inherit' }}>
      {pieces.map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, x: '50%', y: '50%', scale: 0 }}
          animate={{
            opacity: [1, 1, 0],
            x: `${50 + (Math.random() - 0.5) * 120}%`,
            y: `${50 + (Math.random() - 0.5) * 120}%`,
            scale: [0, Math.random() * 0.8 + 0.4, 0],
          }}
          transition={{ duration: 0.7, delay: i * 0.04, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: 5, height: 5,
            borderRadius: Math.random() > 0.5 ? '50%' : 2,
            background: color,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}

function AchievementCard({ item, justUnlocked }) {
  const IconComp = ICON_MAP[item.icon] || Star;
  const locked = !item.unlocked;

  return (
    <motion.div
      variants={cardAnim}
      layout
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{
        background: locked
          ? 'rgba(255,255,255,0.02)'
          : `linear-gradient(135deg, ${item.color}14, ${item.color}06)`,
        border: `1px solid ${locked ? 'rgba(255,255,255,0.05)' : item.color + '35'}`,
        boxShadow: locked ? 'none' : `0 0 24px ${item.color}15`,
      }}
    >
      {justUnlocked && <ConfettiPop color={item.color} />}

      {/* Glow orb behind icon when unlocked */}
      {!locked && (
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl pointer-events-none"
          style={{ background: `${item.color}20` }} />
      )}

      <div className="flex items-start gap-3 relative z-10">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
          style={locked
            ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }
            : { background: `${item.color}22`, border: `1px solid ${item.color}45`, boxShadow: `0 0 16px ${item.color}30` }
          }
        >
          {locked
            ? <Lock size={18} color="rgba(100,116,139,0.45)" />
            : <IconComp size={20} style={{ color: item.color, filter: `drop-shadow(0 0 6px ${item.color})` }} />
          }
          {!locked && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: '#10b981', border: '2px solid #04030a' }}>
              <CheckCircle2 size={9} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-tight truncate"
            style={{ color: locked ? 'rgba(148,163,184,0.5)' : '#e2e8f0' }}>
            {item.name}
          </p>
          <p className="text-[10px] font-medium mt-0.5 leading-relaxed"
            style={{ color: locked ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.75)' }}>
            {item.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: locked ? 'rgba(255,255,255,0.03)' : `${item.color}18`,
                border: `1px solid ${locked ? 'rgba(255,255,255,0.05)' : item.color + '30'}`,
              }}>
              <Zap size={8} style={{ color: locked ? 'rgba(148,163,184,0.3)' : item.color }} />
              <span className="text-[9px] font-black"
                style={{ color: locked ? 'rgba(148,163,184,0.3)' : item.color }}>
                +{item.xp_reward} XP
              </span>
            </div>
            {!locked && item.unlocked_at && (
              <span className="text-[9px] font-semibold" style={{ color: 'rgba(148,163,184,0.45)' }}>
                {new Date(item.unlocked_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Achievements() {
  const { user } = useAppStore();
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [justUnlocked, setJustUnlocked] = useState(new Set());
  const prevUnlocked = useRef(new Set());

  const xp = items.filter(i => i.unlocked).reduce((s, i) => s + i.xp_reward, 0);
  const total = items.length;
  const unlocked = items.filter(i => i.unlocked).length;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  useEffect(() => {
    let cancelled = false;
    let confettiTimer = null;
    async function load() {
      const sid = getVerifiedSession()?.session_id;
      if (!sid) { setLoading(false); return; }
      const { data } = await supabase.rpc('get_user_achievements', { p_session_id: sid });
      if (cancelled) return;
      const list = Array.isArray(data?.items) ? data.items : [];

      const newUnlocked = new Set(list.filter(i => i.unlocked).map(i => i.code));
      const fresh = new Set([...newUnlocked].filter(c => !prevUnlocked.current.has(c)));
      prevUnlocked.current = newUnlocked;
      if (fresh.size > 0) {
        setJustUnlocked(fresh);
        clearTimeout(confettiTimer);
        confettiTimer = setTimeout(() => { if (!cancelled) setJustUnlocked(new Set()); }, 2000);
      }

      setItems(list);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; clearTimeout(confettiTimer); };
  }, [user?.telegram_id]);

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  const rp = rankProgress(xp);

  return (
    <div className="px-4 pt-5 pb-8 space-y-5 relative z-10">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Trophy size={18} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }} />
        <h1 className="font-orbitron text-base font-black text-white tracking-widest">Achievements</h1>
      </div>

      {/* Progress overview card */}
      <motion.div
        className="glass-hero rounded-3xl p-5 relative overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(245,158,11,0.12)' }} />
        <div className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(34,211,238,0.08)' }} />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(148,163,184,0.7)' }}>Progress</p>
            <p className="font-orbitron text-3xl font-black" style={{ color: '#f59e0b' }}>
              {unlocked}<span className="text-lg text-slate-400 font-bold">/{total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(148,163,184,0.7)' }}>XP Earned</p>
            <p className="font-orbitron text-2xl font-black shimmer-gold">{xp.toLocaleString()}</p>
          </div>
        </div>

        {/* Big progress bar */}
        <div className="h-3 rounded-full overflow-hidden mb-2 relative z-10"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #fde68a)',
              boxShadow: '0 0 12px rgba(245,158,11,0.6)',
              borderRadius: 9999,
            }}
          />
        </div>
        <p className="text-[10px] font-bold relative z-10" style={{ color: 'rgba(148,163,184,0.6)' }}>
          {pct}% complete · Keep unlocking to earn XP rewards
        </p>
      </motion.div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = filter === id;
          const count = id === 'all'
            ? items.filter(i => i.unlocked).length
            : items.filter(i => i.category === id && i.unlocked).length;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.94 }}
              onClick={() => setFilter(id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{
                background: active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.07)'}`,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={11} style={{ color: active ? '#22d3ee' : 'rgba(148,163,184,0.5)' }} />
              <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                style={{ color: active ? '#22d3ee' : 'rgba(148,163,184,0.6)' }}>
                {label}
              </span>
              {count > 0 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)',
                    color: active ? '#22d3ee' : 'rgba(148,163,184,0.6)',
                  }}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Achievements grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Lock size={32} color="rgba(148,163,184,0.2)" style={{ margin: '0 auto 12px' }} />
          <p className="text-sm font-bold" style={{ color: 'rgba(148,163,184,0.5)' }}>No achievements here yet</p>
        </div>
      ) : (
        <>
          {/* Unlocked section */}
          {filtered.some(i => i.unlocked) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={11} style={{ color: '#10b981' }} />
                <p className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: 'rgba(148,163,184,0.75)' }}>
                  Unlocked · {filtered.filter(i => i.unlocked).length}
                </p>
              </div>
              <motion.div
                className="grid grid-cols-1 gap-3"
                variants={container}
                initial="initial"
                animate="animate"
              >
                {filtered.filter(i => i.unlocked).map(item => (
                  <AchievementCard
                    key={item.code}
                    item={item}
                    justUnlocked={justUnlocked.has(item.code)}
                  />
                ))}
              </motion.div>
            </div>
          )}

          {/* Locked section */}
          {filtered.some(i => !i.unlocked) && (
            <div>
              <div className="flex items-center gap-2 mb-3 mt-2">
                <Lock size={11} style={{ color: 'rgba(148,163,184,0.4)' }} />
                <p className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: 'rgba(148,163,184,0.45)' }}>
                  Locked · {filtered.filter(i => !i.unlocked).length}
                </p>
              </div>
              <motion.div
                className="grid grid-cols-1 gap-3"
                variants={container}
                initial="initial"
                animate="animate"
              >
                {filtered.filter(i => !i.unlocked).map(item => (
                  <AchievementCard key={item.code} item={item} justUnlocked={false} />
                ))}
              </motion.div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
