import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';
import { Circle, ChevronDown } from 'lucide-react';

const RULES = 'Shoot balls from the cannon. Balls with the same number merge and double! +points = merged value × 100. Ball falls off = -150. Reach 2048 pts before 120 seconds. Merge 128 = huge combo!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 2048;
const COLS = 5;
const VALUES = [2, 4, 8, 16, 32];

function makeGrid() {
  return Array(3).fill(null).map(() => Array(COLS).fill(null));
}

export default function CannonMerge({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [grid, setGrid] = useState(makeGrid());
  const [nextVal, setNextVal] = useState(2);
  const [flash, setFlash] = useState(null);
  const [cannonX, setCannonX] = useState(2);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const gridRef = useRef(makeGrid());

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const dropBall = useCallback((col) => {
    if (!activeRef.current) return;
    const g = gridRef.current.map(r => [...r]);
    const val = nextVal;
    let row = -1;
    for (let r = g.length - 1; r >= 0; r--) {
      if (g[r][col] === null) { row = r; break; }
    }

    if (row === -1) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      return;
    }

    g[row][col] = val;
    beep({ freq: 300 + val * 10, dur: 0.1, vol: 0.1 });

    // Merge same values in column
    let merged = true;
    while (merged) {
      merged = false;
      for (let c = 0; c < COLS; c++) {
        for (let r = g.length - 1; r > 0; r--) {
          if (g[r][c] !== null && g[r][c] === g[r-1][c]) {
            const newVal = g[r][c] * 2;
            g[r-1][c] = newVal;
            g[r][c] = null;
            scoreRef.current = Math.max(0, scoreRef.current + newVal * 10);
            setScore(scoreRef.current);
            chord([440 + newVal, 660 + newVal, 880 + newVal], 0.06, 0.1, 'triangle');
            setFlash({ type: 'good', id: Date.now(), val: newVal });
            triggerHaptic('light');
            merged = true;
          }
        }
      }
    }

    // Gravity
    for (let c = 0; c < COLS; c++) {
      const col2 = g.map(r => r[c]).filter(v => v !== null);
      while (col2.length < g.length) col2.unshift(null);
      g.forEach((r, ri) => { r[c] = col2[ri]; });
    }

    gridRef.current = g;
    setGrid(g.map(r => [...r]));
    onScoreUpdate?.(scoreRef.current);

    const next = VALUES[Math.floor(Math.random() * 3)];
    setNextVal(next);

  }, [nextVal, endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    const g = makeGrid();
    gridRef.current = g;
    setScore(0); setTimeLeft(GAME_TIME); setGrid(g); setNextVal(2); setCannonX(2);
    activeRef.current = true;

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 20)} setPhase={setPhase} />;

  const colors = { 2:'#06b6d4',4:'#3b82f6',8:'#8b5cf6',16:'#ec4899',32:'#f59e0b',64:'#ef4444',128:'#10b981',256:'#f97316' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="NEXT" v={nextVal} c={colors[nextVal] || '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: 4 }}>
        <MomentumFlash msg={flash?.type === 'good' ? `MERGE ${flash.val}!` : 'OVERFLOW!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Cannon */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
          {Array.from({ length: COLS }, (_, c) => (
            <motion.button
              key={c}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => { setCannonX(c); dropBall(c); }}
              style={{
                height: 36, borderRadius: 8,
                background: cannonX === c ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${cannonX === c ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}
            >
              {cannonX === c ? <Circle size={14} /> : <ChevronDown size={14} />}
            </motion.button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grid.map((row, r) => (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4, flex: 1 }}>
              {row.map((val, c) => (
                <div key={c} style={{
                  borderRadius: 8,
                  background: val ? `${colors[val] || '#94a3b8'}22` : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${val ? colors[val] || '#94a3b8' : 'rgba(255,255,255,0.05)'}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                  fontSize: val && val >= 64 ? 12 : 15,
                  color: val ? colors[val] || '#94a3b8' : 'transparent',
                  boxShadow: val ? `0 0 10px ${colors[val] || '#94a3b8'}33` : 'none',
                }}>
                  {val || ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
