import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, hudColor } from './_groupKit';
import { TimeBar } from './_shell';
import { getFrameInterval } from '../../../lib/canvasQuality';

const RULES = 'COMET CATCHER — Slide the basket left/right to catch falling comets. Gold = +120, blue = +60, red bombs = -80. Drag anywhere to move. 90 seconds.';
const DEFAULT_DURATION = 90;
const STAGE_H = 460;
const BASKET_W = 90;

let id = 0;
function makeItem() {
  const r = Math.random();
  let type;
  if (r < 0.55) type = 'blue';
  else if (r < 0.8) type = 'gold';
  else type = 'bomb';
  return { id: ++id, x: 5 + Math.random() * 90, y: -8, type, vy: 0.35 + Math.random() * 0.35 };
}

export default function CometCatcher({ phase, setPhase, onScoreUpdate, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [items, setItems] = useState([]);
  const [basketX, setBasketX] = useState(50);

  const scoreRef = useRef(0);
  const itemsRef = useRef([]);
  const basketRef = useRef(50);
  const timerRef = useRef();
  const rafRef = useRef();
  const spawnRef = useRef();
  const overRef = useRef(false);
  const stageRef = useRef(null);

  const updateScore = useCallback((d) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
  }, [onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    overRef.current = false;
    scoreRef.current = 0; itemsRef.current = []; basketRef.current = 50;
    setScore(0); setTimeLeft(DURATION); setItems([]); setBasketX(50);

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        clearTimeout(spawnRef.current);
        overRef.current = true;
        onScoreUpdate?.(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(() => setPhase('won'), 350);
      }
    }, 1000);

    const tick = () => {
      if (overRef.current) return;
      itemsRef.current.push(makeItem());
      const factor = 1 - (DURATION - t) / DURATION * 0.5;
      spawnRef.current = setTimeout(tick, (350 + Math.random() * 500) * factor);
    };
    spawnRef.current = setTimeout(tick, 500);

    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const loop = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(loop); return; }
      _skzLastT = now;
      if (overRef.current) return;
      itemsRef.current = itemsRef.current.flatMap(it => {
        it.y += it.vy;
        if (it.y >= 95) {
          // basketRef and it.x are percent (0-100); convert BASKET_W (px) to
          // percent using the stage width so the hitbox stays correct on any
          // viewport.
          const stageW = stageRef.current?.getBoundingClientRect()?.width || 360;
          const halfBasketPct = (BASKET_W / 2) / stageW * 100;
          const dx = Math.abs(it.x - basketRef.current);
          if (dx < halfBasketPct) {
            if (it.type === 'gold') { updateScore(120); tone(700, 0.12, 'triangle', 0.25); triggerHaptic('success'); }
            else if (it.type === 'blue') { updateScore(60); tone(523, 0.1, 'sine', 0.2); triggerHaptic('light'); }
            else { updateScore(-80); tone(120, 0.2, 'sawtooth', 0.2, -40); triggerHaptic('error'); }
          }
          return [];
        }
        return [it];
      });
      setItems([...itemsRef.current]);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, updateScore, setPhase, onScoreUpdate]);

  const handleMove = (e) => {
    if (overRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const cx = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const pct = Math.max(0, Math.min(100, (cx / rect.width) * 100));
    basketRef.current = pct;
    setBasketX(pct);
  };

  if (phase === 'rules') {
    return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;
  }

  const tc = hudColor(timeLeft, DURATION);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Hud label="Score" value={score} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}</p>
        </div>
      </div>

      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <div ref={stageRef}
        onPointerDown={handleMove}
        onPointerMove={handleMove}
        style={{ position: 'relative', height: STAGE_H, background: 'radial-gradient(circle at top, rgba(0,212,255,0.07), rgba(0,0,0,0.4))', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 20, overflow: 'hidden', touchAction: 'none', cursor: 'grab' }}>
        <AnimatePresence>
          {items.map(it => {
            const color = it.type === 'gold' ? '#fbbf24' : it.type === 'blue' ? '#06b6d4' : '#ef4444';
            return (
              <div key={it.id}
                style={{ position: 'absolute', left: `${it.x}%`, top: `${it.y}%`, width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: '50%', background: `radial-gradient(circle, ${color}, ${color}66 60%, transparent)`, boxShadow: `0 0 16px ${color}`, pointerEvents: 'none' }} />
            );
          })}
        </AnimatePresence>
        <div style={{ position: 'absolute', left: `${basketX}%`, bottom: 12, marginLeft: -BASKET_W / 2, width: BASKET_W, height: 18, borderRadius: 10, background: 'linear-gradient(180deg, #06b6d4, #0e7490)', border: '2px solid #67e8f9', boxShadow: '0 0 14px rgba(0,212,255,0.6)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function Hud({ label, value, color }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}99`, margin: 0, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color, margin: 0 }}>{value}</p>
    </div>
  );
}
