interface Props {
  jackpot: number;
}

export default function JackpotTrophy({ jackpot }: Props) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full" style={{
        background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)",
        animation: "jackpot-glow 2s ease-in-out infinite",
      }} />

      {/* Trophy SVG */}
      <div className="trophy-float relative z-10">
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          {/* Trophy cup body */}
          <path
            d="M25 15 H75 L68 55 Q65 70 50 72 Q35 70 32 55 Z"
            fill="url(#trophyGrad)"
            stroke="rgba(245,158,11,0.6)"
            strokeWidth="1.5"
          />
          {/* Handles */}
          <path d="M25 15 Q10 15 12 30 Q14 44 30 44" stroke="url(#trophyGrad)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M75 15 Q90 15 88 30 Q86 44 70 44" stroke="url(#trophyGrad)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          {/* Stem */}
          <rect x="43" y="72" width="14" height="12" rx="2" fill="url(#stemGrad)" />
          {/* Base */}
          <rect x="33" y="84" width="34" height="6" rx="3" fill="url(#baseGrad)" />
          {/* Star decoration */}
          <text x="50" y="48" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.9)">⭐</text>
          {/* Shine */}
          <ellipse cx="37" cy="28" rx="5" ry="8" fill="rgba(255,255,255,0.2)" transform="rotate(-20 37 28)" />

          <defs>
            <linearGradient id="trophyGrad" x1="25" y1="15" x2="75" y2="72" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fcd34d"/>
              <stop offset="50%" stopColor="#f59e0b"/>
              <stop offset="100%" stopColor="#92400e"/>
            </linearGradient>
            <linearGradient id="stemGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="#b45309"/>
              <stop offset="100%" stopColor="#78350f"/>
            </linearGradient>
            <linearGradient id="baseGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="#92400e"/>
              <stop offset="50%" stopColor="#d97706"/>
              <stop offset="100%" stopColor="#92400e"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Sparkle particles */}
      {[
        { top: "10%", left: "10%", delay: "0s" },
        { top: "15%", right: "12%", delay: "0.5s" },
        { bottom: "20%", left: "8%", delay: "1s" },
        { bottom: "15%", right: "10%", delay: "1.5s" },
      ].map((pos, i) => (
        <div key={i} className="absolute text-xs" style={{
          ...pos,
          animation: `jackpot-glow 2s ease-in-out ${pos.delay} infinite`,
          fontSize: 12,
        }}>
          ✨
        </div>
      ))}
    </div>
  );
}
