import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Crown, Clock, Globe, TrendingUp, Star } from 'lucide-react';
import useAppStore from '../store/appStore';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { SkeletonRow } from '../components/Skeleton';
import { displayNameOf, avatarUrlOf, initialOf } from '../lib/profile';
import { rankProgress } from '../lib/ranks';

const PODIUM_H = ['h-20', 'h-28', 'h-16'];
const PODIUM_R = [2, 1, 3];
const PODIUM_STYLE = {
  1: { barBg: 'rgba(245,158,11,0.12)', barBorder: 'rgba(245,158,11,0.28)', text: '#f59e0b', glow: '0 0 24px rgba(245,158,11,0.55)' },
  2: { barBg: 'rgba(148,163,184,0.08)', barBorder: 'rgba(148,163,184,0.20)', text: '#94a3b8', glow: '' },
  3: { barBg: 'rgba(6,182,212,0.12)',   barBorder: 'rgba(6,182,212,0.25)',  text: '#06b6d4', glow: '0 0 20px rgba(6,182,212,0.45)' },
};

const TABS = [
  { id: 'all',    label: 'All Time',  icon: Globe },
  { id: 'weekly', label: 'This Week', icon: Clock },
];

const container = { animate: { transition: { staggerChildren: 0.04 } } };
const row = {
  initial: { opacity: 0, x: -14 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

function displayName(p) { return displayNameOf(p); }

function PlayerRow({ p, i, isYou, total }) {
  const rp = rankProgress(Number(p.xp || 0));
  const r = rp.rank;
  const rankNum = Number(p.rank);
  const rankColor = rankNum === 1 ? '#f59e0b' : rankNum === 2 ? '#94a3b8' : rankNum === 3 ? '#06b6d4' : 'rgba(148,163,184,0.78)';

  return (
    <motion.div
      variants={row}
      className={`flex items-center gap-3 px-4 py-3.5 ${i < total - 1 ? 'border-b' : ''}`}
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        background: isYou ? 'rgba(34,211,238,0.06)' : 'transparent',
      }}
    >
      {/* Rank number */}
      <div className="w-8 text-center flex-shrink-0">
        {rankNum <= 3
          ? <span className="font-orbitron font-black text-sm" style={{ color: rankColor }}>#{rankNum}</span>
          : <span className="font-bold text-sm" style={{ color: 'rgba(148,163,184,0.78)' }}>#{rankNum}</span>
        }
      </div>

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-sm font-black flex-shrink-0"
        style={isYou
          ? { background: r.grad, boxShadow: `0 0 12px ${r.glow}`, border: `1px solid ${r.hex}50` }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#cbd5e1' }
        }
      >
        {avatarUrlOf(p)
          ? <img src={avatarUrlOf(p)} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
          : <span style={{ color: isYou ? '#0b1220' : '#cbd5e1', fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 900 }}>{initialOf(p)}</span>
        }
      </div>

      {/* Name + rank label */}
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm truncate" style={{ color: isYou ? '#67e8f9' : '#e2e8f0' }}>
          {isYou ? 'You' : displayName(p)}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ background: r.grad, boxShadow: `0 0 5px ${r.glow}` }} />
          <p className="text-[10px] font-semibold" style={{ color: 'rgba(148,163,184,0.7)' }}>
            {r.name} · LV {rp.level}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p className="font-orbitron font-black text-sm" style={{ color: '#f59e0b' }}>
          {Number(p.total_won || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-[9px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.5)' }}>
          {p.total_wins} wins
        </p>
      </div>
    </motion.div>
  );
}

export default function Leaderboard() {
  const { language, user } = useAppStore();
  const [tab, setTab]          = useState('all');
  const [players, setPlayers]  = useState([]);
  const [me, setMe]            = useState(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setPlayers([]);

      if (tab === 'all') {
        const [{ data: top }, { data: rankRows }] = await Promise.all([
          supabase.rpc('get_global_leaderboard', { p_limit: 50 }),
          user?.telegram_id
            ? supabase.rpc('get_player_rank', { p_telegram_id: user.telegram_id })
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        // Enrich with XP from gamification
        const enriched = (top || []).map(p => ({ ...p, xp: p.xp || p.total_won || 0 }));
        setPlayers(enriched);
        setMe(Array.isArray(rankRows) ? rankRows[0] : rankRows);
      } else {
        const { data: weekly } = await supabase.rpc('get_weekly_leaderboard', { p_limit: 50 });
        if (cancelled) return;
        setPlayers(weekly || []);
      }
      setLoading(false);
    }

    load();

    return () => { cancelled = true; };
  }, [user?.telegram_id, tab]);

  const podium = players.slice(0, 3);
  const podiumOrdered = [podium[1], podium[0], podium[2]].filter(Boolean);

  return (
    <div className="px-4 pt-5 pb-6 space-y-4 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Trophy size={18} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }} />
          <h1 className="font-orbitron text-base font-black text-white tracking-widest">
            {t(language, 'leaderboard')}
          </h1>
        </div>
        {/* Live dot */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Live</span>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.94 }}
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
              style={{
                background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={12} style={{ color: active ? '#f59e0b' : 'rgba(148,163,184,0.5)' }} />
              <span className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: active ? '#f59e0b' : 'rgba(148,163,184,0.6)' }}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Podium */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          className="glass-hero rounded-3xl p-5 relative overflow-hidden"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-20 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(245,158,11,0.10)' }} />

          <div className="flex items-center gap-2 mb-4 relative z-10">
            <Crown size={12} style={{ color: '#f59e0b' }} />
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.78)' }}>
              {tab === 'all' ? t(language, 'topPlayers') : t(language, 'topThisWeek')}
            </p>
          </div>

          {loading ? (
            <div className="flex items-end justify-around gap-3 relative z-10" style={{ minHeight: 130 }}>
              {[0,1,2].map(i => <div key={i} className="flex-1"><SkeletonRow /></div>)}
            </div>
          ) : podiumOrdered.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(148,163,184,0.78)' }}>
              {tab === 'weekly' ? 'No activity yet this week — play to appear' : 'No champions yet — be the first'}
            </p>
          ) : (
            <div className="flex items-end justify-around gap-3 relative z-10">
              {podiumOrdered.map((p, i) => {
                const rank = PODIUM_R[i];
                const s = PODIUM_STYLE[rank];
                const rp = rankProgress(Number(p.xp || p.total_won || 0));
                const r = rp.rank;
                return (
                  <div key={p.telegram_id} className="flex flex-col items-center gap-1.5 flex-1">
                    {rank === 1
                      ? <Crown size={16} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }} />
                      : <div className="h-4" />
                    }
                    {/* Avatar mini */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
                      style={{ background: r.grad, boxShadow: `0 0 12px ${r.glow}` }}>
                      {avatarUrlOf(p)
                        ? <img src={avatarUrlOf(p)} alt="" className="w-full h-full object-cover" />
                        : <span style={{ color: '#0b1220', fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 900 }}>{initialOf(p)}</span>
                      }
                    </div>
                    <p className="text-[9px] font-black text-white text-center truncate w-full leading-tight">
                      {displayName(p)}
                    </p>
                    <p className="text-[10px] font-black" style={{ color: s.text, textShadow: s.glow ? `0 0 10px ${s.text}` : 'none' }}>
                      {Number(p.total_won || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <div className={`w-full ${PODIUM_H[i]} rounded-t-2xl flex items-center justify-center`}
                      style={{ background: s.barBg, border: `1px solid ${s.barBorder}`, boxShadow: s.glow || 'none' }}>
                      <span className="font-orbitron text-base font-black"
                        style={{ color: s.text, textShadow: s.glow ? `0 0 12px ${s.text}` : 'none' }}>
                        #{rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Full list */}
      <motion.div variants={container} initial="initial" animate="animate" className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-3 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : players.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'rgba(148,163,184,0.78)' }}>
            {tab === 'weekly' ? 'Play this week to climb the board' : 'Play a match to enter the ranking'}
          </p>
        ) : players.map((p, i) => {
          const isYou = user?.telegram_id && Number(p.telegram_id) === Number(user.telegram_id);
          return (
            <PlayerRow key={p.telegram_id} p={p} i={i} isYou={isYou} total={players.length} />
          );
        })}
      </motion.div>

      {/* My rank card — only on all-time tab */}
      {tab === 'all' && (
        <motion.div
          className="glass-card rounded-2xl p-4 flex items-center justify-between"
          style={{ border: '1px solid rgba(34,211,238,0.22)', boxShadow: '0 0 24px rgba(34,211,238,0.10)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(148,163,184,0.78)' }}>
              {t(language, 'yourRank')}
            </p>
            <p className="font-orbitron text-3xl font-black" style={{ color: '#22d3ee' }}>
              {me ? `#${me.rank}` : '—'}
            </p>
            <p className="text-xs font-medium mt-0.5" style={{ color: 'rgba(148,163,184,0.78)' }}>
              {me ? `Of ${me.total_ranked} ranked players` : 'Play a match to enter the ranking'}
            </p>
          </div>
          <div className="text-right">
            <Medal size={36} className="opacity-80 mb-1" style={{ color: '#f59e0b' }} />
            {me && (
              <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                Top {me.total_ranked > 0 ? Math.min(100, Math.max(1, Math.ceil(((Number(me.total_ranked) - Number(me.rank) + 1) / Number(me.total_ranked)) * 100))) : '?'}%
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Weekly info banner */}
      {tab === 'weekly' && (
        <motion.div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Clock size={16} style={{ color: '#22d3ee', flexShrink: 0 }} />
          <p className="text-[10px] font-semibold" style={{ color: 'rgba(148,163,184,0.75)' }}>
            Weekly rankings reset every <span style={{ color: '#22d3ee', fontWeight: 900 }}>Monday at midnight UTC</span>. Earn more to climb!
          </p>
        </motion.div>
      )}
    </div>
  );
}
