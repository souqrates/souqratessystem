import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise, pick } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'COLOR HUNT \u2014 A target color shows at the top. Tap ONLY tiles of that color. Wrong tap = -10. Target changes every 5 seconds. Faster taps = bonus. 60 seconds.';
const GAME_TIME = 60;
const PALETTE = [
  { c: '#ff3355', name: 'RED' },
  { c: '#00f5a0', name: 'GREEN' },
  { c: '#00f5ff', name: 'CYAN' },
  { c: '#ffcc00', name: 'GOLD' },
  { c: '#ff66ee', name: 'PINK' },
];
const GRID = 12;

export default function ColorHunt({ phase, setPhase, onScoreUpdate, game }) {
  const DURATION = game?.durationSeconds || GAME_TIME;
  const [target, setTarget] = useState(PALETTE[0]);
  const [tiles, setTiles] = useState(() => randTiles());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);

  const targetRef = useRef(PALETTE[0]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const tickRef = useRef(null);
  const targetTimerRef = useRef(null);
  const activeRef = useRef(false);

  function randTiles() {
    return Array.from({ length: GRID }, (_, i) => ({ id: i, c: pick(PALETTE) }));
  }

  const newTarget = useCallback(() => {
    const t = pick(PALETTE);
    targetRef.current = t;
    setTarget(t);
    setTiles(randTiles());
    beep({ freq: 440, dur: 0.08, type: 'sine', vol: 0.12 });
  }, []);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    clearInterval(targetTimerRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(scoreRef.current >= (game?.targetScore || 300) ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game?.targetScore]);

  const onTap = (i, c) => {
    if (!activeRef.current) return;
    if (c.name === targetRef.current.name) {
      const next = comboRef.current + 1;
      comboRef.current = next;
      setCombo(next);
      const pts = 15 + next * 2;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      setFlash({ ok: true, pts, id: Math.random() });
      beep({ freq: 600 + next * 20, dur: 0.07, type: 'triangle' });
      triggerHaptic('light');
      setTiles(prev => {
        const newTile = { id: Math.random(), c: pick(PALETTE) };
        return prev.map(t => t.id === i ? newTile : t);
      });
      setTimeout(() => setFlash(null), 220);
    } else {
      comboRef.current = 0;
      setCombo(0);
      scoreRef.current = Math.max(0, scoreRef.current - 10);
      setScore(scoreRef.current);
      setFlash({ ok: false, id: Math.random() });
      noise({ dur: 0.15, vol: 0.18 });
      triggerHaptic('error');
      setTimeout(() => setFlash(null), 250);
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(DURATION);
    setTiles(randTiles());
    activeRef.current = true;
    newTarget();
    targetTimerRef.current = setInterval(newTarget, 5000);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; clearInterval(tickRef.current); clearInterval(targetTimerRef.current); };
  }, [phase, newTarget, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1a0a28 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#ff66ee" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{
        padding: '12px 0', textAlign: 'center', borderRadius: 14,
        background: `linear-gradient(135deg, ${target.c}22, ${target.c}06)`,
        border: `2px solid ${target.c}`,
        boxShadow: `0 0 30px ${target.c}66, inset 0 0 20px ${target.c}22`,
      }}>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.3em', margin: 0 }}>TAP ONLY</p>
        <p style={{ fontSize: 26, fontWeight: 900, color: target.c, margin: 0,
          fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 20px ${target.c}` }}>{target.name}</p>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridAutoRows: '1fr', gap: 8 }}>
        {tiles.map(t => (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.92 }}
            onPointerDown={() => onTap(t.id, t.c)}
            style={{
              borderRadius: 14, cursor: 'pointer', border: `2px solid ${t.c.c}88`,
              background: `linear-gradient(135deg, ${t.c.c}, ${t.c.c}66)`,
              boxShadow: `0 0 14px ${t.c.c}55, inset 0 0 18px rgba(0,0,0,0.3)`,
              minHeight: 56,
            }} />
        ))}
      </div>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 1, scale: 0.7, y: 0 }}
            animate={{ opacity: 0, scale: 1.4, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 24, pointerEvents: 'none',
              color: flash.ok ? '#00f5a0' : '#ff3355',
              textShadow: `0 0 18px ${flash.ok ? '#00f5a0' : '#ff3355'}`,
            }}>
            {flash.ok ? `+${flash.pts}` : '-10'}
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
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
