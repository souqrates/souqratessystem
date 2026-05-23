import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';
import { getFrameInterval } from '../../../lib/canvasQuality';

const GAME_TIME = 90;
const RULES = 'BUBBLE BURST ARENA — Iridescent bubbles drift up from below. Tap to pop. Blue = +10, Green = +20, Gold = +50 + slowmo, RED TRAP = -30. Density and speed escalate. Chain pops for combos. 90 seconds of pop-storm chaos.';

const TYPES = [
  { kind: 'blue', pts: 10, hue: '#22d3ee', size: 50, weight: 50 },
  { kind: 'green', pts: 20, hue: '#34d399', size: 42, weight: 28 },
  { kind: 'gold', pts: 50, hue: '#fbbf24', size: 38, weight: 8 },
  { kind: 'trap', pts: -30, hue: '#ef4444', size: 46, weight: 14 },
];

function pickKind() {
  const total = TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TYPES[0];
}

export default function BubbleBurstArena({ phase, setPhase, onScoreUpdate, game }) {
  const DURATION = game?.durationSeconds || GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [combo, setCombo] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [pops, setPops] = useState([]);
  const [slowmo, setSlowmo] = useState(0);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bubIdRef = useRef(0);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const lastTickRef = useRef(0);
  const slowMoUntilRef = useRef(0);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const handlePop = useCallback((b, e) => {
    e.stopPropagation();
    if (!gameActiveRef.current) return;
    const type = TYPES.find((t) => t.kind === b.kind);
    let pts = type.pts;
    if (pts > 0) {
      comboRef.current += 1;
      setCombo(comboRef.current);
      const bonus = comboRef.current >= 5 ? Math.floor(pts * 0.5) : 0;
      pts += bonus;
      tone(440 + pts * 4, 0.1, 'triangle', 0.25, 200);
      triggerHaptic('light');
      if (b.kind === 'gold') {
        slowMoUntilRef.current = Date.now() + 2500;
        setSlowmo(2.5);
        chord([523, 784, 1047, 1318], 0.04, 0.15, 'sine', 0.22);
        triggerHaptic('success');
      }
      if (comboRef.current % 5 === 0) chord([523, 659, 784, 1047], 0.04, 0.15, 'sine', 0.18);
    } else {
      comboRef.current = 0;
      setCombo(0);
      noiseHit(0.18, 0.2);
      triggerHaptic('error');
    }
    addScore(pts);
    setPops((prev) => [...prev.slice(-10), { id: Math.random(), x: b.x, y: b.y, pts, col: b.kind === 'trap' ? '#ef4444' : type.hue }]);
    setTimeout(() => setPops((prev) => prev.slice(1)), 600);
    setBubbles((prev) => prev.filter((x) => x.id !== b.id));
  }, [addScore]);

  const _skzLastTRef = useRef(0);
  const _skzFI = getFrameInterval();
  const animate = useCallback((ts) => {
    if (ts - _skzLastTRef.current < _skzFI) { rafRef.current = requestAnimationFrame(animate); return; }
    _skzLastTRef.current = ts;
    if (!gameActiveRef.current) return;
    if (!lastTickRef.current) lastTickRef.current = ts;
    const sm = slowMoUntilRef.current > Date.now() ? 0.4 : 1;
    const dt = Math.min(50, ts - lastTickRef.current) * sm;
    lastTickRef.current = ts;

    const tier = Math.min(4, Math.floor(scoreRef.current / 300));
    const baseSpeed = (0.04 + tier * 0.008) * dt;

    setBubbles((prev) => {
      const updated = [];
      for (const b of prev) {
        const ny = b.y - baseSpeed * b.speedMul;
        const nx = b.x + Math.sin((Date.now() - b.born) * 0.0015 + b.phase) * 0.1;
        if (ny < -10) continue;
        updated.push({ ...b, y: ny, x: nx });
      }
      return updated;
    });

    if (slowMoUntilRef.current > 0) {
      const rem = (slowMoUntilRef.current - Date.now()) / 1000;
      if (rem <= 0) { slowMoUntilRef.current = 0; setSlowmo(0); }
      else setSlowmo(rem);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const spawn = useCallback(() => {
    if (!gameActiveRef.current) return;
    const type = pickKind();
    const tier = Math.min(4, Math.floor(scoreRef.current / 300));
    const burst = 1 + Math.floor(tier / 2);
    for (let i = 0; i < burst; i++) {
      setBubbles((prev) => [...prev, {
        id: bubIdRef.current++,
        kind: type.kind,
        x: 8 + Math.random() * 84,
        y: 105 + Math.random() * 15,
        size: type.size,
        hue: type.hue,
        speedMul: 0.8 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        born: Date.now(),
      }]);
    }
    const delay = Math.max(450, 1100 - tier * 130);
    spawnRef.current = setTimeout(spawn, delay);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(DURATION); setBubbles([]); setPops([]); setSlowmo(0);
    lastTickRef.current = 0;

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        clearTimeout(spawnRef.current);
        cancelAnimationFrame(rafRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);
    setTimeout(spawn, 400);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, spawn, animate, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>🫧</div>
      <h2 style={{ color: '#22d3ee', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #22d3ee' }}>BUBBLE BURST ARENA</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, DURATION);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(180deg, #042f4a 0%, #0c4a6e 30%, #082f49 70%, #020617 100%)',
      fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
    }}>
      {/* Caustics overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.2,
        backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(34,211,238,0.4), transparent 50%), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.2), transparent 40%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        {slowmo > 0
          ? <Hud label="SLOW" value={slowmo.toFixed(1)} color="#fbbf24" />
          : <Hud label="COMBO" value={`×${combo}`} color="#fbbf24" />}
      </div>

      {bubbles.map((b) => (
        <motion.button
          key={b.id}
          onPointerDown={(e) => handlePop(b, e)}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
            transform: 'translate(-50%,-50%)',
            width: b.size, height: b.size, borderRadius: '50%',
            border: `2px solid rgba(255,255,255,0.4)`,
            background: b.kind === 'trap'
              ? `radial-gradient(circle at 35% 30%, #fca5a5, ${b.hue} 50%, #7f1d1d)`
              : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7), ${b.hue}77 40%, ${b.hue}cc)`,
            boxShadow: `0 0 18px ${b.hue}88, inset -4px -6px 10px rgba(0,0,0,0.3)`,
            cursor: 'pointer', zIndex: 5, padding: 0,
            outline: 'none',
          }}>
          {b.kind === 'gold' && (
            <span style={{ fontSize: 18, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#fff', textShadow: '0 0 8px #f59e0b' }}>★</span>
          )}
          {b.kind === 'trap' && (
            <span style={{ fontSize: 16, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#fff', textShadow: '0 0 6px #000' }}>✕</span>
          )}
          <div style={{
            position: 'absolute', top: '14%', left: '20%', width: '34%', height: '22%',
            borderRadius: '50%', background: 'rgba(255,255,255,0.6)', filter: 'blur(2px)',
            pointerEvents: 'none',
          }} />
        </motion.button>
      ))}

      <AnimatePresence>
        {pops.map((p) => (
          <motion.div key={p.id}
            initial={{ opacity: 1, scale: 0.7, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, y: -50 }}
            transition={{ duration: 0.55 }}
            style={{
              position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
              transform: 'translate(-50%,-50%)',
              color: p.col, fontWeight: 900, fontSize: 20,
              textShadow: `0 0 12px ${p.col}`, pointerEvents: 'none', zIndex: 20,
            }}>
            {p.pts > 0 ? `+${p.pts}` : p.pts}
          </motion.div>
        ))}
      </AnimatePresence>

      <TimerBar pct={timeLeft / DURATION} color={tc} />
    </div>
  );
}

function Hud({ label, value, color, pulse }) {
  return (
    <motion.div animate={pulse ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 0.6, repeat: Infinity }}
      style={{
        background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(8px)',
        border: `1px solid ${color}44`, borderRadius: 12, padding: '6px 14px',
        textAlign: 'center', minWidth: 78,
      }}>
      <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.16em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color, textShadow: `0 0 10px ${color}` }}>{value}</div>
    </motion.div>
  );
}

function TimerBar({ pct, color }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.06)', zIndex: 10 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear' }} />
    </div>
  );
}
