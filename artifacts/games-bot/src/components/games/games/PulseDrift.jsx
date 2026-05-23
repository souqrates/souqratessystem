import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';
import { getFrameInterval } from '../../../lib/canvasQuality';

const DEFAULT_GAME_TIME = 90;
const RULES = 'PULSE DRIFT — A shrinking ring closes in on the target zone. Tap at the PERFECT moment for +60. Good window = +25. Miss = combo break. Chain perfects to unleash supernova bonuses. 90 seconds of pure timing.';

export default function PulseDrift({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [combo, setCombo] = useState(0);
  const [rings, setRings] = useState([]);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(0);
  const [bg, setBg] = useState('#030712');

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const ringIdRef = useRef(0);
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const rafRef = useRef(null);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((pts) => {
    scoreRef.current = Math.max(0, scoreRef.current + pts);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const spawn = useCallback(() => {
    if (!gameActiveRef.current) return;
    const id = ringIdRef.current++;
    const tier = Math.min(3, Math.floor(scoreRef.current / 400));
    const lifetime = Math.max(1500, 2600 - tier * 250);
    const ring = {
      id,
      x: 14 + Math.random() * 72,
      y: 22 + Math.random() * 56,
      birth: Date.now(),
      life: lifetime,
      hue: ['#06b6d4', '#22d3ee', '#3b82f6', '#10b981'][id % 4],
    };
    setRings((prev) => [...prev, ring]);
    setTimeout(() => {
      setRings((prev) => {
        const r = prev.find((x) => x.id === id);
        if (r) {
          comboRef.current = 0;
          setCombo(0);
          triggerHaptic('error');
          noiseHit(0.18, 0.18);
        }
        return prev.filter((x) => x.id !== id);
      });
    }, lifetime + 80);
  }, []);

  const handleTap = useCallback((ring, e) => {
    e.stopPropagation();
    if (!gameActiveRef.current) return;
    const elapsed = Date.now() - ring.birth;
    const ratio = elapsed / ring.life;
    let pts = 0, label = '', col = '';
    if (ratio > 0.78 && ratio < 0.93) {
      pts = 60; label = 'PERFECT'; col = '#fbbf24';
      tone(660, 0.15, 'triangle', 0.3, 220);
    } else if (ratio > 0.55 && ratio <= 0.78) {
      pts = 25; label = 'GOOD'; col = '#10b981';
      tone(440, 0.12, 'sine', 0.25);
    } else if (ratio >= 0.93) {
      pts = 15; label = 'LATE'; col = '#3b82f6';
      tone(330, 0.1, 'sine', 0.22);
    } else {
      pts = 5; label = 'EARLY'; col = '#94a3b8';
      tone(260, 0.1, 'sine', 0.2);
    }
    const bonusCombo = comboRef.current >= 3 ? Math.floor(pts * 0.4) : 0;
    const total = pts + bonusCombo;
    addScore(total);
    if (pts >= 25) {
      comboRef.current += 1;
      setCombo(comboRef.current);
      if (comboRef.current % 5 === 0) {
        chord([523, 659, 784, 1047], 0.05, 0.18, 'sine', 0.18);
        setBg('#0f172a');
        setTimeout(() => setBg('#030712'), 220);
        setShake(8);
        setTimeout(() => setShake(0), 220);
      }
    } else {
      comboRef.current = 0;
      setCombo(0);
    }
    setFlash({ x: ring.x, y: ring.y, label, col, pts: total });
    setTimeout(() => setFlash(null), 600);
    triggerHaptic(pts >= 60 ? 'success' : 'light');
    setRings((prev) => prev.filter((r) => r.id !== ring.id));
  }, [addScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0;
    comboRef.current = 0;
    setScore(0);
    setCombo(0);
    setTimeLeft(GAME_TIME);
    setRings([]);

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        clearInterval(spawnRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);

    const scheduleSpawn = () => {
      if (!gameActiveRef.current) return;
      spawn();
      const tier = Math.min(3, Math.floor(scoreRef.current / 400));
      const delay = Math.max(550, 1100 - tier * 150);
      spawnRef.current = setTimeout(scheduleSpawn, delay);
    };
    setTimeout(scheduleSpawn, 600);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, spawn, setPhase]);

  if (phase === 'rules') {
    return (
      <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>◎</div>
        <h2 style={{ color: '#22d3ee', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #22d3ee' }}>PULSE DRIFT</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
      </div>
    );
  }

  const tc = hudColor(timeLeft, GAME_TIME);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', overflow: 'hidden',
      background: `radial-gradient(ellipse at center, ${bg} 0%, #020617 100%)`,
      fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
      transform: shake ? `translate(${(Math.random() - 0.5) * shake}px,${(Math.random() - 0.5) * shake}px)` : 'none',
      transition: 'background 220ms',
    }}>
      {/* Grid bg */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.18,
        backgroundImage: 'linear-gradient(rgba(6,182,212,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.18) 1px, transparent 1px)',
        backgroundSize: '40px 40px', pointerEvents: 'none' }} />

      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="COMBO" value={`×${combo}`} color="#fbbf24" />
      </div>

      {/* Rings */}
      <AnimatePresence>
        {rings.map((r) => (
          <Ring key={r.id} ring={r} onTap={(e) => handleTap(r, e)} />
        ))}
      </AnimatePresence>

      {/* Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.6, y: -40 }}
            transition={{ duration: 0.55 }}
            style={{
              position: 'absolute',
              left: `${flash.x}%`, top: `${flash.y}%`,
              transform: 'translate(-50%,-50%)',
              color: flash.col, fontWeight: 900, fontSize: 22,
              textShadow: `0 0 18px ${flash.col}`, pointerEvents: 'none', zIndex: 20,
            }}>
            {flash.label} +{flash.pts}
          </motion.div>
        )}
      </AnimatePresence>

      <TimerBar pct={timeLeft / GAME_TIME} color={tc} />
    </div>
  );
}

function Ring({ ring, onTap }) {
  const [size, setSize] = useState(180);
  useEffect(() => {
    const start = Date.now();
    let raf;
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const tick = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(tick); return; }
      _skzLastT = now;
      const e = (Date.now() - start) / ring.life;
      setSize(180 * (1 - Math.min(1, e)) + 30);
      if (e < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ring.life]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.6 }}
      transition={{ duration: 0.15 }}
      onPointerDown={onTap}
      style={{
        position: 'absolute', left: `${ring.x}%`, top: `${ring.y}%`,
        transform: 'translate(-50%,-50%)', width: 200, height: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 6,
      }}>
      {/* Target ring (static) */}
      <div style={{
        position: 'absolute', width: 86, height: 86, borderRadius: '50%',
        border: `2px dashed ${ring.hue}66`,
        boxShadow: `0 0 18px ${ring.hue}44, inset 0 0 24px ${ring.hue}22`,
      }} />
      <div style={{
        position: 'absolute', width: 30, height: 30, borderRadius: '50%',
        background: ring.hue, boxShadow: `0 0 20px ${ring.hue}, 0 0 50px ${ring.hue}88`,
      }} />
      {/* Shrinking ring */}
      <div style={{
        position: 'absolute', width: size, height: size, borderRadius: '50%',
        border: `3px solid ${ring.hue}`,
        boxShadow: `0 0 18px ${ring.hue}88, inset 0 0 18px ${ring.hue}66`,
      }} />
    </motion.div>
  );
}

function Hud({ label, value, color, pulse }) {
  return (
    <motion.div
      animate={pulse ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 0.6, repeat: Infinity }}
      style={{
        background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(8px)',
        border: `1px solid ${color}44`, borderRadius: 12, padding: '6px 14px',
        textAlign: 'center', minWidth: 78,
      }}>
      <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.16em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color, textShadow: `0 0 10px ${color}` }}>{value}</div>
    </motion.div>
  );
}

function TimerBar({ pct, color }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.06)', zIndex: 10 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear' }} />
    </div>
  );
}
