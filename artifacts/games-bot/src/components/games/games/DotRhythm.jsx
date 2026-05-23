import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Dots appear on a grid in rhythm. Tap each dot before it disappears. Perfect timing = +100. Miss/early = -150. More dots appear after 400 pts. Reach 1000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;

const GRID = 3;
const TOTAL = GRID * GRID;

export default function DotRhythm({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [activeDots, setActiveDots] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const dotsRef = useRef([]);
  const nextIdRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getDotLife = () => Math.max(600, 1200 - Math.floor(scoreRef.current / 200) * 100);
  const getInterval = () => Math.max(400, 800 - Math.floor(scoreRef.current / 200) * 60);
  const getCount = () => Math.min(3, 1 + Math.floor(scoreRef.current / 400));

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const tapDot = useCallback((id) => {
    if (!activeRef.current) return;
    const dot = dotsRef.current.find(d => d.id === id);
    if (!dot) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.07, vol: 0.07 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      return;
    }
    dotsRef.current = dotsRef.current.filter(d => d.id !== id);
    setActiveDots([...dotsRef.current]);
    scoreRef.current = Math.max(0, scoreRef.current + 100);
    setScore(scoreRef.current);
    triggerHaptic('light');
    beep({ freq: 500 + id * 30, dur: 0.07, vol: 0.08 });
    setFlash({ type: 'good', id: Date.now() });
    onScoreUpdate?.(scoreRef.current);
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; nextIdRef.current = 0;
    setScore(0); setActiveDots([]); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    dotsRef.current = [];

    const spawnDots = () => {
      if (!activeRef.current) return;
      const count = getCount();
      const available = Array.from({ length: TOTAL }, (_, i) => i).filter(i => !dotsRef.current.some(d => d.cell === i));
      const toSpawn = available.sort(() => Math.random() - 0.5).slice(0, Math.min(count, available.length));
      const now = Date.now();
      const life = getDotLife();
      const newDots = toSpawn.map(cell => ({ id: nextIdRef.current++, cell, born: now, life }));
      dotsRef.current = [...dotsRef.current, ...newDots];
      setActiveDots([...dotsRef.current]);
      newDots.forEach(dot => {
        beep({ freq: 300 + dot.cell * 40, dur: 0.06, vol: 0.05 });
      });

      // Auto-expire
      newDots.forEach(dot => {
        setTimeout(() => {
          if (!activeRef.current) return;
          const stillExists = dotsRef.current.some(d => d.id === dot.id);
          if (stillExists) {
            dotsRef.current = dotsRef.current.filter(d => d.id !== dot.id);
            setActiveDots([...dotsRef.current]);
            scoreRef.current = Math.max(0, scoreRef.current - 150);
            setScore(scoreRef.current);
            setFlash({ type: 'bad', id: Date.now() });
            onScoreUpdate?.(scoreRef.current);
          }
        }, life);
      });

      if (activeRef.current) {
        setTimeout(spawnDots, getInterval());
      }
    };

    setTimeout(spawnDots, 600);

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

  const CELL = 76;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ec4899" />
        <Hud label="DOTS" v={activeDots.length} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'HIT!' : 'MISS!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`, gap: 8 }}>
          {Array.from({ length: TOTAL }, (_, i) => {
            const dot = activeDots.find(d => d.cell === i);
            return (
              <div
                key={i}
                style={{
                  width: CELL, height: CELL,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <AnimatePresence>
                  {dot && (
                    <motion.div
                      key={dot.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      onPointerDown={() => tapDot(dot.id)}
                      style={{
                        width: CELL - 12, height: CELL - 12,
                        borderRadius: '50%',
                        background: `rgba(236,72,153,${0.8})`,
                        boxShadow: '0 0 20px rgba(236,72,153,0.6)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24,
                      }}
                    >
                      ●
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
