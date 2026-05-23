import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tilt the ball through the maze by tapping arrows. Reach the gold star = +100. Fall in a hole = -150. Maze complexity grows every 200 pts. Reach 1000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

const CELL = 44;
const GRID = 7;

function buildMazeWithHoles(size, holes) {
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ walls: { T: true, R: true, B: true, L: true }, hole: false, visited: false }))
  );
  // Recursive backtracker
  const stack = [{ r: 0, c: 0 }];
  grid[0][0].visited = true;
  const dirs = [
    { dr: -1, dc: 0, wall: 'T', opp: 'B' },
    { dr: 0, dc: 1, wall: 'R', opp: 'L' },
    { dr: 1, dc: 0, wall: 'B', opp: 'T' },
    { dr: 0, dc: -1, wall: 'L', opp: 'R' },
  ];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const neighbors = dirs.filter(d => {
      const nr = cur.r + d.dr; const nc = cur.c + d.dc;
      return nr >= 0 && nr < size && nc >= 0 && nc < size && !grid[nr][nc].visited;
    });
    if (!neighbors.length) { stack.pop(); continue; }
    const d = neighbors[Math.floor(Math.random() * neighbors.length)];
    const nr = cur.r + d.dr; const nc = cur.c + d.dc;
    grid[cur.r][cur.c].walls[d.wall] = false;
    grid[nr][nc].walls[d.opp] = false;
    grid[nr][nc].visited = true;
    stack.push({ r: nr, c: nc });
  }
  // Add holes
  let placed = 0;
  const attempts = holes * 10;
  for (let i = 0; i < attempts && placed < holes; i++) {
    const r = 1 + Math.floor(Math.random() * (size - 2));
    const c = 1 + Math.floor(Math.random() * (size - 2));
    if (!grid[r][c].hole && !(r === 0 && c === 0) && !(r === size - 1 && c === size - 1)) {
      grid[r][c].hole = true;
      placed++;
    }
  }
  return grid;
}

export default function MazeBalance({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [maze, setMaze] = useState([]);
  const [pos, setPos] = useState({ r: 0, c: 0 });
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef({ r: 0, c: 0 });
  const mazeRef = useRef([]);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getHoles = () => 2 + Math.floor(scoreRef.current / 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newMaze = useCallback(() => {
    if (!activeRef.current) return;
    const m = buildMazeWithHoles(GRID, getHoles());
    mazeRef.current = m;
    setMaze(m);
    posRef.current = { r: 0, c: 0 };
    setPos({ r: 0, c: 0 });
  }, []);

  const move = useCallback((dir) => {
    if (!activeRef.current) return;
    const { r, c } = posRef.current;
    const cell = mazeRef.current[r]?.[c];
    if (!cell || cell.walls[dir]) return;
    const offsets = { T: [-1, 0], R: [0, 1], B: [1, 0], L: [0, -1] };
    const [dr, dc] = offsets[dir];
    const nr = r + dr; const nc = c + dc;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return;

    posRef.current = { r: nr, c: nc };
    setPos({ r: nr, c: nc });
    beep({ freq: 350, dur: 0.04, vol: 0.05 });

    const target = mazeRef.current[nr][nc];
    if (target.hole) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.08, vol: 0.08 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      posRef.current = { r: 0, c: 0 };
      setPos({ r: 0, c: 0 });
      return;
    }
    if (nr === GRID - 1 && nc === GRID - 1) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newMaze, 600);
    }
  }, [endGame, onScoreUpdate, newMaze, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newMaze();

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f97316" />
        <Hud label="HOLES" v={getHoles()} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 6 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'GOAL!' : 'FELL IN!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ position: 'relative' }}>
          <svg width={GRID * CELL} height={GRID * CELL}>
            {maze.map((row, r) =>
              row.map((cell, c) => {
                const x = c * CELL; const y = r * CELL;
                const isGoal = r === GRID - 1 && c === GRID - 1;
                return (
                  <g key={`${r}-${c}`}>
                    {cell.hole && <rect x={x + 4} y={y + 4} width={CELL - 8} height={CELL - 8} fill="rgba(239,68,68,0.3)" rx={4} />}
                    {isGoal && <rect x={x + 4} y={y + 4} width={CELL - 8} height={CELL - 8} fill="rgba(251,191,36,0.25)" rx={4} />}
                    {isGoal && <text x={x + CELL / 2} y={y + CELL / 2 + 6} textAnchor="middle" fontSize={20}>⭐</text>}
                    {cell.walls.T && <line x1={x} y1={y} x2={x + CELL} y2={y} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                    {cell.walls.R && <line x1={x + CELL} y1={y} x2={x + CELL} y2={y + CELL} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                    {cell.walls.B && <line x1={x} y1={y + CELL} x2={x + CELL} y2={y + CELL} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                    {cell.walls.L && <line x1={x} y1={y} x2={x} y2={y + CELL} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                  </g>
                );
              })
            )}
            {/* Player */}
            <circle
              cx={pos.c * CELL + CELL / 2}
              cy={pos.r * CELL + CELL / 2}
              r={CELL * 0.3}
              fill="#f97316"
              style={{ filter: 'drop-shadow(0 0 6px #f9731666)' }}
            />
          </svg>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '48px 48px 48px', gridTemplateRows: '48px 48px', gap: 4 }}>
          {[['▲', 'T', 1, 2], ['◀', 'L', 2, 1], ['▼', 'B', 2, 2], ['▶', 'R', 2, 3]].map(([label, dir, row, col]) => (
            <motion.button
              key={dir}
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => move(dir)}
              style={{
                gridRow: row, gridColumn: col,
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(249,115,22,0.12)',
                border: '2px solid rgba(249,115,22,0.3)',
                color: '#fb923c', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
