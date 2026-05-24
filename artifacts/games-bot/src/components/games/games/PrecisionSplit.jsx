import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

// PRECISION SPLIT — surgical laser theme. Same core mechanic as StopTheBar
// (a marker sweeps across; tap inside the target window) but a fully
// distinct visual identity: emerald laser beam across a lab grid, scalpel
// crosshair button, particle split on success. Lives in its own file so
// PRECISION SPLIT (id=1) and QUANTUM LOCK (id=149) render distinct UIs.
const RULES = 'PRECISION SPLIT — A laser beam scans the field. Trigger the SPLIT the instant it crosses the emerald focus zone for +100. Miss = -150. The beam accelerates and the zone narrows every 200 pts. Reach 800 in 60s!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 800;
const BASE_SPEED = 1.5;
const BASE_ZONE = 0.18;
const MIN_ZONE = 0.06;

const EMERALD = '#00ffa6';
const WHITE_HOT = '#e8fff5';
const LAB = '#001a14';
const HAZARD = '#ff4d6d';

export default function PrecisionSplit({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pos, setPos] = useState(0);
  const [zoneW, setZoneW] = useState(BASE_ZONE);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);
  const [particles, setParticles] = useState([]);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(BASE_SPEED);
  const zoneRef = useRef(BASE_ZONE);
  const streakRef = useRef(0);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const partIdRef = useRef(0);

  const TARGET_SCORE = game?.targetScore || TARGET;
  const zoneStart = () => 0.5 - zoneRef.current / 2;
  const zoneEnd = () => 0.5 + zoneRef.current / 2;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const spawnParticles = useCallback((x) => {
    const id = partIdRef.current++;
    const burst = Array.from({ length: 6 }).map((_, i) => ({
      id: `${id}-${i}`,
      x,
      dx: (Math.random() - 0.5) * 80,
      dy: (Math.random() - 0.5) * 60 - 10,
    }));
    setParticles(prev => [...prev, ...burst]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !p.id.startsWith(`${id}-`)));
    }, 600);
  }, []);

  const split = useCallback(() => {
    if (!activeRef.current) return;
    const p = posRef.current;
    const inside = p >= zoneStart() && p <= zoneEnd();
    if (inside) {
      streakRef.current++;
      scoreRef.current += 100;
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('medium');
      chord([880, 1320, 1760], 0.06, 0.1, 'sine');
      setFlash({ type: 'good', id: Date.now() });
      spawnParticles(p * 100);
      const lvl = Math.floor(scoreRef.current / 200);
      speedRef.current = BASE_SPEED + lvl * 0.5;
      zoneRef.current = Math.max(MIN_ZONE, BASE_ZONE - lvl * 0.018);
      setZoneW(zoneRef.current);
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
  }, [onScoreUpdate, spawnParticles]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; posRef.current = 0; dirRef.current = 1;
    speedRef.current = BASE_SPEED; zoneRef.current = BASE_ZONE; streakRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME); setPos(0); setZoneW(BASE_ZONE);
    setParticles([]);
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
  }, [phase, GAME_TIME, endGame]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game?.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 8)} setPhase={setPhase} />;
  }

  const zs = zoneStart();
  const inside = pos >= zs && pos <= zoneEnd();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SPLITS" v={score} c={EMERALD} />
        <Hud label="STREAK" v={streak} c={streak >= 3 ? WHITE_HOT : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? HAZARD : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="CALIBRATION" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={EMERALD} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 18,
        borderRadius: 18,
        background: `
          radial-gradient(ellipse at 50% 30%, ${EMERALD}14 0%, ${LAB} 60%, #00080a 100%),
          repeating-linear-gradient(0deg, transparent 0, transparent 20px, ${EMERALD}08 20px, ${EMERALD}08 21px),
          repeating-linear-gradient(90deg, transparent 0, transparent 20px, ${EMERALD}08 20px, ${EMERALD}08 21px)
        `,
        border: `1px solid ${EMERALD}33`,
        boxShadow: `inset 0 0 40px ${EMERALD}15`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Lab cross-hatch corners */}
        <div style={{ position: 'absolute', top: 8, left: 8, color: `${EMERALD}88`, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em' }}>// LAB-7</div>
        <div style={{ position: 'absolute', top: 8, right: 8, color: `${EMERALD}88`, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em' }}>v2.1</div>

        <MomentumFlash
          msg={flash?.type === 'good' ? (streak >= 3 ? 'CLEAN CUT!' : 'SPLIT!') : 'OFF-AXIS!'}
          color={flash?.type === 'good' ? EMERALD : HAZARD}
          trigger={flash?.id}
        />

        {/* Laser track */}
        <div style={{ position: 'relative', width: '100%', padding: '0 4px' }}>
          {/* Top + bottom rails */}
          <div style={{
            position: 'relative', width: '100%', height: 56,
            background: `linear-gradient(180deg, #000604 0%, ${LAB} 50%, #000604 100%)`,
            border: `1px solid ${EMERALD}55`,
            borderRadius: 2,
            boxShadow: `inset 0 0 18px rgba(0,0,0,0.8), 0 0 16px ${EMERALD}22`,
            overflow: 'hidden',
          }}>
            {/* Calibration ticks */}
            {Array.from({ length: 21 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute', bottom: 0, left: `${i * 5}%`,
                width: 1, height: i % 5 === 0 ? 10 : 5,
                background: `${EMERALD}66`,
              }} />
            ))}

            {/* Center axis line */}
            <div style={{
              position: 'absolute', top: 12, bottom: 12, left: '50%',
              width: 1, background: `${WHITE_HOT}44`, marginLeft: -0.5,
            }} />

            {/* Focus zone (emerald target band) */}
            <div style={{
              position: 'absolute', top: 6, bottom: 6,
              left: `${zs * 100}%`, width: `${zoneW * 100}%`,
              background: `linear-gradient(180deg, ${EMERALD}33 0%, ${EMERALD}66 50%, ${EMERALD}33 100%)`,
              borderLeft: `2px solid ${EMERALD}`,
              borderRight: `2px solid ${EMERALD}`,
              boxShadow: `0 0 18px ${EMERALD}aa, inset 0 0 12px ${EMERALD}66`,
            }} />

            {/* Laser beam — thin white-hot vertical line with emerald halo */}
            <motion.div
              animate={{ left: `${pos * 100}%` }}
              transition={{ duration: 0, ease: 'linear' }}
              style={{
                position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5,
                background: inside
                  ? `linear-gradient(180deg, ${EMERALD} 0%, ${WHITE_HOT} 50%, ${EMERALD} 100%)`
                  : `linear-gradient(180deg, ${HAZARD}aa 0%, ${WHITE_HOT} 50%, ${HAZARD}aa 100%)`,
                boxShadow: inside
                  ? `0 0 24px ${EMERALD}, 0 0 8px ${WHITE_HOT}`
                  : `0 0 16px ${HAZARD}88`,
                borderRadius: 1,
              }}
            />

            {/* Particle burst overlay (positioned in % units) */}
            <AnimatePresence>
              {particles.map(p => (
                <motion.div
                  key={p.id}
                  initial={{ left: `${p.x}%`, top: '50%', opacity: 1, scale: 1 }}
                  animate={{
                    left: `calc(${p.x}% + ${p.dx}px)`,
                    top: `calc(50% + ${p.dy}px)`,
                    opacity: 0, scale: 0.4,
                  }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', width: 4, height: 4, marginLeft: -2, marginTop: -2,
                    borderRadius: '50%',
                    background: WHITE_HOT,
                    boxShadow: `0 0 8px ${EMERALD}`,
                    pointerEvents: 'none',
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Scalpel / crosshair trigger button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onPointerDown={split}
          style={{
            width: 160, height: 80, borderRadius: 4,
            background: inside
              ? `linear-gradient(180deg, ${EMERALD}66 0%, ${EMERALD}22 100%)`
              : `linear-gradient(180deg, ${EMERALD}22 0%, ${EMERALD}08 100%)`,
            border: `2px solid ${EMERALD}`,
            boxShadow: inside ? `0 0 36px ${EMERALD}aa, inset 0 0 16px ${EMERALD}66` : `0 0 14px ${EMERALD}33`,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
            color: inside ? WHITE_HOT : EMERALD,
            textShadow: `0 0 12px ${EMERALD}`,
            transition: 'box-shadow 0.1s ease',
            position: 'relative',
          }}
        >
          {/* Crosshair marks */}
          <div style={{ position: 'absolute', top: 4, left: '50%', width: 1, height: 8, background: EMERALD, marginLeft: -0.5 }} />
          <div style={{ position: 'absolute', bottom: 4, left: '50%', width: 1, height: 8, background: EMERALD, marginLeft: -0.5 }} />
          <div style={{ position: 'absolute', left: 4, top: '50%', height: 1, width: 8, background: EMERALD, marginTop: -0.5 }} />
          <div style={{ position: 'absolute', right: 4, top: '50%', height: 1, width: 8, background: EMERALD, marginTop: -0.5 }} />
          <span style={{ fontSize: 22, lineHeight: 1 }}>✂</span>
          <span style={{ fontSize: 13, letterSpacing: '0.24em' }}>SPLIT</span>
        </motion.button>

        <p style={{ color: `${EMERALD}aa`, fontSize: 11, letterSpacing: '0.22em', fontFamily: 'Orbitron, sans-serif' }}>
          ▸ TRIGGER ON THE EMERALD AXIS ◂
        </p>
      </div>
    </div>
  );
}
