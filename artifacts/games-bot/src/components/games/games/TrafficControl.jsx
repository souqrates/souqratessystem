import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap cars in the order they arrive to clear the intersection. Correct order = +100. Wrong car = -150. More cars appear after 400 pts. Reach 2000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 2000;

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#f97316'];
const DIRS = ['↑', '↓', '←', '→'];

export default function TrafficControl({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [queue, setQueue] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const queueRef = useRef([]);
  const nextIdRef = useRef(0);
  const spawnTimerRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getMaxCars = () => 3 + Math.floor(scoreRef.current / 400);
  const getSpawnInterval = () => Math.max(800, 1600 - Math.floor(scoreRef.current / 200) * 100);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(spawnTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const spawnCar = useCallback(() => {
    if (!activeRef.current) return;
    if (queueRef.current.length < getMaxCars()) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      const car = { id: nextIdRef.current++, color, dir, arrived: Date.now() };
      queueRef.current = [...queueRef.current, car];
      setQueue([...queueRef.current]);
      beep({ freq: 300, dur: 0.06, vol: 0.06 });
    }
    spawnTimerRef.current = setTimeout(spawnCar, getSpawnInterval());
  }, []);

  const tapCar = useCallback((id) => {
    if (!activeRef.current || queueRef.current.length === 0) return;
    const first = queueRef.current[0];
    if (first.id === id) {
      queueRef.current = queueRef.current.slice(1);
      setQueue([...queueRef.current]);
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('light');
      beep({ freq: 500, dur: 0.07, vol: 0.08 });
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
    }
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; nextIdRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setQueue([]);
    queueRef.current = [];
    activeRef.current = true;
    setTimeout(spawnCar, 600);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearTimeout(spawnTimerRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f97316" />
        <Hud label="QUEUE" v={queue.length} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'GO!' : 'WRONG ORDER!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Intersection visual */}
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <div style={{ position: 'absolute', inset: '40%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }} />
          {/* Roads */}
          {[['top', '40%', '0', '20%', '100%'], ['bottom', '40%', '60%', '20%', '100%'],
            ['left', '0', '40%', '100%', '20%'], ['right', '60%', '40%', '100%', '20%']].map(([id, left, top, w, h]) => (
            <div key={id} style={{ position: 'absolute', left, top, width: w, height: h, background: 'rgba(255,255,255,0.02)' }} />
          ))}
        </div>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP CARS IN ARRIVAL ORDER</p>

        {/* Car queue */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {queue.map((car, i) => (
            <motion.button
              key={car.id}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => tapCar(car.id)}
              style={{
                width: 60, height: 60, borderRadius: 14,
                background: `${car.color}22`,
                border: `3px solid ${i === 0 ? car.color : `${car.color}44`}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, cursor: 'pointer',
                boxShadow: i === 0 ? `0 0 16px ${car.color}55` : 'none',
              }}
            >
              <span style={{ fontSize: 22 }}>🚗</span>
              <span style={{ fontSize: 14, color: car.color }}>{car.dir}</span>
            </motion.button>
          ))}
          {queue.length === 0 && <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 12 }}>Waiting for cars...</p>}
        </div>
      </div>
    </div>
  );
}
