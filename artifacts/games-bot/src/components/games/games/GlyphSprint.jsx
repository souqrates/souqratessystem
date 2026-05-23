import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';

const RULES = 'GLYPH SPRINT — A glyph appears at the top. Tap the matching glyph from 4 options before it expires. Speed up your taps to maximize streak bonus. 90 seconds of rapid recognition.';
const DEFAULT_DURATION = 90;
const PER_ROUND = 2200;
const GLYPHS = ['◆','◇','★','✦','▲','■','●','✶','✷','♥','♣','♦','◉','◈','✪'];

function makeRound() {
  const all = [...GLYPHS].sort(() => Math.random() - 0.5);
  const target = all[0];
  const options = all.slice(0, 4).sort(() => Math.random() - 0.5);
  if (!options.includes(target)) options[0] = target;
  return { target, options };
}

export default function GlyphSprint({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(() => makeRound());
  const [streak, setStreak] = useState(0);
  const [progress, setProgress] = useState(1);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const timerRef = useRef();
  const roundTimerRef = useRef();
  const progressRef = useRef();
  const startRef = useRef(0);
  const overRef = useRef(false);

  const updateScore = useCallback((d) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [onScoreUpdate]);

  const nextRound = useCallback(() => {
    if (overRef.current) return;
    setRound(makeRound());
    setFlash(null);
    setProgress(1);
    startRef.current = Date.now();
    clearTimeout(roundTimerRef.current);
    clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.max(0, 1 - elapsed / PER_ROUND);
      setProgress(p);
    }, 50);
    roundTimerRef.current = setTimeout(() => {
      if (overRef.current) return;
      streakRef.current = 0; setStreak(0);
      updateScore(-30);
      triggerHaptic('error');
      tone(160, 0.2, 'sawtooth', 0.16, -50);
      nextRound();
    }, PER_ROUND);
  }, [updateScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; streakRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(DURATION);
    nextRound();

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        clearTimeout(roundTimerRef.current);
        clearInterval(progressRef.current);
        overRef.current = true;
        onScoreUpdate?.(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(() => setPhase('won'), 350);
      }
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(roundTimerRef.current);
      clearInterval(progressRef.current);
    };
  }, [phase, nextRound, setPhase, onScoreUpdate]);

  const tap = (g) => {
    if (overRef.current || flash) return;
    if (g === round.target) {
      streakRef.current += 1; setStreak(streakRef.current);
      const bonus = Math.min(streakRef.current * 12, 150);
      updateScore(60 + bonus);
      tone(523, 0.1, 'triangle', 0.22);
      triggerHaptic('light');
      setFlash({ g, ok: true });
    } else {
      streakRef.current = 0; setStreak(0);
      updateScore(-30);
      tone(160, 0.18, 'sawtooth', 0.16, -40);
      triggerHaptic('error');
      setFlash({ g, ok: false });
    }
    clearTimeout(roundTimerRef.current);
    clearInterval(progressRef.current);
    setTimeout(() => !overRef.current && nextRound(), 280);
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

      <motion.div key={round.target}
        initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: 18, padding: '34px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Match</p>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 64, color: '#fff', textShadow: '0 0 24px rgba(0,212,255,0.7)', margin: '4px 0 0', lineHeight: 1 }}>
          {round.target}
        </p>
      </motion.div>

      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.05, ease: 'linear' }}
          style={{ height: '100%', background: progress > 0.4 ? '#10b981' : progress > 0.2 ? '#f59e0b' : '#ef4444' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <AnimatePresence>
          {round.options.map((g, i) => {
            const isFlash = flash?.g === g;
            const color = isFlash ? (flash.ok ? '#10b981' : '#ef4444') : '#00d4ff';
            return (
              <motion.button key={`${round.target}-${g}-${i}`}
                whileTap={{ scale: 0.92 }} onPointerDown={() => tap(g)}
                style={{ height: 78, borderRadius: 14, border: `2px solid ${color}55`, background: `${color}15`, color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 32, cursor: 'pointer', boxShadow: isFlash ? `0 0 26px ${color}88` : 'none' }}>
                {g}
              </motion.button>
            );
          })}
        </AnimatePresence>
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
