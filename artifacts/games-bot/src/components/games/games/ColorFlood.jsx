import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { getAudioContext } from '../../../lib/audioPool';

const RULES = 'COLOR FLOOD ONLINE — Territory Battle! You start from the top-left corner. Click a color to flood-fill your territory. Capture as many cells as possible in 20 turns. Bonus points for speed. Your territory score competes against your opponent!';

const COLS = 12, ROWS = 12;
const MAX_TURNS = 20;
const COLORS = ['#ef4444','#10b981','#f59e0b','#3b82f6','#a855f7','#ec4899'];

function makeGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(Math.random() * COLORS.length))
  );
}

function notePlay(colorIdx) {
  const freqs = [280, 360, 440, 520, 620, 700];
  try {
    const ac = getAudioContext();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = freqs[colorIdx]; o.type = 'triangle';
    g.gain.setValueAtTime(0.2, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.13);
    o.start(); o.stop(ac.currentTime + 0.13);
  } catch {}
}

export default function ColorFlood({ phase, setPhase, onScoreUpdate }) {
  const [grid,     setGrid]     = useState(makeGrid);
  const [owned,    setOwned]    = useState(new Set(['0,0']));
  const [botOwned, setBotOwned] = useState(new Set([`${ROWS-1},${COLS-1}`]));
  const [turns,    setTurns]    = useState(MAX_TURNS);
  const [score,    setScore]    = useState(1);
  const [done,     setDone]     = useState(false);

  const gridRef    = useRef(null);
  const ownedRef   = useRef(new Set(['0,0']));
  const botOwnedRef = useRef(new Set([`${ROWS-1},${COLS-1}`]));
  const turnsRef   = useRef(MAX_TURNS);
  const gameOverRef = useRef(false);

  const endGame = useCallback((playerOwned, botOwnedSet) => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    setDone(true);
    const finalScore = playerOwned.size * 10;
    if (onScoreUpdate) onScoreUpdate(finalScore);
    triggerHaptic('medium');
    const playerWon = playerOwned.size >= botOwnedSet.size;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 700);
  }, [setPhase, onScoreUpdate]);

  // BFS flood-fill helper
  const floodFill = useCallback((grid, startOwned, colorIdx) => {
    const g = grid.map(r => [...r]);
    const myOwned = new Set(startOwned);
    for (const key of myOwned) {
      const [r, c] = key.split(',').map(Number);
      g[r][c] = colorIdx;
    }
    const queue = [...myOwned];
    const visited = new Set(myOwned);
    while (queue.length) {
      const key = queue.shift();
      const [r, c] = key.split(',').map(Number);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const nk = `${nr},${nc}`;
        if (!visited.has(nk) && g[nr][nc] === colorIdx) {
          visited.add(nk); queue.push(nk); myOwned.add(nk);
        }
      }
    }
    return { g, newOwned: myOwned };
  }, []);

  // Bot picks the color that expands its territory most
  const botMove = useCallback((grid, botOwnedSet) => {
    let bestColor = 0, bestSize = -1;
    for (let ci = 0; ci < COLORS.length; ci++) {
      const { newOwned } = floodFill(grid, botOwnedSet, ci);
      if (newOwned.size > bestSize) { bestSize = newOwned.size; bestColor = ci; }
    }
    return bestColor;
  }, [floodFill]);

  const init = useCallback(() => {
    gameOverRef.current = false;
    const ng = makeGrid();
    gridRef.current = ng;
    const o = new Set(['0,0']);
    const bo = new Set([`${ROWS-1},${COLS-1}`]);
    ownedRef.current = o; botOwnedRef.current = bo; turnsRef.current = MAX_TURNS;
    setGrid(ng); setOwned(new Set(o)); setBotOwned(new Set(bo)); setTurns(MAX_TURNS); setScore(1); setDone(false);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    init();
  }, [phase]);

  const pickColor = useCallback((colorIdx) => {
    if (gameOverRef.current || turnsRef.current <= 0) return;

    // Player move
    const { g: g1, newOwned: myOwned } = floodFill(gridRef.current, ownedRef.current, colorIdx);

    // Bot move (greedy best-color from its corner)
    const botColor = botMove(g1, botOwnedRef.current);
    const { g: g2, newOwned: newBotOwned } = floodFill(g1, botOwnedRef.current, botColor);

    gridRef.current = g2;
    ownedRef.current = myOwned;
    botOwnedRef.current = newBotOwned;
    turnsRef.current--;
    const newScore = myOwned.size * 10;

    setGrid(g2.map(r => [...r]));
    setOwned(new Set(myOwned));
    setBotOwned(new Set(newBotOwned));
    setTurns(turnsRef.current);
    setScore(newScore);
    if (onScoreUpdate) onScoreUpdate(newScore);
    notePlay(colorIdx);
    triggerHaptic('light');

    if (myOwned.size >= ROWS * COLS || newBotOwned.size >= ROWS * COLS || turnsRef.current <= 0) {
      endGame(myOwned, newBotOwned);
    }
  }, [endGame, floodFill, botMove, onScoreUpdate]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;

  const progress = owned.size / (ROWS * COLS);
  const botProgress = botOwned.size / (ROWS * COLS);
  const turnsPct = turns / MAX_TURNS;
  const turnsColor = turnsPct > 0.5 ? '#10b981' : turnsPct > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HudCard label="YOU" value={`${owned.size}`} color="#10b981" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Turns Left</p>
          <motion.p animate={turns <= 5 ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}
            style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: turnsColor, margin: 0 }}>{turns}</motion.p>
        </div>
        <HudCard label="OPPONENT" value={`${botOwned.size}`} color="#f97316" />
      </div>

      {/* Dual progress bar */}
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
        <motion.div animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4, type: 'spring' }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '99px 0 0 99px' }} />
        <motion.div animate={{ width: `${botProgress * 100}%` }} transition={{ duration: 0.4, type: 'spring' }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #f97316, #fb923c)', borderRadius: '0 99px 99px 0' }} />
      </div>

      {done && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
          style={{ textAlign: 'center', padding: '10px 0', borderRadius: 14, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: '#10b981', margin: 0 }}>YOU: {owned.size} vs BOT: {botOwned.size}</p>
        </motion.div>
      )}

      {/* Grid */}
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {grid.map((row, r) => row.map((cIdx, c) => {
            const key = `${r},${c}`;
            const isOwned = owned.has(key);
            const isBotOwned = botOwned.has(key);
            const isPlayerStart = r === 0 && c === 0;
            const isBotStart = r === ROWS - 1 && c === COLS - 1;
            const col = COLORS[cIdx];
            return (
              <div key={key} style={{
                aspectRatio: '1',
                background: col,
                outline: isOwned ? '2px solid rgba(255,255,255,0.7)' : isBotOwned ? '2px solid rgba(249,115,22,0.9)' : 'none',
                outlineOffset: '-2px',
                boxShadow: isOwned ? `inset 0 0 6px rgba(255,255,255,0.3)` : isBotOwned ? 'inset 0 0 6px rgba(249,115,22,0.3)' : 'none',
                transition: 'background 0.25s, box-shadow 0.2s',
                position: 'relative',
              }}>
                {isPlayerStart && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />}
                {isBotStart && <div style={{ position: 'absolute', inset: 0, background: 'rgba(249,115,22,0.4)', borderRadius: 2 }} />}
                {isOwned && !isPlayerStart && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.12)' }} />}
                {isBotOwned && !isBotStart && <div style={{ position: 'absolute', inset: 0, background: 'rgba(249,115,22,0.15)' }} />}
              </div>
            );
          }))}
        </div>
      </div>

      {/* Color picker */}
      {!done && (
        <div>
          <p style={{ fontSize: 9, color: 'rgba(168,85,247,0.5)', textAlign: 'center', margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pick a color to flood</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {COLORS.map((col, i) => (
              <motion.button key={i} whileTap={{ scale: 0.82 }} onPointerDown={() => pickColor(i)}
                style={{
                  aspectRatio: '1', borderRadius: 12, background: col, border: 'none', cursor: 'pointer',
                  boxShadow: `0 0 16px ${col}60, 0 4px 12px rgba(0,0,0,0.4)`,
                  transition: 'transform 0.1s',
                }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HudCard({ label, value, color }) {
  return (
    <div style={{ background: `${color}07`, border: `1px solid ${color}20`, borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}60`, margin: 0, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</p>
      <motion.p key={String(value)} initial={{ scale: 1.2, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color, margin: 0 }}>{value}</motion.p>
    </div>
  );
}
