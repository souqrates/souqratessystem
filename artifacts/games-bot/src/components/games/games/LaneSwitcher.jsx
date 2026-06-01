import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap LEFT or RIGHT to switch lanes and dodge obstacles. Collect stars for +100. Hit obstacle = -150. Speed increases every 200 pts. Reach 1200 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1200;

const LANES = 3;
const ITEM_H = 40;
const TRACK_H = 300;

export default function LaneSwitcher({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [lane, setLane] = useState(1);
  const [items, setItems] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const laneRef = useRef(1);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const itemsRef = useRef([]);
  const nextIdRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSpeed = () => 120 + Math.floor(scoreRef.current / 200) * 25;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const switchLane = useCallback((dir) => {
    if (!activeRef.current) return;
    const newLane = Math.max(0, Math.min(LANES - 1, laneRef.current + dir));
    laneRef.current = newLane;
    setLane(newLane);
    beep({ freq: 300, dur: 0.04, vol: 0.05 });
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; laneRef.current = 1; nextIdRef.current = 0;
    setScore(0); setLane(1); setItems([]); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    itemsRef.current = [];
    lastRef.current = performance.now();

    let spawnTimer = 0;

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const speed = getSpeed();

      spawnTimer += dt;
      const spawnInterval = 0.9 - Math.floor(scoreRef.current / 200) * 0.05;
      if (spawnTimer >= Math.max(0.5, spawnInterval)) {
        spawnTimer = 0;
        const isObstacle = Math.random() > 0.4;
        const l = Math.floor(Math.random() * LANES);
        itemsRef.current = [...itemsRef.current, { id: nextIdRef.current++, lane: l, y: -ITEM_H, type: isObstacle ? 'obstacle' : 'star' }];
      }

      itemsRef.current = itemsRef.current
        .map(it => ({ ...it, y: it.y + speed * dt }))
        .filter(it => {
          if (it.y > TRACK_H + ITEM_H) return false;
          if (it.y > TRACK_H - 60 && it.y < TRACK_H && it.lane === laneRef.current) {
            if (it.type === 'star') {
              scoreRef.current = Math.max(0, scoreRef.current + 100);
              setScore(scoreRef.current);
              triggerHaptic('light');
              beep({ freq: 600, dur: 0.06, vol: 0.08 });
              setFlash({ type: 'good', id: Date.now() });
              onScoreUpdate?.(scoreRef.current);
            } else {
              scoreRef.current = Math.max(0, scoreRef.current - 150);
              setScore(scoreRef.current);
              triggerHaptic('error');
              noise({ dur: 0.08, vol: 0.08 });
              setFlash({ type: 'bad', id: Date.now() });
              onScoreUpdate?.(scoreRef.current);
            }
            return false;
          }
          return true;
        });

      setItems([...itemsRef.current]);
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

  const LANE_W = 80;
  const TOTAL_W = LANES * LANE_W;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#22c55e" />
        <Hud label="SPEED" v={getSpeed()} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? '+100!' : 'CRASH!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Track */}
        <div style={{ position: 'relative', width: TOTAL_W, height: TRACK_H, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Lane dividers */}
          {[1, 2].map(i => (
            <div key={i} style={{ position: 'absolute', left: i * LANE_W, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }} />
          ))}

          {/* Items */}
          {items.map(it => (
            <div key={it.id} style={{
              position: 'absolute',
              left: it.lane * LANE_W + LANE_W / 2 - 16,
              top: it.y,
              width: 32, height: 32,
              fontSize: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {it.type === 'star' ? '★' : '×'}
            </div>
          ))}

          {/* Player */}
          <motion.div
            animate={{ left: lane * LANE_W + LANE_W / 2 - 20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute',
              bottom: 16,
              width: 40, height: 40,
              background: 'rgba(34,197,94,0.3)',
              border: '2px solid #22c55e',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 0 16px rgba(34,197,94,0.5)',
            }}
          >
            ▲
          </motion.div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[['◀', -1], ['▶', 1]].map(([label, dir]) => (
            <motion.button
              key={dir}
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => switchLane(dir)}
              style={{
                width: 80, height: 52, borderRadius: 14,
                background: 'rgba(34,197,94,0.1)',
                border: '2px solid rgba(34,197,94,0.3)',
                color: '#4ade80', fontSize: 24, cursor: 'pointer',
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
