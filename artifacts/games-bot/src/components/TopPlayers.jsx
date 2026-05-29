import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal } from 'lucide-react';
import { rankFor } from '../lib/ranks';

function getInitData() {
  try { return window.Telegram?.WebApp?.initData ?? ''; } catch { return ''; }
}

async function fetchLeaderboard() {
  const res = await fetch('/api/games/leaderboard', {
    headers: { 'X-Telegram-Init-Data': getInitData() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const MEDAL_ICONS = [Crown, Trophy, Medal];
const MEDAL_COLORS = ['#fbbf24', '#94a3b8', '#cd7c2f'];
const MEDAL_BG     = ['rgba(251,191,36,0.12)', 'rgba(148,163,184,0.08)', 'rgba(205,124,47,0.10)'];

export default function TopPlayers({ currentTelegramId }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard()
      .then(d => setPlayers(d.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <SectionTitle />
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="flex-1 rounded-2xl h-24 animate-pulse"
            style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    </div>
  );

  if (!players.length) return null;

  return (
    <div>
      <SectionTitle />
      <div className="flex gap-2">
        {players.map((p, i) => {
          const Icon = MEDAL_ICONS[i];
          const color = MEDAL_COLORS[i];
          const bg = MEDAL_BG[i];
          const rank = rankFor(p.level || 1);
          const isMe = String(p.telegramId) === String(currentTelegramId);
          return (
            <motion.div
              key={p.telegramId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex-1 rounded-2xl p-3 flex flex-col items-center text-center relative overflow-hidden"
              style={{
                background: isMe
                  ? 'rgba(34,211,238,0.10)'
                  : `rgba(15,23,42,0.6)`,
                border: isMe
                  ? '1px solid rgba(34,211,238,0.4)'
                  : `1px solid ${color}30`,
                boxShadow: i === 0 ? `0 4px 20px ${color}25` : 'none',
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-30"
                style={{ background: `radial-gradient(circle at 50% 0%, ${bg} 0%, transparent 70%)` }} />

              <div className="relative z-10 w-7 h-7 rounded-full flex items-center justify-center mb-2"
                style={{ background: bg, border: `1px solid ${color}40` }}>
                <Icon size={13} style={{ color }} />
              </div>

              <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center mb-1.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}25` }}>
                <span className="font-orbitron text-sm font-black" style={{ color }}>
                  {(p.name || 'P')[0].toUpperCase()}
                </span>
              </div>

              <p className="text-[10px] font-black text-white truncate w-full relative z-10 leading-tight">
                {isMe ? 'You' : (p.name?.split(' ')[0] || 'Player')}
              </p>

              <div className="mt-1 px-1.5 py-0.5 rounded-full relative z-10"
                style={{ background: `${rank?.hex || color}18`, border: `1px solid ${rank?.hex || color}35` }}>
                <span className="text-[8px] font-black tracking-wider uppercase"
                  style={{ color: rank?.hex || color }}>
                  {rank?.short || 'BGN'}
                </span>
              </div>

              <p className="font-orbitron text-xs font-black mt-1.5 relative z-10" style={{ color }}>
                {(p.xp || 0).toLocaleString()}
                <span className="text-[8px] font-medium ml-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>XP</span>
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Trophy size={11} style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.8))' }} />
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.75)' }}>
        Top Players
      </p>
    </div>
  );
}
