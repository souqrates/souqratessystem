import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'SPEED SORT \u2014 Five numbers appear. Tap them in ASCENDING order. Each correct round scores by speed. Wrong tap = sequence resets. 60 seconds.';
const DEFAULT_GAME_TIME = 60;

function randNumbers() {
  const set = new Set();
  while (set.size < 5) set.add(Math.floor(Math.random() * 99) + 1);
  return [...set].map((n, i) => ({ id: `${Date.now()}-${i}`, n }));
}

export default function SpeedSort({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [nums, setNums] = useState(randNumbers());
  const [tapped, setTapped] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);

  const numsRef = useRef([]);
  const tappedRef = useRef([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const roundStartRef = useRef(0);
  const tickRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const nextRound = useCallback(() => {
    const n = randNumbers();
    numsRef.current = n; tappedRef.current = [];
    setNums(n); setTapped([]);
    roundStartRef.current = Date.now();
    setRound(r => r + 1);
  }, []);

  const onTap = (id, value) => {
    if (!activeRef.current) return;
    const remaining = numsRef.current.filter(x => !tappedRef.current.includes(x.id));
    const min = remaining.reduce((acc, x) => x.n < acc.n ? x : acc, remaining[0]);
    if (id === min.id) {
      const newTapped = [...tappedRef.current, id];
      tappedRef.current = newTapped;
      setTapped(newTapped);
      beep({ freq: 480 + newTapped.length * 60, dur: 0.07, type: 'triangle' });
      triggerHaptic('light');
      if (newTapped.length === 5) {
        const elapsed = (Date.now() - roundStartRef.current) / 1000;
        const speedBonus = Math.max(0, Math.floor((6 - elapsed) * 15));
        const next = comboRef.current + 1;
        comboRef.current = next;
        const pts = 50 + speedBonus + next * 3;
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(next);
        if (onScoreUpdate) onScoreUpdate(scoreRef.current);
        setFlash({ ok: true, pts, id: Math.random() });
        triggerHaptic('medium');
        setTimeout(() => setFlash(null), 380);
        setTimeout(nextRound, 350);
      }
    } else {
      comboRef.current = 0;
      tappedRef.current = [];
      setCombo(0); setTapped([]);
      setFlash({ ok: false, id: Math.random() });
      noise({ dur: 0.18, vol: 0.2 });
      triggerHaptic('error');
      setTimeout(() => setFlash(null), 320);
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; tappedRef.current = [];
    setScore(0); setCombo(0); setTapped([]); setTimeLeft(GAME_TIME); setRound(1);
    const n = randNumbers();
    numsRef.current = n; setNums(n);
    roundStartRef.current = Date.now();
    activeRef.current = true;
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; clearInterval(tickRef.current); };
  }, [phase, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #062828 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5a0" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="ROUND" val={round} color="#00f5ff" />
        <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: 10, padding: 6 }}>
        {nums.map((x) => {
          const done = tapped.includes(x.id);
          return (
            <motion.button
              key={x.id}
              whileTap={{ scale: 0.94 }}
              onPointerDown={() => !done && onTap(x.id, x.n)}
              animate={{ opacity: done ? 0.3 : 1, scale: done ? 0.9 : 1 }}
              style={{
                borderRadius: 18, cursor: done ? 'default' : 'pointer',
                border: `2px solid ${done ? '#00f5a055' : '#00f5a0'}`,
                background: done
                  ? 'rgba(0,245,160,0.08)'
                  : 'linear-gradient(135deg, rgba(0,245,160,0.18), rgba(0,245,160,0.04))',
                boxShadow: done ? 'none' : '0 0 18px rgba(0,245,160,0.35), inset 0 0 18px rgba(0,245,160,0.1)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 38,
                color: '#fff', textShadow: '0 0 14px #00f5a0',
              }}>
              {x.n}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 28, pointerEvents: 'none',
              color: flash.ok ? '#00f5a0' : '#ff3355',
              textShadow: `0 0 22px ${flash.ok ? '#00f5a0' : '#ff3355'}`,
            }}>
            {flash.ok ? `+${flash.pts}` : 'RESET'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 7, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.16em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
