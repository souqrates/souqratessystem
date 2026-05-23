import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { getFrameInterval } from '../../../lib/canvasQuality';
import { TimeBar } from './_shell';

const RULES = 'PLASMA SURGE — A pulse sweeps left to right. Tap when it lands inside the GREEN zone for max score. Yellow zone = half. Red = penalty. 90 seconds, infinite waves.';
const DEFAULT_DURATION = 90;
const SWEEP_MS = 1600;

export default function PlasmaSurge({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [pos, setPos] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const lastTsRef = useRef(0);
  const rafRef = useRef();
  const timerRef = useRef();
  const overRef = useRef(false);

  const updateScore = useCallback((d) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; streakRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(DURATION);
    posRef.current = 0; dirRef.current = 1;

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        overRef.current = true;
        onScoreUpdate?.(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(() => setPhase('won'), 350);
      }
    }, 1000);

    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    const loop = (ts) => {
      if (ts - _skzLastT < _skzFI) { rafRef.current = requestAnimationFrame(loop); return; }
      _skzLastT = ts;
      if (overRef.current) return;
      const last = lastTsRef.current || ts;
      const dt = ts - last;
      lastTsRef.current = ts;
      const speed = 100 / SWEEP_MS;
      posRef.current += dt * speed * dirRef.current;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0)   { posRef.current = 0;   dirRef.current = 1;  }
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { clearInterval(timerRef.current); cancelAnimationFrame(rafRef.current); };
  }, [phase, setPhase, onScoreUpdate]);

  const tap = () => {
    if (overRef.current) return;
    const p = posRef.current;
    let label, color, delta;
    if (p >= 45 && p <= 55) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      delta = 120 + Math.min(streakRef.current * 15, 150);
      label = `PERFECT +${delta}`; color = '#10b981';
      tone(700, 0.12, 'triangle', 0.22);
      triggerHaptic('success');
    } else if (p >= 35 && p <= 65) {
      streakRef.current = 0; setStreak(0);
      delta = 50; label = 'GOOD +50'; color = '#f59e0b';
      tone(440, 0.1, 'triangle', 0.18);
      triggerHaptic('light');
    } else {
      streakRef.current = 0; setStreak(0);
      delta = -40; label = 'MISS -40'; color = '#ef4444';
      tone(160, 0.18, 'sawtooth', 0.16, -50);
      triggerHaptic('error');
    }
    updateScore(delta);
    setFeedback({ label, color, key: Date.now() });
    setTimeout(() => setFeedback(null), 500);
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
        <Hud label="Streak" value={`x${streak}`} color="#10b981" />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div style={{ position: 'relative', height: 80, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '35%', right: '35%', top: 0, bottom: 0, background: 'rgba(245,158,11,0.15)' }} />
        <div style={{ position: 'absolute', left: '45%', right: '45%', top: 0, bottom: 0, background: 'rgba(16,185,129,0.32)' }} />
        <motion.div
          animate={{ left: `${pos}%` }}
          transition={{ duration: 0.02, ease: 'linear' }}
          style={{ position: 'absolute', top: 0, bottom: 0, width: 4, marginLeft: -2, background: '#00d4ff', boxShadow: '0 0 14px #00d4ff' }} />
        {feedback && (
          <motion.div key={feedback.key}
            initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}
            style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: feedback.color, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, textShadow: `0 0 12px ${feedback.color}` }}>
            {feedback.label}
          </motion.div>
        )}
      </div>

      <motion.button whileTap={{ scale: 0.95 }} onPointerDown={tap}
        style={{ height: 240, borderRadius: 20, border: '2px solid rgba(0,212,255,0.4)', background: 'radial-gradient(circle at center, rgba(0,212,255,0.15), rgba(0,0,0,0.3))', cursor: 'pointer', color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: '0.18em', boxShadow: '0 0 32px rgba(0,212,255,0.18) inset' }}>
        TAP
      </motion.button>
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
