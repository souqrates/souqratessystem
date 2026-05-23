import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';

const RULES = 'ECHO PAINTER — A masterpiece hides in the dark. You have 10 touches. Each touch reveals a patch. After your touches, finish to reveal — high similarity = high score. Aim above 75%.';
const GOLD = '#ffd86b';

const SHAPES = [
  // each shape = list of {x%, y%, w%, h%} rectangles forming a pixel-art image
  { name: 'GOLDEN MASK', rects: [
    { x: 30, y: 18, w: 40, h: 12, c: '#ffd86b' },
    { x: 26, y: 30, w: 48, h: 30, c: '#ffce4a' },
    { x: 38, y: 38, w: 6,  h: 6,  c: '#000' },
    { x: 56, y: 38, w: 6,  h: 6,  c: '#000' },
    { x: 45, y: 52, w: 10, h: 4,  c: '#a06b00' },
    { x: 30, y: 60, w: 40, h: 18, c: '#b88820' },
    { x: 30, y: 78, w: 40, h: 4,  c: '#5a3a08' },
  ]},
  { name: 'SCARAB', rects: [
    { x: 40, y: 20, w: 20, h: 12, c: '#1a4a6e' },
    { x: 30, y: 32, w: 40, h: 30, c: '#0e6aa4' },
    { x: 38, y: 38, w: 4, h: 4, c: '#ffd86b' },
    { x: 58, y: 38, w: 4, h: 4, c: '#ffd86b' },
    { x: 30, y: 62, w: 40, h: 16, c: '#0a4a78' },
    { x: 20, y: 38, w: 8, h: 20, c: '#0e6aa4' },
    { x: 72, y: 38, w: 8, h: 20, c: '#0e6aa4' },
  ]},
  { name: 'ANKH', rects: [
    { x: 45, y: 14, w: 10, h: 20, c: '#ffd86b' },
    { x: 40, y: 16, w: 4, h: 14, c: '#ffd86b' },
    { x: 56, y: 16, w: 4, h: 14, c: '#ffd86b' },
    { x: 30, y: 40, w: 40, h: 6, c: '#ffd86b' },
    { x: 47, y: 46, w: 6, h: 40, c: '#ffd86b' },
  ]},
];

export default function EchoPainter({ phase, setPhase, game, onScoreUpdate }) {
  const [touches, setTouches] = useState([]);
  const [used, setUsed] = useState(0);
  const [shape, setShape] = useState(SHAPES[0]);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [maxTouches, setMaxTouches] = useState(10);
  const cfgRef = useRef({ target: 75 });

  const reset = useCallback(() => {
    const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    setShape(s);
    setTouches([]); setUsed(0); setRevealed(false); setScore(0);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(120).then(cfg => {
      if (!mounted) return;
      cfgRef.current.target = cfg.target_score ?? 75;
      setMaxTouches(cfg.params?.touches ?? 10);
    });
    reset();
    return () => { mounted = false; };
  }, [phase, reset]);

  const computeScore = useCallback((tList) => {
    // How much of the artwork was covered by reveal radii?
    let totalArea = 0, hitArea = 0;
    const W = 100, H = 100;
    for (let x = 0; x < W; x += 2) {
      for (let y = 0; y < H; y += 2) {
        const inArt = shape.rects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (!inArt) continue;
        totalArea += 1;
        const hit = tList.some(t => {
          const dx = t.x - x, dy = t.y - y;
          return dx * dx + dy * dy < t.r * t.r;
        });
        if (hit) hitArea += 1;
      }
    }
    return totalArea > 0 ? Math.round((hitArea / totalArea) * 100) : 0;
  }, [shape]);

  const onCanvasClick = useCallback((e) => {
    if (used >= maxTouches || revealed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTouches(t => [...t, { x, y, r: 14 }]);
    setUsed(u => u + 1);
    beep({ freq: 440 + Math.random() * 200, dur: 0.15, type: 'sine' });
    triggerHaptic('light');
  }, [used, maxTouches, revealed]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    const sc = computeScore(touches);
    setScore(sc);
    if (onScoreUpdate) onScoreUpdate(sc);
    const won = sc >= cfgRef.current.target;
    setEarnings(won ? Number(game?.prize || 0) : 0);
    beep({ freq: won ? 880 : 220, dur: 0.4, type: won ? 'sine' : 'sawtooth', sweepTo: won ? 1200 : 100 });
    triggerHaptic(won ? 'medium' : 'error');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 1400);
  }, [computeScore, touches, setPhase, game, onScoreUpdate]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, #1a1408 0%, #050300 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="TOUCHES" val={`${used} / ${maxTouches}`} color={GOLD} />
        <Tile label="SIMILARITY" val={`${score}%`} color={score >= cfgRef.current.target ? '#10b981' : '#fff'} />
      </div>

      <div onClick={onCanvasClick}
        style={{
          position: 'relative', height: 340, borderRadius: 14, overflow: 'hidden',
          background: '#050300',
          border: `1px solid ${GOLD}33`, cursor: revealed ? 'default' : 'crosshair',
          boxShadow: `inset 0 0 80px ${GOLD}15`,
        }}>
        {/* Gold leaf particles bg */}
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${(i * 53) % 100}%`, top: `${(i * 31) % 100}%`,
            width: 2, height: 2, background: GOLD, opacity: 0.12,
            boxShadow: `0 0 4px ${GOLD}`,
          }} />
        ))}

        {/* Hidden artwork (rendered only inside touch radii or full when revealed) */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <mask id="reveal-mask">
              <rect width="100" height="100" fill={revealed ? 'white' : 'black'} />
              {!revealed && touches.map((t, i) => (
                <circle key={i} cx={t.x} cy={t.y} r={t.r} fill="white" />
              ))}
            </mask>
          </defs>
          <g mask="url(#reveal-mask)">
            {shape.rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} />
            ))}
          </g>
        </svg>

        {/* Touch ripples */}
        {touches.map((t, i) => (
          <motion.div key={i}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 1, opacity: revealed ? 0 : 0.5 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              left: `${t.x}%`, top: `${t.y}%`, width: `${t.r * 2}%`, height: `${t.r * 2}%`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `1px solid ${GOLD}55`,
              boxShadow: `0 0 16px ${GOLD}33`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {revealed && (
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999,
              background: `${GOLD}22`, border: `1px solid ${GOLD}`, color: GOLD,
              fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 900, letterSpacing: '0.18em' }}>
              {shape.name}
            </span>
          </div>
        )}
      </div>

      <motion.button whileTap={{ scale: 0.96 }} onPointerDown={handleReveal} disabled={revealed || used === 0}
        style={{
          marginTop: 12, width: '100%', padding: '16px 0', borderRadius: 14,
          background: revealed ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, #b8800b, ${GOLD})`,
          border: `1px solid ${GOLD}66`, color: '#0a0500',
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.16em',
          cursor: revealed ? 'not-allowed' : 'pointer', opacity: revealed || used === 0 ? 0.5 : 1,
        }}>
        REVEAL THE MASTERPIECE
      </motion.button>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
      borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
