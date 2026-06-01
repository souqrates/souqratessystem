import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';
import { getFrameInterval } from '../../../lib/canvasQuality';

const DEFAULT_GAME_TIME = 90;
const RULES = 'STACK STORM — A block slides side-to-side. Tap to drop it onto the tower. Perfect alignment = +50 + width bonus. Misalignment trims your block. Build the highest tower under the 90-second clock. Speed escalates with height.';

const BASE_W = 220;
const BLOCK_H = 22;

export default function StackStorm({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [height, setHeight] = useState(0);
  const [tower, setTower] = useState([]);  // {x, w, hue}
  const [movingX, setMovingX] = useState(0);
  const [movingW, setMovingW] = useState(BASE_W);
  const [movingHue, setMovingHue] = useState('#06b6d4');
  const [perfectFlash, setPerfectFlash] = useState(null);

  const scoreRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(2.4);
  const widthRef = useRef(BASE_W);
  const lastXRef = useRef(0);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const handleDrop = useCallback(() => {
    if (!gameActiveRef.current) return;
    const cx = movingX;
    const cw = movingW;
    const last = tower[tower.length - 1] || { x: 0, w: BASE_W };
    const overlapL = Math.max(cx, last.x);
    const overlapR = Math.min(cx + cw, last.x + last.w);
    const overlap = Math.max(0, overlapR - overlapL);

    if (overlap === 0) {
      // Full miss = game over
      gameActiveRef.current = false;
      noiseHit(0.3, 0.3);
      triggerHaptic('error');
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
      setTimeout(() => setPhase('lost'), 600);
      return;
    }

    const trim = cw - overlap;
    let pts;
    const newHue = nextHue(tower.length);
    if (trim < 4) {
      pts = 50 + Math.floor(overlap * 0.1);
      setPerfectFlash({ id: Math.random() });
      setTimeout(() => setPerfectFlash(null), 600);
      chord([523, 784, 1047], 0.05, 0.15, 'sine', 0.22);
      triggerHaptic('success');
    } else {
      pts = 15 + Math.floor(overlap * 0.05);
      tone(440, 0.1, 'sine', 0.22);
      triggerHaptic('light');
    }
    addScore(pts);

    widthRef.current = overlap;
    setTower((prev) => [...prev, { x: overlapL, w: overlap, hue: newHue }]);
    setHeight((h) => h + 1);
    setMovingW(overlap);
    setMovingHue(nextHue(tower.length + 1));
    speedRef.current = Math.min(7, speedRef.current + 0.1);
  }, [tower, movingX, movingW, addScore, setPhase]);

  let _skzLastT = 0;
  const _skzFI = getFrameInterval();
  let _skzRaf;
  const animate = useCallback((now = performance.now()) => {
    if (now - _skzLastT < _skzFI) { rafRef.current = requestAnimationFrame(animate); return; }
    _skzLastT = now;
    if (!gameActiveRef.current) return;
    const maxX = 340 - widthRef.current;
    let nx = lastXRef.current + dirRef.current * speedRef.current;
    if (nx > maxX) { nx = maxX; dirRef.current = -1; }
    if (nx < 0) { nx = 0; dirRef.current = 1; }
    lastXRef.current = nx;
    setMovingX(nx);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0;
    speedRef.current = 2.4;
    widthRef.current = BASE_W;
    lastXRef.current = 60;
    dirRef.current = 1;
    setScore(0); setHeight(0); setTimeLeft(GAME_TIME);
    setTower([{ x: 60, w: BASE_W, hue: '#1e293b' }]);
    setMovingX(60); setMovingW(BASE_W); setMovingHue('#06b6d4');

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, animate, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>■</div>
      <h2 style={{ color: '#10b981', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #10b981' }}>STACK STORM</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, GAME_TIME);
  const camY = Math.min(0, 300 - (height + 2) * BLOCK_H);

  return (
    <div onPointerDown={handleDrop}
      style={{
        position: 'relative', width: '100%', height: '100vh', overflow: 'hidden',
        background: 'linear-gradient(180deg, #1e293b, #020617)',
        fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
        cursor: 'pointer',
      }}>
      {/* Stars */}
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', width: 2, height: 2, borderRadius: '50%',
          background: '#fff', opacity: 0.4 + Math.random() * 0.4,
          left: `${(i * 41) % 100}%`, top: `${(i * 71) % 100}%`,
        }} />
      ))}

      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="HEIGHT" value={height} color="#10b981" />
      </div>

      {/* Tower viewport */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: `translate(-50%, calc(-50% + ${-camY}px))`,
        width: 360, transition: 'transform 0.25s ease-out',
      }}>
        {tower.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: b.x, bottom: i * BLOCK_H,
            width: b.w, height: BLOCK_H,
            background: `linear-gradient(180deg, ${b.hue}, ${b.hue}aa)`,
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
            boxShadow: `0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 14px ${b.hue}44`,
          }} />
        ))}
        {/* Moving block */}
        <motion.div
          animate={{ left: movingX }}
          transition={{ duration: 0, ease: 'linear' }}
          style={{
            position: 'absolute', bottom: tower.length * BLOCK_H,
            width: movingW, height: BLOCK_H,
            background: `linear-gradient(180deg, ${movingHue}, ${movingHue}aa)`,
            border: '2px solid #fff', borderRadius: 4,
            boxShadow: `0 0 18px ${movingHue}, 0 0 30px ${movingHue}88`,
          }} />
      </div>

      <AnimatePresence>
        {perfectFlash && (
          <motion.div key={perfectFlash.id}
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.6, y: -50 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute', left: '50%', top: '40%',
              transform: 'translate(-50%,-50%)',
              color: '#fbbf24', fontWeight: 900, fontSize: 26,
              textShadow: '0 0 20px #fbbf24', pointerEvents: 'none', zIndex: 20,
            }}>
            PERFECT!
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(148,163,184,0.6)', fontSize: 11, letterSpacing: 2, pointerEvents: 'none' }}>
        TAP TO DROP
      </div>

      <TimerBar pct={timeLeft / GAME_TIME} color={tc} />
    </div>
  );
}

function nextHue(idx) {
  const hues = ['#06b6d4', '#10b981', '#fbbf24', '#ec4899', '#3b82f6', '#f43f5e', '#8b5cf6'];
  return hues[idx % hues.length];
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
