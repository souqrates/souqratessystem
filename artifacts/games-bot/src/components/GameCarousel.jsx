import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight } from 'lucide-react';
import { GameIcon } from '../lib/game-icons';
import { GAMES } from '../constants';

const DIFFICULTY_COLOR = { Easy: '#10b981', Medium: '#f59e0b', Hard: '#ef4444' };

const FEATURED = GAMES.slice(0, 12);

export default function GameCarousel({ onOpenGame, appConfig }) {
  const [active, setActive] = useState(0);
  const startX = useRef(null);

  const sym = appConfig?.currency_symbol || 'SKZ';

  function handleTouchStart(e) { startX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (dx < -40 && active < FEATURED.length - 1) setActive(a => a + 1);
    if (dx >  40 && active > 0)                   setActive(a => a - 1);
  }

  const g = FEATURED[active];
  const diffColor = DIFFICULTY_COLOR[g.difficulty] || '#f59e0b';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={11} style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.8))' }} />
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.75)' }}>
            Featured Games
          </p>
        </div>
        <span className="text-[10px] font-bold" style={{ color: 'rgba(148,163,184,0.5)' }}>
          {active + 1} / {FEATURED.length}
        </span>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={g.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="rounded-3xl overflow-hidden relative"
            style={{
              background: 'rgba(15,23,42,0.7)',
              border: '1px solid rgba(34,211,238,0.18)',
              boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5)',
            }}
          >
            <div className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: `linear-gradient(135deg, ${diffColor}30, transparent 60%)` }} />

            <div className="p-5 relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="mb-2" style={{ filter: `drop-shadow(0 0 12px ${diffColor}80)` }}>
                    <GameIcon id={g.id} size={36} color={diffColor} strokeWidth={1.6} />
                  </div>
                  <h3 className="font-orbitron text-lg font-black text-white leading-tight tracking-wide">
                    {g.name}
                  </h3>
                  <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(148,163,184,0.75)' }}>
                    {g.desc}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-3">
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
                    style={{ background: `${diffColor}20`, border: `1px solid ${diffColor}50`, color: diffColor }}>
                    {g.difficulty}
                  </span>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>Prize</p>
                    <p className="font-orbitron text-base font-black" style={{ color: '#fbbf24' }}>
                      {g.prize} <span className="text-[10px]">{sym}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onOpenGame(g)}
                  className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-sm tracking-widest uppercase"
                  style={{
                    background: `linear-gradient(135deg, ${diffColor}cc, ${diffColor}88)`,
                    boxShadow: `0 4px 20px ${diffColor}40`,
                    color: '#fff',
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: 11,
                  }}
                >
                  Play Now
                  <ChevronRight size={14} />
                </motion.button>
                <div className="text-center px-3 py-2.5 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="font-orbitron text-xs font-black text-white">{g.entryFee}</p>
                  <p className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>Entry</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-1.5 mt-3">
          {FEATURED.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: i === active ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? '#22d3ee' : 'rgba(148,163,184,0.25)',
                transition: 'all 0.3s ease',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
