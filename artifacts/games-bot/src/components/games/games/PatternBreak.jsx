import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Shapes flash in a repeating pattern. When the PATTERN BREAKS — tap immediately! Correct = +100, False alarm = -150. Speed increases 5% every 5 correct. Reaction must be < 0.3s after 500 pts!';
const DEFAULT_GAME_TIME = 45;
const TARGET = 1000;
const PATTERNS = [
  ['●','●','●'],
  ['▲','▲','▲'],
  ['■','■','■'],
  ['●','▲','●','▲'],
  ['■','●','■','●'],
  ['▲','■','▲','■'],
];

export default function PatternBreak({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [current, setCurrent] = useState(null);
  const [isBreak, setIsBreak] = useState(false);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);
  const [speed, setSpeed] = useState(700);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const streakRef = useRef(0);
  const speedRef = useRef(700);
  const isBreakRef = useRef(false);
  const patternRef = useRef([]);
  const idxRef = useRef(0);
  const reactionWindowRef = useRef(null);
  const stepTimerRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const SYMBOLS = ['●','▲','■','◆','★'];
  const COLORS = { '●':'#ef4444','▲':'#f59e0b','■':'#3b82f6','◆':'#10b981','★':'#a855f7' };

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(stepTimerRef.current);
    clearTimeout(reactionWindowRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const nextStep = useCallback(() => {
    if (!activeRef.current) return;
    const speed = speedRef.current;
    const pattern = patternRef.current;
    const isB = Math.random() < 0.25 && idxRef.current > 2;
    isBreakRef.current = isB;
    setIsBreak(isB);

    let sym;
    if (isB) {
      sym = SYMBOLS.find(s => !pattern.includes(s)) || SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    } else {
      sym = pattern[idxRef.current % pattern.length];
    }
    idxRef.current++;
    setCurrent(sym);
    beep({ freq: isB ? 800 : 300, dur: 0.08, vol: 0.06 });

    if (isB) {
      reactionWindowRef.current = setTimeout(() => {
        if (!activeRef.current || !isBreakRef.current) return;
        // Missed the break
        streakRef.current = 0;
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        setStreak(0);
        triggerHaptic('error');
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        isBreakRef.current = false;
        setIsBreak(false);
        stepTimerRef.current = setTimeout(nextStep, speed);
      }, Math.max(300, speed * 0.8));
    } else {
      stepTimerRef.current = setTimeout(nextStep, speed);
    }
  }, []);

  const tap = useCallback(() => {
    if (!activeRef.current) return;
    clearTimeout(reactionWindowRef.current);
    if (isBreakRef.current) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      if (streakRef.current % 5 === 0) {
        speedRef.current = Math.max(300, speedRef.current * 0.95);
        setSpeed(speedRef.current);
      }
      isBreakRef.current = false;
      setIsBreak(false);
      stepTimerRef.current = setTimeout(nextStep, speedRef.current);
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
  }, [endGame, onScoreUpdate, nextStep, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0; speedRef.current = 700; idxRef.current = 0;
    isBreakRef.current = false;
    const p = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    patternRef.current = p;
    setScore(0); setStreak(0); setSpeed(700); setTimeLeft(GAME_TIME); setIsBreak(false);
    activeRef.current = true;
    setTimeout(nextStep, 600);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearTimeout(stepTimerRef.current); clearTimeout(reactionWindowRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#a855f7" />
        <Hud label="STREAK" v={streak} c={streak >= 5 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, cursor: 'pointer', padding: 16 }}
        onPointerDown={tap}
      >
        <MomentumFlash msg={flash?.type === 'good' ? 'BREAK CAUGHT!' : 'FALSE TAP!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              fontSize: 88, color: COLORS[current] || '#94a3b8',
              textShadow: isBreak ? `0 0 40px ${COLORS[current] || '#94a3b8'}` : 'none',
              filter: isBreak ? 'brightness(1.5)' : 'none',
            }}
          >
            {current || '●'}
          </motion.div>
        </AnimatePresence>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.18em' }}>TAP WHEN PATTERN BREAKS</p>
      </div>
    </div>
  );
}
