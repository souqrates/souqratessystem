import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Lang } from '../lib/i18n';

interface FallingCoin {
  id: number;
  left: number;
  delay: number;
  size: number;
  spin: number;
}

interface Props {
  jackpot: number;
  coinTrigger: number;
  lang: Lang;
  participants: number;
  onClick: () => void;
}

const AUTO_NAMES = [
  'أحمد م.', 'Sarah K.', 'خالد ر.', 'Omar B.', 'نورة س.',
  'Fatima A.', 'محمد ع.', 'Ali H.', 'سارة ع.', 'Yousef K.',
];

export default function JackpotCup({ jackpot, coinTrigger, lang, participants, onClick }: Props) {
  const [coins, setCoins] = useState<FallingCoin[]>([]);
  const [autoName, setAutoName] = useState<string | null>(null);
  const [autoAmount, setAutoAmount] = useState(0);
  const nextId = useRef(0);
  const isRtl = lang === 'ar';

  // fill 0–1 : 5 000 SKZ → 25%, 25 000 SKZ → 100%
  const fill = Math.min(1, 0.25 + Math.max(0, (jackpot - 5000) / 20000) * 0.75);

  // SVG cup interior: rim at y=56, bottom at y=250  (194 units tall)
  const INTERIOR_TOP = 60;
  const INTERIOR_BOT = 248;
  const FILL_HEIGHT = INTERIOR_BOT - INTERIOR_TOP; // 188
  const surfaceY = INTERIOR_BOT - fill * FILL_HEIGHT;

  function spawnCoins(count: number) {
    const batch: FallingCoin[] = Array.from({ length: count }, (_, i) => ({
      id: ++nextId.current,
      left: 20 + Math.random() * 60,
      delay: i * 0.09 + Math.random() * 0.04,
      size: 11 + Math.floor(Math.random() * 9),
      spin: Math.random() > 0.5 ? 1 : -1,
    }));
    setCoins(c => [...c, ...batch]);
    setTimeout(() => {
      const ids = new Set(batch.map(c => c.id));
      setCoins(c => c.filter(coin => !ids.has(coin.id)));
    }, 2400);
  }

  useEffect(() => { if (coinTrigger > 0) spawnCoins(9); }, [coinTrigger]);

  // Auto-demo: random users every ~4 s
  useEffect(() => {
    const id = setInterval(() => {
      const name = AUTO_NAMES[Math.floor(Math.random() * AUTO_NAMES.length)];
      const amt = [5, 10, 15, 20][Math.floor(Math.random() * 4)];
      setAutoName(name);
      setAutoAmount(amt);
      spawnCoins(4 + Math.floor(Math.random() * 4));
      setTimeout(() => setAutoName(null), 2500);
    }, 3800 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // Coin positions inside the cup pile
  const coinDots: Array<[number, number]> = [
    [75, 0], [118, 2], [162, 0], [205, 3],
    [90, 18], [145, 20], [195, 17],
    [108, 36], [158, 38], [80, 50], [185, 48], [132, 54],
  ];

  return (
    <div
      onClick={onClick}
      style={{ position: 'relative', width: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Ambient glow background */}
      <motion.div
        animate={{ opacity: [0.18, 0.42, 0.18], scale: [1, 1.07, 1] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', width: '85%', height: '60%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, #f59e0b40 0%, #d9770618 45%, transparent 70%)', pointerEvents: 'none' }}
      />

      {/* Live-buy notification */}
      <AnimatePresence>
        {autoName && (
          <motion.div
            key={`${autoName}-${autoAmount}`}
            initial={{ opacity: 0, y: 10, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            style={{ position: 'absolute', top: 48, zIndex: 20, background: 'rgba(8,18,8,0.93)', border: '1px solid rgba(251,191,36,0.38)', borderRadius: 20, padding: '4px 14px', fontSize: 11, color: '#fde047', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 16px rgba(251,191,36,0.22)', backdropFilter: 'blur(6px)', whiteSpace: 'nowrap' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ color: '#e2e8f0' }}>{autoName}</span>
            <span>{isRtl ? `اشترى تذكرة · +${autoAmount}` : `bought ticket · +${autoAmount}`} SKZ</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jackpot label + amount */}
      <motion.div
        animate={{ scale: [1, 1.022, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ textAlign: 'center', marginBottom: 4, zIndex: 2, position: 'relative' }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#f59e0b', fontFamily: '"Orbitron", sans-serif', fontWeight: 700, textShadow: '0 0 14px #f59e0baa', marginBottom: 2 }}>
          {isRtl ? '🏆 الجائزة الكبرى' : '🏆 JACKPOT'}
        </div>
        <motion.div
          key={jackpot}
          initial={{ scale: 1.14, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 34, fontWeight: 900, background: 'linear-gradient(90deg,#fbbf24 0%,#fde047 42%,#f59e0b 72%,#fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.05, filter: 'drop-shadow(0 0 14px #f59e0b88)' }}
        >
          {jackpot.toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, opacity: 0.82, marginTop: -1 }}>SKZ</div>
      </motion.div>

      {/* SVG cup + falling coins */}
      <div style={{ position: 'relative', width: '94%', maxWidth: 320 }}>
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/*
            Cup shape (proper goblet / trophy):
            - Rim: x 28–272 (244px wide) at y=46
            - Walls bulge slightly outward to y≈90, then curve inward to y=250
            - Stem: narrow y=250–300
            - Base: wide y=300–324
          */}
          <svg viewBox="0 0 300 380" style={{ width: '100%', overflow: 'visible' }}>
            <defs>
              {/* Gold liquid fill */}
              <linearGradient id="jcFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#fde047" stopOpacity="1" />
                <stop offset="30%"  stopColor="#fbbf24" stopOpacity="0.95" />
                <stop offset="70%"  stopColor="#d97706" stopOpacity="0.92" />
                <stop offset="100%" stopColor="#92400e" stopOpacity="1" />
              </linearGradient>

              {/* Glass wall — left-to-right gradient */}
              <linearGradient id="jcWall" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.72" />
                <stop offset="10%"  stopColor="#fffbeb" stopOpacity="0.24" />
                <stop offset="50%"  stopColor="#fffbeb" stopOpacity="0.05" />
                <stop offset="88%"  stopColor="#fffbeb" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.66" />
              </linearGradient>

              {/* Base */}
              <linearGradient id="jcBase" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#92400e" stopOpacity="0.85" />
                <stop offset="35%"  stopColor="#fbbf24" stopOpacity="0.95" />
                <stop offset="65%"  stopColor="#fde047" stopOpacity="1" />
                <stop offset="100%" stopColor="#92400e" stopOpacity="0.85" />
              </linearGradient>

              <filter id="jcGlow" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="jcDeepGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* Interior clip — matches the inside of the cup walls */}
              <clipPath id="jcClip">
                <path d="
                  M 42 54
                  C 52 60, 66 84, 70 110
                  C 76 140, 90 186, 116 248
                  L 184 248
                  C 210 186, 224 140, 230 110
                  C 234 84, 248 60, 258 54
                  Z
                " />
              </clipPath>

              <radialGradient id="jcRimGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fde047" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ── COIN FILL (clipped inside cup) ── */}
            <g clipPath="url(#jcClip)">
              {/* Dark empty interior */}
              <rect x="0" y="0" width="300" height="380" fill="#0d0800" />

              {/* Gold liquid — animate y position */}
              <motion.rect
                x={0}
                y={surfaceY}
                width={300}
                height={380}
                fill="url(#jcFill)"
                initial={{ y: INTERIOR_BOT }}
                animate={{ y: surfaceY }}
                transition={{ type: 'spring', stiffness: 28, damping: 11 }}
              />

              {/* Liquid surface wave */}
              <motion.ellipse
                cx={150}
                cy={surfaceY}
                rx={80}
                ry={10}
                fill="#fde047"
                opacity={0.9}
                initial={{ cy: surfaceY, rx: 80, ry: 10 }}
                animate={{ cy: [surfaceY, surfaceY - 6, surfaceY], rx: [80, 88, 80], ry: [10, 14, 10] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Coin circles in pile */}
              {coinDots.map(([dotCx, dotRelY], i) => (
                <motion.circle
                  key={i}
                  cx={dotCx}
                  cy={surfaceY + 10 + dotRelY}
                  r={7 + (i % 3) * 3}
                  fill="#fbbf24"
                  stroke="#fde047"
                  strokeWidth="1.2"
                  opacity={0.42 + (i % 4) * 0.13}
                  initial={{ cy: surfaceY + 10 + dotRelY }}
                  animate={{ cy: surfaceY + 10 + dotRelY }}
                  transition={{ type: 'spring', stiffness: 22, damping: 10, delay: i * 0.04 }}
                />
              ))}

              {/* Surface sparkles */}
              {([100, 154, 206] as const).map((spCx, i) => (
                <motion.circle
                  key={spCx}
                  cx={spCx}
                  cy={surfaceY + 10}
                  r={2.5}
                  fill="#fffbeb"
                  initial={{ opacity: 0, cy: surfaceY + 10 }}
                  animate={{ cy: [surfaceY + 10, surfaceY + 5, surfaceY + 10], opacity: [0, 0.9, 0], scale: [0.5, 1.5, 0.5] }}
                  transition={{ duration: 1.7, repeat: Infinity, delay: i * 0.58 }}
                />
              ))}
            </g>

            {/* ── GOBLET GLASS WALLS ──
                Proper trophy shape:
                - Rim wide (28–272) at y=46
                - Slight outward belly near top
                - Curves inward by y=250
                - Stem y=250–302
                - Base y=302–324
            */}
            <path
              d="
                M 28 46
                L 272 46
                C 284 56, 284 84, 272 112
                C 258 144, 228 188, 196 250
                L 172 250
                L 168 302
                L 226 302
                L 226 324
                L 74 324
                L 74 302
                L 132 302
                L 128 250
                L 104 250
                C 72 188, 42 144, 28 112
                C 16 84, 16 56, 28 46
                Z
              "
              fill="url(#jcWall)"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeOpacity="0.88"
              filter="url(#jcGlow)"
            />

            {/* Left glass reflection — bright streak */}
            <path d="M 42 64 C 50 96, 60 148, 68 210" fill="none" stroke="#fffbeb" strokeWidth="5" strokeOpacity="0.2" strokeLinecap="round" />
            <path d="M 50 72 C 57 100, 66 148, 74 205" fill="none" stroke="#fffbeb" strokeWidth="2" strokeOpacity="0.1" strokeLinecap="round" />

            {/* Right glass reflection */}
            <path d="M 258 64 C 250 96, 240 148, 232 210" fill="none" stroke="#fffbeb" strokeWidth="3" strokeOpacity="0.1" strokeLinecap="round" />

            {/* Rim highlight — thick glowing bar */}
            <path d="M 22 43 Q 150 30 278 43" fill="none" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round" filter="url(#jcGlow)" strokeOpacity="0.95" />
            <path d="M 30 43 Q 150 32 270 43" fill="none" stroke="#fde047" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.7" />
            {/* Rim glow ellipse */}
            <ellipse cx="150" cy="40" rx="112" ry="8" fill="url(#jcRimGlow)" opacity="0.5" />

            {/* Stem side lines */}
            <line x1="128" y1="250" x2="132" y2="302" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.35" />
            <line x1="172" y1="250" x2="168" y2="302" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.35" />

            {/* Base body */}
            <rect x="74" y="302" width="152" height="22" rx="5" fill="url(#jcBase)" />
            <rect x="74" y="302" width="152" height="22" rx="5" fill="none" stroke="#fbbf24" strokeWidth="2" strokeOpacity="0.88" filter="url(#jcGlow)" />
            {/* Base highlight */}
            <rect x="92" y="306" width="116" height="5" rx="2.5" fill="#fffbeb" opacity="0.28" />
            {/* Base glow shadow */}
            <ellipse cx="150" cy="326" rx="80" ry="6" fill="#f59e0b" opacity="0.2" filter="url(#jcDeepGlow)" />

            {/* ── Stars / sparkles floating outside cup ── */}
            {([
              { cx: 36, cy: 120, r: 3, delay: 0 },
              { cx: 264, cy: 140, r: 2.5, delay: 0.7 },
              { cx: 25, cy: 200, r: 2, delay: 1.3 },
              { cx: 275, cy: 90, r: 2, delay: 0.4 },
            ]).map((s, i) => (
              <motion.circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill="#fde047"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.8, 0], scale: [0, 1.2, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: s.delay, repeatDelay: 1.5 }}
              />
            ))}
          </svg>
        </motion.div>

        {/* ── FALLING COINS (HTML overlay) ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <AnimatePresence>
            {coins.map(coin => (
              <motion.div
                key={coin.id}
                initial={{ top: '2%', left: `${coin.left}%`, opacity: 1, rotate: 0, scale: 1 }}
                animate={{ top: '68%', opacity: [1, 1, 1, 0.6, 0], rotate: coin.spin * 200, scale: [1, 1.1, 0.95, 0.75] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, delay: coin.delay, ease: [0.22, 0.05, 0.82, 1] }}
                style={{ position: 'absolute', width: coin.size, height: coin.size, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fde047 0%, #fbbf24 45%, #d97706 80%, #92400e 100%)', boxShadow: '0 0 8px #fbbf2499, 0 2px 4px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.4)', transform: 'translateX(-50%)', zIndex: 20 }}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Splash particles when coins land */}
        <AnimatePresence>
          {coins.length > 0 && (
            <motion.div
              key="splash-burst"
              style={{ position: 'absolute', top: '64%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 22 }}
            >
              {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                <motion.div
                  key={deg}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(deg * Math.PI / 180) * 22, y: Math.sin(deg * Math.PI / 180) * 16, opacity: 0, scale: 0.4 }}
                  transition={{ duration: 0.45, delay: 0.52 + i * 0.03, ease: 'easeOut' }}
                  style={{ position: 'absolute', width: 5, height: 5, borderRadius: '50%', background: '#fde047', boxShadow: '0 0 4px #fbbf24' }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Participants + hint */}
      <div style={{ textAlign: 'center', marginTop: -6, paddingBottom: 2 }}>
        <span style={{ fontSize: 11, color: '#78716c' }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>{participants.toLocaleString()}</span>
          {isRtl ? ' مشترك ' : ' participants '}
        </span>
        <motion.span
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}
        >
          {isRtl ? '· اضغط لشراء تذكرة ←' : '· tap to buy ticket →'}
        </motion.span>
      </div>
    </div>
  );
}
