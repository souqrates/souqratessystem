import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'VORTEX STRIKE — Targets shrink fast. Tap them while still large for big points; small targets give less. Miss completely and pay a penalty. 90 seconds of pure accuracy.';
const DEFAULT_DURATION = 90;
const LIFE = 1300;

let s = 0;

export default function VortexStrike({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [targets, setTargets] = useState([]);
  const [floats, setFloats] = useState([]);

  const scoreRef = useRef(0);
  const targetsRef = useRef([]);
  const timerRef = useRef();
  const spawnRef = useRef();
  const overRef = useRef(false);

  const updateScore = useCallback((d, x, y, label) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
    const id = ++s;
    setFloats(f => [...f, { id, x, y, label, color: d > 0 ? '#10b981' : '#ef4444' }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 600);
  }, [onScoreUpdate]);

  const spawn = useCallback(() => {
    if (overRef.current) return;
    const id = ++s;
    const x = 12 + Math.random() * 76;
    const y = 12 + Math.random() * 76;
    const born = Date.now();
    targetsRef.current = [...targetsRef.current, { id, x, y, born }];
    setTargets([...targetsRef.current]);
    setTimeout(() => {
      if (overRef.current) return;
      const stillThere = targetsRef.current.some(t => t.id === id);
      if (stillThere) {
        targetsRef.current = targetsRef.current.filter(t => t.id !== id);
        setTargets([...targetsRef.current]);
        updateScore(-25, x, y, '-25');
      }
    }, LIFE);
  }, [updateScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; targetsRef.current = [];
    setScore(0); setTimeLeft(DURATION); setTargets([]);

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        clearTimeout(spawnRef.current);
        overRef.current = true;
        onScoreUpdate?.(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(() => setPhase('won'), 350);
      }
    }, 1000);

    const tick = () => {
      if (overRef.current) return;
      spawn();
      const factor = 1 - (DURATION - t) / DURATION * 0.55;
      spawnRef.current = setTimeout(tick, (500 + Math.random() * 700) * factor);
    };
    spawnRef.current = setTimeout(tick, 500);

    return () => { clearInterval(timerRef.current); clearTimeout(spawnRef.current); };
  }, [phase, spawn, setPhase, onScoreUpdate]);

  const tap = (t) => {
    if (overRef.current) return;
    const age = Date.now() - t.born;
    const r = age / LIFE;
    targetsRef.current = targetsRef.current.filter(x => x.id !== t.id);
    setTargets([...targetsRef.current]);
    let pts;
    if (r < 0.3) pts = 150;
    else if (r < 0.6) pts = 90;
    else pts = 40;
    tone(440 + (1 - r) * 400, 0.1, 'triangle', 0.22);
    triggerHaptic('light');
    updateScore(pts, t.x, t.y, `+${pts}`);
  };

  if (phase === 'rules') {
    return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;
  }

  const tc = hudColor(timeLeft, DURATION);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Hud label="Score" value={score} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}</p>
        </div>
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div style={{ position: 'relative', height: 460, background: 'radial-gradient(circle at center, rgba(239,68,68,0.06), rgba(0,0,0,0.4))', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, overflow: 'hidden' }}>
        <AnimatePresence>
          {targets.map(t => (
            <motion.button key={t.id}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0.2, opacity: 0.4 }}
              transition={{ duration: LIFE / 1000, ease: 'linear' }}
              onPointerDown={() => tap(t)}
              style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, width: 80, height: 80, marginLeft: -40, marginTop: -40, borderRadius: '50%', border: '3px solid #ef4444', background: 'radial-gradient(circle, rgba(239,68,68,0.45), rgba(239,68,68,0.1) 60%, transparent)', boxShadow: '0 0 22px rgba(239,68,68,0.55)', cursor: 'pointer', padding: 0 }} />
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {floats.map(f => (
            <motion.span key={f.id}
              initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} transition={{ duration: 0.55 }}
              style={{ position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, color: f.color, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, textShadow: `0 0 10px ${f.color}` }}>
              {f.label}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Hud({ label, value, color }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}99`, margin: 0, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color, margin: 0 }}>{value}</p>
    </div>
  );
}
