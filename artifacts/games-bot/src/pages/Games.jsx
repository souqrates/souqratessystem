import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Search, Zap, Trophy, Star } from 'lucide-react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';
import { triggerHaptic } from '../lib/telegram';

// Single, very-short stagger only on the top-level header items.
// The grid itself does NOT re-stagger — that was causing a visible
// "flicker" every time the filter/search changed because all cards
// re-mounted with the entrance animation.
const container = { animate: { transition: { staggerChildren: 0.03, delayChildren: 0 } } };
const item = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
};

const DIFF_COLOR = {
  Easy:   { text: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.22)' },
  Medium: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)' },
  Hard:   { text: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)'  },
};

const FILTERS = [
  { id: 'all',    label: 'All Games' },
  { id: 'Easy',   label: 'Easy'      },
  { id: 'Medium', label: 'Medium'    },
  { id: 'Hard',   label: 'Hard'      },
];

export default function Games({ onOpenGame }) {
  const { games, language, gamesFilter, wallet } = useAppStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(gamesFilter || 'all');

  const filtered = useMemo(() => {
    let list = games || [];
    if (filter !== 'all') list = list.filter(g => g.difficulty === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q) || (g.desc || '').toLowerCase().includes(q));
    }
    return list;
  }, [games, filter, search]);

  return (
    <motion.div className="px-4 pt-5 pb-6 space-y-4 relative z-10" variants={container} initial="initial" animate="animate">
      <motion.div variants={item} className="flex items-center gap-2.5">
        <Gamepad2 size={17} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }} />
        <h1 className="font-orbitron text-base font-black text-white tracking-widest">
          {t(language, 'games')}
        </h1>
        <span className="ml-auto font-orbitron text-xs font-black" style={{ color: '#10b981' }}>
          {(wallet?.sc_balance || 0).toLocaleString()} SKZ
        </span>
      </motion.div>

      {/* Search */}
      <motion.div variants={item} className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.5)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search games…"
          className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm text-white bg-transparent outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', fontWeight: 600 }}
        />
      </motion.div>

      {/* Filter pills */}
      <motion.div variants={item} className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
            style={filter === f.id ? {
              background: 'linear-gradient(135deg, #d97706, #f59e0b)',
              color: '#000',
              boxShadow: '0 2px 12px rgba(245,158,11,0.3)',
            } : {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(148,163,184,0.7)',
            }}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Game grid — plain divs, no per-card entrance animation.
          Filter/search changes used to re-stagger 110 cards every time,
          which read as a full-screen flicker. Stable layout now. */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(game => {
          const dc = DIFF_COLOR[game.difficulty] || DIFF_COLOR.Medium;
          return (
            <button
              key={game.id}
              onClick={() => { triggerHaptic('medium'); onOpenGame?.(game); }}
              className="glass-card rounded-2xl p-3.5 text-left flex flex-col gap-2 relative overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', background: 'none', minHeight: 120 }}
            >
              <div className="text-3xl leading-none">{game.emoji}</div>
              <div>
                <p className="text-xs font-black text-white leading-tight line-clamp-1">{game.name}</p>
                <p className="text-[9px] mt-0.5 leading-tight line-clamp-2" style={{ color: 'rgba(148,163,184,0.6)' }}>{game.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-auto flex-wrap">
                <span className="px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase"
                  style={{ background: dc.bg, border: `1px solid ${dc.border}`, color: dc.text }}>
                  {game.difficulty}
                </span>
                {game.entryFee > 0 && (
                  <span className="flex items-center gap-0.5 text-[8px] font-black"
                    style={{ color: 'rgba(245,158,11,0.85)' }}>
                    <Zap size={7} fill="currentColor" />{game.entryFee} SKZ
                  </span>
                )}
                {game.prize > 0 && (
                  <span className="flex items-center gap-0.5 text-[8px] font-black ml-auto"
                    style={{ color: 'rgba(16,185,129,0.85)' }}>
                    <Trophy size={7} />{game.prize} SKZ
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <motion.div variants={item} className="glass-card rounded-2xl p-10 text-center">
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>No games found</p>
        </motion.div>
      )}
    </motion.div>
  );
}
