import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Keep the balance beam perfectly level by tapping LEFT or RIGHT side to add weight. Stay within ±5° for 3 seconds = +100. Tip beyond ±20° = -150 and reset. Reach 2000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 2000;

const BEAM_W = 220;
const BEAM_H = 10;
const MAX_ANGLE = 25;
const WIN_ANGLE = 5;
const WIN_HOLD = 3000;

export default function ZenBalance({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [angle, setAngle] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const angleRef = useRef(0);
  const angVelRef = useRef(0);
  const leftWeightRef = useRef(0);
  const rightWeightRef = useRef(0);
  const holdStartRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getDrift = () => 0.3 + Math.floor(scoreRef.current / 400) * 0.1;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const addWeight = useCallback((side) => {
    if (!activeRef.current) return;
    if (side === 'left') { leftWeightRef.current += 1; }
    else { rightWeightRef.current += 1; }
    beep({ freq: 350, dur: 0.05, vol: 0.06 });
    triggerHaptic('light');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    angleRef.current = (Math.random() - 0.5) * 10;
    angVelRef.current = 0;
    leftWeightRef.current = 0; rightWeightRef.current = 0;
    holdStartRef.current = null;
    setScore(0); setAngle(0); setHoldProgress(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      const netForce = (rightWeightRef.current - leftWeightRef.current) * 2;
      const drift = getDrift() * Math.sin(now / 3000);
      const torque = netForce + drift - angleRef.current * 2;
      angVelRef.current += torque * dt;
      angVelRef.current *= 0.96;
      angleRef.current += angVelRef.current;
      angleRef.current = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angleRef.current));
      setAngle(angleRef.current);

      // Decay weights slowly
      leftWeightRef.current = Math.max(0, leftWeightRef.current - 0.4 * dt);
      rightWeightRef.current = Math.max(0, rightWeightRef.current - 0.4 * dt);

      const inBalance = Math.abs(angleRef.current) < WIN_ANGLE;
      if (inBalance) {
        if (!holdStartRef.current) holdStartRef.current = now;
        const held = now - holdStartRef.current;
        setHoldProgress(Math.min(1, held / WIN_HOLD));
        if (held >= WIN_HOLD) {
          holdStartRef.current = null;
          scoreRef.current = Math.max(0, scoreRef.current + 100);
          setScore(scoreRef.current);
          triggerHaptic('medium');
          chord([660, 880], 0.05, 0.09, 'triangle');
          setFlash({ type: 'good', id: Date.now() });
          onScoreUpdate?.(scoreRef.current);
          // Destabilize slightly
          angVelRef.current = (Math.random() - 0.5) * 3;
        }
      } else {
        holdStartRef.current = null;
        setHoldProgress(0);
        if (Math.abs(angleRef.current) >= MAX_ANGLE) {
          scoreRef.current = Math.max(0, scoreRef.current - 150);
          setScore(scoreRef.current);
          triggerHaptic('error');
          noise({ dur: 0.09, vol: 0.09 });
          setFlash({ type: 'bad', id: Date.now() });
          onScoreUpdate?.(scoreRef.current);
          angleRef.current = (Math.random() - 0.5) * 8;
          angVelRef.current = 0;
          leftWeightRef.current = 0; rightWeightRef.current = 0;
        }
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

  const isBalance = Math.abs(angle) < WIN_ANGLE;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="ANGLE" v={`${angle.toFixed(1)}°`} c={isBalance ? '#10b981' : Math.abs(angle) > 15 ? '#ef4444' : '#f59e0b'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'BALANCED!' : 'TIPPED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Hold progress ring */}
        {holdProgress > 0 && (
          <div style={{ color: '#10b981', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em' }}>
            HOLD... {Math.round(holdProgress * 100)}%
          </div>
        )}

        {/* Balance beam */}
        <div style={{ position: 'relative', width: BEAM_W + 40, height: 120 }}>
          {/* Pivot */}
          <div style={{ position: 'absolute', left: '50%', top: 50, transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '20px solid rgba(148,163,184,0.4)' }} />

          {/* Beam */}
          <div style={{
            position: 'absolute', left: 20, top: 40,
            width: BEAM_W, height: BEAM_H,
            background: isBalance ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.2)',
            border: `2px solid ${isBalance ? '#10b981' : 'rgba(148,163,184,0.4)'}`,
            borderRadius: 4,
            transformOrigin: `${BEAM_W / 2}px ${BEAM_H / 2}px`,
            transform: `rotate(${angle}deg)`,
            transition: 'border-color 0.2s',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {[['ADD LEFT ◀', 'left', '#3b82f6'], ['▶ ADD RIGHT', 'right', '#ef4444']].map(([label, side, color]) => (
            <motion.button
              key={side}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => addWeight(side)}
              style={{
                width: 110, height: 52, borderRadius: 14,
                background: `${color}15`,
                border: `2px solid ${color}44`,
                color, fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 10,
                letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
