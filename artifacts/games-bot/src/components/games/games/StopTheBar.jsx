import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A bar bounces back and forth. Tap STOP when it lands in the GOLDEN zone for +100 pts. Miss = -150. The bar gets faster and the golden zone shrinks every 200 points. Reach 800 pts in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 800;
const BASE_SPEED = 1.5;
const BASE_GOLD = 0.18;
const MIN_GOLD = 0.06;

export default function StopTheBar({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pos, setPos] = useState(0);
  const [goldWidth, setGoldWidth] = useState(BASE_GOLD);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(BASE_SPEED);
  const goldRef = useRef(BASE_GOLD);
  const streakRef = useRef(0);
  const rafRef = useRef(null);
  const lastRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const goldStart = () => 0.5 - goldRef.current / 2;
  const goldEnd = () => 0.5 + goldRef.current / 2;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    const p = posRef.current;
    const gs = goldStart();
    const ge = goldEnd();
    const inGold = p >= gs && p <= ge;
    if (inGold) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      chord([700, 1000, 1400], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      const lvl = Math.floor(scoreRef.current / 200);
      speedRef.current = BASE_SPEED + lvl * 0.5;
      goldRef.current = Math.max(MIN_GOLD, BASE_GOLD - lvl * 0.018);
      setGoldWidth(goldRef.current);
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; posRef.current = 0; dirRef.current = 1;
    speedRef.current = BASE_SPEED; goldRef.current = BASE_GOLD; streakRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME); setPos(0); setGoldWidth(BASE_GOLD);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      posRef.current += dirRef.current * speedRef.current * dt;
      if (posRef.current >= 1) { posRef.current = 1; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setPos(posRef.current);
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
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 8)} setPhase={setPhase} />;

  const gs = goldStart();
  const ge = goldEnd();
  const inGold = pos >= gs && pos <= ge;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="STREAK" v={streak} c={streak >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 16 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'GOLDEN!' : 'MISS!'} color={flash?.type === 'good' ? '#f59e0b' : '#ef4444'} trigger={flash?.id} />

        {/* Bar track */}
        <div style={{ position: 'relative', width: '100%', height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {/* Golden zone */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${gs * 100}%`, width: `${goldWidth * 100}%`,
            background: 'rgba(245,158,11,0.3)',
            borderLeft: '2px solid #f59e0b', borderRight: '2px solid #f59e0b',
            boxShadow: 'inset 0 0 12px rgba(245,158,11,0.2)',
          }} />
          {/* Moving indicator */}
          <motion.div
            animate={{ left: `${pos * 100}%` }}
            transition={{ duration: 0, ease: 'linear' }}
            style={{
              position: 'absolute', top: 6, bottom: 6, width: 10, marginLeft: -5,
              borderRadius: 5,
              background: inGold ? '#f59e0b' : '#64748b',
              boxShadow: inGold ? '0 0 20px #f59e0b' : 'none',
            }}
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.88 }}
          onPointerDown={stop}
          style={{
            width: 130, height: 130, borderRadius: '50%',
            background: inGold
              ? 'radial-gradient(circle at 35% 35%, #f59e0b55, #f59e0b22)'
              : 'radial-gradient(circle at 35% 35%, rgba(100,116,139,0.2), rgba(100,116,139,0.08))',
            border: `3px solid ${inGold ? '#f59e0b' : 'rgba(100,116,139,0.4)'}`,
            boxShadow: inGold ? '0 0 40px #f59e0b55' : 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20,
            color: inGold ? '#f59e0b' : '#64748b',
            transition: 'all 0.1s ease',
          }}
        >
          STOP
        </motion.button>
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP IN THE GOLDEN ZONE</p>
      </div>
    </div>
  );
}
