import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap the color shown at the top! Correct = +100, Wrong = -150 AND lose 1 second. After 600 pts, 6 colors appear. Speed + zero mistakes = the winning formula! Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;
const COLS_3 = ['#ef4444','#10b981','#3b82f6'];
const COLS_6 = ['#ef4444','#10b981','#3b82f6','#f59e0b','#a855f7','#06b6d4'];
const LABELS_3 = ['RED','GREEN','BLUE'];
const LABELS_6 = ['RED','GREEN','BLUE','GOLD','VIOLET','CYAN'];

export default function TapColorRushPro({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [target, setTarget] = useState(0);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const timeRef = useRef(GAME_TIME);
  const streakRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getColors = () => scoreRef.current >= 600 ? COLS_6 : COLS_3;
  const getLabels = () => scoreRef.current >= 600 ? LABELS_6 : LABELS_3;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const nextTarget = useCallback(() => {
    const cols = getColors();
    setTarget(Math.floor(Math.random() * cols.length));
  }, []);

  const tap = useCallback((idx) => {
    if (!activeRef.current) return;
    if (idx === target) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      beep({ freq: 500 + idx * 60, dur: 0.06, vol: 0.09 });
      setFlash({ type: 'good', id: Date.now() });
      nextTarget();
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      timeRef.current = Math.max(1, timeRef.current - 1);
      setScore(scoreRef.current);
      setStreak(0);
      setTimeLeft(timeRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
      nextTarget();
    }
    onScoreUpdate?.(scoreRef.current);
  }, [target, endGame, onScoreUpdate, nextTarget, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0; timeRef.current = GAME_TIME;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    nextTarget();

    const iv = setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - 1);
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) { clearInterval(iv); endGame(); }
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const cols = getColors();
  const labels = getLabels();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ec4899" />
        <Hud label="STREAK" v={streak} c={streak >= 5 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'YES!' : '-1s!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Target color indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 10, letterSpacing: '0.2em', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>TAP THIS COLOR</p>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: cols[target],
            boxShadow: `0 0 40px ${cols[target]}88`,
            border: `3px solid ${cols[target]}`,
          }} />
        </div>

        {/* Color buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length <= 3 ? 3 : 3}, 1fr)`, gap: 8, width: '100%' }}>
          {cols.map((c, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => tap(i)}
              style={{
                height: 60, borderRadius: 14,
                background: `${c}22`, border: `2px solid ${c}66`,
                boxShadow: `0 0 14px ${c}22`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
