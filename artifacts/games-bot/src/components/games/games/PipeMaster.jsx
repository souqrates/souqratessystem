import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Rotate pipe tiles to connect the source to the drain. Complete = +100. Unnecessary pipe in path = -20. Wrong rotation wasting connections = -150. Grid grows 4×4 → 6×6. Reach 1000 in 120 seconds!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 1000;

// Pipe types: which sides they connect (T=top, R=right, B=bottom, L=left)
const PIPE_TYPES = {
  straight_h: { connects: ['L', 'R'], symbol: '━' },
  straight_v: { connects: ['T', 'B'], symbol: '┃' },
  bend_tr:    { connects: ['T', 'R'], symbol: '┗' },
  bend_tl:    { connects: ['T', 'L'], symbol: '┛' },
  bend_br:    { connects: ['B', 'R'], symbol: '┏' },
  bend_bl:    { connects: ['B', 'L'], symbol: '┓' },
  cross:      { connects: ['T', 'R', 'B', 'L'], symbol: '╋' },
  tee_trb:    { connects: ['T', 'R', 'B'], symbol: '┣' },
};

const PIPE_KEYS = Object.keys(PIPE_TYPES);
const ROTATIONS = [0, 90, 180, 270];

function rotateSide(side, deg) {
  const order = ['T', 'R', 'B', 'L'];
  const steps = (deg / 90) % 4;
  const idx = order.indexOf(side);
  return order[(idx + steps) % 4];
}

function getConnects(typeKey, rotation) {
  return PIPE_TYPES[typeKey].connects.map(s => rotateSide(s, rotation));
}

function buildGrid(size) {
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      const typeKey = PIPE_KEYS[Math.floor(Math.random() * 6)];
      const rotation = ROTATIONS[Math.floor(Math.random() * 4)];
      row.push({ typeKey, rotation, id: `${r}-${c}` });
    }
    grid.push(row);
  }
  // Set source at (0,0) and drain at (size-1, size-1)
  grid[0][0] = { typeKey: 'bend_br', rotation: 0, id: '0-0', source: true };
  grid[size - 1][size - 1] = { typeKey: 'bend_tl', rotation: 0, id: `${size-1}-${size-1}`, drain: true };
  return grid;
}

function isConnected(grid, size) {
  // BFS from source
  const visited = new Set();
  const queue = [{ r: 0, c: 0 }];
  visited.add('0,0');
  const dirs = [
    { dr: -1, dc: 0, from: 'B', to: 'T' },
    { dr: 0, dc: 1, from: 'L', to: 'R' },
    { dr: 1, dc: 0, from: 'T', to: 'B' },
    { dr: 0, dc: -1, from: 'R', to: 'L' },
  ];
  while (queue.length) {
    const { r, c } = queue.shift();
    if (r === size - 1 && c === size - 1) return true;
    const cell = grid[r][c];
    const connects = getConnects(cell.typeKey, cell.rotation);
    for (const dir of dirs) {
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (!connects.includes(dir.from)) continue;
      const neighbor = grid[nr][nc];
      const neighborConnects = getConnects(neighbor.typeKey, neighbor.rotation);
      if (neighborConnects.includes(dir.to)) {
        visited.add(key);
        queue.push({ r: nr, c: nc });
      }
    }
  }
  return false;
}

export default function PipeMaster({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [grid, setGrid] = useState([]);
  const [gridSize, setGridSize] = useState(4);
  const [flash, setFlash] = useState(null);
  const [connected, setConnected] = useState(false);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPuzzle = useCallback(() => {
    if (!activeRef.current) return;
    const size = scoreRef.current >= 400 ? 6 : 4;
    setGridSize(size);
    setGrid(buildGrid(size));
    setConnected(false);
  }, []);

  const rotateCell = useCallback((r, c) => {
    if (!activeRef.current) return;
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      const cell = next[r][c];
      const rotIdx = ROTATIONS.indexOf(cell.rotation);
      cell.rotation = ROTATIONS[(rotIdx + 1) % 4];
      beep({ freq: 300 + rotIdx * 50, dur: 0.05, vol: 0.06 });

      const size = next.length;
      if (isConnected(next, size)) {
        scoreRef.current = Math.max(0, scoreRef.current + 100);
        setScore(scoreRef.current);
        triggerHaptic('medium');
        chord([660, 880, 1100], 0.06, 0.1, 'triangle');
        setFlash({ type: 'good', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setConnected(true);
        setTimeout(newPuzzle, 700);
      }
      return next;
    });
  }, [endGame, onScoreUpdate, newPuzzle, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newPuzzle();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const cellSize = gridSize === 4 ? 56 : 40;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#06b6d4" />
        <Hud label="GRID" v={`${gridSize}×${gridSize}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'CONNECTED!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`, gap: 2 }}>
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const conn = getConnects(cell.typeKey, cell.rotation);
              return (
                <motion.div
                  key={cell.id}
                  whileTap={{ scale: 0.88 }}
                  onPointerDown={() => rotateCell(r, c)}
                  style={{
                    width: cellSize, height: cellSize,
                    background: cell.source ? 'rgba(16,185,129,0.2)' : cell.drain ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${cell.source ? '#10b981' : cell.drain ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: cellSize * 0.5,
                    color: connected ? '#06b6d4' : '#64748b',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'color 0.2s',
                  }}
                >
                  {cell.source ? '●' : cell.drain ? '◎' : PIPE_TYPES[cell.typeKey].symbol}
                </motion.div>
              );
            })
          )}
        </div>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP TO ROTATE PIPES</p>
      </div>
    </div>
  );
}
