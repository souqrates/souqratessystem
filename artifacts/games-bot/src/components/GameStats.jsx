import { motion } from 'framer-motion';
import { BarChart2 } from 'lucide-react';
import { GameIcon } from '../lib/game-icons';
import { GAMES } from '../constants';

const SAMPLE_GAMES = GAMES.slice(0, 6);

export default function GameStats({ gami, onOpenGame }) {
  const totalGames = Number(gami?.total_games || 0);
  const totalWins  = Number(gami?.total_wins  || 0);
  const totalLoss  = Math.max(0, totalGames - totalWins);
  const winRate    = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={11} style={{ color: '#a78bfa', filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.8))' }} />
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.75)' }}>
          Your Stats
        </p>
      </div>

      <div className="rounded-3xl overflow-hidden"
        style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(167,139,250,0.15)' }}>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-center">
              <p className="font-orbitron text-xl font-black" style={{ color: '#34d399' }}>
                {totalWins.toLocaleString()}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                Wins
              </p>
            </div>
            <div className="flex-1 mx-4">
              <div className="flex justify-between text-[9px] font-bold mb-1.5"
                style={{ color: 'rgba(148,163,184,0.6)' }}>
                <span style={{ color: '#34d399' }}>W {winRate}%</span>
                <span style={{ color: '#f43f5e' }}>L {100 - winRate}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${winRate}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #34d399, #10b981)' }}
                />
              </div>
              <div className="flex justify-between text-[8px] mt-1" style={{ color: 'rgba(148,163,184,0.4)' }}>
                <span>{totalWins}W</span>
                <span>{totalLoss}L</span>
              </div>
            </div>
            <div className="text-center">
              <p className="font-orbitron text-xl font-black" style={{ color: '#f43f5e' }}>
                {totalLoss.toLocaleString()}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                Losses
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-[9px] font-black uppercase tracking-widest mb-2.5"
            style={{ color: 'rgba(148,163,184,0.5)' }}>
            Play Again
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SAMPLE_GAMES.map((g) => (
              <motion.button
                key={g.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => onOpenGame(g)}
                className="rounded-xl p-2.5 flex flex-col items-center gap-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}><GameIcon id={g.id} size={18} color="rgba(34,211,238,0.75)" /></span>
                <p className="text-[8px] font-black text-white leading-tight text-center truncate w-full">
                  {g.name.split(' ')[0]}
                </p>
                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: g.difficulty === 'Hard' ? 'rgba(239,68,68,0.15)' : g.difficulty === 'Easy' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: g.difficulty === 'Hard' ? '#ef4444' : g.difficulty === 'Easy' ? '#10b981' : '#f59e0b',
                  }}>
                  {g.difficulty}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
