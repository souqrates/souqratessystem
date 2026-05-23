import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'LAST STAND \u2014 Defend your core. Tap incoming projectiles to destroy them. Each hit on your core drops shield by 10. Waves get faster. Score = wave + projectiles destroyed. 60 seconds.';
const GAME_TIME = 60;

export default function LastStand({ phase, setPhase, onScoreUpdate, game }) {
  const DURATION = game?.durationSeconds || GAME_TIME;
  const [missiles, setMissiles] = useState([]);
  const [shield, setShield] = useState(100);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [shake, setShake] = useState(false);

  const missilesRef = useRef([]);
  const idRef = useRef(0);
  const shieldRef = useRef(100);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const speedRef = useRef(22);
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

    spawnAccRef.current += dt;
    const interval = Math.max(0.35, 0.95 - waveRef.current * 0.06);
    if (spawnAccRef.current > interval) {
      spawnAccRef.current = 0;
      const angle = Math.random() * Math.PI * 2;
      missilesRef.current.push({
        id: idRef.current++,
        x: 50 + Math.cos(angle) * 60,
        y: 50 + Math.sin(angle) * 60,
        ang: angle + Math.PI,
        hit: false,
      });
    }

    speedRef.current = 22 + waveRef.current * 3;
    missilesRef.current.forEach(m => {
      m.x += Math.cos(m.ang) * speedRef.current * dt;
      m.y += Math.sin(m.ang) * speedRef.current * dt;
    });

    // collision with core
    for (const m of missilesRef.current) {
      if (m.hit) continue;
      const dx = m.x - 50, dy = m.y - 50;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        m.hit = true;
        shieldRef.current = Math.max(0, shieldRef.current - 10);
        setShield(shieldRef.current);
        noise({ dur: 0.18, vol: 0.18 });
        setShake(true);
        setTimeout(() => setShake(false), 200);
        triggerHaptic('warning');
        if (shieldRef.current <= 0) { endGame(true); return; }
      }
    }
    missilesRef.current = missilesRef.current.filter(m => !m.hit);
    setMissiles([...missilesRef.current]);

    rafRef.current = requestAnimationFrame(loop);
  }, [endGame]);

  const onTapMissile = (e, m) => {
    e.stopPropagation();
    if (m.hit) return;
    m.hit = true;
    const pts = 10 + waveRef.current * 2;
    scoreRef.current += pts;
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    beep({ freq: 720, dur: 0.07, type: 'triangle' });
    triggerHaptic('light');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    missilesRef.current = []; idRef.current = 0;
    shieldRef.current = 100; scoreRef.current = 0; waveRef.current = 1;
    setShield(100); setScore(0); setWave(1); setTimeLeft(DURATION);
    activeRef.current = true; lastTimeRef.current = 0; spawnAccRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(false); return 0; }
        if (t % 8 === 0) { waveRef.current += 1; setWave(waveRef.current); }
        return t - 1;
      });
    }, 1000);
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); };
  }, [phase, loop, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, #061a30 0%, #02060c 100%)',
      transform: 'none',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5ff" />
        <Tile label="WAVE" val={wave} color="#ffcc00" />
        <Tile label="SHIELD" val={`${shield}%`} color={shield <= 30 ? '#ff3355' : '#00f5a0'} />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
      </div>

      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{
        position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
        background: 'radial-gradient(circle at center, rgba(0,245,255,0.04), rgba(0,0,0,0.6))',
        border: '1px solid rgba(0,245,255,0.2)', minHeight: 380,
      }}>
        {/* core */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          width: 70, height: 70, borderRadius: '50%',
          background: `radial-gradient(circle at center, #00f5ff, #003a4a)`,
          border: '3px solid #00f5ff',
          boxShadow: `0 0 ${30 + shield * 0.3}px #00f5ff${shield < 50 ? '88' : 'ff'}`,
          opacity: 0.4 + shield * 0.006,
        }} />
        {/* shield ring */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <circle cx="50" cy="50" r={14} fill="none" stroke="#00f5a0" strokeWidth="0.4"
            strokeDasharray={`${shield * 0.88} 999`} opacity={0.7} />
        </svg>
        {missiles.map(m => (
          <div key={m.id} onPointerDown={(e) => onTapMissile(e, m)} style={{
            position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
            transform: 'translate(-50%,-50%)',
            width: 28, height: 28, borderRadius: '50%',
            background: 'radial-gradient(circle at center, #ff6b6b, #800014)',
            border: '2px solid #ff3355', boxShadow: '0 0 14px #ff3355',
            cursor: 'pointer', touchAction: 'none',
          }} />
        ))}
        <p style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
          fontSize: 10, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em', margin: 0 }}>
          TAP INCOMING MISSILES
        </p>
      </div>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 7, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.16em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
