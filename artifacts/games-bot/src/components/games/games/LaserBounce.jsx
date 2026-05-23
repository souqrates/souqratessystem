import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Place mirrors to guide the laser beam to the TARGET. Correct = +100, Laser hits wall without target = -150. Fewer mirrors available as score grows. Reach 800 pts in 120 seconds!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 800;
const GRID = 6;

function genPuzzle(level) {
  const mirrors = Math.max(1, 3 - Math.floor(level / 2));
  // Simple puzzle: laser from left, target on right
  const targetRow = Math.floor(Math.random() * GRID);
  const mirrorRow = Math.floor(Math.random() * GRID);
  const mirrorCol = 2 + Math.floor(Math.random() * 2);
  return { targetRow, mirrorRow, mirrorCol, mirrors, answer: mirrorRow === targetRow ? 'straight' : 'bounce' };
}

export default function LaserBounce({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [puzzle, setPuzzle] = useState(null);
  const [placed, setPlaced] = useState([]);
  const [flash, setFlash] = useState(null);
  const [laserPath, setLaserPath] = useState([]);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getLevel = () => Math.floor(scoreRef.current / 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPuzzle = useCallback(() => {
    if (!activeRef.current) return;
    const p = genPuzzle(getLevel());
    setPuzzle(p);
    setPlaced([]);
    setLaserPath([]);
  }, []);

  const traceLaser = useCallback((mirrors) => {
    if (!puzzle) return false;
    let row = puzzle.mirrorRow; let dir = 'right';
    const path = [{ row, col: 0 }];
    for (let col = 1; col < GRID; col++) {
      const m = mirrors.find(m => m.row === row && m.col === col);
      if (m) { dir = m.type === '/' ? (dir === 'right' ? 'up' : 'right') : (dir === 'right' ? 'down' : 'right'); }
      if (dir === 'up') { row--; if (row < 0) break; }
      if (dir === 'down') { row++; if (row >= GRID) break; }
      path.push({ row, col });
      if (col === GRID - 1 && row === puzzle.targetRow) return { hit: true, path };
    }
    return { hit: false, path };
  }, [puzzle]);

  const placeMirror = useCallback((row, col, type) => {
    if (!activeRef.current || !puzzle) return;
    const newPlaced = placed.filter(m => !(m.row === row && m.col === col));
    newPlaced.push({ row, col, type });
    setPlaced(newPlaced);

    const { hit, path } = traceLaser(newPlaced);
    setLaserPath(path);

    if (newPlaced.length >= puzzle.mirrors) {
      setTimeout(() => {
        if (hit) {
          scoreRef.current = Math.max(0, scoreRef.current + 100);
          setScore(scoreRef.current);
          triggerHaptic('medium');
          chord([660, 880, 1100], 0.06, 0.1, 'triangle');
          setFlash({ type: 'good', id: Date.now() });
        } else {
          scoreRef.current = Math.max(0, scoreRef.current - 150);
          setScore(scoreRef.current);
          triggerHaptic('error');
          noise({ dur: 0.1, vol: 0.1 });
          setFlash({ type: 'bad', id: Date.now() });
        }
        onScoreUpdate?.(scoreRef.current);
        setTimeout(newPuzzle, 700);
      }, 500);
    } else {
      beep({ freq: 400 + col * 40, dur: 0.08, vol: 0.08 });
    }
  }, [placed, puzzle, traceLaser, endGame, onScoreUpdate, newPuzzle, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    setTimeout(newPuzzle, 400);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 8)} setPhase={setPhase} />;

  const cellSize = 42;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ef4444" />
        <Hud label="MIRRORS" v={puzzle ? `${placed.length}/${puzzle.mirrors}` : '-'} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'TARGET HIT!' : 'MISSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {puzzle && (
          <div style={{ position: 'relative' }}>
            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, ${cellSize}px)`, gap: 3 }}>
              {Array.from({ length: GRID * GRID }, (_, idx) => {
                const r = Math.floor(idx / GRID);
                const c = idx % GRID;
                const isTarget = c === GRID - 1 && r === puzzle.targetRow;
                const isSource = c === 0 && r === puzzle.mirrorRow;
                const mirror = placed.find(m => m.row === r && m.col === c);
                const inPath = laserPath.some(p => p.row === r && p.col === c);
                const editable = c > 0 && c < GRID - 1;
                return (
                  <motion.div
                    key={idx}
                    whileTap={editable ? { scale: 0.9 } : {}}
                    onPointerDown={() => editable && placeMirror(r, c, mirror?.type === '/' ? '\\' : '/')}
                    style={{
                      width: cellSize, height: cellSize, borderRadius: 6,
                      background: isTarget ? 'rgba(16,185,129,0.2)' : isSource ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${isTarget ? '#10b981' : isSource ? '#ef4444' : inPath ? '#ef444444' : 'rgba(255,255,255,0.07)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, cursor: editable ? 'pointer' : 'default',
                      boxShadow: inPath ? '0 0 8px #ef444433' : 'none',
                    }}
                  >
                    {isSource ? '💥' : isTarget ? '🎯' : mirror ? (mirror.type === '/' ? '/' : '\\') : ''}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, letterSpacing: '0.14em', textAlign: 'center' }}>
          TAP CELL TO PLACE MIRROR · TAP AGAIN TO ROTATE · PLACE {puzzle?.mirrors} MIRRORS
        </p>
      </div>
    </div>
  );
}
