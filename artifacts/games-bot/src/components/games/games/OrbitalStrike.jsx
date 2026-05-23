import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { getFrameInterval } from '../../../lib/canvasQuality';

const RULES = 'ORBITAL STRIKE — Drag from the launcher to AIM, release to FIRE. Planets pull your projectile with gravity. Hit the glowing target. 10 shots, harder each round.';

const ROUNDS = 10;
const W = 100; // logical width %
const H = 100;
const LAUNCH = { x: 12, y: 88 };

function makeRound(n) {
  // Place 1-3 planets and one target
  const planets = [];
  const count = 1 + Math.min(2, Math.floor(n / 3));
  for (let i = 0; i < count; i++) {
    planets.push({
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 40,
      r: 6 + Math.random() * 4,
      mass: 350 + Math.random() * 250,
    });
  }
  const target = { x: 65 + Math.random() * 25, y: 15 + Math.random() * 30, r: 6 - Math.min(2, n * 0.2) };
  return { planets, target };
}

export default function OrbitalStrike({ phase, setPhase, onScoreUpdate }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [aim, setAim] = useState(null); // {x,y}
  const [proj, setProj] = useState(null); // {x,y, trail:[]}
  const [data, setData] = useState(() => makeRound(0));
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const roundRef = useRef(0);
  const dataRef = useRef(data);
  const projRef = useRef(null);
  const rafRef = useRef(null);
  const areaRef = useRef(null);
  const activeRef = useRef(true);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(scoreRef.current > 100 ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate]);

  const startNextRound = useCallback(() => {
    if (roundRef.current >= ROUNDS) { endGame(); return; }
    const d = makeRound(roundRef.current);
    dataRef.current = d;
    setData(d);
    setProj(null); projRef.current = null;
    setAim(null);
  }, [endGame]);

  const fire = useCallback((dirX, dirY) => {
    if (projRef.current) return;
    const len = Math.hypot(dirX, dirY);
    if (len < 4) return;
    const power = Math.min(60, len * 1.4);
    const vx = (dirX / len) * power;
    const vy = (dirY / len) * power;
    projRef.current = { x: LAUNCH.x, y: LAUNCH.y, vx, vy, trail: [] };
    setProj({ ...projRef.current });
    beep({ freq: 320, dur: 0.18, type: 'square', sweepTo: 110 });
    triggerHaptic('medium');
  }, []);

  const stepPhysics = useCallback(() => {
    if (!projRef.current) return;
    const p = projRef.current;
    const dt = 1 / 60;
    // gravity from each planet
    for (const pl of dataRef.current.planets) {
      const dx = pl.x - p.x;
      const dy = pl.y - p.y;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2);
      if (d < pl.r) {
        // hit planet — destroy projectile
        noise({ dur: 0.18, vol: 0.18 });
        triggerHaptic('error');
        setFlash({ type: 'miss', text: 'PLANET HIT' });
        roundRef.current += 1; setRound(roundRef.current);
        setTimeout(() => { setFlash(null); startNextRound(); }, 700);
        projRef.current = null;
        setProj(null);
        return;
      }
      const a = (pl.mass / Math.max(2, d2)) * dt;
      p.vx += (dx / d) * a;
      p.vy += (dy / d) * a;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 30) p.trail.shift();

    // check target
    const t = dataRef.current.target;
    const td = Math.hypot(p.x - t.x, p.y - t.y);
    if (td < t.r + 1.5) {
      const pts = 50 + Math.floor((10 - roundRef.current) * 4);
      scoreRef.current += pts; setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      beep({ freq: 880, dur: 0.18, type: 'triangle' });
      triggerHaptic('success');
      setFlash({ type: 'hit', text: `+${pts}` });
      roundRef.current += 1; setRound(roundRef.current);
      setTimeout(() => { setFlash(null); startNextRound(); }, 700);
      projRef.current = null;
      setProj(null);
      return;
    }

    // off-screen
    if (p.x < -10 || p.x > 110 || p.y < -10 || p.y > 110) {
      setFlash({ type: 'miss', text: 'MISS' });
      roundRef.current += 1; setRound(roundRef.current);
      setTimeout(() => { setFlash(null); startNextRound(); }, 700);
      projRef.current = null;
      setProj(null);
      return;
    }
    setProj({ ...p });
  }, [onScoreUpdate, startNextRound]);

  let _skzLastT = 0;
  const _skzFI = getFrameInterval();
  let _skzRaf;
  const loop = useCallback((now = performance.now()) => {
    if (now - _skzLastT < _skzFI) { rafRef.current = requestAnimationFrame(loop); return; }
    _skzLastT = now;
    if (!activeRef.current) return;
    stepPhysics();
    rafRef.current = requestAnimationFrame(loop);
  }, [stepPhysics]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; roundRef.current = 0;
    setScore(0); setRound(0);
    activeRef.current = true;
    startNextRound();
    rafRef.current = requestAnimationFrame(loop);
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); };
  }, [phase, loop, startNextRound]);

  const onDown = (e) => {
    if (projRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setAim({ x, y });
  };
  const onMove = (e) => {
    if (!aim || projRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setAim({ x, y });
  };
  const onUp = () => {
    if (!aim || projRef.current) return;
    const dx = aim.x - LAUNCH.x;
    const dy = aim.y - LAUNCH.y;
    fire(dx, dy);
    setAim(null);
  };

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 500, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, #1a0d04 0%, #03020a 100%)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#ffa500" />
        <Tile label="SHOT" val={`${round + 1} / ${ROUNDS}`} color="#fff" />
      </div>

      <div
        ref={areaRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(180deg, #0a0612, #02030a)',
          border: '1px solid rgba(255,165,0,0.18)',
          touchAction: 'none', cursor: 'crosshair',
        }}>
        {/* stars */}
        {Array.from({ length: 40 }).map((_, i) => {
          const x = (i * 137) % 100, y = (i * 79) % 100;
          return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 1.5, height: 1.5, borderRadius: '50%', background: '#fff', opacity: 0.4 }} />;
        })}

        {/* planets */}
        {data.planets.map((pl, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${pl.x}%`, top: `${pl.y}%`,
            width: `${pl.r * 2}%`, aspectRatio: '1',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #a78bfa, #6d28d9 50%, #1f1147)',
            boxShadow: '0 0 22px rgba(167,139,250,0.5)',
          }} />
        ))}

        {/* target */}
        <div style={{
          position: 'absolute', left: `${data.target.x}%`, top: `${data.target.y}%`,
          width: `${data.target.r * 2}%`, aspectRatio: '1',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffcc00, #ff6600)',
          boxShadow: '0 0 26px #ffcc00',
          animation: 'orbtarget 1.4s ease-in-out infinite',
        }} />
        <style>{`@keyframes orbtarget{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.18)}}`}</style>

        {/* launcher */}
        <div style={{
          position: 'absolute', left: `${LAUNCH.x}%`, top: `${LAUNCH.y}%`,
          transform: 'translate(-50%,-50%)',
          width: 28, height: 28, borderRadius: '50%',
          background: 'radial-gradient(circle, #fb923c, #7c2d12)',
          boxShadow: '0 0 18px #fb923c',
          border: '2px solid #fff',
        }} />

        {/* trail */}
        {proj && proj.trail.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
            width: 4, height: 4, borderRadius: '50%',
            background: '#ffe066', opacity: (i + 1) / 30,
            transform: 'translate(-50%,-50%)',
            boxShadow: '0 0 6px #ffe066',
          }} />
        ))}
        {/* projectile */}
        {proj && (
          <div style={{
            position: 'absolute', left: `${proj.x}%`, top: `${proj.y}%`,
            width: 10, height: 10, borderRadius: '50%',
            transform: 'translate(-50%,-50%)',
            background: '#fff', boxShadow: '0 0 14px #ffe066, 0 0 22px #ffa500',
          }} />
        )}

        {/* aim line */}
        {aim && !proj && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={LAUNCH.x} y1={LAUNCH.y} x2={aim.x} y2={aim.y} stroke="#ffcc00" strokeWidth="0.4" strokeDasharray="1 1" />
          </svg>
        )}
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22,
              color: flash.type === 'hit' ? '#ffcc00' : '#ff4d6d',
              textShadow: '0 0 18px currentColor', zIndex: 5, pointerEvents: 'none',
            }}>
            {flash.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
