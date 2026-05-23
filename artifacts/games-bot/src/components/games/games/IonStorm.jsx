import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'ION STORM \u2014 Rings expand from each target. Tap when the ring perfectly aligns with the gold band. Perfect = +50, Good = +25, Late = combo break. 90 seconds.';
const DEFAULT_GAME_TIME = 90;
const HIT_RADIUS = 38;        // px target ring outer radius for "perfect"
const PERFECT_BAND = 4;
const GOOD_BAND = 8;
const RING_GROWTH = 1.4;      // per 16ms

export default function IonStorm({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [targets, setTargets] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);

  const targetsRef = useRef([]);
  const idRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const spawnAccRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const loop = useCallback((ts) => {
    if (!activeRef.current) return;
    const dt = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = ts;

    spawnAccRef.current += dt;
    if (spawnAccRef.current > 1.0 && targetsRef.current.length < 3) {
      spawnAccRef.current = 0;
      targetsRef.current.push({
        id: idRef.current++,
        x: 15 + Math.random() * 70, y: 18 + Math.random() * 64,
        r: 4, hit: false, age: 0,
      });
    }

    targetsRef.current.forEach(t => { t.r += dt * 22; t.age += dt; });
    targetsRef.current = targetsRef.current.filter(t => {
      if (t.r > HIT_RADIUS + GOOD_BAND + 6 && !t.hit) {
        comboRef.current = 0; setCombo(0);
        return false;
      }
      return !t.hit;
    });
    setTargets([...targetsRef.current]);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const onTap = (e, t) => {
    e.stopPropagation();
    if (t.hit) return;
    const diff = Math.abs(t.r - HIT_RADIUS);
    t.hit = true;
    if (diff <= PERFECT_BAND) {
      const next = comboRef.current + 1; comboRef.current = next; setCombo(next);
      const pts = 50 + next * 4;
      scoreRef.current += pts; setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      setFlash({ type: 'PERFECT', pts, id: Math.random() });
      beep({ freq: 920, dur: 0.12, type: 'square' });
      triggerHaptic('medium');
    } else if (diff <= GOOD_BAND) {
      const next = comboRef.current + 1; comboRef.current = next; setCombo(next);
      const pts = 25 + next * 2;
      scoreRef.current += pts; setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      setFlash({ type: 'GOOD', pts, id: Math.random() });
      beep({ freq: 640, dur: 0.1, type: 'triangle' });
      triggerHaptic('light');
    } else {
      comboRef.current = 0; setCombo(0);
      setFlash({ type: 'OFF', id: Math.random() });
      noise({ dur: 0.14, vol: 0.16 });
      triggerHaptic('error');
    }
    setTimeout(() => setFlash(null), 320);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    targetsRef.current = []; idRef.current = 0;
    scoreRef.current = 0; comboRef.current = 0; spawnAccRef.current = 0;
    setTargets([]); setScore(0); setCombo(0); setTimeLeft(GAME_TIME);
    activeRef.current = true; lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); };
  }, [phase, loop, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #06182a 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5ff" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{
        position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
        background: 'radial-gradient(circle at center, rgba(0,245,255,0.04), rgba(0,0,0,0.6))',
        border: '1px solid rgba(0,245,255,0.2)', minHeight: 380,
      }}>
        {targets.map(t => {
          const perfect = Math.abs(t.r - HIT_RADIUS) <= PERFECT_BAND;
          return (
            <div key={t.id} onPointerDown={(e) => onTap(e, t)} style={{
              position: 'absolute', left: `${t.x}%`, top: `${t.y}%`,
              transform: 'translate(-50%,-50%)', cursor: 'pointer', touchAction: 'none',
              width: HIT_RADIUS * 2 + 30, height: HIT_RADIUS * 2 + 30, marginLeft: -(HIT_RADIUS + 15), marginTop: -(HIT_RADIUS + 15),
            }}>
              {/* gold target ring */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                width: HIT_RADIUS * 2, height: HIT_RADIUS * 2, borderRadius: '50%',
                border: '2px dashed #ffcc00', boxShadow: '0 0 12px #ffcc0066',
              }} />
              {/* expanding ring */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                width: t.r * 2, height: t.r * 2, borderRadius: '50%',
                border: `2px solid ${perfect ? '#00f5a0' : '#00f5ff'}`,
                boxShadow: `0 0 ${perfect ? 24 : 16}px ${perfect ? '#00f5a0' : '#00f5ff'}`,
                opacity: 0.85, transition: 'border-color 0.08s',
              }} />
              {/* center dot */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                width: 8, height: 8, borderRadius: '50%',
                background: '#fff', boxShadow: '0 0 10px #00f5ff',
              }} />
            </div>
          );
        })}
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                padding: '6px 14px', borderRadius: 999,
                background: flash.type === 'OFF' ? 'rgba(255,77,109,0.2)' : flash.type === 'PERFECT' ? 'rgba(0,245,160,0.2)' : 'rgba(0,245,255,0.2)',
                border: `1px solid ${flash.type === 'OFF' ? '#ff4d6d' : flash.type === 'PERFECT' ? '#00f5a0' : '#00f5ff'}`,
                color: flash.type === 'OFF' ? '#ff4d6d' : flash.type === 'PERFECT' ? '#00f5a0' : '#00f5ff',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.15em',
              }}>
              {flash.type === 'OFF' ? 'OFF BAND' : `${flash.type} +${flash.pts}`}
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
