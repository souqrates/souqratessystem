import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A ring expands from center. Tap EXACTLY when it matches the thin target ring. The closer to perfect, the more points. Zones shrink every 5 hits. Reach 30 perfect hits to win!';
const DEFAULT_GAME_TIME = 45;
const TARGET = 30;

export default function PulseStrike({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [ringScale, setRingScale] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [lives, setLives] = useState(3);
  const [roundSpeed, setRoundSpeed] = useState(1100);

  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const activeRef = useRef(false);
  const ringRef = useRef(0);
  const dirRef = useRef(1);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const speedRef = useRef(1100);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const animateRing = useCallback(() => {
    if (!activeRef.current) return;
    const now = performance.now();
    const elapsed = (now - startRef.current) / speedRef.current;
    ringRef.current = Math.abs(Math.sin(elapsed * Math.PI));
    setRingScale(ringRef.current);
    rafRef.current = requestAnimationFrame(animateRing);
  }, []);

  const handleTap = useCallback(() => {
    if (!activeRef.current) return;
    const v = ringRef.current;
    const dist = Math.abs(v - 0.9);
    let label, pts, color;
    if (dist < 0.04) { label = '◆ PERFECT'; pts = 3; color = '#00f5a0'; chord([880, 1320, 1760], 0.06, 0.14, 'triangle'); triggerHaptic('success'); }
    else if (dist < 0.1) { label = '✓ GREAT'; pts = 2; color = '#fbbf24'; beep({ freq: 660, dur: 0.07, vol: 0.1 }); triggerHaptic('light'); }  // game-symbol
    else if (dist < 0.18) { label = 'GOOD'; pts = 1; color = '#94a3b8'; beep({ freq: 440, dur: 0.06, vol: 0.08 }); triggerHaptic('light'); }
    else {
      label = '✗ MISS'; pts = 0; color = '#ef4444';  // game-symbol
      beep({ freq: 200, dur: 0.15, type: 'sawtooth', vol: 0.12 });
      triggerHaptic('error');
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      if (livesRef.current <= 0) { endGame(); return; }
    }
    if (pts > 0) {
      scoreRef.current += pts;
      setScore(scoreRef.current);
      const hitsNow = scoreRef.current;
      if (hitsNow % 5 === 0) {
        speedRef.current = Math.max(800, speedRef.current - 150);
        setRoundSpeed(speedRef.current);
      }
    }
    setFeedback({ label, color, id: Date.now() });
    setTimeout(() => setFeedback(null), 500);
  }, [endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3; speedRef.current = 1100;
    setScore(0); setLives(3); setTimeLeft(GAME_TIME); setFeedback(null); setRoundSpeed(1100);
    activeRef.current = true;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animateRing);
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(iv); cancelAnimationFrame(rafRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const targetRad = 88;
  const ringRad = ringScale * targetRad;
  const color = game.color?.includes('cyan') ? '#06b6d4' : '#3b82f6';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="HITS" v={score} c={color} />
        <Hud label="SPEED" v={`${Math.round(1800 / roundSpeed * 100)}%`} c="#94a3b8" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{
          flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 50%, #00101a 0%, #040810 100%)',
          border: `1px solid ${color}22`,
          minHeight: 320,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onPointerDown={handleTap}
      >
        {/* Target ring (static) */}
        <div style={{
          position: 'absolute', width: targetRad * 2, height: targetRad * 2, borderRadius: '50%',
          border: `3px solid ${color}`,
          boxShadow: `0 0 16px ${color}66`,
          pointerEvents: 'none',
        }} />

        {/* Zone band */}
        {[0.04, 0.1, 0.18].map((z, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: (targetRad + z * targetRad) * 2, height: (targetRad + z * targetRad) * 2,
            borderRadius: '50%',
            border: `1px solid ${i === 0 ? '#00f5a0' : i === 1 ? '#fbbf24' : '#94a3b8'}22`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Expanding ring */}
        <motion.div
          style={{
            position: 'absolute',
            width: ringRad * 2, height: ringRad * 2, borderRadius: '50%',
            border: `4px solid ${color}`,
            boxShadow: `0 0 22px ${color}99, 0 0 60px ${color}33`,
            pointerEvents: 'none',
          }}
        />

        {/* Center dot */}
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 16px ${color}` }} />

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.id}
              initial={{ opacity: 1, y: 0, scale: 0.9 }}
              animate={{ opacity: 0, y: -44, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              style={{
                position: 'absolute', top: '28%',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18,
                color: feedback.color, textShadow: `0 0 16px ${feedback.color}`,
                pointerEvents: 'none',
              }}
            >
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'absolute', bottom: 16, fontSize: 11, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.2em', fontFamily: 'Orbitron, sans-serif' }}>
          TAP WHEN RINGS ALIGN
        </div>
      </div>
    </div>
  );
}
