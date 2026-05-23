import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A star hangs on ropes above a basket. Tap the correct rope(s) to cut them and drop the star into the basket. Basket = +100, Miss = -150. More ropes and trickier puzzles every 100 pts. Reach 1000!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;

function genPuzzle(level) {
  const ropeCount = Math.min(2 + level, 5);
  const starRope = Math.floor(Math.random() * ropeCount);
  return { ropeCount, starRope };
}

export default function RopeSlice({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [puzzle, setPuzzle] = useState(null);
  const [cut, setCut] = useState([]);
  const [flash, setFlash] = useState(null);
  const [animating, setAnimating] = useState(false);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getLevel = () => Math.floor(scoreRef.current / 100);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPuzzle = useCallback(() => {
    if (!activeRef.current) return;
    const p = genPuzzle(getLevel());
    setPuzzle(p);
    setCut([]);
    setAnimating(false);
  }, []);

  const cutRope = useCallback((idx) => {
    if (!activeRef.current || animating || !puzzle) return;
    const newCut = [...cut, idx];
    setCut(newCut);
    beep({ freq: 300 + idx * 60, dur: 0.08, vol: 0.1 });

    // Check if star rope is cut
    if (newCut.includes(puzzle.starRope)) {
      // All other ropes should also be cut for "basket"
      const allCut = puzzle.ropeCount <= 1 || newCut.length >= puzzle.ropeCount;
      setAnimating(true);
      setTimeout(() => {
        if (allCut) {
          scoreRef.current = Math.max(0, scoreRef.current + 100);
          setScore(scoreRef.current);
          triggerHaptic('light');
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
        setTimeout(newPuzzle, 500);
      }, 400);
    } else if (newCut.length >= puzzle.ropeCount) {
      // Cut all wrong ropes
      setAnimating(true);
      setTimeout(() => {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.1, vol: 0.1 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setTimeout(newPuzzle, 500);
      }, 400);
    }
  }, [animating, puzzle, cut, endGame, onScoreUpdate, newPuzzle, TARGET_SCORE]);

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
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="LEVEL" v={getLevel() + 1} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8, position: 'relative' }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'IN THE BASKET!' : 'MISSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {puzzle && (
          <svg width="260" height="200" style={{ overflow: 'visible' }}>
            {/* Basket */}
            <path d="M80,185 Q130,195 180,185 L175,165 Q130,175 85,165 Z" fill="rgba(245,158,11,0.3)" stroke="#f59e0b" strokeWidth="2" />

            {/* Star */}
            <text x="130" y="50" textAnchor="middle" fontSize="32" style={{ userSelect: 'none' }}>⭐</text>

            {/* Ropes */}
            {Array.from({ length: puzzle.ropeCount }, (_, i) => {
              const x = 80 + (i * 100 / Math.max(1, puzzle.ropeCount - 1));
              const isCut = cut.includes(i);
              const isStar = i === puzzle.starRope;
              return (
                <g key={i} onClick={() => cutRope(i)} style={{ cursor: 'pointer' }}>
                  {!isCut && (
                    <line x1="130" y1="55" x2={x} y2="165" stroke={isStar ? '#10b981' : '#f59e0b'} strokeWidth="3" strokeDasharray={isStar ? '6,3' : 'none'} />
                  )}
                  {isCut && (
                    <>
                      <line x1="130" y1="55" x2={x} y2="100" stroke="#ef444488" strokeWidth="3" strokeDasharray="4,4" />
                      <line x1={x} y1="100" x2={x} y2="165" stroke="#ef444488" strokeWidth="3" strokeDasharray="4,4" />
                      <text x={x} y="108" textAnchor="middle" fontSize="14">✂️</text>
                    </>
                  )}
                  {!isCut && (
                    <circle cx={x} cy="90" r="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                  )}
                </g>
              );
            })}
          </svg>
        )}

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.12em' }}>TAP ROPE TO CUT</p>
      </div>
    </div>
  );
}
