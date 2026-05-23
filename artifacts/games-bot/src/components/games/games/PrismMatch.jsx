import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';

const RULES = 'PRISM MATCH — A target color appears at the top. Tap any tile matching the SAME color to score. Tap a wrong color and lose points. Tiles refresh each second — 90s sprint.';
const DEFAULT_DURATION = 90;
const COLORS = [
  { name: 'CYAN',   hex: '#06b6d4' },
  { name: 'AMBER',  hex: '#f59e0b' },
  { name: 'ROSE',   hex: '#f43f5e' },
  { name: 'GREEN',  hex: '#10b981' },
  { name: 'BLUE',   hex: '#3b82f6' },
  { name: 'PINK',   hex: '#ec4899' },
];

function makeGrid(target) {
  const tiles = Array.from({ length: 12 }, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
  if (!tiles.some(t => t.hex === target.hex)) tiles[Math.floor(Math.random() * 12)] = target;
  return tiles;
}

export default function PrismMatch({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [target, setTarget] = useState(COLORS[0]);
  const [tiles, setTiles] = useState(() => makeGrid(COLORS[0]));
  const [popped, setPopped] = useState(new Set());

  const scoreRef = useRef(0);
  const timerRef = useRef();
  const cycleRef = useRef();
  const overRef = useRef(false);

  const updateScore = useCallback((d) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [onScoreUpdate]);

  const nextRound = useCallback(() => {
    if (overRef.current) return;
    const t = COLORS[Math.floor(Math.random() * COLORS.length)];
    setTarget(t);
    setTiles(makeGrid(t));
    setPopped(new Set());
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(DURATION);
    nextRound();

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        clearInterval(cycleRef.current);
        overRef.current = true;
        onScoreUpdate?.(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(() => setPhase('won'), 350);
      }
    }, 1000);

    cycleRef.current = setInterval(nextRound, 1000);

    return () => { clearInterval(timerRef.current); clearInterval(cycleRef.current); };
  }, [phase, nextRound, setPhase, onScoreUpdate]);

  const tap = (i) => {
    if (overRef.current || popped.has(i)) return;
    const tile = tiles[i];
    setPopped(p => new Set(p).add(i));
    if (tile.hex === target.hex) {
      tone(523 + Math.random() * 120, 0.1, 'triangle', 0.2);
      triggerHaptic('light');
      updateScore(80);
    } else {
      tone(160, 0.18, 'sawtooth', 0.16, -40);
      triggerHaptic('error');
      updateScore(-40);
    }
  };

  if (phase === 'rules') {
    return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;
  }

  const tc = hudColor(timeLeft, DURATION);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Hud label="Score" value={score} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}</p>
        </div>
        <Hud label="Target" value={target.name} color={target.hex} />
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <motion.div key={target.hex}
        initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        style={{ background: `${target.hex}1a`, border: `1px solid ${target.hex}66`, borderRadius: 14, padding: '12px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Match Color</p>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: target.hex, textShadow: `0 0 16px ${target.hex}`, margin: '4px 0 0' }}>
          {target.name}
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {tiles.map((tile, i) => {
          const isPopped = popped.has(i);
          return (
            <motion.button key={i}
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => tap(i)}
              animate={{ opacity: isPopped ? 0.25 : 1, scale: isPopped ? 0.85 : 1 }}
              style={{ height: 80, borderRadius: 16, border: `2px solid ${tile.hex}55`, background: `radial-gradient(circle at 35% 30%, ${tile.hex}, ${tile.hex}aa)`, boxShadow: `0 0 18px ${tile.hex}44`, cursor: 'pointer', padding: 0 }} />
          );
        })}
      </div>
    </div>
  );
}

function Hud({ label, value, color }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}99`, margin: 0, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color, margin: 0 }}>{value}</p>
    </div>
  );
}
