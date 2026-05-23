import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise, pick } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'PLASMA CATCH \u2014 An ACTIVE color shows at top. Tap orbs of that color only. Wrong color = penalty. Active color changes every 4s. 90 seconds.';
const DEFAULT_GAME_TIME = 90;
const COLORS = [
  { c: '#00f5ff', name: 'CYAN', freq: 660 },
  { c: '#ff66ee', name: 'MAGENTA', freq: 520 },
  { c: '#ffcc00', name: 'GOLD', freq: 480 },
  { c: '#00f5a0', name: 'JADE', freq: 740 },
];

export default function PlasmaCatch({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [orbs, setOrbs] = useState([]);
  const [active, setActive] = useState(COLORS[0]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);

  const orbsRef = useRef([]);
  const idRef = useRef(0);
  const activeRef = useRef(COLORS[0]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const spawnAccRef = useRef(0);
  const colorAccRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const isOnRef = useRef(false);

  const endGame = useCallback(() => {
    isOnRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const switchColor = () => {
    let next;
    do { next = pick(COLORS); } while (next.name === activeRef.current.name);
    activeRef.current = next;
    setActive(next);
    beep({ freq: next.freq, dur: 0.12, type: 'sine', vol: 0.14 });
  };

  const loop = useCallback((ts) => {
    if (!isOnRef.current) return;
    const dt = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = ts;

    spawnAccRef.current += dt;
    if (spawnAccRef.current > 0.35) {
      spawnAccRef.current = 0;
      const c = pick(COLORS);
      orbsRef.current.push({
        id: idRef.current++, c, x: 10 + Math.random() * 80, y: -8,
        vy: 18 + Math.random() * 18, vx: (Math.random() - 0.5) * 4,
      });
    }
    colorAccRef.current += dt;
    if (colorAccRef.current > 4) { colorAccRef.current = 0; switchColor(); }

    orbsRef.current.forEach(o => { o.y += o.vy * dt; o.x += o.vx * dt; });
    orbsRef.current = orbsRef.current.filter(o => o.y < 115);
    setOrbs([...orbsRef.current]);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const onTap = (e, orb) => {
    e.stopPropagation();
    if (!isOnRef.current) return;
    orbsRef.current = orbsRef.current.filter(o => o.id !== orb.id);
    if (orb.c.name === activeRef.current.name) {
      const next = comboRef.current + 1;
      comboRef.current = next;
      setCombo(next);
      const pts = 18 + next * 2;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      beep({ freq: orb.c.freq + next * 8, dur: 0.08, type: 'triangle' });
      triggerHaptic('light');
      setFlash({ ok: true, pts, id: Math.random() });
    } else {
      comboRef.current = 0; setCombo(0);
      scoreRef.current = Math.max(0, scoreRef.current - 8);
      setScore(scoreRef.current);
      noise({ dur: 0.15, vol: 0.16 });
      triggerHaptic('error');
      setFlash({ ok: false, id: Math.random() });
    }
    setTimeout(() => setFlash(null), 240);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    orbsRef.current = []; idRef.current = 0; scoreRef.current = 0; comboRef.current = 0;
    spawnAccRef.current = 0; colorAccRef.current = 0;
    activeRef.current = COLORS[0]; setActive(COLORS[0]);
    setOrbs([]); setScore(0); setCombo(0); setTimeLeft(GAME_TIME);
    isOnRef.current = true; lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { isOnRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); };
  }, [phase, loop, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1a0828 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5ff" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{
        padding: '10px 0', textAlign: 'center', borderRadius: 12,
        background: `linear-gradient(135deg, ${active.c}22, ${active.c}06)`,
        border: `2px solid ${active.c}`, boxShadow: `0 0 24px ${active.c}66`,
      }}>
        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.3em', margin: 0 }}>TAP COLOR</p>
        <p style={{ fontSize: 22, fontWeight: 900, color: active.c, margin: 0,
          fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 18px ${active.c}` }}>{active.name}</p>
      </div>
      <div style={{
        position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.5))',
        border: '1px solid rgba(255,255,255,0.05)', touchAction: 'none', minHeight: 360,
      }}>
        {orbs.map(o => (
          <div key={o.id} onPointerDown={(e) => onTap(e, o)} style={{
            position: 'absolute', left: `${o.x}%`, top: `${o.y}%`, transform: 'translate(-50%,-50%)',
            width: 38, height: 38, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${o.c.c}, ${o.c.c}55)`,
            border: `2px solid ${o.c.c}`, boxShadow: `0 0 18px ${o.c.c}`,
            cursor: 'pointer',
          }} />
        ))}
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.id}
              initial={{ opacity: 1, scale: 0.6, y: 0 }}
              animate={{ opacity: 0, scale: 1.4, y: -20 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 26, pointerEvents: 'none',
                color: flash.ok ? '#00f5a0' : '#ff3355',
                textShadow: `0 0 18px ${flash.ok ? '#00f5a0' : '#ff3355'}`,
              }}>
              {flash.ok ? `+${flash.pts}` : '-8'}
            </motion.div>
          )}
        </AnimatePresence>
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
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
