import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Watch the path light up on the grid. Then tap the cells in the exact same order! Correct trace = +100. Wrong cell = -150. Grid grows from 5×5 to 7×7 after 400 pts. Accuracy beats speed!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

function buildPath(size, len) {
  const visited = new Set();
  let r = Math.floor(Math.random() * size);
  let c = Math.floor(Math.random() * size);
  const path = [{ r, c }];
  visited.add(`${r},${c}`);
  while (path.length < len) {
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    let moved = false;
    for (const [dr, dc] of shuffled) {
      const nr = r + dr; const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(`${nr},${nc}`)) {
        r = nr; c = nc;
        path.push({ r, c }); visited.add(`${r},${c}`);
        moved = true; break;
      }
    }
    if (!moved) break;
  }
  return path;
}

export default function GridTrace({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [grid, setGrid] = useState(5);
  const [path, setPath] = useState([]);
  const [state, setState] = useState('idle'); // idle|showing|input
  const [showIdx, setShowIdx] = useState(-1);
  const [userPath, setUserPath] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const stateRef = useRef('idle');
  const pathRef = useRef([]);
  const userRef = useRef([]);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getGrid = () => scoreRef.current >= 300 ? 7 : 5;
  const getPathLen = () => 5 + Math.floor(scoreRef.current / 150);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const g = getGrid();
    const len = Math.min(getPathLen(), g * 2);
    const p = buildPath(g, len);
    pathRef.current = p; userRef.current = [];
    setGrid(g); setPath(p); setUserPath([]);
    stateRef.current = 'showing';
    setState('showing');

    let i = 0;
    const show = () => {
      if (!activeRef.current) return;
      if (i < p.length) {
        setShowIdx(i);
        beep({ freq: 300 + i * 40, dur: 0.16, vol: 0.08 });
        setTimeout(() => { i++; show(); }, 320);
      } else {
        setShowIdx(-1);
        stateRef.current = 'input';
        setState('input');
      }
    };
    setTimeout(show, 400);
  }, []);

  const tapCell = useCallback((r, c) => {
    if (!activeRef.current || stateRef.current !== 'input') return;
    const expected = pathRef.current[userRef.current.length];
    if (!expected) return;
    const correct = expected.r === r && expected.c === c;
    const newUser = [...userRef.current, { r, c }];
    userRef.current = newUser;
    setUserPath([...newUser]);

    if (!correct) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      stateRef.current = 'idle';
      setState('idle');
      setTimeout(startRound, 800);
    } else {
      beep({ freq: 400 + newUser.length * 30, dur: 0.07, vol: 0.08 });
      triggerHaptic('light');
      if (newUser.length === pathRef.current.length) {
        scoreRef.current = Math.max(0, scoreRef.current + 100);
        setScore(scoreRef.current);
        setFlash({ type: 'good', id: Date.now() });
        chord([660, 880, 1100], 0.05, 0.09, 'triangle');
        onScoreUpdate?.(scoreRef.current);
        stateRef.current = 'idle';
        setState('idle');
        setTimeout(startRound, 500);
      }
    }
  }, [endGame, onScoreUpdate, startRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; stateRef.current = 'idle'; userRef.current = [];
    setScore(0); setTimeLeft(GAME_TIME); setState('idle');
    activeRef.current = true;
    setTimeout(startRound, 400);

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
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="STEP" v={`${userPath.length}/${path.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 4 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'TRACED!' : 'WRONG PATH!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <p style={{ color: state === 'showing' ? '#f59e0b' : state === 'input' ? '#10b981' : 'rgba(148,163,184,0.5)', fontSize: 10, letterSpacing: '0.18em', fontFamily: 'Orbitron, sans-serif', fontWeight: 800 }}>
          {state === 'showing' ? 'MEMORIZE THE PATH' : state === 'input' ? 'TRACE THE PATH' : 'LOADING...'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${grid}, 1fr)`, gap: 5 }}>
          {Array.from({ length: grid * grid }, (_, idx) => {
            const r = Math.floor(idx / grid);
            const c = idx % grid;
            const pathIdx = path.findIndex(p => p.r === r && p.c === c);
            const isShowing = state === 'showing' && pathIdx >= 0 && pathIdx <= showIdx;
            // No helpers in input phase — players must remember from memory.
            return (
              <motion.button
                key={idx}
                whileTap={state === 'input' ? { scale: 0.88 } : {}}
                onPointerDown={() => tapCell(r, c)}
                style={{
                  width: grid === 5 ? 44 : 35, height: grid === 5 ? 44 : 35,
                  borderRadius: 8,
                  background: isShowing ? '#10b98166' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${isShowing ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isShowing ? '0 0 12px #10b98155' : 'none',
                  cursor: state === 'input' ? 'pointer' : 'default',
                  transition: 'all 0.1s',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
