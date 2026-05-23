import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { getAudioContext } from '../../../lib/audioPool';

const RULES =
  'DUEL OF DOTS ONLINE — Claim dots on the grid to form lines of 4! ' +
  'Each connected line of 4 dots = 1 point. ' +
  'You have 60 seconds to score as many lines as possible. ' +
  'Your score competes against your online opponent. Most lines WINS!';

const COLS = 7;
const ROWS = 7;
const TOTAL = COLS * ROWS;
const DEFAULT_GAME_TIME = 60;

function checkLines(grid, owner) {
  let lines = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c] !== owner) continue;
      for (const [dc, dr] of directions) {
        const prevR = r - dr, prevC = c - dc;
        if (prevR >= 0 && prevR < ROWS && prevC >= 0 && prevC < COLS && grid[prevR * COLS + prevC] === owner) continue;
        let count = 1;
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr * COLS + nc] === owner) {
          count++; nr += dr; nc += dc;
        }
        if (count >= 4) lines++;
      }
    }
  }
  return lines;
}

function playDot(freq = 520) {
  try {
    const ac = getAudioContext();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    o.start(); o.stop(ac.currentTime + 0.1);
  } catch {}
}

function playLine() {
  try {
    const ac = getAudioContext();
    [523, 659, 784].forEach((f, i) => {
      const o = ac.createOscillator(); const g2 = ac.createGain();
      o.connect(g2); g2.connect(ac.destination);
      o.type = 'triangle'; o.frequency.value = f;
      g2.gain.setValueAtTime(0.2, ac.currentTime + i * 0.08);
      g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.08 + 0.1);
      o.start(ac.currentTime + i * 0.08); o.stop(ac.currentTime + i * 0.08 + 0.12);
    });
  } catch {}
}

export default function DuelOfDots({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [grid,      setGrid]      = useState(() => Array(TOTAL).fill(0));
  const [score,     setScore]     = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(GAME_TIME);
  const [lastLine,  setLastLine]  = useState(false);
  const [botScore,  setBotScore]  = useState(0);
  const [botFlash,  setBotFlash]  = useState(false);
  const [newDots,   setNewDots]   = useState(new Set());

  const gridRef     = useRef(Array(TOTAL).fill(0));
  const scoreRef    = useRef(0);
  const botRef      = useRef(0);
  const timerRef    = useRef(null);
  const botIntRef   = useRef(null);
  const gameOverRef = useRef(false);

  const endGame = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(botIntRef.current);
    gameOverRef.current = true;
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('medium');
    const playerWon = scoreRef.current >= botRef.current;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate]);

  const init = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(botIntRef.current);
    gameOverRef.current = false;
    const ng = Array(TOTAL).fill(0);
    gridRef.current = ng;
    scoreRef.current = 0; botRef.current = 0;
    setGrid([...ng]); setScore(0); setBotScore(0);
    setTimeLeft(GAME_TIME); setLastLine(false); setNewDots(new Set());
  }, []);

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); clearInterval(botIntRef.current); return; }
    init();

    let t = GAME_TIME;
    timerRef.current = setInterval(() => { t--; setTimeLeft(t); if (t <= 0) endGame(); }, 1000);

    // Bot opponent — places dots on the actual grid and scores lines legitimately
    const scheduleBotMove = () => {
      if (gameOverRef.current) return;
      const delay = 1600 + Math.random() * 1200;
      clearTimeout(botIntRef.current);
      botIntRef.current = setTimeout(() => {
        if (gameOverRef.current) return;
        const g = gridRef.current;
        const empty = [];
        for (let i = 0; i < TOTAL; i++) if (g[i] === 0) empty.push(i);
        if (empty.length > 0) {
          const idx = empty[Math.floor(Math.random() * empty.length)];
          const ng = [...g];
          ng[idx] = 2;
          gridRef.current = ng;
          setGrid([...ng]);
          const newBotScore = checkLines(ng, 2);
          if (newBotScore > botRef.current) {
            botRef.current = newBotScore;
            setBotScore(newBotScore);
            setBotFlash(true);
            setTimeout(() => setBotFlash(false), 350);
          }
          if (ng.every(v => v !== 0)) endGame();
        }
        scheduleBotMove();
      }, delay);
    };
    scheduleBotMove();

    return () => { clearInterval(timerRef.current); clearTimeout(botIntRef.current); };
  }, [phase]);

  const tap = useCallback((idx) => {
    if (gameOverRef.current) return;
    const g = gridRef.current;
    if (g[idx] !== 0) return;

    const ng = [...g];
    ng[idx] = 1;
    gridRef.current = ng;
    setGrid([...ng]);
    setNewDots(prev => new Set([...prev, idx]));
    setTimeout(() => setNewDots(prev => { const n = new Set(prev); n.delete(idx); return n; }), 400);

    playDot(440 + Math.random() * 160);
    triggerHaptic('light');

    const newScore = checkLines(ng, 1);
    if (newScore > scoreRef.current) {
      scoreRef.current = newScore;
      setScore(newScore);
      if (onScoreUpdate) onScoreUpdate(newScore);
      playLine();
      triggerHaptic('success');
      setLastLine(true);
      setTimeout(() => setLastLine(false), 900);
    } else {
      scoreRef.current = newScore;
      setScore(newScore);
    }

    // End when grid is full
    if (ng.every(v => v !== 0)) endGame();
  }, [endGame, onScoreUpdate]);

  if (phase === 'rules') return (
    <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>
  );

  const tp = timeLeft / GAME_TIME;
  const tc = tp > 0.5 ? '#10b981' : tp > 0.25 ? '#f59e0b' : '#ef4444';
  const dotsPlaced = gridRef.current.filter(v => v !== 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HudCard label="YOUR LINES" value={score} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <motion.p animate={timeLeft <= 15 ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}
            style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}s</motion.p>
        </div>
        <motion.div animate={botFlash ? { scale: [1, 1.1, 1] } : {}} transition={{ duration: 0.2 }}
          style={{ background: 'rgba(249,115,22,0.07)', border: `1px solid ${botFlash ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.18)'}`, borderRadius: 12, padding: '8px 0', textAlign: 'center', transition: 'border-color 0.2s' }}>
          <p style={{ fontSize: 8, color: 'rgba(249,115,22,0.5)', margin: 0, textTransform: 'uppercase' }}>OPPONENT</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: '#f97316', margin: 0 }}>{botScore}</p>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${(dotsPlaced / TOTAL) * 100}%` }} transition={{ duration: 0.3 }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #00d4ff, #00ff88)', borderRadius: 99 }} />
      </div>

      {/* Line scored flash */}
      <AnimatePresence>
        {lastLine && (
          <motion.div key="line" initial={{ opacity: 0, scale: 0.85, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1 }}
            style={{ textAlign: 'center', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: 10, padding: '5px 0' }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, color: '#00d4ff' }}>
              LINE SCORED! +1
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: 6,
        background: 'rgba(0,212,255,0.03)',
        border: '1px solid rgba(0,212,255,0.08)',
        borderRadius: 18,
        padding: 12,
      }}>
        {grid.map((val, idx) => {
          const isNew = newDots.has(idx);
          return (
            <motion.button
              key={idx}
              onClick={() => tap(idx)}
              whileTap={!val ? { scale: 0.8 } : {}}
              animate={isNew ? { scale: [0.5, 1.2, 1] } : {}}
              transition={{ duration: 0.3, type: 'spring' }}
              style={{
                aspectRatio: '1',
                borderRadius: '50%',
                border: 'none',
                cursor: val ? 'default' : 'pointer',
                background: val === 1
                  ? 'radial-gradient(circle at 35% 30%, #7fffff, #00d4ff, #0090aa)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: val === 1
                  ? '0 0 14px rgba(0,212,255,0.7), inset 0 1px 3px rgba(255,255,255,0.4)'
                  : 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {!val && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, rgba(0,212,255,0.15), transparent)',
                }} />
              )}
              {val === 1 && (
                <div style={{
                  position: 'absolute', top: '18%', left: '22%',
                  width: '28%', height: '25%',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.5)',
                }} />
              )}
            </motion.button>
          );
        })}
      </div>

      <motion.p animate={{ opacity: [0.3, 0.65, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
        style={{ textAlign: 'center', fontSize: 9, color: 'rgba(0,212,255,0.35)', letterSpacing: '0.1em', margin: 0 }}>
        TAP DOTS  •  CONNECT 4 IN A LINE TO SCORE
      </motion.p>
    </div>
  );
}

function HudCard({ label, value, color }) {
  return (
    <div style={{ background: `${color}07`, border: `1px solid ${color}20`, borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}55`, margin: 0, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</p>
      <motion.p key={String(value)} initial={{ scale: 1.25, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color, margin: 0 }}>{value}</motion.p>
    </div>
  );
}
