import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Shapes fall from the top. Tap the correct SLOT to sort each shape. Right slot = +100, Wrong = -150. After 600 pts, shapes fall twice as fast. Reach 1200 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1200;
const SHAPES = [
  { id: 'circle',   label: '●', color: '#ef4444' },
  { id: 'triangle', label: '▲', color: '#f59e0b' },
  { id: 'square',   label: '■', color: '#3b82f6' },
  { id: 'diamond',  label: '◆', color: '#10b981' },
];

export default function ShapeSort({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [falling, setFalling] = useState(null);
  const [fallingY, setFallingY] = useState(0);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const fallingRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const yRef = useRef(0);
  const streakRef = useRef(0);
  const waitingRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSpeed = () => scoreRef.current >= 600 ? 0.6 : 0.3;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const spawnShape = useCallback(() => {
    if (!activeRef.current || waitingRef.current) return;
    const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    fallingRef.current = s;
    yRef.current = 0;
    setFalling(s);
    setFallingY(0);
  }, []);

  const sortShape = useCallback((slotId) => {
    if (!activeRef.current || !fallingRef.current || waitingRef.current) return;
    waitingRef.current = true;
    const correct = slotId === fallingRef.current.id;
    if (correct) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      beep({ freq: 500 + streakRef.current * 40, dur: 0.08, vol: 0.09 });
      setFlash({ type: 'good', id: Date.now() });
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
    setFalling(null);
    fallingRef.current = null;
    yRef.current = 0;
    setTimeout(() => { waitingRef.current = false; spawnShape(); }, 400);
  }, [endGame, onScoreUpdate, spawnShape, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0; waitingRef.current = false;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME); setFalling(null);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (fallingRef.current && !waitingRef.current) {
        yRef.current = Math.min(1, yRef.current + getSpeed() * dt);
        setFallingY(yRef.current);
        if (yRef.current >= 1) {
          // Missed — auto penalty
          streakRef.current = 0;
          scoreRef.current = Math.max(0, scoreRef.current - 150);
          setScore(scoreRef.current);
          setStreak(0);
          triggerHaptic('error');
          setFlash({ type: 'bad', id: Date.now() });
          setFalling(null);
          fallingRef.current = null;
          yRef.current = 0;
          waitingRef.current = true;
          setTimeout(() => { waitingRef.current = false; spawnShape(); }, 400);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    setTimeout(spawnShape, 500);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="STREAK" v={streak} c={streak >= 3 ? '#f59e0b' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 8, gap: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'SORTED!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Drop zone */}
        <div style={{ flex: 1, position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          {falling && (
            <motion.div
              animate={{ top: `${fallingY * 85}%` }}
              transition={{ duration: 0, ease: 'linear' }}
              style={{
                position: 'absolute', left: '50%', marginLeft: -24,
                fontSize: 40, color: falling.color,
                textShadow: `0 0 20px ${falling.color}88`,
              }}
            >
              {falling.label}
            </motion.div>
          )}
          {!falling && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,0.3)', fontSize: 12 }}>LOADING...</div>}
        </div>

        {/* Slots */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {SHAPES.map(s => (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => sortShape(s.id)}
              style={{
                height: 56, borderRadius: 12,
                background: `${s.color}11`, border: `2px solid ${s.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, cursor: 'pointer',
                boxShadow: falling?.id === s.id ? `0 0 18px ${s.color}44` : 'none',
              }}
            >
              {s.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
