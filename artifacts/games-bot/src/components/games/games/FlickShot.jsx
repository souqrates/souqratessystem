import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = '10 balls total. Swipe UP to shoot! Land in the basket = +100, Swish (perfect arc) = +150, Miss = -150. Wind increases after 400 pts. You need at least 7 baskets from 10 shots to win!';
const TARGET = 1000;
const TOTAL_BALLS = 10;

export default function FlickShot({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [ballsLeft, setBallsLeft] = useState(TOTAL_BALLS);
  const [trajectory, setTrajectory] = useState(null);
  const [wind, setWind] = useState(0);
  const [flash, setFlash] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [result, setResult] = useState(null); // 'basket'|'swish'|'miss'

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const ballsRef = useRef(TOTAL_BALLS);
  const touchStartRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const shoot = useCallback((power, angle) => {
    if (!activeRef.current || shooting || ballsRef.current <= 0) return;
    setShooting(true);
    const windEffect = wind * 0.3;
    const adjustedAngle = angle + windEffect;
    const inBasket = Math.abs(adjustedAngle) < 18 && power > 0.5 && power < 0.95;
    const swish = Math.abs(adjustedAngle) < 8 && power > 0.65 && power < 0.85;

    const pts = swish ? 150 : inBasket ? 100 : -150;
    const type = swish ? 'swish' : inBasket ? 'basket' : 'miss';

    setTrajectory({ angle: adjustedAngle, power });
    setResult(type);

    setTimeout(() => {
      scoreRef.current = Math.max(0, scoreRef.current + pts);
      setScore(scoreRef.current);
      setFlash({ type: type === 'miss' ? 'bad' : 'good', label: swish ? 'SWISH!' : inBasket ? 'BASKET!' : 'MISS!', id: Date.now() });
      triggerHaptic(type === 'miss' ? 'error' : 'medium');
      if (type !== 'miss') chord([520, 700, 880], 0.06, 0.1, 'triangle');
      else noise({ dur: 0.1, vol: 0.1 });
      onScoreUpdate?.(scoreRef.current);

      ballsRef.current--;
      setBallsLeft(ballsRef.current);
      setTrajectory(null);
      setResult(null);
      setShooting(false);

      if (scoreRef.current >= 400) setWind((Math.random() - 0.5) * 30);
      if (ballsRef.current <= 0) { endGame(); }
    }, 800);
  }, [shooting, wind, endGame, onScoreUpdate, TARGET_SCORE]);

  const handlePointerDown = (e) => {
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e) => {
    if (!touchStartRef.current || shooting) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = touchStartRef.current.y - e.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) return;
    const power = Math.min(1, dist / 120);
    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
    shoot(power, angle);
    touchStartRef.current = null;
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; ballsRef.current = TOTAL_BALLS;
    setScore(0); setBallsLeft(TOTAL_BALLS); setWind(0); setShooting(false);
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="BALLS" v={ballsLeft} c={ballsLeft <= 3 ? '#ef4444' : '#94a3b8'} />
        <Hud label="WIND" v={wind === 0 ? 'CALM' : wind > 0 ? `→${Math.abs(wind.toFixed(0))}` : `←${Math.abs(wind.toFixed(0))}`} c="#06b6d4" />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />

      <div
        style={{ flex: 1, position: 'relative', background: 'radial-gradient(ellipse at center, #0a1628 0%, #030810 100%)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(245,158,11,0.15)', cursor: shooting ? 'default' : 'crosshair', userSelect: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <MomentumFlash msg={flash?.label} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Basket */}
        <div style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ width: 60, height: 4, background: '#f59e0b', borderRadius: 2, boxShadow: '0 0 12px #f59e0b88' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 60 }}>
            <div style={{ width: 2, height: 20, background: '#f59e0b88' }} />
            <div style={{ width: 2, height: 20, background: '#f59e0b88' }} />
          </div>
          <p style={{ color: '#f59e0b88', fontSize: 20, margin: 0 }}>🏀</p>
        </div>

        {/* Ball */}
        <AnimatePresence>
          {!shooting && ballsLeft > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'absolute', bottom: '20%', left: '50%', marginLeft: -20, width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #f97316cc, #ea580c)', boxShadow: '0 0 16px #f9731688' }}
            />
          )}
          {trajectory && (
            <motion.div
              key="flying"
              initial={{ bottom: '20%', left: '50%', marginLeft: -20, opacity: 1 }}
              animate={{ bottom: '18%', left: '50%', marginLeft: -20 - trajectory.angle * 2, opacity: [1, 1, 0] }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #f97316cc, #ea580c)', boxShadow: '0 0 16px #f9731688' }}
            />
          )}
        </AnimatePresence>

        {/* Wind indicator */}
        {wind !== 0 && (
          <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 12, color: '#06b6d4', fontFamily: 'Orbitron, sans-serif', fontWeight: 800 }}>
            {wind > 0 ? '→' : '←'} WIND
          </div>
        )}

        <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.12em' }}>
          {shooting ? 'FLYING...' : 'SWIPE UP TO SHOOT'}
        </p>
      </div>
    </div>
  );
}
