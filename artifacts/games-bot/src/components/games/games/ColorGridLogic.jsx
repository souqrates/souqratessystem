import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Fill the grid so no row or column has duplicate colors. Each valid grid = +100. Wrong placement = -150. Grid grows 3×3 → 5×5 after 400 pts. Reach 1000 in 180 seconds!';
const DEFAULT_GAME_TIME = 180;
const TARGET = 1000;

const PALETTE = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

function genPuzzle(size) {
  const colors = PALETTE.slice(0, size);
  // Generate a valid Latin square solution
  const solution = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => colors[(r + c) % size])
  );
  // Shuffle rows and cols for variety
  const rowPerm = [...Array(size).keys()].sort(() => Math.random() - 0.5);
  const colPerm = [...Array(size).keys()].sort(() => Math.random() - 0.5);
  const shuffled = rowPerm.map(r => colPerm.map(c => solution[r][c]));

  // Pre-fill some cells as hints
  const hintCount = Math.floor(size * size * 0.35);
  const hints = new Set();
  while (hints.size < hintCount) hints.add(Math.floor(Math.random() * size * size));

  const grid = shuffled.map((row, r) =>
    row.map((color, c) => ({
      color: hints.has(r * size + c) ? color : null,
      fixed: hints.has(r * size + c),
      solution: color,
    }))
  );
  return { grid, colors };
}

function isValid(grid, size) {
  for (let r = 0; r < size; r++) {
    const rowColors = grid[r].map(c => c.color).filter(Boolean);
    if (new Set(rowColors).size !== rowColors.length) return false;
  }
  for (let c = 0; c < size; c++) {
    const colColors = grid.map(row => row[c].color).filter(Boolean);
    if (new Set(colColors).size !== colColors.length) return false;
  }
  return true;
}

function isComplete(grid, size) {
  return grid.every(row => row.every(cell => cell.color !== null)) && isValid(grid, size);
}

export default function ColorGridLogic({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [puzzle, setPuzzle] = useState(null);
  const [grid, setGrid] = useState([]);
  const [gridSize, setGridSize] = useState(3);
  const [selected, setSelected] = useState(null);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSize = () => scoreRef.current >= 400 ? 5 : 3;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPuzzle = useCallback(() => {
    if (!activeRef.current) return;
    const size = getSize();
    setGridSize(size);
    const p = genPuzzle(size);
    setPuzzle(p);
    setGrid(p.grid.map(row => row.map(cell => ({ ...cell }))));
    setSelected(null);
  }, []);

  const tapCell = useCallback((r, c) => {
    if (!activeRef.current || !grid[r]?.[c]) return;
    if (grid[r][c].fixed) return;
    setSelected({ r, c });
    beep({ freq: 350, dur: 0.05, vol: 0.06 });
  }, [grid]);

  const pickColor = useCallback((color) => {
    if (!activeRef.current || !selected || !puzzle) return;
    const { r, c } = selected;
    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
    const correct = newGrid[r][c].solution === color;

    if (!correct) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setSelected(null);
      return;
    }

    newGrid[r][c] = { ...newGrid[r][c], color };
    setGrid(newGrid);
    setSelected(null);
    beep({ freq: 480, dur: 0.07, vol: 0.08 });

    if (isComplete(newGrid, gridSize)) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newPuzzle, 700);
    }
  }, [selected, grid, gridSize, puzzle, endGame, onScoreUpdate, newPuzzle, TARGET_SCORE]);

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

  const CELL = gridSize === 3 ? 60 : 44;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ec4899" />
        <Hud label="GRID" v={`${gridSize}×${gridSize}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 30 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 10 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'SOLVED!' : 'CONFLICT!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, ${CELL}px)`, gap: 4 }}>
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isSel = selected?.r === r && selected?.c === c;
              return (
                <motion.div
                  key={`${r}-${c}`}
                  whileTap={cell.fixed ? {} : { scale: 0.9 }}
                  onPointerDown={() => tapCell(r, c)}
                  style={{
                    width: CELL, height: CELL, borderRadius: 10,
                    background: cell.color ? `${cell.color}44` : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${isSel ? '#fff' : cell.fixed ? `${cell.color}88` : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: isSel ? '0 0 12px rgba(255,255,255,0.2)' : 'none',
                    cursor: cell.fixed ? 'default' : 'pointer',
                  }}
                >
                  {cell.color && <div style={{ width: '100%', height: '100%', borderRadius: 8, background: cell.color, opacity: cell.fixed ? 0.9 : 0.7 }} />}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Color picker */}
        {selected && puzzle && (
          <div style={{ display: 'flex', gap: 8 }}>
            {puzzle.colors.map(color => (
              <motion.button
                key={color}
                whileTap={{ scale: 0.85 }}
                onPointerDown={() => pickColor(color)}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${color}66`, border: `2px solid ${color}`,
                  cursor: 'pointer',
                  boxShadow: `0 0 10px ${color}44`,
                }}
              />
            ))}
          </div>
        )}

        {!selected && <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11, letterSpacing: '0.12em' }}>TAP EMPTY CELL TO FILL</p>}
      </div>
    </div>
  );
}
