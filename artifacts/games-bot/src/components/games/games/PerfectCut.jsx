import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A bar sweeps back and forth. Tap STOP when it lands in the green zone for +100 pts. Miss the zone = -150 pts. The bar speeds up every 200 points. Reach the target score before time runs out!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;
const BASE_SPEED = 1.8;
const GREEN_WIDTH = 0.22;

export default function PerfectCut({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState(null);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(BASE_SPEED);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const comboRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const greenStart = 0.5 - GREEN_WIDTH / 2;
  const greenEnd = 0.5 + GREEN_WIDTH / 2;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const tap = useCallback(() => {
    if (!activeRef.current) return;
    const p = posRef.current;
    const inGreen = p >= greenStart && p <= greenEnd;
    if (inGreen) {
      comboRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      triggerHaptic('light');
      chord([660, 880], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      const lvl = Math.floor(scoreRef.current / 200);
      speedRef.current = BASE_SPEED + lvl * 0.4;
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
  }, [endGame, onScoreUpdate, greenStart, greenEnd, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; posRef.current = 0; dirRef.current = 1;
    speedRef.current = BASE_SPEED; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setPos(0);
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
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const greenPct = GREEN_WIDTH * 100;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="COMBO" v={combo} c={combo >= 3 ? '#f59e0b' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 16 }}>
        <MomentumFlash msg={flash?.type === 'good' ? (combo >= 3 ? 'ON FIRE!' : 'PERFECT!') : 'MISS!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Bar track */}
        <div style={{ position: 'relative', width: '100%', height: 56, borderRadius: 28, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {/* Green zone */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${greenStart * 100}%`, width: `${greenPct}%`,
            background: 'rgba(16,185,129,0.25)', borderLeft: '2px solid #10b981', borderRight: '2px solid #10b981',
          }} />
          {/* Center marker */}
          <div style={{ position: 'absolute', top: 8, bottom: 8, left: '50%', width: 2, background: 'rgba(255,255,255,0.15)' }} />
          {/* Moving bar */}
          <motion.div
            animate={{ left: `${pos * 100}%` }}
            transition={{ duration: 0, ease: 'linear' }}
            style={{
              position: 'absolute', top: 4, bottom: 4, width: 8,
              marginLeft: -4,
              borderRadius: 4,
              background: pos >= greenStart && pos <= greenEnd ? '#10b981' : '#f59e0b',
              boxShadow: pos >= greenStart && pos <= greenEnd ? '0 0 18px #10b981' : '0 0 12px #f59e0b88',
            }}
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onPointerDown={tap}
          style={{
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #10b98144, #10b98122)',
            border: '3px solid #10b981',
            boxShadow: '0 0 40px #10b98155',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18,
            color: '#10b981', letterSpacing: '0.05em',
          }}
        >
          CUT!
        </motion.button>

        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 11, letterSpacing: '0.15em', textAlign: 'center' }}>
          TAP WHEN BAR IS IN GREEN ZONE
        </p>
      </div>
    </div>
  );
}
