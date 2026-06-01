import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';

const DEFAULT_GAME_TIME = 90;
const GRID = 4;
const RULES = 'COLOR TAP RUSH — A target color flashes at the top. Tap ONLY matching tiles. Right tile = +20. Wrong = -25 and combo breaks. Target color shifts every 8s. Tiles refresh fast. Chain 10+ for massive multipliers. 90 seconds of color chaos.';

const COLORS = [
  { c: '#ef4444', n: 'RED', glow: '#fca5a5' },
  { c: '#06b6d4', n: 'CYAN', glow: '#a5f3fc' },
  { c: '#10b981', n: 'GREEN', glow: '#6ee7b7' },
  { c: '#fbbf24', n: 'GOLD', glow: '#fde68a' },
  { c: '#ec4899', n: 'PINK', glow: '#f9a8d4' },
];

const makeGrid = () => Array.from({ length: GRID * GRID }, () => Math.floor(Math.random() * COLORS.length));

export default function ColorTapRush({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [combo, setCombo] = useState(0);
  const [target, setTarget] = useState(0);
  const [grid, setGrid] = useState(makeGrid);
  const [flash, setFlash] = useState(null);
  const [popped, setPopped] = useState(null);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const timerRef = useRef(null);
  const targetRef = useRef(null);
  const refreshRef = useRef(null);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const handleTap = useCallback((idx) => {
    if (!gameActiveRef.current) return;
    const matched = grid[idx] === target;
    setPopped({ idx, matched, id: Math.random() });
    setTimeout(() => setPopped(null), 280);

    if (matched) {
      comboRef.current += 1;
      setCombo(comboRef.current);
      const bonus = comboRef.current >= 10 ? 20 : comboRef.current >= 5 ? 10 : 0;
      const pts = 20 + bonus;
      addScore(pts);
      setFlash({ id: Math.random(), pts, col: COLORS[target].c });
      setTimeout(() => setFlash(null), 500);
      if (comboRef.current % 10 === 0) chord([523, 659, 784, 1047], 0.04, 0.16, 'sine', 0.22);
      else tone(440 + comboRef.current * 12, 0.08, 'sine', 0.22);
      triggerHaptic(comboRef.current % 10 === 0 ? 'success' : 'light');

      setGrid((prev) => {
        const ng = prev.slice();
        ng[idx] = Math.floor(Math.random() * COLORS.length);
        return ng;
      });
    } else {
      comboRef.current = 0;
      setCombo(0);
      addScore(-25);
      noiseHit(0.15, 0.2);
      triggerHaptic('error');
      setFlash({ id: Math.random(), pts: -25, col: '#ef4444' });
      setTimeout(() => setFlash(null), 500);
    }
  }, [grid, target, addScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME);
    setGrid(makeGrid());
    setTarget(Math.floor(Math.random() * COLORS.length));

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        clearInterval(targetRef.current);
        clearInterval(refreshRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);

    targetRef.current = setInterval(() => {
      setTarget((prev) => {
        let n = Math.floor(Math.random() * COLORS.length);
        if (n === prev) n = (n + 1) % COLORS.length;
        return n;
      });
      tone(880, 0.1, 'triangle', 0.2);
    }, 8000);

    refreshRef.current = setInterval(() => {
      setGrid((prev) => {
        const ng = prev.slice();
        const k = Math.floor(Math.random() * ng.length);
        ng[k] = Math.floor(Math.random() * COLORS.length);
        return ng;
      });
    }, 800);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      clearInterval(targetRef.current);
      clearInterval(refreshRef.current);
    };
  }, [phase, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>■</div>
      <h2 style={{ color: '#ec4899', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #ec4899' }}>COLOR TAP RUSH</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, GAME_TIME);
  const tgt = COLORS[target];

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden',
      background: `radial-gradient(ellipse at top, ${tgt.c}1a, #020617 70%)`,
      fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
      padding: '60px 12px 30px', transition: 'background 320ms',
    }}>
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="COMBO" value={`×${combo}`} color="#fbbf24" />
      </div>

      <motion.div
        key={target}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.1, 1], opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          margin: '54px auto 22px',
          width: 220, padding: '14px 24px',
          background: `${tgt.c}22`, border: `2px solid ${tgt.c}`,
          borderRadius: 18, textAlign: 'center',
          boxShadow: `0 0 36px ${tgt.c}88, inset 0 0 24px ${tgt.c}44`,
        }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.2em' }}>TAP ONLY</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: tgt.c, textShadow: `0 0 16px ${tgt.c}`, letterSpacing: '0.12em' }}>
          {tgt.n}
        </div>
      </motion.div>

      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${GRID}, 1fr)`, gap: 8,
        maxWidth: 380, margin: '0 auto',
      }}>
        {grid.map((c, i) => {
          const col = COLORS[c];
          const wasPop = popped?.idx === i;
          return (
            <motion.button
              key={i}
              onPointerDown={() => handleTap(i)}
              animate={wasPop ? { scale: [1, 1.2, 1], rotate: [0, popped.matched ? 6 : -6, 0] } : { scale: 1 }}
              transition={{ duration: 0.28 }}
              style={{
                aspectRatio: '1', borderRadius: 14,
                background: `linear-gradient(135deg, ${col.glow}, ${col.c})`,
                border: c === target ? `2px solid #fff` : `2px solid ${col.c}66`,
                cursor: 'pointer', position: 'relative',
                boxShadow: `0 6px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 18px ${col.c}55`,
              }}>
              <div style={{
                position: 'absolute', top: '12%', left: '18%', width: '36%', height: '24%',
                borderRadius: '50%', background: 'rgba(255,255,255,0.5)', filter: 'blur(3px)',
                pointerEvents: 'none',
              }} />
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div key={flash.id}
            initial={{ opacity: 1, scale: 0.7, y: 0 }}
            animate={{ opacity: 0, scale: 1.4, y: -60 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'fixed', left: '50%', top: '50%',
              transform: 'translate(-50%,-50%)',
              color: flash.col, fontWeight: 900, fontSize: 30,
              textShadow: `0 0 18px ${flash.col}`, pointerEvents: 'none', zIndex: 30,
            }}>
            {flash.pts > 0 ? `+${flash.pts}` : flash.pts}
          </motion.div>
        )}
      </AnimatePresence>

      <TimerBar pct={timeLeft / GAME_TIME} color={tc} />
    </div>
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
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.06)', zIndex: 10 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear' }} />
    </div>
  );
}
