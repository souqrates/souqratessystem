import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';

const RULES = 'KING OF THE HILL \u2014 The HILL appears at random spots. Keep your finger ON the hill to claim it. Hold time = score. Each second on the hill = +10. 60 seconds.';
const DEFAULT_GAME_TIME = 60;

export default function KingOfTheHill({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [hill, setHill] = useState({ x: 50, y: 50, r: 14 });
  const [holding, setHolding] = useState(false);
  const [score, setScore] = useState(0);
  const [hold, setHold] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);

  const hillRef = useRef({ x: 50, y: 50, r: 14 });
  const holdingRef = useRef(false);
  const holdAccRef = useRef(0);
  const totalHoldRef = useRef(0);
  const scoreRef = useRef(0);
  const lastTimeRef = useRef(0);
  const moveAccRef = useRef(0);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const activeRef = useRef(false);
  const areaRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, on: false });

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const moveHill = () => {
    const r = 12 + Math.random() * 4;
    const x = 18 + Math.random() * 64;
    const y = 18 + Math.random() * 64;
    hillRef.current = { x, y, r };
    setHill({ x, y, r });
    beep({ freq: 360, dur: 0.08, type: 'square', vol: 0.1 });
  };

  const loop = useCallback((ts) => {
    if (!activeRef.current) return;
    const dt = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = ts;

    moveAccRef.current += dt;
    if (moveAccRef.current > 3.5) { moveAccRef.current = 0; moveHill(); }

    if (pointerRef.current.on) {
      const dx = pointerRef.current.x - hillRef.current.x;
      const dy = pointerRef.current.y - hillRef.current.y;
      const inside = Math.hypot(dx, dy) < hillRef.current.r;
      if (inside !== holdingRef.current) {
        holdingRef.current = inside;
        setHolding(inside);
      }
      if (inside) {
        holdAccRef.current += dt;
        totalHoldRef.current += dt;
        if (holdAccRef.current >= 0.1) {
          holdAccRef.current -= 0.1;
          scoreRef.current += 1;
          setScore(scoreRef.current);
          if (onScoreUpdate) onScoreUpdate(scoreRef.current);
        }
        setHold(totalHoldRef.current);
      }
    } else if (holdingRef.current) {
      holdingRef.current = false;
      setHolding(false);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [onScoreUpdate]);

  const pointerMove = (e) => {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    pointerRef.current.x = ((e.clientX - r.left) / r.width) * 100;
    pointerRef.current.y = ((e.clientY - r.top) / r.height) * 100;
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; totalHoldRef.current = 0; holdAccRef.current = 0; moveAccRef.current = 0;
    holdingRef.current = false; pointerRef.current.on = false;
    setScore(0); setHold(0); setHolding(false); setTimeLeft(GAME_TIME);
    moveHill();
    activeRef.current = true; lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); };
  }, [phase, loop, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #2a1a00 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#ffcc00" />
        <Tile label="HOLD" val={`${hold.toFixed(1)}s`} color="#00f5a0" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
      </div>
      <div
        ref={areaRef}
        onPointerDown={(e) => { pointerRef.current.on = true; pointerMove(e); }}
        onPointerMove={(e) => { if (pointerRef.current.on) pointerMove(e); }}
        onPointerUp={() => { pointerRef.current.on = false; holdingRef.current = false; setHolding(false); }}
        onPointerLeave={() => { pointerRef.current.on = false; holdingRef.current = false; setHolding(false); }}
        style={{
          position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255,204,0,0.04), rgba(0,0,0,0.5))',
          border: '1px solid rgba(255,204,0,0.25)', touchAction: 'none', cursor: 'crosshair', minHeight: 380,
        }}>
        <motion.div
          key={`${hill.x}-${hill.y}`}
          animate={{ scale: holding ? 1.1 : 1 }}
          style={{
            position: 'absolute', left: `${hill.x}%`, top: `${hill.y}%`,
            width: `${hill.r * 2}%`, aspectRatio: 1, transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: holding
              ? 'radial-gradient(circle at center, #00f5a0, #006a4a)'
              : 'radial-gradient(circle at center, #ffcc00, #6a5400)',
            border: `3px solid ${holding ? '#00f5a0' : '#ffcc00'}`,
            boxShadow: `0 0 ${holding ? 50 : 30}px ${holding ? '#00f5a0' : '#ffcc00'}, inset 0 0 24px rgba(0,0,0,0.4)`,
          }} />
        <p style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
          fontSize: 10, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em', margin: 0 }}>
          HOLD FINGER ON THE HILL
        </p>
      </div>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
