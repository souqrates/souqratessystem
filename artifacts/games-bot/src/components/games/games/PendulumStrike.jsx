import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A pendulum swings left and right. Strike when it reaches MAXIMUM swing for +100 pts. A weak strike = -150 pts. The target zone moves every 300 pts. Chain 3 perfect strikes for bonus! Reach 1500 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1500;

export default function PendulumStrike({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [angle, setAngle] = useState(0);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);
  const [targetSide, setTargetSide] = useState(1);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const angleRef = useRef(0);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const streakRef = useRef(0);
  const targetSideRef = useRef(1);
  const tRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const MAX_ANGLE = 55;
  const SWEET_ZONE = 12;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const strike = useCallback(() => {
    if (!activeRef.current) return;
    const a = Math.abs(angleRef.current);
    const inSweet = a >= MAX_ANGLE - SWEET_ZONE;
    const correctSide = (angleRef.current > 0 && targetSideRef.current > 0) || (angleRef.current < 0 && targetSideRef.current < 0);
    if (inSweet && correctSide) {
      streakRef.current++;
      const pts = streakRef.current >= 3 ? 200 : 100;
      scoreRef.current = Math.max(0, scoreRef.current + pts);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('medium');
      chord([550, 770, 1000], 0.07, 0.12, 'triangle');
      setFlash({ type: 'good', id: Date.now(), pts });
      if (scoreRef.current >= 300 && scoreRef.current % 300 < 100) {
        targetSideRef.current = Math.random() > 0.5 ? 1 : -1;
        setTargetSide(targetSideRef.current);
      }
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.15, vol: 0.15 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0; tRef.current = 0;
    targetSideRef.current = 1; setTargetSide(1);
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME); setAngle(0);
    activeRef.current = true;
    lastRef.current = performance.now();

    const period = 2.2;
    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      tRef.current += dt;
      const lvl = Math.floor(scoreRef.current / 300);
      const speed = 1 + lvl * 0.15;
      const a = Math.sin(tRef.current * speed * (2 * Math.PI / period)) * MAX_ANGLE;
      angleRef.current = a;
      setAngle(a);
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
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 12)} setPhase={setPhase} />;

  const a = Math.abs(angle);
  const inZone = a >= MAX_ANGLE - SWEET_ZONE;
  const correctSide = (angle > 0 && targetSide > 0) || (angle < 0 && targetSide < 0);
  const isPerfect = inZone && correctSide;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ef4444" />
        <Hud label="STREAK" v={streak} c={streak >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', cursor: 'pointer' }}
        onPointerDown={strike}
      >
        <MomentumFlash msg={flash?.type === 'good' ? (flash?.pts === 200 ? 'TRIPLE STRIKE!' : 'PERFECT!') : 'TOO WEAK!'} color={flash?.type === 'good' ? '#f97316' : '#ef4444'} trigger={flash?.id} />

        {/* Pendulum SVG */}
        <svg width="220" height="200" style={{ overflow: 'visible' }}>
          {/* Pivot */}
          <circle cx="110" cy="10" r="6" fill="#475569" />
          {/* Rod */}
          <line
            x1="110" y1="10"
            x2={110 + Math.sin(angle * Math.PI / 180) * 160}
            y2={10 + Math.cos(angle * Math.PI / 180) * 160}
            stroke={isPerfect ? '#f97316' : 'rgba(148,163,184,0.5)'}
            strokeWidth="3"
          />
          {/* Bob */}
          <circle
            cx={110 + Math.sin(angle * Math.PI / 180) * 160}
            cy={10 + Math.cos(angle * Math.PI / 180) * 160}
            r="18"
            fill={isPerfect ? '#f97316' : '#ef4444'}
            style={{ filter: isPerfect ? 'drop-shadow(0 0 12px #f97316)' : 'none' }}
          />
          {/* Sweet zone arc indicators */}
          <text x="110" y="190" textAnchor="middle" fontSize="11" fill={targetSide > 0 ? '#f59e0b' : 'rgba(148,163,184,0.3)'} fontFamily="Orbitron, sans-serif" fontWeight="bold">→ STRIKE HERE</text>
        </svg>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: isPerfect ? '#10b981' : '#475569', boxShadow: isPerfect ? '0 0 12px #10b981' : 'none', transition: 'all 0.1s' }} />
          <p style={{ color: isPerfect ? '#10b981' : 'rgba(148,163,184,0.5)', fontSize: 12, letterSpacing: '0.12em', fontFamily: 'Orbitron, sans-serif', fontWeight: 800 }}>
            {isPerfect ? 'STRIKE NOW!' : 'WAIT...'}
          </p>
        </div>
        <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11 }}>TAP ANYWHERE TO STRIKE</p>
      </div>
    </div>
  );
}
