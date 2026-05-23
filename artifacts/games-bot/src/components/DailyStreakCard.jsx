import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Check, Gift, Zap, Calendar } from 'lucide-react';
import useAppStore from '../store/appStore';
import { claimDailyStreak, streakClaimedToday } from '../lib/gamification';
import { triggerHaptic } from '../lib/telegram';

// Day rewards schedule (streak day → XP earned)
function streakXp(day) {
  if (day <= 0) return 20;
  return Math.min(20 + (day - 1) * 5, 150);
}

// Show a 7-day preview of streak days
const DAYS = Array.from({ length: 7 }, (_, i) => i + 1);

export default function DailyStreakCard({ streak, gami, onClaimed }) {
  const { user, addNotification } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [showDays, setShowDays] = useState(false);

  const telegramId = user?.telegram_id;
  const claimed = streakClaimedToday(streak);
  const currentStreak = Number(streak?.current_streak || 0);
  const longestStreak = Number(streak?.longest_streak || 0);
  const nextXp = streakXp(currentStreak + (claimed ? 1 : 0));
  const todayXp = streakXp(currentStreak);

  async function handleClaim() {
    if (busy || claimed || !telegramId) return;
    setBusy(true);
    triggerHaptic('medium');
    const newStreak = await claimDailyStreak(telegramId);
    if (newStreak?.current_streak != null) {
      triggerHaptic('success');
      addNotification?.({
        title: `Day ${newStreak.current_streak} Streak!`,
        sub: `+${streakXp(newStreak.current_streak)} XP earned`,
        accent: '#f97316',
        glow: 'rgba(249,115,22,0.5)',
        bg: 'rgba(249,115,22,0.08)',
        border: 'rgba(249,115,22,0.2)',
        icon: Flame,
      });
      onClaimed?.();
    }
    setBusy(false);
  }

  if (!streak && !gami) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: claimed
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.04))'
          : 'linear-gradient(135deg, rgba(249,115,22,0.10), rgba(245,158,11,0.06))',
        border: `1px solid ${claimed ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.30)'}`,
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
          style={{
            background: claimed
              ? 'linear-gradient(135deg,#10b981,#059669)'
              : 'linear-gradient(135deg,#f97316,#ea580c)',
            boxShadow: claimed
              ? '0 0 20px rgba(16,185,129,0.5)'
              : '0 0 20px rgba(249,115,22,0.5)',
          }}
        >
          {claimed
            ? <Check size={22} color="#fff" strokeWidth={3} />
            : <Flame size={22} color="#fff" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' }} />
          }
          {/* Streak number badge */}
          {currentStreak > 0 && (
            <div
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
              style={{
                background: '#0b1220',
                border: `2px solid ${claimed ? '#10b981' : '#f97316'}`,
                fontSize: 9, fontWeight: 900, fontFamily: 'Orbitron, sans-serif',
                color: claimed ? '#10b981' : '#f97316',
              }}
            >
              {currentStreak}
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-tight">
            {claimed ? 'Daily Reward Claimed!' : 'Claim Daily Reward'}
          </p>
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(148,163,184,0.75)' }}>
            {claimed
              ? `${currentStreak} day streak · Come back tomorrow for +${streakXp(currentStreak + 1)} XP`
              : `Day ${currentStreak + 1} · Earn +${todayXp} XP today`
            }
          </p>
          {longestStreak > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Calendar size={9} style={{ color: 'rgba(148,163,184,0.5)' }} />
              <span className="text-[9px] font-bold" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Best: {longestStreak} days
              </span>
            </div>
          )}
        </div>

        {/* Action button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleClaim}
          disabled={claimed || busy}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl"
          style={{
            background: claimed
              ? 'rgba(16,185,129,0.12)'
              : 'linear-gradient(135deg,#f97316,#ea580c)',
            border: claimed ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(249,115,22,0.4)',
            boxShadow: claimed ? 'none' : '0 4px 16px rgba(249,115,22,0.4)',
            cursor: claimed || busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {claimed
            ? <Check size={13} color="#10b981" />
            : <Gift size={13} color="#fff" />
          }
          <span
            className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: claimed ? '#10b981' : '#fff' }}
          >
            {busy ? '…' : claimed ? 'Done' : 'Claim'}
          </span>
        </motion.button>
      </div>

      {/* 7-day streak pills */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-1.5">
          {DAYS.map(day => {
            const isPast = day < (claimed ? currentStreak + 1 : currentStreak);
            const isToday = day === (claimed ? currentStreak : currentStreak + 1) && day <= 7;
            const isFuture = !isPast && !isToday;
            return (
              <div
                key={day}
                className="flex-1 flex flex-col items-center gap-1"
                style={{ minWidth: 0 }}
              >
                <div
                  className="w-full h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: isPast
                      ? 'linear-gradient(135deg,#f97316,#ea580c)'
                      : isToday
                        ? claimed
                          ? 'linear-gradient(135deg,#10b981,#059669)'
                          : 'rgba(249,115,22,0.25)'
                        : 'rgba(255,255,255,0.04)',
                    border: isPast
                      ? 'none'
                      : isToday
                        ? claimed ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(249,115,22,0.4)'
                        : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: isPast ? '0 0 6px rgba(249,115,22,0.4)' : isToday && claimed ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
                  }}
                >
                  {(isPast || (isToday && claimed)) && (
                    <Check size={8} color="#fff" strokeWidth={3} />
                  )}
                  {isToday && !claimed && (
                    <Flame size={8} color="#f97316" />
                  )}
                </div>
                <span
                  className="text-[7px] font-black uppercase tracking-wide"
                  style={{
                    color: isPast || (isToday && claimed)
                      ? '#f97316'
                      : isToday
                        ? 'rgba(249,115,22,0.8)'
                        : 'rgba(148,163,184,0.3)',
                  }}
                >
                  D{day}
                </span>
              </div>
            );
          })}
          <div className="flex flex-col items-center gap-1" style={{ minWidth: 0 }}>
            <div className="w-full h-5 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Gift size={8} color="#f59e0b" />
            </div>
            <span className="text-[7px] font-black uppercase tracking-wide" style={{ color: 'rgba(245,158,11,0.5)' }}>
              +BIG
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
