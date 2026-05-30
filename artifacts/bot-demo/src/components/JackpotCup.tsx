import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Lang } from '../lib/i18n';

/* ──────────────────────────────────────────────────────
   GEOMETRY
   viewBox 0 0 320 400
   The cup path and interior clip must match exactly.
   Glass wall thickness: ~5px.
   ────────────────────────────────────────────────────── */
const VW = 320;
const VH = 400;

// Interior top / bottom (y coordinates)
const IT = 50;   // interior top  (just below rim)
const IB = 260;  // interior bottom
const FH = IB - IT; // fill height = 210

// ── Coin grid constants ────────────────────────────────
const CR  = 9;    // coin radius
const HS  = 20;   // horizontal step (center-to-center)
const VS  = 15;   // vertical step   (hex-pack, slight overlap)

/**
 * Returns [xLeft, xRight] of the interior clip at a given y.
 * Derived from the clip path shape below.
 *
 *   At y = IT  (50)  → xL=26,  xR=294  (wide rim opening)
 *   At y = IB  (260) → xL=110, xR=210  (narrow bottom)
 *
 * Using a curve that matches the Bezier hull.
 */
function clipBounds(y: number): [number, number] {
  const t = (y - IT) / FH;                      // 0 = rim, 1 = bottom
  // Quadratic ease-in: starts narrow at top, but the rim IS the wide end.
  // The cup WIDENS slightly around y=80 then tapers in.
  // Approximate with two linear segments for simplicity; clipping handles overflows.
  const xL = 26  + t * (110 - 26);
  const xR = 294 - t * (294 - 210);
  return [xL, xR];
}

interface CoinPos { cx: number; cy: number }

function buildGrid(): CoinPos[] {
  const grid: CoinPos[] = [];
  let row = 0;
  for (let cy = IB - CR - 1; cy > IT + CR; cy -= VS) {
    const [rawL, rawR] = clipBounds(cy);
    const xL = rawL + CR + 1;
    const xR = rawR - CR - 1;
    if (xR - xL < CR * 2) { row++; continue; }
    const n   = Math.floor((xR - xL) / HS) + 1;
    const tw  = (n - 1) * HS;
    const sx  = (xL + xR) / 2 - tw / 2 + (row % 2 === 0 ? 0 : HS / 2);
    for (let i = 0; i < n; i++) {
      const cx = sx + i * HS;
      if (cx >= xL && cx <= xR) grid.push({ cx, cy });
    }
    row++;
  }
  return grid;
}

const COIN_GRID = buildGrid();

/* ──────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────── */
interface DroppingCoin {
  id: number; cx: number; startY: number; landY: number; r: number; delay: number;
}

interface Props {
  jackpot: number; coinTrigger: number;
  lang: Lang; participants: number; onClick: () => void;
}

const DEMO_NAMES = [
  'أحمد م.','Sarah K.','خالد ر.','Omar B.','نورة س.',
  'Fatima A.','محمد ع.','Ali H.','سارة ع.','Yousef K.',
];

/* ──────────────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────────────── */
export default function JackpotCup({
  jackpot, coinTrigger, lang, participants, onClick,
}: Props) {
  const [dropping, setDropping] = useState<DroppingCoin[]>([]);
  const [toast,    setToast   ] = useState<{ name: string; amt: number } | null>(null);
  const nextId = useRef(0);
  const isRtl  = lang === 'ar';

  // fill 0→1 : jackpot 5 000 → 40 %, jackpot 25 000 → 100 %
  const fill     = Math.min(1, 0.40 + Math.max(0, (jackpot - 5000) / 20000) * 0.60);
  const surfaceY = IB - fill * FH;                     // y of coin pile top
  const coverH   = Math.max(0, surfaceY - IT + 1);     // dark cover height

  function spawnCoins(count: number) {
    const batch: DroppingCoin[] = Array.from({ length: count }, (_, i) => ({
      id:     ++nextId.current,
      cx:     80 + Math.random() * 160,
      startY: IT + 4,
      landY:  surfaceY - CR * 0.5,
      r:      7 + Math.random() * 5,
      delay:  i * 0.08,
    }));
    setDropping(d => [...d, ...batch]);
    setTimeout(() => {
      const ids = new Set(batch.map(c => c.id));
      setDropping(d => d.filter(c => !ids.has(c.id)));
    }, 2400);
  }

  useEffect(() => { if (coinTrigger > 0) spawnCoins(10); }, [coinTrigger]);

  useEffect(() => {
    const t = setInterval(() => {
      const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
      const amt  = [5, 10, 15, 20][Math.floor(Math.random() * 4)];
      setToast({ name, amt });
      spawnCoins(4 + Math.floor(Math.random() * 4));
      setTimeout(() => setToast(null), 2600);
    }, 3800 + Math.random() * 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', width: '100%', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Ambient glow behind cup */}
      <motion.div
        animate={{ opacity: [0.12, 0.32, 0.12] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: '82%', height: '55%', borderRadius: '50%',
          background: 'radial-gradient(ellipse, #f59e0b30 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Live-buy toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={`${toast.name}-${toast.amt}`}
            initial={{ opacity: 0, y: 12, scale: 0.88 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit   ={{ opacity: 0, y: -8, scale: 0.9  }}
            style={{
              position: 'absolute', top: 44, zIndex: 30,
              background: 'rgba(5,12,5,0.95)',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 22, padding: '4px 14px',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 20px rgba(251,191,36,0.18)',
              backdropFilter: 'blur(10px)',
              whiteSpace: 'nowrap', color: '#fde047',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
            <span style={{ color: '#e2e8f0' }}>{toast.name}</span>
            <span>{isRtl ? `اشترى · +${toast.amt}` : `bought · +${toast.amt}`} SKZ</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jackpot amount */}
      <motion.div
        animate={{ scale: [1, 1.016, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ textAlign: 'center', marginBottom: 0, zIndex: 2, position: 'relative' }}
      >
        <div style={{
          fontSize: 11, letterSpacing: '0.15em', color: '#f59e0b',
          fontFamily: '"Orbitron",sans-serif', fontWeight: 700,
          textShadow: '0 0 14px #f59e0baa', marginBottom: 4,
        }}>
          {isRtl ? '🏆 الجائزة الكبرى' : '🏆 JACKPOT PRIZE'}
        </div>
        <motion.div
          key={jackpot}
          initial={{ scale: 1.1, opacity: 0.6 }}
          animate={{ scale: 1,   opacity: 1   }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            fontFamily: '"Orbitron",sans-serif', fontSize: 36, fontWeight: 900,
            background: 'linear-gradient(90deg,#fbbf24 0%,#fef9c3 40%,#f59e0b 75%,#fbbf24 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.05, filter: 'drop-shadow(0 0 18px #f59e0b99)',
          }}
        >
          {jackpot.toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, opacity: 0.8, marginTop: -2 }}>SKZ</div>
      </motion.div>

      {/* ═══ SVG CUP ═══ */}
      <div style={{ position: 'relative', width: '96%', maxWidth: 340 }}>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', overflow: 'visible' }}>
            <defs>

              {/* ─── 3-D Coin gradient (specular top-left → dark bottom-right) ─── */}
              <radialGradient id="gCoin" cx="30%" cy="26%" r="75%">
                <stop offset="0%"   stopColor="#fffde7" />
                <stop offset="12%"  stopColor="#fef9c3" />
                <stop offset="32%"  stopColor="#fde047" />
                <stop offset="58%"  stopColor="#f59e0b" />
                <stop offset="80%"  stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>

              {/* Brighter freshly-dropped coin */}
              <radialGradient id="gCoinNew" cx="30%" cy="26%" r="72%">
                <stop offset="0%"   stopColor="#ffffff" />
                <stop offset="10%"  stopColor="#fffde7" />
                <stop offset="30%"  stopColor="#fef9c3" />
                <stop offset="55%"  stopColor="#fde047" />
                <stop offset="80%"  stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </radialGradient>

              {/* Cup wall: nearly transparent amber tint, edges only */}
              <linearGradient id="gWall" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.60" />
                <stop offset="4%"   stopColor="#fde047" stopOpacity="0.08" />
                <stop offset="50%"  stopColor="#fffbeb" stopOpacity="0.02" />
                <stop offset="96%"  stopColor="#fde047" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.56" />
              </linearGradient>

              {/* Base gradient */}
              <linearGradient id="gBase" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#78350f" stopOpacity="0.95" />
                <stop offset="25%"  stopColor="#d97706" stopOpacity="1" />
                <stop offset="50%"  stopColor="#fde047" stopOpacity="1" />
                <stop offset="75%"  stopColor="#d97706" stopOpacity="1" />
                <stop offset="100%" stopColor="#78350f" stopOpacity="0.95" />
              </linearGradient>

              {/* Glow filters */}
              <filter id="fGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="fRim" x="-30%" y="-120%" width="160%" height="340%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="fBase" x="-25%" y="-80%" width="150%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="fSurface" x="-20%" y="-80%" width="140%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              {/*
                ════════════════════════════════════════
                INTERIOR CLIP PATH
                Follows the inner wall of the cup.
                Glass wall thickness ≈ 5px.

                At y=50  (rim):   xL=26,  xR=294  width=268
                At y=260 (bottom):xL=110, xR=210  width=100

                The cup slightly widens around y=70–90 (belly),
                then tapers inward. The clip follows that curve.
                ════════════════════════════════════════
              */}
              <clipPath id="cupClip">
                <path d="
                  M 26 50
                  C 16 62, 14 92, 26 126
                  C 40 162, 72 206, 110 260
                  L 210 260
                  C 248 206, 280 162, 294 126
                  C 306 92, 304 62, 294 50
                  Z
                " />
              </clipPath>

            </defs>

            {/* ════ COIN FILL (all clipped to cup interior) ════ */}
            <g clipPath="url(#cupClip)">

              {/* Deep dark interior */}
              <rect x="0" y="0" width={VW} height={VH} fill="#060300" />

              {/* ── Static coin grid ── */}
              {COIN_GRID.map((d, i) => (
                <g key={i}>
                  {/* Depth shadow under coin (gives 3D stacking feel) */}
                  <ellipse
                    cx={d.cx + 1.5} cy={d.cy + 2}
                    rx={CR} ry={CR * 0.28}
                    fill="#000" opacity="0.55"
                  />
                  {/* Coin face */}
                  <circle cx={d.cx} cy={d.cy} r={CR} fill="url(#gCoin)" />
                  {/* Outer rim ring */}
                  <circle cx={d.cx} cy={d.cy} r={CR} fill="none"
                    stroke="#fde047" strokeWidth="1.4" opacity="0.65" />
                  {/* Inner detail ring */}
                  <circle cx={d.cx} cy={d.cy} r={CR * 0.56} fill="none"
                    stroke="#fef9c3" strokeWidth="0.7" opacity="0.38" />
                  {/* Specular shine (small bright spot top-left) */}
                  <ellipse
                    cx={d.cx - CR * 0.28} cy={d.cy - CR * 0.28}
                    rx={CR * 0.28} ry={CR * 0.18}
                    fill="#fffde7" opacity="0.72"
                    transform={`rotate(-38 ${d.cx - CR * 0.28} ${d.cy - CR * 0.28})`}
                  />
                </g>
              ))}

              {/*
                ── DARK COVER ──
                Sits above the coin pile, slides DOWN as jackpot drops / UP as it grows.
                Height = coverH means it covers IT → (IT + coverH) = surfaceY.
                Everything below surfaceY is visible (coins).
              */}
              <motion.rect
                x={0} y={IT} width={VW}
                fill="#060300"
                initial={{ height: FH }}
                animate={{ height: Math.max(0, coverH) }}
                transition={{ type: 'spring', stiffness: 24, damping: 10 }}
              />

              {/* ── Coin pile surface ── (amber ellipse at surfaceY) */}
              <motion.ellipse
                cx={VW / 2}
                cy={surfaceY}
                rx={74}
                ry={8}
                fill="#fbbf24"
                opacity={0.72}
                initial={{ cx: VW/2, cy: IB, rx: 42, ry: 6 }}
                animate={{ cy: [surfaceY, surfaceY-5, surfaceY], rx: [74, 82, 74], ry: [8, 12, 8] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Bright specular line on surface */}
              <motion.ellipse
                cx={VW / 2}
                cy={surfaceY - 2}
                rx={44}
                ry={3}
                fill="#fef9c3"
                opacity={0.4}
                initial={{ cx: VW/2, cy: IB - 2, rx: 44, ry: 3 }}
                animate={{ cy: [surfaceY-2, surfaceY-6, surfaceY-2], rx: [44, 50, 44] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Surface glow */}
              <motion.ellipse
                cx={VW / 2}
                cy={surfaceY + 2}
                rx={88}
                ry={14}
                fill="#f59e0b"
                opacity={0.28}
                filter="url(#fSurface)"
                initial={{ cx: VW/2, cy: IB + 2, rx: 88, ry: 14 }}
                animate={{ cy: surfaceY + 2 }}
                transition={{ type: 'spring', stiffness: 24, damping: 10 }}
              />

              {/* ── Falling coins (SVG, fully clipped inside cup) ── */}
              <AnimatePresence>
                {dropping.map(dc => (
                  <motion.g key={dc.id}>
                    {/* Motion trail */}
                    <motion.line
                      x1={dc.cx} y1={dc.startY - dc.r}
                      x2={dc.cx} y2={dc.startY - dc.r - 14}
                      stroke="#fde047" strokeWidth={dc.r * 0.55}
                      strokeLinecap="round" strokeOpacity={0.22}
                      initial={{ y1: dc.startY - dc.r, y2: dc.startY - dc.r - 14, opacity: 0.35 }}
                      animate={{ y1: dc.landY - dc.r,  y2: dc.landY - dc.r - 14,  opacity: [0.35,0.2,0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.48, delay: dc.delay, ease: [0.2,0,0.8,1] }}
                    />
                    {/* Coin */}
                    <motion.circle
                      cx={dc.cx} cy={dc.startY} r={dc.r}
                      fill="url(#gCoinNew)"
                      stroke="#fde047" strokeWidth="1.4"
                      initial={{ cy: dc.startY, scaleY: 1, opacity: 1 }}
                      animate={{ cy: dc.landY, scaleY: [1,1.15,0.85,0.7], opacity:[1,1,1,0.7,0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.48, delay: dc.delay, ease: [0.2,0,0.8,1] }}
                    />
                    {/* Shine on falling coin */}
                    <motion.ellipse
                      cx={dc.cx - dc.r * 0.28} cy={dc.startY - dc.r * 0.28}
                      rx={dc.r * 0.3} ry={dc.r * 0.18}
                      fill="#fffde7" opacity={0.7}
                      initial={{ cx: dc.cx - dc.r * 0.28, cy: dc.startY - dc.r * 0.28, rx: dc.r * 0.3, ry: dc.r * 0.18, opacity: 0.7 }}
                      animate={{ cy: dc.landY - dc.r * 0.28, opacity: [0.7,0.7,0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.48, delay: dc.delay, ease: [0.2,0,0.8,1] }}
                    />
                  </motion.g>
                ))}
              </AnimatePresence>

              {/* ── Landing splash ── */}
              <AnimatePresence>
                {dropping.length > 0 && (
                  <motion.g key={`sp-${dropping[0]?.id}`}>
                    {[0,40,80,120,160,200,240,280,320].map((deg) => {
                      const a = (deg * Math.PI) / 180;
                      const d = 16;
                      return (
                        <motion.circle
                          key={deg}
                          cx={VW/2} cy={surfaceY}
                          r={2.2}
                          fill="#fde047"
                          initial={{ cx: VW/2, cy: surfaceY, opacity: 0.9, r: 2.2 }}
                          animate={{
                            cx: VW/2 + Math.cos(a)*d,
                            cy: surfaceY + Math.sin(a)*d*0.45,
                            opacity: 0, r: 0.8,
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.38, delay: 0.44, ease: 'easeOut' }}
                        />
                      );
                    })}
                  </motion.g>
                )}
              </AnimatePresence>

            </g>{/* end cupClip */}

            {/* ════ CUP GLASS WALLS (drawn ABOVE the coin fill) ════
                NO reflections, NO streaks inside the glass.
                Only clean stroke + fill for a pure glass look.
            */}
            <path
              d="
                M 22 44
                L 298 44
                C 314 56, 318 90, 304 126
                C 288 164, 255 208, 218 260
                L 184 260
                L 180 314
                L 246 314
                L 246 338
                L 74 338
                L 74 314
                L 140 314
                L 136 260
                L 102 260
                C 65 208, 32 164, 16 126
                C 2 90, 6 56, 22 44
                Z
              "
              fill="url(#gWall)"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeOpacity="0.92"
              filter="url(#fGlow)"
            />

            {/* ── Rim (top bar of cup) — bright gold, thick ── */}
            <path
              d="M 16 41 Q 160 26 304 41"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="10"
              strokeLinecap="round"
              filter="url(#fRim)"
              strokeOpacity="0.96"
            />
            {/* Rim inner highlight */}
            <path
              d="M 24 41 Q 160 29 296 41"
              fill="none"
              stroke="#fffde7"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeOpacity="0.65"
            />

            {/* ── Stem lines ── */}
            <line x1="136" y1="260" x2="140" y2="314"
              stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.25" />
            <line x1="184" y1="260" x2="180" y2="314"
              stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.25" />

            {/* ── Base ── */}
            <rect x="74" y="314" width="172" height="24" rx="6"
              fill="url(#gBase)" />
            <rect x="74" y="314" width="172" height="24" rx="6"
              fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeOpacity="0.9"
              filter="url(#fGlow)" />
            {/* Base top-shine */}
            <rect x="92" y="318" width="136" height="5" rx="2.5"
              fill="#fffde7" opacity="0.22" />
            {/* Base floor glow */}
            <ellipse cx="160" cy="340" rx="88" ry="7"
              fill="#f59e0b" opacity="0.16" filter="url(#fBase)" />

            {/* ── Floating sparkle dots around cup edges ── */}
            {[
              { cx: 8,   cy: 140, d: 0.0, r: 2.6 },
              { cx: 312, cy: 118, d: 0.8, r: 2.0 },
              { cx: 4,   cy: 220, d: 1.5, r: 1.7 },
              { cx: 316, cy: 200, d: 0.4, r: 2.3 },
              { cx: 10,  cy: 82,  d: 1.1, r: 1.5 },
              { cx: 310, cy: 82,  d: 1.8, r: 1.5 },
            ].map((s, i) => (
              <motion.circle
                key={i} cx={s.cx} cy={s.cy} r={s.r}
                fill="#fde047"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0, 1.4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: s.d, repeatDelay: 2.2 }}
              />
            ))}

          </svg>
        </motion.div>
      </div>

      {/* Participants + tap hint */}
      <div style={{ textAlign: 'center', marginTop: -6 }}>
        <span style={{ fontSize: 11, color: '#78716c' }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>{participants.toLocaleString()}</span>
          {isRtl ? ' مشترك ' : ' participants '}
        </span>
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}
        >
          {isRtl ? '· اضغط لشراء تذكرة ←' : '· tap to buy ticket →'}
        </motion.span>
      </div>
    </div>
  );
}
