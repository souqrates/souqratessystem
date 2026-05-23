import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap the beat circle exactly when it hits the ring. Perfect timing (±50ms) = +150. Good timing (±150ms) = +100. Miss = -150. BPM increases every 200 pts. Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;
const BASE_BPM = 80;

export default function BeatTap({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pulse, setPulse] = useState(0);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bpm, setBpm] = useState(BASE_BPM);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const streakRef = useRef(0);
  const lastBeatRef = useRef(0);
  const bpmRef = useRef(BASE_BPM);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const tap = useCallback(() => {
    if (!activeRef.current) return;
    const now = performance.now();
    const beatInterval = 60000 / bpmRef.current;
    const elapsed = now - startRef.current;
    const phase_in_beat = elapsed % beatInterval;
    const distToCenter = Math.abs(phase_in_beat - beatInterval / 2);
    const tolerance = beatInterval * 0.5;

    if (distToCenter > tolerance * 0.9) {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.08, vol: 0.08 });
      setFlash({ type: 'bad', id: Date.now() });
    } else if (distToCenter < tolerance * 0.3) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 150);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.08, 'triangle');
      setFlash({ type: 'perfect', id: Date.now() });
    } else {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      beep({ freq: 500, dur: 0.07, vol: 0.08 });
      setFlash({ type: 'good', id: Date.now() });
    }
    bpmRef.current = BASE_BPM + Math.floor(scoreRef.current / 200) * 8;
    setBpm(bpmRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0; bpmRef.current = BASE_BPM;
    setScore(0); setStreak(0); setBpm(BASE_BPM); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    startRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const beatInterval = 60000 / bpmRef.current;
      const elapsed = (now - startRef.current) % beatInterval;
      const t = elapsed / beatInterval;
      setPulse(t);
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

  // pulse goes 0→1, center hit at 0.5
  const scale = 1 + Math.abs(pulse - 0.5) * 1.2;
  const opacity = 1 - Math.abs(pulse - 0.5) * 1.4;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f97316" />
        <Hud label="STREAK" v={streak} c={streak >= 5 ? '#f59e0b' : '#94a3b8'} />
        <Hud label="BPM" v={bpm} c="#94a3b8" />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'pointer', padding: 16 }}
        onPointerDown={tap}
      >
        <MomentumFlash
          msg={flash?.type === 'perfect' ? 'PERFECT!' : flash?.type === 'good' ? 'GOOD!' : 'MISS!'}
          color={flash?.type === 'perfect' ? '#f59e0b' : flash?.type === 'good' ? '#10b981' : '#ef4444'}
          trigger={flash?.id}
        />

        <div style={{ position: 'relative', width: 180, height: 180 }}>
          {/* Static ring */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '3px solid rgba(249,115,22,0.4)',
            boxShadow: '0 0 20px rgba(249,115,22,0.2)',
          }} />

          {/* Pulsing indicator */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: `3px solid rgba(249,115,22,${Math.max(0, opacity)})`,
            transform: `scale(${scale})`,
            transition: 'none',
          }} />

          {/* Center dot */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 60, height: 60,
            borderRadius: '50%',
            background: `rgba(249,115,22,${0.3 + Math.max(0, 0.7 - Math.abs(pulse - 0.5) * 2)})`,
            boxShadow: `0 0 ${20 + Math.max(0, 30 - Math.abs(pulse - 0.5) * 100)}px rgba(249,115,22,0.6)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            🥁
          </div>
        </div>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.18em' }}>TAP ON THE BEAT</p>
      </div>
    </div>
  );
}
