import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, noiseHit, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'NOVA TAP — Tap exploding nova bursts the instant they peak. Perfect hits chain combos. Miss the peak window and you score zero for that nova. 90 seconds — climb the live tournament leaderboard.';
const DEFAULT_DURATION = 90;
const SPAWN_MIN = 600;
const SPAWN_MAX = 1100;
const LIFE = 1400;

let seq = 0;

export default function NovaTap({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [novas, setNovas] = useState([]);
  const [combo, setCombo] = useState(0);
  const [floats, setFloats] = useState([]);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const novasRef = useRef([]);
  const timerRef = useRef();
  const spawnRef = useRef();
  const overRef = useRef(false);

  const push = useCallback((delta, x, y, label) => {
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
    const id = ++seq;
    setFloats(f => [...f, { id, x, y, label, color: delta > 0 ? '#10b981' : '#ef4444' }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 700);
  }, [onScoreUpdate]);

  const spawnNova = useCallback(() => {
    if (overRef.current) return;
    const id = ++seq;
    const x = 8 + Math.random() * 84;
    const y = 10 + Math.random() * 80;
    const born = Date.now();
    const nova = { id, x, y, born };
    novasRef.current = [...novasRef.current, nova];
    setNovas([...novasRef.current]);
    setTimeout(() => {
      novasRef.current = novasRef.current.filter(n => n.id !== id);
      setNovas([...novasRef.current]);
    }, LIFE);
  }, []);

  const handleTap = useCallback((nova) => {
    if (overRef.current) return;
    const age = Date.now() - nova.born;
    novasRef.current = novasRef.current.filter(n => n.id !== nova.id);
    setNovas([...novasRef.current]);
    const peakStart = LIFE * 0.55;
    const peakEnd = LIFE * 0.85;
    if (age >= peakStart && age <= peakEnd) {
      comboRef.current += 1;
      setCombo(comboRef.current);
      const base = 100;
      const bonus = Math.min(comboRef.current * 20, 200);
      tone(440 + comboRef.current * 30, 0.1, 'triangle', 0.22);
      triggerHaptic('light');
      push(base + bonus, nova.x, nova.y, `+${base + bonus}`);
    } else {
      comboRef.current = 0;
      setCombo(0);
      tone(160, 0.18, 'sawtooth', 0.18, -40);
      triggerHaptic('error');
      push(-30, nova.x, nova.y, '-30');
    }
  }, [push]);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; comboRef.current = 0;
    novasRef.current = [];
    setScore(0); setCombo(0); setNovas([]); setTimeLeft(DURATION);

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
      spawnNova();
      const factor = 1 - (DURATION - t) / DURATION * 0.5;
      const delay = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN) * factor;
      spawnRef.current = setTimeout(tick, delay);
    };
    spawnRef.current = setTimeout(tick, 600);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
    };
  }, [phase, spawnNova, setPhase, onScoreUpdate]);

  if (phase === 'rules') {
    return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;
  }

  const tc = hudColor(timeLeft, DURATION);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Hud label="Score" value={score} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}</p>
        </div>
        <Hud label="Combo" value={`x${combo}`} color="#f59e0b" />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div style={{ position: 'relative', height: 430, background: 'radial-gradient(circle at center, rgba(0,212,255,0.06), rgba(0,0,0,0.4))', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 20, overflow: 'hidden' }}>
        <AnimatePresence>
          {novas.map(n => (
            <motion.button key={n.id}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1, 1.4, 0.6], opacity: [0, 1, 1, 0] }}
              transition={{ duration: LIFE / 1000, ease: 'easeInOut', times: [0, 0.45, 0.7, 1] }}
              onPointerDown={() => handleTap(n)}
              style={{ position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, width: 64, height: 64, marginLeft: -32, marginTop: -32, borderRadius: '50%', border: '2px solid #00d4ff', background: 'radial-gradient(circle, #00d4ff, #0891b2, transparent 70%)', boxShadow: '0 0 28px rgba(0,212,255,0.6)', cursor: 'pointer', padding: 0 }} />
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {floats.map(f => (
            <motion.span key={f.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6 }}
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
      <motion.p key={String(value)} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
        style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color, margin: 0 }}>
        {value}
      </motion.p>
    </div>
  );
}
