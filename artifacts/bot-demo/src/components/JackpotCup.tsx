import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Lang } from '../lib/i18n';

/* ─── constants ─────────────────────────────────────── */
const VB_W = 300;
const VB_H = 380;

// Cup interior clip region (approximate trapezoidal-ish shape)
const ITOP_Y = 54;   // y at cup rim interior
const IBOT_Y = 250;  // y at cup bottom interior

const COIN_R = 8;
const COIN_HSTEP = 19;   // horizontal center-to-center
const COIN_VSTEP = 14;   // vertical step (hex packing gives overlap)

/** Approximate interior x-bounds at a given y (linear interpolation) */
function iBoundsAt(y: number): [number, number] {
  const t = (y - ITOP_Y) / (IBOT_Y - ITOP_Y); // 0 = rim, 1 = bottom
  const xL = 42  + t * (118 - 42);
  const xR = 258 - t * (258 - 182);
  return [xL, xR];
}

interface CoinDot { cx: number; cy: number }

/** Generate static hex-packed coin grid filling the whole cup interior */
function buildGrid(): CoinDot[] {
  const dots: CoinDot[] = [];
  let row = 0;
  for (let cy = IBOT_Y - COIN_R - 1; cy > ITOP_Y + COIN_R; cy -= COIN_VSTEP) {
    const [rawL, rawR] = iBoundsAt(cy);
    const xL = rawL + COIN_R + 1;
    const xR = rawR - COIN_R - 1;
    if (xR - xL < COIN_R * 2) { row++; continue; }
    const nCoins = Math.floor((xR - xL) / COIN_HSTEP) + 1;
    const totalW  = (nCoins - 1) * COIN_HSTEP;
    const startX  = (xL + xR) / 2 - totalW / 2 + (row % 2 === 0 ? 0 : COIN_HSTEP / 2);
    for (let i = 0; i < nCoins; i++) {
      const cx = startX + i * COIN_HSTEP;
      if (cx >= xL && cx <= xR) dots.push({ cx, cy });
    }
    row++;
  }
  return dots;
}

const COIN_GRID = buildGrid();

/* ─── types ─────────────────────────────────────────── */
interface DroppingCoin {
  id: number;
  cx: number;
  landCy: number;
  r: number;
  delay: number;
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

/* ─── component ─────────────────────────────────────── */
export default function JackpotCup({ jackpot, coinTrigger, lang, participants, onClick }: Props) {
  const [dropping, setDropping] = useState<DroppingCoin[]>([]);
  const [autoName, setAutoName] = useState<string | null>(null);
  const [autoAmt, setAutoAmt]   = useState(0);
  const nextId = useRef(0);
  const isRtl = lang === 'ar';

  // fill 0–1 : 5 000 → 40 %, 25 000 → 100 %
  const fill     = Math.min(1, 0.40 + Math.max(0, (jackpot - 5000) / 20000) * 0.60);
  const surfaceY = IBOT_Y - fill * (IBOT_Y - ITOP_Y);

  // Dark-cover height: covers everything above surfaceY (coin pile hidden above it)
  const coverH   = Math.max(0, surfaceY - ITOP_Y + 2);

  function spawnCoins(count: number) {
    const batch: DroppingCoin[] = Array.from({ length: count }, (_, i) => ({
      id: ++nextId.current,
      cx: 70 + Math.random() * 160,        // random x in wide part of cup
      landCy: surfaceY - COIN_R * 0.6,     // land at current surface
      r: 6 + Math.random() * 5,
      delay: i * 0.08,
    }));
    setDropping(d => [...d, ...batch]);
    setTimeout(() => {
      const ids = new Set(batch.map(c => c.id));
      setDropping(d => d.filter(c => !ids.has(c.id)));
    }, 2200);
  }

  useEffect(() => { if (coinTrigger > 0) spawnCoins(10); }, [coinTrigger]);

  // Auto-demo
  useEffect(() => {
    const id = setInterval(() => {
      const name = AUTO_NAMES[Math.floor(Math.random() * AUTO_NAMES.length)];
      const amt  = [5, 10, 15, 20][Math.floor(Math.random() * 4)];
      setAutoName(name);
      setAutoAmt(amt);
      spawnCoins(4 + Math.floor(Math.random() * 4));
      setTimeout(() => setAutoName(null), 2500);
    }, 3600 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // Depth gradient: bottom coins are darker
  const DEPTH_STOPS = useMemo(() => {
    const full = fill;
    return [
      { offset: '0%',   color: '#fde047', opacity: 0.92 },
      { offset: `${Math.min(60, full * 100 * 0.6)}%`, color: '#fbbf24', opacity: 0.75 },
      { offset: '100%', color: '#92400e', opacity: 0.55 },
    ];
  }, [fill]);

  return (
    <div
      onClick={onClick}
      style={{ position: 'relative', width: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Soft ambient pulse behind cup */}
      <motion.div
        animate={{ opacity: [0.14, 0.36, 0.14] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', width: '78%', height: '58%', borderRadius: '50%', background: 'radial-gradient(ellipse, #f59e0b38 0%, transparent 70%)', pointerEvents: 'none' }}
      />

      {/* Live-buy toast */}
      <AnimatePresence>
        {autoName && (
          <motion.div
            key={`${autoName}-${autoAmt}`}
            initial={{ opacity: 0, y: 10, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            style={{ position: 'absolute', top: 46, zIndex: 30, background: 'rgba(6,14,6,0.94)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 22, padding: '4px 14px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 18px rgba(251,191,36,0.22)', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', color: '#fde047' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
            <span style={{ color: '#e2e8f0' }}>{autoName}</span>
            <span>{isRtl ? `اشترى · +${autoAmt}` : `bought · +${autoAmt}`} SKZ</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jackpot amount */}
      <motion.div
        animate={{ scale: [1, 1.018, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ textAlign: 'center', marginBottom: 2, zIndex: 2, position: 'relative' }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#f59e0b', fontFamily: '"Orbitron", sans-serif', fontWeight: 700, textShadow: '0 0 12px #f59e0baa', marginBottom: 3 }}>
          {isRtl ? '🏆 الجائزة الكبرى' : '🏆 JACKPOT PRIZE'}
        </div>
        <motion.div
          key={jackpot}
          initial={{ scale: 1.12, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.48, ease: 'easeOut' }}
          style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 34, fontWeight: 900, background: 'linear-gradient(90deg,#fbbf24 0%,#fde047 40%,#f59e0b 72%,#fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.05, filter: 'drop-shadow(0 0 14px #f59e0b88)' }}
        >
          {jackpot.toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, opacity: 0.82, marginTop: -1 }}>SKZ</div>
      </motion.div>

      {/* ─── SVG CUP ─── */}
      <div style={{ position: 'relative', width: '94%', maxWidth: 310 }}>
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            style={{ width: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* ── Coin face gradient (radial, 3D effect) ── */}
              <radialGradient id="jcCoin" cx="36%" cy="34%" r="68%">
                <stop offset="0%"   stopColor="#fef3c7" />
                <stop offset="30%"  stopColor="#fde047" />
                <stop offset="65%"  stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </radialGradient>

              {/* Top-layer coin (brighter, recently dropped) */}
              <radialGradient id="jcCoinTop" cx="34%" cy="32%" r="68%">
                <stop offset="0%"   stopColor="#fffbeb" />
                <stop offset="25%"  stopColor="#fef9c3" />
                <stop offset="55%"  stopColor="#fde047" />
                <stop offset="100%" stopColor="#d97706" />
              </radialGradient>

              {/* Depth gradient applied over the pile (top bright → bottom dark) */}
              <linearGradient id="jcDepth" x1="0" y1="0" x2="0" y2="1">
                {DEPTH_STOPS.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
                ))}
              </linearGradient>

              {/* Warm glow overlay at surface level */}
              <radialGradient id="jcSurface" cx="50%" cy="100%" r="60%">
                <stop offset="0%"   stopColor="#fef9c3" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
              </radialGradient>

              {/* Cup wall gradient — very subtle, clean */}
              <linearGradient id="jcWall" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.55" />
                <stop offset="6%"   stopColor="#fde047" stopOpacity="0.14" />
                <stop offset="50%"  stopColor="#fffbeb" stopOpacity="0.03" />
                <stop offset="94%"  stopColor="#fde047" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.50" />
              </linearGradient>

              {/* Base */}
              <linearGradient id="jcBase" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#78350f" stopOpacity="0.9" />
                <stop offset="30%"  stopColor="#fbbf24" stopOpacity="0.95" />
                <stop offset="70%"  stopColor="#fde047" stopOpacity="1" />
                <stop offset="100%" stopColor="#78350f" stopOpacity="0.9" />
              </linearGradient>

              {/* Glow / shadow filters */}
              <filter id="jcGlow" x="-18%" y="-18%" width="136%" height="136%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="jcRimGlow" x="-25%" y="-100%" width="150%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="jcBaseGlow" x="-20%" y="-60%" width="140%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/*
                Interior clip path — inside of the cup body.
                This clips ALL coin fill, falling coins, and surface effects.
                Cup narrows from wide rim to narrow stem area.
              */}
              <clipPath id="jcClip">
                <path d="
                  M 42 54
                  C 52 62, 66 88, 70 114
                  C 78 146, 96 194, 122 250
                  L 178 250
                  C 204 194, 222 146, 230 114
                  C 234 88, 248 62, 258 54
                  Z
                " />
              </clipPath>

              {/* Rim radial glow */}
              <radialGradient id="jcRimRad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fde047" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ───────────────────────────────────── */}
            {/* STEP 1: CUP INTERIOR — COIN FILL      */}
            {/* ───────────────────────────────────── */}
            <g clipPath="url(#jcClip)">

              {/* Deep dark interior (empty top portion) */}
              <rect x="0" y="0" width={VB_W} height={VB_H} fill="#070400" />

              {/* ── Coin grid: ALL positions, always rendered ── */}
              {COIN_GRID.map((dot, i) => (
                <g key={i}>
                  <circle cx={dot.cx} cy={dot.cy} r={COIN_R}     fill="url(#jcCoin)" />
                  <circle cx={dot.cx} cy={dot.cy} r={COIN_R}     fill="none" stroke="#fde047" strokeWidth="1" opacity="0.45" />
                  {/* Tiny shine on each coin */}
                  <ellipse
                    cx={dot.cx - 2.5} cy={dot.cy - 2.8}
                    rx={2.5} ry={1.5}
                    fill="#fef9c3" opacity="0.55"
                  />
                </g>
              ))}

              {/* Depth overlay — makes bottom coins darker/richer */}
              <rect x="0" y={ITOP_Y} width={VB_W} height={IBOT_Y - ITOP_Y} fill="url(#jcDepth)" style={{ mixBlendMode: 'multiply' }} />

              {/*
                ── DARK COVER ──
                A dark rectangle from y=ITOP_Y whose height = coverH.
                It hides the TOP portion of the coin grid (above the fill level).
                As fill increases → coverH decreases → more coins revealed.
              */}
              <motion.rect
                x={0}
                y={ITOP_Y}
                width={VB_W}
                fill="#070400"
                initial={{ height: IBOT_Y - ITOP_Y }}
                animate={{ height: Math.max(0, coverH) }}
                transition={{ type: 'spring', stiffness: 26, damping: 11 }}
              />

              {/* ── Coin pile surface shine (amber, not white) ── */}
              <motion.ellipse
                cx={150}
                cy={surfaceY}
                rx={64}
                ry={7}
                fill="#fbbf24"
                opacity={0.65}
                initial={{ cy: IBOT_Y, rx: 38, ry: 6 }}
                animate={{ cy: [surfaceY, surfaceY - 4, surfaceY], rx: [64, 70, 64], ry: [7, 10, 7] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Top shimmer line */}
              <motion.ellipse
                cx={150}
                cy={surfaceY - 2}
                rx={42}
                ry={3}
                fill="#fef9c3"
                opacity={0.35}
                initial={{ cy: IBOT_Y - 2, rx: 28, ry: 2 }}
                animate={{ cy: [surfaceY - 2, surfaceY - 5, surfaceY - 2], rx: [42, 48, 42] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* ── Falling / dropping coins ── */}
              <AnimatePresence>
                {dropping.map(dc => (
                  <motion.g key={dc.id}>
                    <motion.circle
                      cx={dc.cx}
                      cy={ITOP_Y + 5}
                      r={dc.r}
                      fill="url(#jcCoinTop)"
                      stroke="#fde047"
                      strokeWidth="1.3"
                      initial={{ cy: ITOP_Y + 5, opacity: 1, scaleX: 1, scaleY: 1 }}
                      animate={{ cy: dc.landCy, opacity: [1, 1, 1, 0.8, 0], scaleY: [1, 1.2, 0.8, 0.7] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, delay: dc.delay, ease: [0.25, 0.05, 0.75, 1] }}
                    />
                    {/* Motion blur streak on each coin */}
                    <motion.line
                      x1={dc.cx} y1={ITOP_Y + 5 - dc.r}
                      x2={dc.cx} y2={ITOP_Y + 5 - dc.r - 12}
                      stroke="#fde047"
                      strokeWidth={dc.r * 0.6}
                      strokeOpacity={0.25}
                      strokeLinecap="round"
                      initial={{ x1: dc.cx, y1: ITOP_Y + 5 - dc.r, x2: dc.cx, y2: ITOP_Y + 5 - dc.r - 12, opacity: 0.4 }}
                      animate={{ y1: dc.landCy - dc.r, y2: dc.landCy - dc.r - 12, opacity: [0.4, 0.3, 0.1, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, delay: dc.delay, ease: [0.25, 0.05, 0.75, 1] }}
                    />
                  </motion.g>
                ))}
              </AnimatePresence>

              {/* ── Coin land splash ── */}
              <AnimatePresence>
                {dropping.length > 0 && (
                  <motion.g key={`splash-${dropping[0]?.id}`}>
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
                      const rad = (deg * Math.PI) / 180;
                      const dist = 14;
                      return (
                        <motion.circle
                          key={deg}
                          cx={150}
                          cy={surfaceY}
                          r={2.5}
                          fill="#fde047"
                          initial={{ cx: 150, cy: surfaceY, opacity: 1, r: 2.5 }}
                          animate={{
                            cx: 150 + Math.cos(rad) * dist,
                            cy: surfaceY + Math.sin(rad) * dist * 0.5,
                            opacity: 0,
                            r: 1,
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.4, delay: 0.45 + i * 0.02, ease: 'easeOut' }}
                        />
                      );
                    })}
                  </motion.g>
                )}
              </AnimatePresence>

            </g>{/* end clipPath */}

            {/* ───────────────────────────────────── */}
            {/* STEP 2: CUP GLASS WALLS               */}
            {/* ───────────────────────────────────── */}

            {/*
              Goblet / trophy shape:
              - Rim: x 24–276 (252 wide) at y=44
              - Slight outward belly near top (classic chalice shape)
              - Narrows to stem by y=252
              - Stem: y 252–306
              - Base: y 306–328
            */}
            <path
              d="
                M 24 44
                L 276 44
                C 290 56, 292 86, 280 118
                C 265 152, 234 196, 202 252
                L 174 252
                L 170 306
                L 230 306
                L 230 328
                L 70 328
                L 70 306
                L 130 306
                L 126 252
                L 98 252
                C 66 196, 35 152, 20 118
                C 8 86, 10 56, 24 44
                Z
              "
              fill="url(#jcWall)"
              stroke="#f59e0b"
              strokeWidth="2.2"
              strokeOpacity="0.9"
              filter="url(#jcGlow)"
            />

            {/* ── Rim bar ── */}
            <path
              d="M 18 41 Q 150 28 282 41"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="9"
              strokeLinecap="round"
              filter="url(#jcRimGlow)"
              strokeOpacity="0.95"
            />
            {/* Rim inner bright line */}
            <path
              d="M 26 41 Q 150 30 274 41"
              fill="none"
              stroke="#fef9c3"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />
            {/* Rim glow ellipse */}
            <ellipse cx="150" cy="38" rx="115" ry="9" fill="url(#jcRimRad)" opacity="0.5" />

            {/* ── Thin accent on left & right edges only (no thick stripe) ── */}
            <path d="M 36 60 C 40 90, 46 148, 54 214" fill="none" stroke="#fde047" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round" />
            <path d="M 264 60 C 260 90, 254 148, 246 214" fill="none" stroke="#fde047" strokeWidth="1.5" strokeOpacity="0.1" strokeLinecap="round" />

            {/* ── Stem ── */}
            <line x1="126" y1="252" x2="130" y2="306" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" />
            <line x1="174" y1="252" x2="170" y2="306" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" />

            {/* ── Base ── */}
            <rect x="70" y="306" width="160" height="22" rx="5" fill="url(#jcBase)" />
            <rect x="70" y="306" width="160" height="22" rx="5" fill="none" stroke="#fbbf24" strokeWidth="2" strokeOpacity="0.88" filter="url(#jcGlow)" />
            {/* Base highlight line */}
            <rect x="88" y="310" width="124" height="5" rx="2.5" fill="#fffbeb" opacity="0.24" />
            {/* Base glow puddle */}
            <ellipse cx="150" cy="330" rx="84" ry="7" fill="#f59e0b" opacity="0.18" filter="url(#jcBaseGlow)" />

            {/* ── Ambient coin sparkles ── */}
            {[
              { cx: 32,  cy: 130, delay: 0.0,  r: 2.8 },
              { cx: 268, cy: 110, delay: 0.7,  r: 2.2 },
              { cx: 22,  cy: 210, delay: 1.4,  r: 1.8 },
              { cx: 278, cy: 190, delay: 0.4,  r: 2.5 },
              { cx: 26,  cy: 80,  delay: 1.0,  r: 1.6 },
            ].map((s, i) => (
              <motion.circle
                key={i}
                cx={s.cx} cy={s.cy} r={s.r}
                fill="#fde047"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.85, 0], scale: [0, 1.3, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: s.delay, repeatDelay: 2 }}
              />
            ))}
          </svg>
        </motion.div>
      </div>

      {/* Participants + hint */}
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <span style={{ fontSize: 11, color: '#78716c' }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>{participants.toLocaleString()}</span>
          {isRtl ? ' مشترك ' : ' participants '}
        </span>
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}
        >
          {isRtl ? '· اضغط لشراء تذكرة ←' : '· tap to buy ticket →'}
        </motion.span>
      </div>
    </div>
  );
}
