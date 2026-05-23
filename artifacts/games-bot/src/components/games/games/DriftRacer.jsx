import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Swipe LEFT or RIGHT to switch lanes. Dodge red cars and collect green boost pads for bonus points! Survive the full 30 seconds. Collect 25 boost pads to win!';
const DEFAULT_GAME_TIME = 30;
const TARGET = 35;
const LANES = [0, 1, 2];
const LANE_X = ['16%', '50%', '84%'];

let _rid = 0;

export default function DriftRacer({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [lane, setLane] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [objects, setObjects] = useState([]);
  const [crashed, setCrashed] = useState(false);
  const [lives, setLives] = useState(3);

  const laneRef = useRef(1);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const activeRef = useRef(false);
  const spawnRef = useRef(null);
  const touchStartX = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(spawnRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const switchLane = useCallback((dir) => {
    const n = Math.max(0, Math.min(2, laneRef.current + dir));
    laneRef.current = n;
    setLane(n);
    triggerHaptic('light');
    beep({ freq: dir > 0 ? 400 : 360, dur: 0.04, vol: 0.07 });
  }, []);

  const spawnObj = useCallback(() => {
    if (!activeRef.current) return;
    const l = Math.floor(Math.random() * 3);
    const type = Math.random() < 0.45 ? 'enemy' : 'boost';
    const id = ++_rid;
    setObjects(o => [...o, { id, lane: l, type, y: -10 }]);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; laneRef.current = 1; livesRef.current = 3; _rid = 0;
    setScore(0); setLane(1); setLives(3); setTimeLeft(GAME_TIME); setObjects([]); setCrashed(false);
    activeRef.current = true;

    const moveIv = setInterval(() => {
      setObjects(objs => {
        const updated = objs.map(o => ({ ...o, y: o.y + 8 })).filter(o => o.y < 115);
        const hits = updated.filter(o => o.y > 65 && o.y < 90 && o.lane === laneRef.current);
        hits.forEach(h => {
          if (h.type === 'enemy') {
            livesRef.current = Math.max(0, livesRef.current - 1);
            setLives(livesRef.current);
            setCrashed(true);
            setTimeout(() => setCrashed(false), 300);
            beep({ freq: 200, dur: 0.18, type: 'sawtooth', vol: 0.2 });
            triggerHaptic('error');
            if (livesRef.current <= 0) endGame();
          } else {
            scoreRef.current++;
            setScore(scoreRef.current);
            beep({ freq: 660, dur: 0.05, vol: 0.08 });
            triggerHaptic('light');
            if (scoreRef.current >= (game.targetScore || TARGET)) endGame();
          }
        });
        return hits.length ? updated.filter(o => !hits.find(h => h.id === o.id)) : updated;
      });
    }, 40);

    const timeIv = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timeIv); endGame(); return 0; } return t - 1; });
    }, 1000);

    spawnRef.current = setInterval(spawnObj, 480);

    return () => { clearInterval(moveIv); clearInterval(timeIv); clearInterval(spawnRef.current); activeRef.current = false; };
  }, [phase]);

  const onPointerDown = useCallback((e) => { touchStartX.current = e.clientX; }, []);
  const onPointerUp = useCallback((e) => {
    if (!activeRef.current || touchStartX.current === null) return;
    const dx = e.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 20) switchLane(dx > 0 ? 1 : -1);
  }, [switchLane]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={10 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="BOOST" v={score} c="#10b981" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
        <Hud label="TIME" v={`${timeLeft}s`} c={timeLeft <= 8 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{
          flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: crashed ? 'radial-gradient(ellipse at 50% 50%, #3a0000, #060204)' : 'radial-gradient(ellipse at 50% 0%, #001a08 0%, #040608 100%)',
          border: `1px solid ${crashed ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.12)'}`,
          minHeight: 340, touchAction: 'none', cursor: 'pointer',
          transition: 'background 0.1s, border-color 0.1s',
        }}
      >
        {/* Road lines */}
        {[1, 2].map(i => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 33.3}%`, width: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
        ))}

        {/* Road speed lines */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div key={i}
            animate={{ y: ['0%', '120%'] }}
            transition={{ duration: 0.4 + i * 0.07, repeat: Infinity, ease: 'linear', delay: i * 0.1 }}
            style={{
              position: 'absolute', width: 3, height: 30,
              left: `${8 + i * 16}%`, top: `-10%`,
              background: 'rgba(255,255,255,0.07)', borderRadius: 2,
            }}
          />
        ))}

        {/* Objects */}
        <AnimatePresence>
          {objects.map(o => (
            <div key={o.id} style={{
              position: 'absolute',
              left: LANE_X[o.lane],
              top: `${o.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: o.type === 'enemy' ? 32 : 28,
              filter: o.type === 'enemy' ? 'drop-shadow(0 0 8px rgba(239,68,68,0.8))' : 'drop-shadow(0 0 8px rgba(16,185,129,0.8))',
            }}>
              {o.type === 'enemy' ? '🚗' : '💚'}
            </div>
          ))}
        </AnimatePresence>

        {/* Player car */}
        <motion.div
          animate={{ left: LANE_X[lane] }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            position: 'absolute', bottom: '14%',
            transform: 'translateX(-50%)',
            fontSize: 36,
            filter: crashed ? 'drop-shadow(0 0 16px rgba(239,68,68,1))' : 'drop-shadow(0 0 10px rgba(16,185,129,0.6))',
          }}
        >
          🏎️
        </motion.div>

        {/* Swipe hint */}
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.25)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.14em' }}>
          ← SWIPE →
        </div>
      </div>
    </div>
  );
}
