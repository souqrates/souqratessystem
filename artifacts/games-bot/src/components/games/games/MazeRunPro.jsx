import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Navigate the maze to the EXIT. Tap arrow buttons or swipe. Reach exit = +100. Hit a wall = -150. After 400 pts maze grows 7×7 → 11×11. Reach 1000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

function buildMaze(size) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ walls: { T: true, R: true, B: true, L: true }, visited: false })));
  const stack = [];
  const start = { r: 0, c: 0 };
  grid[0][0].visited = true;
  stack.push(start);
  const dirs = [
    { dr: -1, dc: 0, wall: 'T', opp: 'B' },
    { dr: 0, dc: 1, wall: 'R', opp: 'L' },
    { dr: 1, dc: 0, wall: 'B', opp: 'T' },
    { dr: 0, dc: -1, wall: 'L', opp: 'R' },
  ];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const unvisited = dirs.filter(d => {
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      return nr >= 0 && nr < size && nc >= 0 && nc < size && !grid[nr][nc].visited;
    });
    if (unvisited.length === 0) { stack.pop(); continue; }
    const d = unvisited[Math.floor(Math.random() * unvisited.length)];
    const nr = cur.r + d.dr;
    const nc = cur.c + d.dc;
    grid[cur.r][cur.c].walls[d.wall] = false;
    grid[nr][nc].walls[d.opp] = false;
    grid[nr][nc].visited = true;
    stack.push({ r: nr, c: nc });
  }
  return grid;
}

export default function MazeRunPro({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [maze, setMaze] = useState([]);
  const [mazeSize, setMazeSize] = useState(7);
  const [pos, setPos] = useState({ r: 0, c: 0 });
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef({ r: 0, c: 0 });
  const mazeRef = useRef([]);
  const mazeSizeRef = useRef(7);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newMaze = useCallback(() => {
    if (!activeRef.current) return;
    const size = scoreRef.current >= 400 ? 11 : 7;
    mazeSizeRef.current = size;
    setMazeSize(size);
    const m = buildMaze(size);
    mazeRef.current = m;
    setMaze(m);
    posRef.current = { r: 0, c: 0 };
    setPos({ r: 0, c: 0 });
  }, []);

  const move = useCallback((dir) => {
    if (!activeRef.current) return;
    const { r, c } = posRef.current;
    const size = mazeSizeRef.current;
    const cell = mazeRef.current[r]?.[c];
    if (!cell) return;
    if (cell.walls[dir]) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.07, vol: 0.07 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      return;
    }
    const offsets = { T: [-1, 0], R: [0, 1], B: [1, 0], L: [0, -1] };
    const [dr, dc] = offsets[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) return;
    posRef.current = { r: nr, c: nc };
    setPos({ r: nr, c: nc });
    beep({ freq: 350, dur: 0.04, vol: 0.05 });

    if (nr === size - 1 && nc === size - 1) {
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

  const CELL = Math.floor(220 / mazeSize);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#8b5cf6" />
        <Hud label="SIZE" v={`${mazeSize}×${mazeSize}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'EXIT!' : 'WALL!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Maze */}
        <div style={{ position: 'relative', border: '2px solid rgba(139,92,246,0.3)', borderRadius: 4 }}>
          <svg width={mazeSize * CELL} height={mazeSize * CELL}>
            {maze.map((row, r) =>
              row.map((cell, c) => {
                const x = c * CELL;
                const y = r * CELL;
                const isPlayer = pos.r === r && pos.c === c;
                const isExit = r === mazeSize - 1 && c === mazeSize - 1;
                return (
                  <g key={`${r}-${c}`}>
                    {isExit && <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} fill="rgba(16,185,129,0.2)" />}
                    {isPlayer && <circle cx={x + CELL / 2} cy={y + CELL / 2} r={CELL * 0.3} fill="#8b5cf6" />}
                    {cell.walls.T && <line x1={x} y1={y} x2={x + CELL} y2={y} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                    {cell.walls.R && <line x1={x + CELL} y1={y} x2={x + CELL} y2={y + CELL} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                    {cell.walls.B && <line x1={x} y1={y + CELL} x2={x + CELL} y2={y + CELL} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                    {cell.walls.L && <line x1={x} y1={y} x2={x} y2={y + CELL} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px 48px 48px', gridTemplateRows: '48px 48px', gap: 4 }}>
          {[['▲', 'T', 0, 1], ['◀', 'L', 1, 0], ['▼', 'B', 1, 2], ['▶', 'R', 1, 2]].map(([label, dir, gr]) => (
            <motion.button
              key={dir}
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => move(dir)}
              style={{
                gridRow: dir === 'T' ? 1 : 2,
                gridColumn: dir === 'L' ? 1 : dir === 'T' || dir === 'B' ? 2 : 3,
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(139,92,246,0.15)',
                border: '2px solid rgba(139,92,246,0.3)',
                color: '#a78bfa', fontSize: 20, cursor: 'pointer',
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
