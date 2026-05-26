import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Star, Check } from 'lucide-react';
import useAppStore from '../store/appStore';
import {
  fetchGamification, fetchStreak, claimDailyStreak,
  streakClaimedToday,
} from '../lib/gamification';
import { rankProgress } from '../lib/ranks';
import { triggerHaptic } from '../lib/telegram';

export default function GamificationCard() {
  const { user, addNotification, gamificationVersion } = useAppStore();
  const telegramId = user?.telegram_id;
  const [gami, setGami]     = useState(null);
  const [streak, setStreak] = useState(null);
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!telegramId) return;
      const [g, s] = await Promise.all([
        fetchGamification(),
        fetchStreak(),
      ]);
      if (cancelled) return;
      setGami(g);
      setStreak(s);
    }
    load();
    return () => { cancelled = true; };
  }, [telegramId, gamificationVersion]);

  const xp = Number(gami?.xp || 0);
  const { level, inLevel, span, pct, rank } = rankProgress(xp);
  const claimed = streakClaimedToday(streak);
  const currentStreak = Number(streak?.current_streak || 0);

  async function onClaim() {
    if (busy || claimed || !telegramId) return;
    setBusy(true);
    triggerHaptic('medium');
    const newStreak = await claimDailyStreak(telegramId);
    if (newStreak) {
      setStreak(newStreak);
      const refreshed = await fetchGamification();
      setGami(refreshed);
      triggerHaptic('success');
      addNotification?.({
        title: `Day ${newStreak.current_streak} Streak!`,
        sub: `+${Math.min(100, 20 + (newStreak.current_streak - 1) * 5)} XP earned`,
        accent: '#10b981',
        glow: 'rgba(16,185,129,0.5)',
        bg: 'rgba(16,185,129,0.08)',
        border: 'rgba(16,185,129,0.2)',
        icon: Flame,
      });
    }
    setBusy(false);
  }

  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${rank.hex}14, rgba(6,182,212,0.04))`,
        border: `1px solid ${rank.hex}2e`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: rank.grad,
              boxShadow: `0 0 20px ${rank.glow}`,
            }}
          >
            <Star size={22} color="#0b1220" strokeWidth={2.4} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: `${rank.hex}cc` }}>
              {rank.name}
            </p>
            <p className="font-orbitron text-xl font-black text-white leading-none">LV {level}</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: 'rgba(148,163,184,0.78)' }}>
              {inLevel}/{span} XP
            </p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onClaim}
          disabled={claimed || busy}
          className="flex items-center justify-center px-4 py-2.5 rounded-2xl flex-shrink-0 flex-row"
          style={{
            background: claimed
              ? 'rgba(16,185,129,0.12)'
              : 'linear-gradient(135deg,#f97316,#ea580c)',
            border: claimed ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(249,115,22,0.4)',
            boxShadow: claimed ? 'none' : '0 4px 14px rgba(249,115,22,0.4)',
            opacity: busy ? 0.6 : 1,
            cursor: claimed || busy ? 'default' : 'pointer',
            minWidth: 92,
          }}
        >
          <div className="flex items-center gap-1.5">
            {claimed ? (
              <Check size={14} color="#10b981" />
            ) : (
              <Flame size={14} color="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
            )}
            <span
              className="font-orbitron text-base font-black leading-none"
              style={{ color: claimed ? '#10b981' : '#fff' }}
            >
              {currentStreak}
            </span>
          </div>
          <span
            className="text-[9px] font-black uppercase tracking-widest mt-1"
            style={{ color: claimed ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.92)' }}
          >
            {claimed ? 'Claimed' : 'Claim'}
          </span>
        </motion.button>
      </div>

      <div
        className="mt-3 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: rank.grad,
            boxShadow: `0 0 8px ${rank.glow}`,
          }}
        />
      </div>
    </div>
  );
}
