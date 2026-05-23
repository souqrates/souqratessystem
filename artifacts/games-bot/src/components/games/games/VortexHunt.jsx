import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';

const RULES = 'VORTEX HUNT \u2014 Orbs spiral toward the center vortex. Tap them BEFORE they\u2019re swallowed. Closer to vortex = more points but harder. 90 seconds.';
const DEFAULT_GAME_TIME = 90;
const CENTER = { x: 50, y: 50 };

export default function VortexHunt({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [orbs, setOrbs] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);

  const orbsRef = useRef([]);
  const idRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const missedRef = useRef(0);
  const spawnAccRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const loop = useCallback((ts) => {
    if (!activeRef.current) return;
    const dt = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = ts;

    spawnAccRef.current += dt;
    if (spawnAccRef.current > 0.5) {
      spawnAccRef.current = 0;
      const ang = Math.random() * Math.PI * 2;
      orbsRef.current.push({
        id: idRef.current++,
        r: 42, ang,
        speed: 6 + Math.random() * 3,
        spin: 0.9 + Math.random() * 0.6,
        hit: false,
      });
    }

    orbsRef.current.forEach(o => {
      o.r -= o.speed * dt;
      o.ang += o.spin * dt;
    });
    // capture by vortex
    let lostThisFrame = 0;
    orbsRef.current = orbsRef.current.filter(o => {
      if (o.r <= 4 && !o.hit) {
        lostThisFrame += 1;
        return false;
      }
      return !o.hit;
    });
    if (lostThisFrame > 0) {
      missedRef.current += lostThisFrame;
      setMissed(missedRef.current);
      comboRef.current = 0; setCombo(0);
      triggerHaptic('warning');
    }
    setOrbs([...orbsRef.current]);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const onTap = (e, o) => {
    e.stopPropagation();
    if (o.hit) return;
    o.hit = true;
    const closeness = Math.max(0, Math.min(40, 42 - o.r));
    const pts = Math.floor(10 + closeness * 2.2);
    const next = comboRef.current + 1; comboRef.current = next; setCombo(next);
    const total = pts + next;
    scoreRef.current += total;
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    beep({ freq: 500 + closeness * 12, dur: 0.07, type: 'triangle' });
    triggerHaptic('light');
    setFlash({ pts: total, id: Math.random() });
    setTimeout(() => setFlash(null), 240);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    orbsRef.current = []; idRef.current = 0;
    scoreRef.current = 0; comboRef.current = 0; missedRef.current = 0; spawnAccRef.current = 0;
    setOrbs([]); setScore(0); setCombo(0); setMissed(0); setTimeLeft(GAME_TIME);
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
      background: 'radial-gradient(circle at center, #062028 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5ff" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />
        <Tile label="LOST" val={missed} color="#ff4d6d" />
      </div>
      <div style={{
        position: 'relative', flex: 1, borderRadius: '50%',
        background: 'radial-gradient(circle at center, rgba(0,245,255,0.06), rgba(0,0,0,0.7))',
        border: '1px solid rgba(0,245,255,0.2)', overflow: 'hidden',
        minHeight: 360, aspectRatio: 1, alignSelf: 'center', width: '100%', maxHeight: 420,
      }}>
        {/* swirling rings */}
        {[1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8 + i * 4, ease: 'linear' }}
            style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              width: `${i * 22}%`, height: `${i * 22}%`, borderRadius: '50%',
              border: '1px dashed rgba(0,245,255,0.15)',
            }} />
        ))}
        {/* vortex core */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
          style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 60, height: 60, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #00f5ff, #003a5a, #00f5ff, #003a5a, #00f5ff)',
            boxShadow: '0 0 40px #00f5ff, inset 0 0 20px rgba(0,0,0,0.6)',
          }} />
        {orbs.map(o => {
          const x = CENTER.x + Math.cos(o.ang) * o.r;
          const y = CENTER.y + Math.sin(o.ang) * o.r;
          const sz = 20 + (42 - o.r) * 0.4;
          return (
            <div key={o.id} onPointerDown={(e) => onTap(e, o)} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)',
              width: sz, height: sz, borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, #ffcc00, #aa7a00)`,
              border: '2px solid #ffcc00', boxShadow: '0 0 14px #ffcc00',
              cursor: 'pointer', touchAction: 'none',
            }} />
          );
        })}
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -20, scale: 1.3 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22,
                color: '#ffcc00', textShadow: '0 0 18px #ffcc00', pointerEvents: 'none',
              }}>+{flash.pts}</motion.div>
          )}
        </AnimatePresence>
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
      <p style={{ fontSize: 7, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.14em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
