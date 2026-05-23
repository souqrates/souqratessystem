import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, hudColor } from './_groupKit';

const DEFAULT_GAME_TIME = 90;
const COLS = 7, ROWS = 9;
const RULES = 'CRYSTAL CASCADE — Tap a group of 2+ same-color crystals to detonate them. Larger groups = exponential bonus. Crystals tumble down and refill from above. Chain combos for massive multipliers. 90 seconds to top the cascade leaderboard.';

const HUES = [
  { c: '#06b6d4', g: 'linear-gradient(135deg,#22d3ee,#0891b2)' },
  { c: '#10b981', g: 'linear-gradient(135deg,#34d399,#059669)' },
  { c: '#fbbf24', g: 'linear-gradient(135deg,#fde047,#d97706)' },
  { c: '#ef4444', g: 'linear-gradient(135deg,#f87171,#b91c1c)' },
  { c: '#ec4899', g: 'linear-gradient(135deg,#f472b6,#be185d)' },
];

const makeBoard = () =>
  Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(Math.random() * HUES.length))
  );

const floodGroup = (board, r, c, color, seen = new Set()) => {
  const key = `${r},${c}`;
  if (seen.has(key)) return [];
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return [];
  if (board[r][c] !== color) return [];
  seen.add(key);
  return [
    [r, c],
    ...floodGroup(board, r + 1, c, color, seen),
    ...floodGroup(board, r - 1, c, color, seen),
    ...floodGroup(board, r, c + 1, color, seen),
    ...floodGroup(board, r, c - 1, color, seen),
  ];
};

const collapse = (board) => {
  const nb = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== -1) {
        nb[writeRow][c] = board[r][c];
        writeRow--;
      }
    }
    while (writeRow >= 0) {
      nb[writeRow][c] = Math.floor(Math.random() * HUES.length);
      writeRow--;
    }
  }
  return nb;
};

export default function CrystalCascade({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [board, setBoard] = useState(makeBoard);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [combo, setCombo] = useState(0);
  const [popFx, setPopFx] = useState([]);
  const [flashPts, setFlashPts] = useState(null);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const timerRef = useRef(null);
  const comboResetRef = useRef(null);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const handleTap = useCallback((r, c) => {
    if (phase !== 'playing') return;
    const color = board[r][c];
    if (color === -1) return;
    const group = floodGroup(board, r, c, color);
    if (group.length < 2) {
      tone(180, 0.08, 'sawtooth', 0.12);
      return;
    }
    const base = group.length * 10;
    const groupBonus = group.length >= 5 ? group.length * 15 : group.length >= 3 ? group.length * 5 : 0;
    comboRef.current += 1;
    setCombo(comboRef.current);
    const comboBonus = Math.floor((comboRef.current - 1) * 8);
    const total = base + groupBonus + comboBonus;
    addScore(total);

    if (group.length >= 6) chord([523, 659, 784, 1047, 1318], 0.04, 0.16, 'sine', 0.22);
    else if (group.length >= 4) chord([523, 659, 784], 0.05, 0.15, 'sine', 0.22);
    else tone(440 + group.length * 40, 0.1, 'triangle', 0.25);
    triggerHaptic(group.length >= 4 ? 'success' : 'light');

    setPopFx(group.map(([gr, gc]) => ({
      id: Math.random(), r: gr, c: gc, col: HUES[color].c,
    })));
    setFlashPts({ id: Math.random(), pts: total, r, c, col: HUES[color].c });
    setTimeout(() => setPopFx([]), 400);
    setTimeout(() => setFlashPts(null), 700);

    const nb = board.map((row) => row.slice());
    group.forEach(([gr, gc]) => { nb[gr][gc] = -1; });
    setTimeout(() => setBoard(collapse(nb)), 180);

    clearTimeout(comboResetRef.current);
    comboResetRef.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, 2000);
  }, [board, phase, addScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME);
    setBoard(makeBoard());

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(comboResetRef.current);
    };
  }, [phase, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>💎</div>
      <h2 style={{ color: '#22d3ee', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #22d3ee' }}>CRYSTAL CASCADE</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, GAME_TIME);

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #020617 70%)',
      fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
      padding: '60px 8px 30px',
    }}>
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="COMBO" value={`×${combo}`} color="#fbbf24" />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: 4,
        maxWidth: 380,
        margin: '0 auto',
        background: 'rgba(2,6,23,0.5)',
        border: '1px solid rgba(34,211,238,0.18)',
        borderRadius: 14,
        padding: 6,
        boxShadow: '0 0 30px rgba(34,211,238,0.12)',
      }}>
        {board.map((row, r) =>
          row.map((color, c) => {
            const popped = popFx.find((p) => p.r === r && p.c === c);
            return (
              <motion.button
                key={`${r}-${c}`}
                onPointerDown={() => handleTap(r, c)}
                layout
                animate={popped ? { scale: [1, 1.5, 0], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
                transition={popped ? { duration: 0.35 } : { type: 'spring', stiffness: 380, damping: 22 }}
                style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  background: HUES[color]?.g || 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: `0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.3), 0 0 12px ${HUES[color]?.c || '#fff'}44`,
                }}>
                <div style={{
                  position: 'absolute', top: '15%', left: '20%', width: '30%', height: '20%',
                  borderRadius: '50%', background: 'rgba(255,255,255,0.45)',
                  filter: 'blur(2px)', pointerEvents: 'none',
                }} />
              </motion.button>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {flashPts && (
          <motion.div key={flashPts.id}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -50, scale: 1.4 }}
            transition={{ duration: 0.7 }}
            style={{
              position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%,-50%)',
              color: flashPts.col, fontWeight: 900, fontSize: 28,
              textShadow: `0 0 18px ${flashPts.col}`, pointerEvents: 'none', zIndex: 20,
            }}>
            +{flashPts.pts}
          </motion.div>
        )}
      </AnimatePresence>

      <TimerBar pct={timeLeft / GAME_TIME} color={tc} />
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
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.06)', zIndex: 10 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear' }} />
    </div>
  );
}
