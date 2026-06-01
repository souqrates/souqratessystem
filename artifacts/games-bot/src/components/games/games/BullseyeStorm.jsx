import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';
import { getFrameInterval } from '../../../lib/canvasQuality';

const DEFAULT_GAME_TIME = 90;
const RULES = 'BULLSEYE STORM — Targets erupt across the field. Hit the gold center for +75. Outer rings = +30 / +15. Miss the target field = -10. Targets shrink and vanish — tap fast. 90 seconds of pure accuracy under pressure.';

export default function BullseyeStorm({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [targets, setTargets] = useState([]);
  const [shots, setShots] = useState([]);
  const [accuracy, setAccuracy] = useState(0);

  const scoreRef = useRef(0);
  const tIdRef = useRef(0);
  const hitsRef = useRef(0);
  const totalShotsRef = useRef(0);
  const spawnRef = useRef(null);
  const timerRef = useRef(null);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const spawn = useCallback(() => {
    if (!gameActiveRef.current) return;
    const tier = Math.min(4, Math.floor(scoreRef.current / 350));
    const life = Math.max(1100, 2200 - tier * 220);
    const targ = {
      id: tIdRef.current++,
      x: 10 + Math.random() * 80,
      y: 18 + Math.random() * 64,
      size: 110 - tier * 8,
      birth: Date.now(),
      life,
    };
    setTargets((prev) => [...prev, targ]);
    setTimeout(() => {
      setTargets((prev) => prev.filter((t) => t.id !== targ.id));
    }, life);
  }, []);

  const handleAreaTap = useCallback((e) => {
    if (!gameActiveRef.current) return;
    totalShotsRef.current += 1;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const px = (cx / rect.width) * 100;
    const py = (cy / rect.height) * 100;

    let hit = null;
    let bestRatio = 999;
    for (const t of targets) {
      const tx = (t.x / 100) * rect.width;
      const ty = (t.y / 100) * rect.height;
      const dx = cx - tx;
      const dy = cy - ty;
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = t.size / 2;
      if (d <= r) {
        const ratio = d / r;
        if (ratio < bestRatio) { bestRatio = ratio; hit = t; }
      }
    }

    setShots((prev) => [...prev.slice(-8), { id: Math.random(), x: px, y: py, hit: !!hit }]);

    if (hit) {
      hitsRef.current += 1;
      let pts = 0, col = '';
      if (bestRatio < 0.25) { pts = 75; col = '#fbbf24'; chord([880, 1175, 1568], 0.03, 0.13, 'triangle', 0.25); }
      else if (bestRatio < 0.55) { pts = 30; col = '#10b981'; tone(660, 0.1, 'triangle', 0.25); }
      else { pts = 15; col = '#06b6d4'; tone(440, 0.1, 'sine', 0.22); }
      addScore(pts);
      triggerHaptic(pts >= 75 ? 'success' : 'light');
      setShots((prev) => [...prev, { id: Math.random(), x: px, y: py, hit: true, label: `+${pts}`, col }]);
      setTargets((prev) => prev.filter((t) => t.id !== hit.id));
    } else {
      addScore(-10);
      noiseHit(0.12, 0.18);
      triggerHaptic('error');
    }
    setAccuracy(Math.round((hitsRef.current / totalShotsRef.current) * 100));
  }, [targets, addScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0; hitsRef.current = 0; totalShotsRef.current = 0;
    setScore(0); setAccuracy(0); setTimeLeft(GAME_TIME); setTargets([]); setShots([]);

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        clearTimeout(spawnRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);

    const sched = () => {
      if (!gameActiveRef.current) return;
      spawn();
      const tier = Math.min(4, Math.floor(scoreRef.current / 350));
      spawnRef.current = setTimeout(sched, Math.max(500, 1100 - tier * 130));
    };
    setTimeout(sched, 400);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
    };
  }, [phase, spawn, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>◎</div>
      <h2 style={{ color: '#fbbf24', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #fbbf24' }}>BULLSEYE STORM</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, GAME_TIME);

  return (
    <div onPointerDown={handleAreaTap}
      style={{
        position: 'relative', width: '100%', height: '100vh', overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #2a1a05 0%, #020617 70%)',
        fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
      }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.12,
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.4), transparent 60%)',
        pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#fbbf24" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="ACC" value={`${accuracy}%`} color="#22d3ee" />
      </div>

      <AnimatePresence>
        {targets.map((t) => <Target key={t.id} target={t} />)}
      </AnimatePresence>

      <AnimatePresence>
        {shots.map((s) => (
          <motion.div key={s.id}
            initial={{ opacity: 1, scale: 0.6 }}
            animate={{ opacity: 0, scale: s.label ? 2 : 1.2, y: s.label ? -30 : 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
              transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 30,
            }}>
            {s.label ? (
              <span style={{ fontWeight: 900, fontSize: 22, color: s.col, textShadow: `0 0 14px ${s.col}` }}>{s.label}</span>
            ) : (
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.hit ? '#10b981' : '#ef4444', boxShadow: `0 0 12px ${s.hit ? '#10b981' : '#ef4444'}` }} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <TimerBar pct={timeLeft / GAME_TIME} color={tc} />
    </div>
  );
}

function Target({ target }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const start = Date.now();
    let raf;
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const tick = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(tick); return; }
      _skzLastT = now;
      const e = (Date.now() - start) / target.life;
      setScale(Math.max(0.3, 1 - e * 0.7));
      if (e < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.life]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute', left: `${target.x}%`, top: `${target.y}%`,
        transform: 'translate(-50%,-50%)',
        width: target.size, height: target.size, borderRadius: '50%',
        background: `radial-gradient(circle, #fbbf24 0%, #fbbf24 15%, #ffffff 15%, #ffffff 28%, #ef4444 28%, #ef4444 50%, #ffffff 50%, #ffffff 70%, #06b6d4 70%, #06b6d4 100%)`,
        border: '2px solid rgba(255,255,255,0.6)',
        boxShadow: '0 0 30px rgba(251,191,36,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      }}>
      <div style={{
        position: 'absolute', inset: '45%', borderRadius: '50%',
        background: '#fff', boxShadow: '0 0 10px #fff',
      }} />
    </motion.div>
  );
}

function Hud({ label, value, color, pulse }) {
  return (
    <motion.div animate={pulse ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 0.6, repeat: Infinity }}
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
