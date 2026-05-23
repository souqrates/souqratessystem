import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'MIND MIRROR — Tap cards to flip them. Find pairs of matching icons. Each pair scores big. Each wrong flip costs a few points. Clear the board to spawn a new harder one. 90 seconds.';
const DEFAULT_DURATION = 90;
const ICONS = ['◆','◇','★','✦','▲','■','●','✶','✷','♥','♣','♦'];

function makeDeck(size) {
  const pairs = Math.floor(size / 2);
  const pool = ICONS.slice(0, pairs);
  const arr = [...pool, ...pool].sort(() => Math.random() - 0.5);
  return arr.map((icon, i) => ({ id: i + Math.random(), icon, matched: false }));
}

export default function MindMirror({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [board, setBoard] = useState(() => makeDeck(8));
  const [flipped, setFlipped] = useState([]);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(1);

  const scoreRef = useRef(0);
  const roundRef = useRef(1);
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
    scoreRef.current = 0; roundRef.current = 1;
    setScore(0); setTimeLeft(DURATION); setRound(1);
    setBoard(makeDeck(8)); setFlipped([]); setBusy(false);

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

  const flip = (idx) => {
    if (overRef.current || busy) return;
    if (flipped.includes(idx)) return;
    if (board[idx].matched) return;
    const newFlipped = [...flipped, idx];
    setFlipped(newFlipped);
    tone(440, 0.08, 'sine', 0.18);
    triggerHaptic('light');
    if (newFlipped.length === 2) {
      setBusy(true);
      const [a, b] = newFlipped;
      if (board[a].icon === board[b].icon) {
        setTimeout(() => {
          if (overRef.current) return;
          const next = board.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
          setBoard(next);
          setFlipped([]);
          setBusy(false);
          updateScore(120);
          tone(700, 0.15, 'triangle', 0.22);
          triggerHaptic('success');
          if (next.every(c => c.matched)) {
            updateScore(250);
            roundRef.current += 1;
            setRound(roundRef.current);
            const newSize = Math.min(8 + roundRef.current * 2, 16);
            setTimeout(() => !overRef.current && setBoard(makeDeck(newSize)), 400);
          }
        }, 300);
      } else {
        setTimeout(() => {
          if (overRef.current) return;
          setFlipped([]);
          setBusy(false);
          updateScore(-15);
        }, 700);
      }
    }
  };

  if (phase === 'rules') {
    return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;
  }

  const tc = hudColor(timeLeft, DURATION);
  const cols = board.length <= 12 ? 4 : 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Hud label="Score" value={score} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}</p>
        </div>
        <Hud label="Round" value={round} color="#10b981" />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, perspective: '1200px' }}>
        {board.map((card, i) => {
          const showFace = flipped.includes(i) || card.matched;
          return (
            <motion.button key={card.id}
              whileTap={{ scale: 0.94 }}
              onPointerDown={() => flip(i)}
              animate={{ rotateY: showFace ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              style={{ height: 70, borderRadius: 12, border: `1.5px solid ${card.matched ? '#10b98166' : 'rgba(0,212,255,0.3)'}`, background: card.matched ? 'rgba(16,185,129,0.12)' : showFace ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.35)', cursor: 'pointer', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22 }}>
              <span style={{ display: 'inline-block', transform: showFace ? 'rotateY(180deg)' : 'none' }}>
                {showFace ? card.icon : '?'}
              </span>
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
