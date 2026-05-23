import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'LOGIC STORM — Solve rapid math problems. Pick the correct answer from 4 options. Streaks multiply your score. Wrong picks deduct points. 90 seconds — outsmart the field.';
const DEFAULT_DURATION = 90;

function genProblem(level) {
  const ops = level < 4 ? ['+', '-'] : level < 8 ? ['+', '-', '*'] : ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const max = op === '*' ? 9 + level : 20 + level * 3;
  let a = Math.floor(Math.random() * max) + 1;
  let b = Math.floor(Math.random() * max) + 1;
  if (op === '-') { if (b > a) [a, b] = [b, a]; }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const choices = new Set([answer]);
  while (choices.size < 4) {
    const drift = Math.floor(Math.random() * 8) - 4 + (Math.random() < 0.5 ? 1 : -1);
    const c = answer + (drift === 0 ? 1 : drift);
    if (c !== answer && c >= 0) choices.add(c);
  }
  return { a, b, op, answer, choices: [...choices].sort(() => Math.random() - 0.5) };
}

export default function LogicStorm({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [problem, setProblem] = useState(() => genProblem(1));
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const solvedRef = useRef(0);
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
    scoreRef.current = 0; streakRef.current = 0; solvedRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(DURATION);
    setProblem(genProblem(1));

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
  }, [phase, setPhase, onScoreUpdate]);

  const pick = (val) => {
    if (overRef.current || flash) return;
    if (val === problem.answer) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      solvedRef.current += 1;
      const bonus = Math.min(streakRef.current * 15, 200);
      updateScore(80 + bonus);
      tone(523, 0.1, 'triangle', 0.22);
      triggerHaptic('light');
      setFlash({ val, ok: true });
    } else {
      streakRef.current = 0; setStreak(0);
      updateScore(-40);
      tone(160, 0.18, 'sawtooth', 0.16, -50);
      triggerHaptic('error');
      setFlash({ val, ok: false });
    }
    setTimeout(() => {
      if (overRef.current) return;
      setFlash(null);
      const level = Math.floor(solvedRef.current / 3) + 1;
      setProblem(genProblem(level));
    }, 350);
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
        <Hud label="Streak" value={`x${streak}`} color="#f59e0b" />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <motion.div key={`${problem.a}${problem.op}${problem.b}`}
        initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 16, padding: '28px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 38, color: '#fff', margin: 0, letterSpacing: '0.06em' }}>
          {problem.a} {problem.op === '*' ? 'x' : problem.op} {problem.b}
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {problem.choices.map((c) => {
          const isFlash = flash?.val === c;
          const color = isFlash ? (flash.ok ? '#10b981' : '#ef4444') : '#00d4ff';
          return (
            <motion.button key={c}
              whileTap={{ scale: 0.95 }}
              onPointerDown={() => pick(c)}
              animate={isFlash ? { scale: [1, 1.05, 1], borderColor: color } : {}}
              transition={{ duration: 0.25 }}
              style={{ height: 64, borderRadius: 14, border: `2px solid ${color}55`, background: `${color}10`, color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, cursor: 'pointer', boxShadow: isFlash ? `0 0 22px ${color}88` : 'none' }}>
              {c}
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
