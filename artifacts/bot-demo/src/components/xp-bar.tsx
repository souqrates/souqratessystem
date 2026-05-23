import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import {
  levelFromXp,
  xpProgress,
  xpInLevel,
  xpToNextLevel,
  xpForLevelSpan,
  getRankForLevel,
} from "../lib/xp-system";
import { MOCK_XP } from "../lib/mock-data";

export function XpBar() {
  const { totalXp, streak } = MOCK_XP;
  const level = levelFromXp(totalXp);
  const rank = getRankForLevel(level);
  const progress = xpProgress(totalXp);
  const inLevel = xpInLevel(totalXp);
  const toNext = xpToNextLevel(totalXp);
  const span = xpForLevelSpan(level);

  return (
    <div
      className="rounded-2xl px-4 py-3 relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Subtle rank glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 5% 50%, ${rank.glow} 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 flex items-center gap-3">

        {/* Rank badge */}
        <div
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 relative"
          style={{ background: rank.gradient, boxShadow: `0 4px 16px ${rank.glow}` }}
        >
          <span className="text-base leading-none">{rank.icon}</span>
          <span
            className="text-[8px] font-black text-white/80 leading-none mt-0.5"
          >
            {level}
          </span>
        </div>

        {/* Progress area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black" style={{ color: rank.color }}>
                {rank.name}
              </span>
              <span className="text-[10px] text-white/30 font-medium">
                · Lv {level}
              </span>
            </div>
            <span className="text-[10px] font-bold text-white/40">
              {inLevel.toLocaleString()} / {span.toLocaleString()} XP
            </span>
          </div>

          {/* XP bar track */}
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress * 100, 100)}%` }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              style={{
                background: rank.gradient,
                boxShadow: `0 0 8px ${rank.glow}`,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-white/25 font-medium">
              {toNext.toLocaleString()} XP to Lv {level + 1}
            </span>
            {/* Next rank preview */}
            {level < 50 && (
              <span className="text-[9px] text-white/20 font-medium">
                Next: {getRankForLevel(level + 1).name}
              </span>
            )}
          </div>
        </div>

        {/* Streak badge */}
        {streak > 0 && (
          <div
            className="flex flex-col items-center gap-0.5 flex-shrink-0"
            style={{ minWidth: 36 }}
          >
            <div
              className="w-9 h-9 rounded-xl flex flex-col items-center justify-center"
              style={{
                background: streak >= 7
                  ? "linear-gradient(135deg,#f59e0b,#ef4444)"
                  : "rgba(245,158,11,0.12)",
                border: `1px solid ${streak >= 7 ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.25)"}`,
                boxShadow: streak >= 7 ? "0 4px 12px rgba(239,68,68,0.3)" : "none",
              }}
            >
              <Flame
                size={14}
                style={{ color: streak >= 7 ? "white" : "#f59e0b" }}
                className={streak >= 7 ? "fill-white" : ""}
              />
              <span
                className="text-[8px] font-black leading-none"
                style={{ color: streak >= 7 ? "white" : "#f59e0b" }}
              >
                {streak}
              </span>
            </div>
            <span className="text-[8px] text-white/25 font-medium">streak</span>
          </div>
        )}
      </div>
    </div>
  );
}
