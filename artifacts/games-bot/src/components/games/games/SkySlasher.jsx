import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar, TargetBar } from './_shell';

const RULES = 'SKY SLASHER — Drones zip across the sky. SWIPE through them to slice. Bombs (red) end your run on touch. Chain slices for combo multipliers. 60 seconds.';

const GAME_TIME = 60;

export default function SkySlasher({ phase, setPhase, onScoreUpdate, game }) {
  const DURATION = game?.durationSeconds || GAME_TIME;
  const TARGET_SCORE = game?.targetScore || 200;
  const SCORE_PENALTY = game?.scorePenalty || 40;
  const [drones, setDrones] = useState([]);
  const [trail, setTrail] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);

  const dronesRef = useRef([]);
  const idRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const trailRef = useRef([]);
  const sliceTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const spawnAccRef = useRef(0);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const activeRef = useRef(false);
  const areaRef = useRef(null);
  const trackingRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const loop = useCallback((ts) => {
    if (!activeRef.current) return;
    const dt = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = ts;

    spawnAccRef.current += dt;
    if (spawnAccRef.current > 0.75) {
      spawnAccRef.current = 0;
      const fromLeft = Math.random() < 0.5;
      const isBomb = Math.random() < 0.35;
      dronesRef.current.push({
        id: idRef.current++,
        x: fromLeft ? -8 : 108,
        y: 12 + Math.random() * 70,
        vx: (fromLeft ? 1 : -1) * (16 + Math.random() * 14),
        vy: (Math.random() - 0.5) * 4,
        isBomb,
        sliced: false,
      });
    }

    dronesRef.current.forEach(d => {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    });
    dronesRef.current = dronesRef.current.filter(d => d.x > -15 && d.x < 115 && !d.sliced);

    // check intersect with recent trail
    const now = Date.now();
    trailRef.current = trailRef.current.filter(t => now - t.time < 280);
    if (trackingRef.current && trailRef.current.length > 1) {
      const last = trailRef.current[trailRef.current.length - 1];
      const prev = trailRef.current[trailRef.current.length - 2];
      for (const d of dronesRef.current) {
        if (d.sliced) continue;
        const distToSeg = pointToSeg(d.x, d.y, prev.x, prev.y, last.x, last.y);
        if (distToSeg < 6) {
          if (d.isBomb) {
            d.sliced = true;
            noise({ dur: 0.3, vol: 0.25 });
            triggerHaptic('error');
            setShake(true);
            setTimeout(() => setShake(false), 400);
            scoreRef.current = Math.max(0, scoreRef.current - SCORE_PENALTY);
            setScore(scoreRef.current);
            comboRef.current = 0;
            setCombo(0);
            if (onScoreUpdate) onScoreUpdate(scoreRef.current);
            setFlash({ x: d.x, y: d.y, pts: -SCORE_PENALTY, id: Math.random() });
            setTimeout(() => setFlash(null), 500);
            continue;
          }
          d.sliced = true;
          const c = comboRef.current + 1;
          comboRef.current = c;
          setCombo(c);
          const pts = 20 + c * 4;
          scoreRef.current += pts;
          setScore(scoreRef.current);
          if (onScoreUpdate) onScoreUpdate(scoreRef.current);
          beep({ freq: 600 + c * 30, dur: 0.08, type: 'triangle' });
          triggerHaptic('light');
          setFlash({ x: d.x, y: d.y, pts, id: Math.random() });
          setTimeout(() => setFlash(null), 350);
        }
      }
    }

    setDrones([...dronesRef.current]);
    setTrail([...trailRef.current]);
    rafRef.current = requestAnimationFrame(loop);
  }, [endGame, onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    dronesRef.current = []; idRef.current = 0; trailRef.current = [];
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(DURATION);
    activeRef.current = true;
    lastTimeRef.current = 0; spawnAccRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
      clearInterval(tickRef.current);
    };
  }, [phase, loop, endGame]);

  const onDown = (e) => {
    trackingRef.current = true;
    trailRef.current = [];
    addTrail(e);
  };
  const onMove = (e) => {
    if (!trackingRef.current) return;
    addTrail(e);
  };
  const onUp = () => {
    trackingRef.current = false;
    comboRef.current = 0;
    setCombo(0);
  };
  const addTrail = (e) => {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    trailRef.current.push({ x, y, time: Date.now() });
    if (trailRef.current.length > 30) trailRef.current.shift();
  };

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #2a0a13 0%, #04020a 100%)',
      transform: 'none',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#ff6b6b" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />
      </div>

      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />

      <div
        ref={areaRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255,107,107,0.04), rgba(0,0,0,0.5))',
          border: '1px solid rgba(255,107,107,0.25)',
          touchAction: 'none', cursor: 'crosshair',
        }}>
        {drones.map(d => (
          <div key={d.id} style={{
            position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
            transform: 'translate(-50%,-50%)',
            fontSize: 30,
            filter: d.isBomb ? 'drop-shadow(0 0 14px #ff3355)' : 'drop-shadow(0 0 10px #00f5ff)',
          }}>
            {d.isBomb ? '\uD83D\uDCA3' : '\uD83D\uDEF8'}
          </div>
        ))}

        {/* slash trail */}
        {trail.length > 1 && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={trail.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="rgba(255,220,80,0.9)" strokeWidth="0.6"
              strokeLinejoin="round" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px #ffcc00)' }} />
          </svg>
        )}

        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.id}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 1.6, y: -10 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', left: `${flash.x}%`, top: `${flash.y}%`,
                transform: 'translate(-50%,-50%)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16,
                color: flash.pts < 0 ? '#ff3355' : '#ffcc00',
                textShadow: `0 0 12px ${flash.pts < 0 ? '#ff3355' : '#ffcc00'}`,
                pointerEvents: 'none',
              }}>{flash.pts < 0 ? flash.pts : `+${flash.pts}`}</motion.div>
          )}
        </AnimatePresence>

        <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center',
          fontSize: 10, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em', margin: 0 }}>
          SWIPE TO SLICE \u2022 AVOID BOMBS
        </p>
      </div>
    </div>
  );
}

function pointToSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / Math.max(0.0001, abx * abx + aby * aby)));
  const cx = ax + abx * t, cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
