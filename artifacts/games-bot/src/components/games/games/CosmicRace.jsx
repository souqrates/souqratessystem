import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import PremiumStage from './_premiumStage';
import { TimeBar } from './_shell';

const RULES = 'COSMIC RACE \u2014 Steer left/right with the on-screen pads. Dodge asteroids, fly through GREEN gates for bonus. Crash = -25 shield. Survive longer = more score. 60 seconds.';
const DEFAULT_GAME_TIME = 60;

export default function CosmicRace({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [shipX, setShipX] = useState(50);
  const [obstacles, setObstacles] = useState([]);
  const [shield, setShield] = useState(100);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [shake, setShake] = useState(false);

  const shipXRef = useRef(50);
  const moveDirRef = useRef(0);
  const obsRef = useRef([]);
  const idRef = useRef(0);
  const shieldRef = useRef(100);
  const scoreRef = useRef(0);
  const speedRef = useRef(34);
  const spawnAccRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback((dead = false) => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(dead ? 'lost' : 'won'), 400);
  }, [setPhase, onScoreUpdate]);

  const loop = useCallback((ts) => {
    if (!activeRef.current) return;
    const dt = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = ts;

    speedRef.current = Math.min(78, speedRef.current + dt * 1.2);

    // Move ship
    shipXRef.current = Math.max(8, Math.min(92, shipXRef.current + moveDirRef.current * 55 * dt));
    setShipX(shipXRef.current);

    spawnAccRef.current += dt;
    if (spawnAccRef.current > 0.42) {
      spawnAccRef.current = 0;
      const isGate = Math.random() < 0.18;
      obsRef.current.push({
        id: idRef.current++, x: 12 + Math.random() * 76, y: -10, isGate, scored: false,
      });
    }

    obsRef.current.forEach(o => { o.y += speedRef.current * dt; });

    // scoring per second alive
    scoreRef.current += 6 * dt;
    setScore(Math.floor(scoreRef.current));
    if (onScoreUpdate) onScoreUpdate(Math.floor(scoreRef.current));

    // collisions near ship at y ~ 84
    for (const o of obsRef.current) {
      if (o.scored) continue;
      if (o.y > 80 && o.y < 90 && Math.abs(o.x - shipXRef.current) < (o.isGate ? 14 : 7)) {
        o.scored = true;
        if (o.isGate) {
          scoreRef.current += 40;
          setScore(Math.floor(scoreRef.current));
          if (onScoreUpdate) onScoreUpdate(Math.floor(scoreRef.current));
          beep({ freq: 880, dur: 0.12, type: 'triangle' });
          triggerHaptic('light');
        } else {
          shieldRef.current = Math.max(0, shieldRef.current - 25);
          setShield(shieldRef.current);
          noise({ dur: 0.22, vol: 0.2 });
          setShake(true);
          setTimeout(() => setShake(false), 280);
          triggerHaptic('error');
          if (shieldRef.current <= 0) { endGame(true); return; }
        }
      }
    }
    obsRef.current = obsRef.current.filter(o => o.y < 115);
    setObstacles([...obsRef.current]);

    rafRef.current = requestAnimationFrame(loop);
  }, [endGame, onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    shipXRef.current = 50; moveDirRef.current = 0;
    obsRef.current = []; idRef.current = 0;
    shieldRef.current = 100; scoreRef.current = 0; speedRef.current = 34;
    setShipX(50); setShield(100); setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true; lastTimeRef.current = 0; spawnAccRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(false); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); };
  }, [phase, loop, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <PremiumStage accent="#00f5ff" accent2="#3b82f6">
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      transform: 'none',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5ff" />
        <Tile label="SHIELD" val={`${shield}%`} color={shield <= 30 ? '#ff3355' : '#00f5a0'} />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{
        position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(0,245,255,0.05), rgba(0,0,0,0.6))',
        border: '1px solid rgba(0,245,255,0.2)', minHeight: 360,
        transform: shake ? 'translate(3px, -2px)' : 'none',
        transition: shake ? 'none' : 'transform 0.1s ease',
      }}>
        {/* stars */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${(i * 37 + 5) % 100}%`, top: `${(i * 53 + 13) % 100}%`,
            width: 2, height: 2, background: '#fff', opacity: 0.4, borderRadius: '50%',
          }} />
        ))}
        {obstacles.map(o => (
          <div key={o.id} style={{
            position: 'absolute', left: `${o.x}%`, top: `${o.y}%`,
            transform: 'translate(-50%,-50%)',
            width: o.isGate ? 56 : 36, height: o.isGate ? 26 : 36,
            borderRadius: o.isGate ? 6 : '50%',
            background: o.isGate
              ? 'linear-gradient(90deg, rgba(0,245,160,0.4), rgba(0,245,160,0.1), rgba(0,245,160,0.4))'
              : 'radial-gradient(circle at 30% 30%, #aa6633, #4a2010)',
            border: `2px solid ${o.isGate ? '#00f5a0' : '#8a5a2a'}`,
            boxShadow: o.isGate ? '0 0 18px #00f5a0' : '0 0 8px rgba(0,0,0,0.4)',
          }} />
        ))}
        {/* ship */}
        <div style={{
          position: 'absolute', left: `${shipX}%`, top: '84%', transform: 'translate(-50%,-50%)',
          width: 0, height: 0,
          borderLeft: '18px solid transparent', borderRight: '18px solid transparent',
          borderBottom: '32px solid #00f5ff',
          filter: 'drop-shadow(0 0 14px #00f5ff)',
        }} />
        <div style={{
          position: 'absolute', left: `${shipX}%`, top: '90%', transform: 'translate(-50%,-50%)',
          width: 8, height: 14, background: 'linear-gradient(180deg, #ffcc00, transparent)',
          borderRadius: 4, filter: 'blur(2px)', opacity: 0.85,
        }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onPointerDown={() => { moveDirRef.current = -1; }}
          onPointerUp={() => { moveDirRef.current = 0; }}
          onPointerLeave={() => { moveDirRef.current = 0; }}
          style={padStyle}>
          {'\u25C0'}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onPointerDown={() => { moveDirRef.current = 1; }}
          onPointerUp={() => { moveDirRef.current = 0; }}
          onPointerLeave={() => { moveDirRef.current = 0; }}
          style={padStyle}>
          {'\u25B6'}
        </motion.button>
      </div>
    </div>
    </PremiumStage>
  );
}

const padStyle = {
  padding: '14px 0', borderRadius: 14, cursor: 'pointer',
  border: '2px solid #00f5ff', background: 'linear-gradient(135deg, rgba(0,245,255,0.18), rgba(0,245,255,0.04))',
  boxShadow: '0 0 16px rgba(0,245,255,0.4)', color: '#fff', fontSize: 22,
  fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 14px #00f5ff',
};

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
