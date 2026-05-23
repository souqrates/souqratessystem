import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Match the target pixel art by painting cells. Each correct cell = +10. Painting wrong color = -50. Complete the art = +200 bonus. Canvas grows 5×5 → 8×8 after 400 pts. Reach 1500 in 180 seconds!';
const DEFAULT_GAME_TIME = 180;
const TARGET_PTS = 1500;

const PALETTE = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#94a3b8'];

const PATTERNS_5 = [
  // Smiley face 5x5 (0=empty)
  [[0,1,0,1,0],[0,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
  // Heart 5x5
  [[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  // Arrow 5x5
  [[0,0,1,0,0],[0,1,1,1,0],[1,0,1,0,1],[0,0,1,0,0],[0,0,1,0,0]],
];

function genTarget(size) {
  const pattern = PATTERNS_5[Math.floor(Math.random() * PATTERNS_5.length)];
  const primaryColor = PALETTE[Math.floor(Math.random() * (PALETTE.length - 1))];
  const grid = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      if (size === 5 && pattern[r]?.[c]) return primaryColor;
      if (size === 8 && r < 5 && c < 5 && pattern[r]?.[c]) return primaryColor;
      return null;
    })
  );
  return { grid, primaryColor };
}

export default function PixelPaintPro({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [target, setTarget] = useState(null);
  const [canvas, setCanvas] = useState([]);
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [gridSize, setGridSize] = useState(5);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET_PTS;
  const getSize = () => scoreRef.current >= 400 ? 8 : 5;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const size = getSize();
    setGridSize(size);
    const t = genTarget(size);
    setTarget(t);
    setCanvas(Array.from({ length: size }, () => Array(size).fill(null)));
    setSelectedColor(t.primaryColor);
  }, []);

  const checkComplete = useCallback((newCanvas, t, size) => {
    let correct = 0, total = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (t.grid[r][c] !== null) {
          total++;
          if (newCanvas[r][c] === t.grid[r][c]) correct++;
        }
      }
    }
    if (correct === total && total > 0) {
      scoreRef.current = Math.max(0, scoreRef.current + 200);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newRound, 700);
    }
  }, [endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  const paintCell = useCallback((r, c) => {
    if (!activeRef.current || !target) return;
    const expectedColor = target.grid[r][c];
    if (expectedColor === null) {
      // Should be empty — wrong to paint
      if (selectedColor !== null) {
        scoreRef.current = Math.max(0, scoreRef.current - 50);
        setScore(scoreRef.current);
        triggerHaptic('error');
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
      }
      return;
    }
    if (selectedColor !== expectedColor) {
      scoreRef.current = Math.max(0, scoreRef.current - 50);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.06, vol: 0.06 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      return;
    }
    setCanvas(prev => {
      if (prev[r][c] === selectedColor) return prev;
      const next = prev.map(row => [...row]);
      next[r][c] = selectedColor;
      scoreRef.current = Math.max(0, scoreRef.current + 10);
      setScore(scoreRef.current);
      beep({ freq: 450 + r * 20, dur: 0.05, vol: 0.07 });
      onScoreUpdate?.(scoreRef.current);
      checkComplete(next, target, gridSize);
      return next;
    });
  }, [target, selectedColor, gridSize, checkComplete, onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newRound();

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

  const CELL = gridSize === 5 ? 34 : 26;
  const MINI = Math.floor(CELL * 0.6);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ec4899" />
        <Hud label="SIZE" v={`${gridSize}×${gridSize}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 30 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'ART COMPLETE!' : 'WRONG COLOR!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Target (mini) */}
          <div>
            <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4, textAlign: 'center' }}>TARGET</p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, ${MINI}px)`, gap: 1 }}>
              {(target?.grid || []).map((row, r) => row.map((color, c) => (
                <div key={`t-${r}-${c}`} style={{ width: MINI, height: MINI, background: color || 'rgba(255,255,255,0.03)', borderRadius: 2 }} />
              )))}
            </div>
          </div>

          {/* Canvas */}
          <div>
            <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4, textAlign: 'center' }}>PAINT HERE</p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, ${CELL}px)`, gap: 2 }}>
              {canvas.map((row, r) => row.map((color, c) => (
                <motion.div
                  key={`c-${r}-${c}`}
                  whileTap={{ scale: 0.9 }}
                  onPointerDown={() => paintCell(r, c)}
                  style={{
                    width: CELL, height: CELL, borderRadius: 4,
                    background: color || 'rgba(255,255,255,0.04)',
                    border: `1px solid ${color || 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                  }}
                />
              )))}
            </div>
          </div>
        </div>

        {/* Color palette */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PALETTE.map(color => (
            <motion.button
              key={color}
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => setSelectedColor(color)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${color}88`,
                border: `2px solid ${selectedColor === color ? '#fff' : color}`,
                cursor: 'pointer',
                boxShadow: selectedColor === color ? `0 0 10px ${color}66` : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
