import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A colored ball falls from the top. Tap the matching color button below! Correct = +100, Wrong = -150. After 400 points, 4 colors appear. Reach the target before time runs out!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1200;
const COLORS_3 = [
  { id: 'red',   label: 'RED',   c: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
  { id: 'green', label: 'GREEN', c: '#10b981', bg: 'rgba(16,185,129,0.18)' },
  { id: 'blue',  label: 'BLUE',  c: '#3b82f6', bg: 'rgba(59,130,246,0.18)' },
];
const COLORS_4 = [
  ...COLORS_3,
  { id: 'yellow', label: 'YELLOW', c: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
];

export default function ColorMatchDrop({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [ballColor, setBallColor] = useState(null);
  const [ballY, setBallY] = useState(0);
  const [flash, setFlash] = useState(null);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const comboRef = useRef(0);
  const ballRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const ballYRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;

  const getColors = () => scoreRef.current >= 400 ? COLORS_4 : COLORS_3;

  const spawnBall = useCallback(() => {
    const cols = getColors();
    const c = cols[Math.floor(Math.random() * cols.length)];
    ballRef.current = c;
    ballYRef.current = 0;
    setBallColor(c);
    setBallY(0);
  }, []);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const guess = useCallback((colorId) => {
    if (!activeRef.current || !ballRef.current) return;
    const correct = ballRef.current.id === colorId;
    if (correct) {
      comboRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      triggerHaptic('light');
      chord([660, 880, 1100], 0.05, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
    } else {
      comboRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setCombo(0);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
    spawnBall();
  }, [endGame, onScoreUpdate, spawnBall, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    lastRef.current = performance.now();
    spawnBall();

    const speed = 0.35;
    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      ballYRef.current = Math.min(1, ballYRef.current + speed * dt);
      setBallY(ballYRef.current);
      if (ballYRef.current >= 1) {
        comboRef.current = 0;
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        setCombo(0);
        noise({ dur: 0.1, vol: 0.1 });
        spawnBall();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

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

  const cols = getColors();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="COMBO" v={combo} c={combo >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 8, position: 'relative' }}>
        <MomentumFlash msg={flash?.type === 'good' ? (combo >= 5 ? 'COMBO!' : 'MATCH!') : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Ball drop area */}
        <div style={{ width: '100%', height: 120, position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {ballColor && (
            <motion.div
              animate={{ top: `${ballY * 85}%` }}
              transition={{ duration: 0, ease: 'linear' }}
              style={{
                position: 'absolute', left: '50%', marginLeft: -28,
                width: 56, height: 56, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${ballColor.c}cc, ${ballColor.c})`,
                boxShadow: `0 0 24px ${ballColor.c}88`,
              }}
            />
          )}
        </div>

        {/* Color buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: 8, width: '100%' }}>
          {cols.map(c => (
            <motion.button
              key={c.id}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => guess(c.id)}
              style={{
                padding: '14px 8px', borderRadius: 14,
                background: c.bg, border: `2px solid ${c.c}66`,
                color: c.c, fontFamily: 'Orbitron, sans-serif',
                fontWeight: 900, fontSize: 10, letterSpacing: '0.12em',
                cursor: 'pointer', boxShadow: `0 0 16px ${c.c}33`,
              }}
            >
              {c.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
