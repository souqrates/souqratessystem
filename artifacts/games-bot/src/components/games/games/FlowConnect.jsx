import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Connect matching color dots by drawing a line. Lines cannot cross! Complete all connections = +100. Any crossing = -150. Grid grows 5×5 → 10×10. One mistake ruins the whole puzzle!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 1000;
const COLORS = ['#ef4444','#10b981','#3b82f6','#f59e0b'];

function genPuzzle(size, pairs) {
  const dots = [];
  const used = new Set();
  for (let i = 0; i < pairs; i++) {
    let a, b;
    do { a = `${Math.floor(Math.random()*size)},${Math.floor(Math.random()*size)}`; } while (used.has(a));
    do { b = `${Math.floor(Math.random()*size)},${Math.floor(Math.random()*size)}`; } while (used.has(b) || b === a);
    used.add(a); used.add(b);
    const [ar, ac] = a.split(',').map(Number);
    const [br, bc] = b.split(',').map(Number);
    dots.push({ color: COLORS[i], a: { r: ar, c: ac }, b: { r: br, c: bc } });
  }
  return dots;
}

export default function FlowConnect({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [gridSize, setGridSize] = useState(5);
  const [dots, setDots] = useState([]);
  const [paths, setPaths] = useState({});
  const [drawing, setDrawing] = useState(null);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSize = () => scoreRef.current >= 500 ? 7 : 5;
  const getPairs = () => Math.min(4, 2 + Math.floor(scoreRef.current / 300));

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPuzzle = useCallback(() => {
    if (!activeRef.current) return;
    const size = getSize();
    const pairs = getPairs();
    const d = genPuzzle(size, pairs);
    setGridSize(size);
    setDots(d);
    setPaths({});
    setDrawing(null);
  }, []);

  const checkComplete = useCallback((newPaths, d) => {
    const complete = d.every(dot => {
      const p = newPaths[dot.color];
      if (!p || p.length < 2) return false;
      const start = p[0]; const end = p[p.length - 1];
      return ((start.r === dot.a.r && start.c === dot.a.c && end.r === dot.b.r && end.c === dot.b.c) ||
              (start.r === dot.b.r && start.c === dot.b.c && end.r === dot.a.r && end.c === dot.a.c));
    });
    if (complete) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newPuzzle, 600);
    }
  }, [endGame, onScoreUpdate, newPuzzle, TARGET_SCORE]);

  const tapCell = useCallback((r, c) => {
    if (!activeRef.current) return;
    const dot = dots.find(d => (d.a.r === r && d.a.c === c) || (d.b.r === r && d.b.c === c));
    if (dot) {
      setDrawing({ color: dot.color, path: [{ r, c }] });
      beep({ freq: 400, dur: 0.06, vol: 0.07 });
    }
  }, [dots]);

  const moveCell = useCallback((r, c) => {
    if (!drawing) return;
    const last = drawing.path[drawing.path.length - 1];
    if (last.r === r && last.c === c) return;

    // Check adjacency
    if (Math.abs(last.r - r) + Math.abs(last.c - c) !== 1) return;

    // Check if cell occupied by other path
    for (const [col, p] of Object.entries(paths)) {
      if (col !== drawing.color && p.some(cell => cell.r === r && cell.c === c)) {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.08, vol: 0.08 });
        setFlash({ type: 'bad', id: Date.now() });
        setDrawing(null);
        return;
      }
    }

    const newPath = [...drawing.path, { r, c }];
    const newDraw = { ...drawing, path: newPath };
    setDrawing(newDraw);

    // Check if reached endpoint
    const dot = dots.find(d => d.color === drawing.color);
    if (dot) {
      const endA = (r === dot.a.r && c === dot.a.c);
      const endB = (r === dot.b.r && c === dot.b.c);
      if (endA || endB) {
        const newPaths = { ...paths, [drawing.color]: newPath };
        setPaths(newPaths);
        setDrawing(null);
        checkComplete(newPaths, dots);
      }
    }
  }, [drawing, paths, dots, checkComplete]);

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

  const cellSize = gridSize === 5 ? 46 : 36;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="GRID" v={`${gridSize}×${gridSize}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 4 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'CONNECTED!' : 'CROSSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`, gap: 3 }}
          onPointerMove={(e) => {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el?.dataset?.r !== undefined) moveCell(Number(el.dataset.r), Number(el.dataset.c));
          }}
          onPointerUp={() => setDrawing(null)}
        >
          {Array.from({ length: gridSize * gridSize }, (_, idx) => {
            const r = Math.floor(idx / gridSize);
            const c = idx % gridSize;
            const dot = dots.find(d => (d.a.r === r && d.a.c === c) || (d.b.r === r && d.b.c === c));
            const pathEntry = Object.entries(paths).find(([, p]) => p.some(cell => cell.r === r && cell.c === c));
            const drawCell = drawing?.path.some(cell => cell.r === r && cell.c === c);
            const pathColor = drawCell ? drawing.color : pathEntry?.[0];
            return (
              <div
                key={idx}
                data-r={r} data-c={c}
                onPointerDown={() => tapCell(r, c)}
                style={{
                  width: cellSize, height: cellSize, borderRadius: 6,
                  background: pathColor ? `${pathColor}33` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${pathColor || 'rgba(255,255,255,0.07)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {dot && <div style={{ width: cellSize * 0.55, height: cellSize * 0.55, borderRadius: '50%', background: dot.color, boxShadow: `0 0 10px ${dot.color}88` }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
