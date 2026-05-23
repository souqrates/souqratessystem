import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'QUANTUM TRACE — Tap the numbered nodes in ASCENDING order: 1, 2, 3… A wrong number resets the round. Finish a sequence for a big bonus. Sequences grow longer over 90 seconds.';
const DEFAULT_DURATION = 90;

let nodeSeq = 0;

function spawnNodes(count) {
  const nodes = [];
  for (let i = 1; i <= count; i++) {
    let tries = 0, x, y, ok;
    do {
      x = 10 + Math.random() * 80;
      y = 10 + Math.random() * 80;
      ok = !nodes.some(n => Math.hypot(n.x - x, n.y - y) < 16);
      tries++;
    } while (!ok && tries < 30);
    nodes.push({ id: ++nodeSeq, x, y, num: i });
  }
  return nodes;
}

export default function QuantumTrace({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(1);
  const [nodes, setNodes] = useState([]);
  const [next, setNext] = useState(1);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const roundRef = useRef(1);
  const nextRef = useRef(1);
  const timerRef = useRef();
  const overRef = useRef(false);

  const updateScore = useCallback((d) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [onScoreUpdate]);

  const newRound = useCallback((n) => {
    const len = Math.min(4 + n, 12);
    setNodes(spawnNodes(len));
    nextRef.current = 1;
    setNext(1);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; roundRef.current = 1;
    setScore(0); setTimeLeft(DURATION); setRound(1);
    newRound(1);

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        overRef.current = true;
        onScoreUpdate?.(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(() => setPhase('won'), 350);
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase, newRound, setPhase, onScoreUpdate]);

  const tap = (node) => {
    if (overRef.current) return;
    if (node.num < nextRef.current) return; // already completed — ignore tap
    if (node.num === nextRef.current) {
      tone(330 + nextRef.current * 40, 0.08, 'triangle', 0.2);
      triggerHaptic('light');
      setFlash({ id: node.id, ok: true });
      setTimeout(() => setFlash(null), 250);
      updateScore(40);
      nextRef.current += 1;
      setNext(nextRef.current);
      if (nextRef.current > nodes.length) {
        updateScore(200);
        tone(700, 0.18, 'triangle', 0.25);
        triggerHaptic('success');
        roundRef.current += 1;
        setRound(roundRef.current);
        setTimeout(() => !overRef.current && newRound(roundRef.current), 250);
      }
    } else {
      tone(160, 0.2, 'sawtooth', 0.16, -50);
      triggerHaptic('error');
      setFlash({ id: node.id, ok: false });
      setTimeout(() => setFlash(null), 350);
      updateScore(-60);
      nextRef.current = 1;
      setNext(1);
    }
  };

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
        <Hud label={`Round ${round}`} value={`${next}/${nodes.length}`} color="#10b981" />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div style={{ position: 'relative', height: 430, background: 'radial-gradient(circle at center, rgba(16,185,129,0.06), rgba(0,0,0,0.4))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, overflow: 'hidden' }}>
        {nodes.map(n => {
          const done = n.num < next;
          const isNext = n.num === next;
          const f = flash?.id === n.id ? flash : null;
          const color = done ? '#10b981' : isNext ? '#fbbf24' : '#00d4ff';
          return (
            <motion.button key={n.id}
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => tap(n)}
              animate={f ? { scale: f.ok ? [1, 1.3, 1] : [1, 0.85, 1], borderColor: f.ok ? '#10b981' : '#ef4444' } : { scale: isNext ? [1, 1.08, 1] : 1 }}
              transition={f ? { duration: 0.3 } : { duration: 1.2, repeat: isNext ? Infinity : 0 }}
              style={{ position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, width: 48, height: 48, marginLeft: -24, marginTop: -24, borderRadius: '50%', border: `2px solid ${color}`, background: `radial-gradient(circle at 35% 30%, ${color}66, ${color}22, transparent)`, color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, boxShadow: `0 0 16px ${color}88`, cursor: 'pointer', opacity: done ? 0.45 : 1, padding: 0 }}>
              {n.num}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Hud({ label, value, color }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}99`, margin: 0, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color, margin: 0 }}>{value}</p>
    </div>
  );
}
