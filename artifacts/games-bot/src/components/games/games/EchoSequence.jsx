import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'ECHO SEQUENCE — Watch the lighting pattern, repeat it in the same order. Each round adds one more pad. Perfect repeats build streaks. Miss = reset to round 1. 90 seconds.';
const DEFAULT_DURATION = 90;
const PADS = [
  { id: 0, color: '#06b6d4', freq: 261 },
  { id: 1, color: '#10b981', freq: 329 },
  { id: 2, color: '#f59e0b', freq: 392 },
  { id: 3, color: '#f43f5e', freq: 523 },
  { id: 4, color: '#3b82f6', freq: 587 },
  { id: 5, color: '#ec4899', freq: 659 },
];

export default function EchoSequence({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(1);
  const [seq, setSeq] = useState([]);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [lit, setLit] = useState(null);
  const [state, setState] = useState('idle');

  const scoreRef = useRef(0);
  const seqRef = useRef([]);
  const idxRef = useRef(0);
  const roundRef = useRef(1);
  const stateRef = useRef('idle');
  const timerRef = useRef();
  const showTimerRef = useRef([]);
  const overRef = useRef(false);

  const updateScore = useCallback((d) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [onScoreUpdate]);

  const showSeq = useCallback((s) => {
    stateRef.current = 'showing';
    setState('showing');
    setLit(null);
    showTimerRef.current.forEach(id => clearTimeout(id));
    showTimerRef.current = [];
    s.forEach((p, i) => {
      const t1 = setTimeout(() => {
        if (overRef.current) return;
        setLit(p);
        tone(PADS[p].freq, 0.2, 'sine', 0.22);
      }, i * 520);
      const t2 = setTimeout(() => setLit(null), i * 520 + 320);
      showTimerRef.current.push(t1, t2);
    });
    const tEnd = setTimeout(() => {
      if (overRef.current) return;
      stateRef.current = 'input';
      setState('input');
    }, s.length * 520 + 200);
    showTimerRef.current.push(tEnd);
  }, []);

  const startRound = useCallback((n) => {
    if (overRef.current) return;
    // Extend previous sequence by one — true Simon Says mechanic
    const prev = n <= 1 ? [] : seqRef.current.slice(0, 1 + n);
    const s = prev.length > 0
      ? [...prev, Math.floor(Math.random() * PADS.length)]
      : Array.from({ length: 2 }, () => Math.floor(Math.random() * PADS.length));
    seqRef.current = s;
    setSeq(s);
    idxRef.current = 0;
    setPlayerIdx(0);
    roundRef.current = n;
    setRound(n);
    setTimeout(() => showSeq(s), 400);
  }, [showSeq]);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; idxRef.current = 0; roundRef.current = 1;
    setScore(0); setTimeLeft(DURATION); setRound(1);
    startRound(1);

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

    return () => {
      clearInterval(timerRef.current);
      showTimerRef.current.forEach(id => clearTimeout(id));
    };
  }, [phase, startRound, setPhase, onScoreUpdate]);

  const tap = (id) => {
    if (overRef.current || stateRef.current !== 'input') return;
    setLit(id);
    tone(PADS[id].freq, 0.15, 'sine', 0.22);
    setTimeout(() => setLit(null), 180);
    if (seqRef.current[idxRef.current] === id) {
      idxRef.current += 1;
      setPlayerIdx(idxRef.current);
      triggerHaptic('light');
      if (idxRef.current === seqRef.current.length) {
        updateScore(60 + roundRef.current * 20);
        triggerHaptic('success');
        stateRef.current = 'wait';
        setTimeout(() => startRound(roundRef.current + 1), 500);
      }
    } else {
      updateScore(-50);
      tone(120, 0.25, 'sawtooth', 0.18, -40);
      triggerHaptic('error');
      stateRef.current = 'wait';
      setTimeout(() => startRound(1), 700);
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
        <Hud label={`Round ${round}`} value={`${playerIdx}/${seq.length}`} color="#10b981" />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div style={{ textAlign: 'center', minHeight: 22 }}>
        <p style={{ margin: 0, fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: state === 'showing' ? '#00d4ff' : state === 'input' ? '#f59e0b' : 'rgba(148,163,184,0.5)', letterSpacing: '0.18em' }}>
          {state === 'showing' ? 'WATCH...' : state === 'input' ? 'YOUR TURN' : '—'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {PADS.map(p => {
          const isLit = lit === p.id;
          return (
            <motion.button key={p.id}
              whileTap={state === 'input' ? { scale: 0.94 } : {}}
              onPointerDown={() => tap(p.id)}
              animate={isLit ? { scale: 1.06, boxShadow: `0 0 36px ${p.color}, inset 0 0 28px ${p.color}88` } : { scale: 1, boxShadow: `0 0 12px ${p.color}33` }}
              transition={{ duration: 0.15 }}
              style={{ height: 110, borderRadius: 16, border: `2px solid ${p.color}55`, background: isLit ? `radial-gradient(circle at 35% 30%, ${p.color}, ${p.color}88)` : `radial-gradient(circle at 35% 30%, ${p.color}33, ${p.color}11)`, cursor: 'pointer' }} />
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
