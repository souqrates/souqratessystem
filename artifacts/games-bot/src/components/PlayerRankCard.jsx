import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sprout, Sparkles, Rocket, Swords, Shield, Zap, Target, Crosshair,
  Medal, Flame, Sword, Trophy, Star, Crown, Gem, Ghost, Sun, ChevronRight,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { fetchGamification } from '../lib/gamification';
import { rankProgress, RANKS } from '../lib/ranks';

const ICONS = {
  sprout: Sprout, sparkles: Sparkles, rocket: Rocket, swords: Swords, shield: Shield,
  zap: Zap, target: Target, crosshair: Crosshair, medal: Medal, flame: Flame,
  'bow-arrow': Target, sword: Sword, trophy: Trophy, star: Star, crown: Crown,
  gem: Gem, ghost: Ghost, sun: Sun,
};

export default function PlayerRankCard() {
  const { user, gamificationVersion } = useAppStore();
  const telegramId = user?.telegram_id;
  const [xp, setXp] = useState(0);
  const [totals, setTotals] = useState({ games: 0, wins: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!telegramId) return;
      const g = await fetchGamification();
      if (cancelled) return;
      setXp(Number(g?.xp || 0));
      setTotals({ games: Number(g?.total_games || 0), wins: Number(g?.total_wins || 0) });
    }
    load();
    return () => { cancelled = true; };
  }, [telegramId, gamificationVersion]);

  const p = rankProgress(xp);
  const rank = p.rank;
  const next = p.nextRank;
  const Icon = ICONS[rank.icon] || Star;
  const NextIcon = next ? (ICONS[next.icon] || Star) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(2,6,23,0.92))',
        border: `1px solid ${rank.hex}33`,
        boxShadow: `0 18px 50px -20px ${rank.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: rank.glow, opacity: 0.55 }} />
      <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full blur-3xl pointer-events-none"
        style={{ background: rank.glow, opacity: 0.28 }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: rank.hex, boxShadow: `0 0 10px ${rank.glow}` }} />
            <p className="text-[10px] font-black uppercase tracking-[0.22em]"
              style={{ color: 'rgba(226,232,240,0.7)' }}>
              Player Rank
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: `${rank.hex}14`, border: `1px solid ${rank.hex}33` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: rank.hex, boxShadow: `0 0 8px ${rank.glow}` }} />
            <span className="font-orbitron text-[10px] font-black tracking-widest" style={{ color: rank.hex }}>
              LV {p.level}/20
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Insignia */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex-shrink-0"
          >
            <div className="absolute inset-0 rounded-2xl blur-2xl pointer-events-none"
              style={{ background: rank.glow, opacity: 0.6 }} />
            <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: rank.grad,
                boxShadow: `0 12px 30px -10px ${rank.glow}, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 16px rgba(0,0,0,0.35)`,
              }}>
              <Icon size={36} color="#0b1220" strokeWidth={2.2}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }} />
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md"
              style={{ background: '#0b1220', border: `1px solid ${rank.hex}55` }}>
              <span className="font-orbitron text-[9px] font-black tracking-widest" style={{ color: rank.hex }}>
                {rank.short}
              </span>
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <p className="font-orbitron text-[22px] font-black leading-none truncate"
              style={{ color: '#fff', textShadow: `0 0 20px ${rank.glow}` }}>
              {rank.name}
            </p>
            <p className="text-[11px] font-semibold mt-1.5 uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.7)' }}>
              {p.xp.toLocaleString()} XP {!p.isMax && next && <span style={{ color: rank.hex }}>· {(p.nextAt - p.xp).toLocaleString()} to {next.name}</span>}
              {p.isMax && <span style={{ color: rank.hex }}>· Max Tier Reached</span>}
            </p>

            <div className="mt-3 h-2 rounded-full overflow-hidden relative"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${p.pct}%` }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                className="h-full rounded-full relative"
                style={{
                  background: rank.grad,
                  boxShadow: `0 0 16px ${rank.glow}`,
                }}>
                <motion.span
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-y-0 w-1/3 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }} />
              </motion.div>
            </div>

            <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(148,163,184,0.55)' }}>
              <span>{p.inLevel.toLocaleString()}/{p.span.toLocaleString()}</span>
              {next && NextIcon && (
                <span className="inline-flex items-center gap-1" style={{ color: next.hex }}>
                  <NextIcon size={11} /> {next.name} <ChevronRight size={10} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sub stats */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <SubStat label="Games" value={totals.games} color={rank.hex} />
          <SubStat label="Wins"  value={totals.wins}  color={rank.hex} />
          <SubStat
            label="Win Rate"
            value={`${totals.games ? Math.round((totals.wins / totals.games) * 100) : 0}%`}
            color={rank.hex}
          />
        </div>

        {/* Tier ladder */}
        <div className="mt-5 flex items-center gap-1.5 overflow-hidden">
          {RANKS.map((r, i) => {
            const reached = (i + 1) <= p.level;
            return (
              <div key={r.lvl} className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  background: reached ? r.grad : 'rgba(148,163,184,0.10)',
                  boxShadow: reached ? `0 0 6px ${r.glow}` : 'none',
                  opacity: reached ? 1 : 0.55,
                }} />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function SubStat({ label, value, color }) {
  return (
    <div className="rounded-xl p-2.5"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="font-orbitron text-base font-black leading-none" style={{ color: '#fff' }}>{value}</p>
      <p className="text-[9px] font-black uppercase tracking-widest mt-1.5" style={{ color: `${color}b3` }}>{label}</p>
    </div>
  );
}
