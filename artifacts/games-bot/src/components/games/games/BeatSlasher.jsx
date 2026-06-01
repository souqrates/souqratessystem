import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';
import { getFrameInterval } from '../../../lib/canvasQuality';

const DEFAULT_GAME_TIME = 90;
const LANES = 3;
const RULES = 'BEAT SLASHER — Neon notes fall down 3 lanes. Tap the lane when a note crosses the hit line. PERFECT = +50, GREAT = +25, GOOD = +10, MISS = combo break. The BPM rises every 15 seconds. Slash to the rhythm. 90 seconds of pure flow.';

const LANE_HUES = ['#ec4899', '#22d3ee', '#fbbf24'];

export default function BeatSlasher({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [combo, setCombo] = useState(0);
  const [notes, setNotes] = useState([]);
  const [judgments, setJudgments] = useState([]);
  const [lanePulse, setLanePulse] = useState([false, false, false]);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const noteIdRef = useRef(0);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastTickRef = useRef(0);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const spawn = useCallback(() => {
    if (!gameActiveRef.current) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const tier = Math.min(4, Math.floor(elapsed / 15));
    setNotes((prev) => [
      ...prev,
      {
        id: noteIdRef.current++,
        lane: Math.floor(Math.random() * LANES),
        y: -8,
      },
    ]);
    const delay = Math.max(380, 900 - tier * 110);
    spawnRef.current = setTimeout(spawn, delay);
  }, []);

  const handleLaneTap = useCallback((lane) => {
    if (!gameActiveRef.current) return;
    setLanePulse((prev) => {
      const np = [...prev]; np[lane] = true; return np;
    });
    setTimeout(() => setLanePulse((prev) => { const np = [...prev]; np[lane] = false; return np; }), 180);
    // Find the closest note in this lane near the hit line (y ~ 78)
    let closest = null, bestDist = 999;
    notes.forEach((n) => {
      if (n.lane !== lane) return;
      const d = Math.abs(n.y - 78);
      if (d < bestDist && d < 15) { bestDist = d; closest = n; }
    });
    if (!closest) {
      tone(150, 0.06, 'sawtooth', 0.1);
      return;
    }
    let pts, label, col;
    if (bestDist < 3) { pts = 50; label = 'PERFECT'; col = '#fbbf24'; }
    else if (bestDist < 7) { pts = 25; label = 'GREAT'; col = '#10b981'; }
    else { pts = 10; label = 'GOOD'; col = '#06b6d4'; }
    comboRef.current += 1;
    setCombo(comboRef.current);
    const bonus = comboRef.current >= 10 ? 15 : comboRef.current >= 5 ? 8 : 0;
    addScore(pts + bonus);
    setNotes((prev) => prev.filter((n) => n.id !== closest.id));
    setJudgments((prev) => [...prev.slice(-6), { id: Math.random(), label, col, lane }]);
    setTimeout(() => setJudgments((prev) => prev.slice(1)), 700);
    tone(440 + lane * 110 + (pts === 50 ? 220 : 0), 0.1, 'triangle', 0.25);
    triggerHaptic(pts === 50 ? 'success' : 'light');
    if (comboRef.current % 10 === 0) chord([523, 659, 784, 1047, 1318], 0.04, 0.16, 'sine', 0.18);
  }, [notes, addScore]);

  const _skzLastTRef = useRef(0);
  const _skzFI = getFrameInterval();
  const animate = useCallback((ts) => {
    if (ts - _skzLastTRef.current < _skzFI) { rafRef.current = requestAnimationFrame(animate); return; }
    _skzLastTRef.current = ts;
    if (!gameActiveRef.current) return;
    if (!lastTickRef.current) lastTickRef.current = ts;
    const dt = Math.min(50, ts - lastTickRef.current);
    lastTickRef.current = ts;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const tier = Math.min(4, Math.floor(elapsed / 15));
    const speed = (0.055 + tier * 0.014) * dt;
    setNotes((prev) => {
      const updated = [];
      for (const n of prev) {
        const ny = n.y + speed;
        if (ny > 96) {
          comboRef.current = 0;
          setCombo(0);
          addScore(-12);
          noiseHit(0.1, 0.12);
          continue;
        }
        updated.push({ ...n, y: ny });
      }
      return updated;
    });
    rafRef.current = requestAnimationFrame(animate);
  }, [addScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setNotes([]); setJudgments([]);
    startTimeRef.current = Date.now(); lastTickRef.current = 0;

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        clearTimeout(spawnRef.current);
        cancelAnimationFrame(rafRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);
    setTimeout(spawn, 500);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, animate, spawn, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>♪</div>
      <h2 style={{ color: '#ec4899', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #ec4899' }}>BEAT SLASHER</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, GAME_TIME);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(180deg, #1e0a35 0%, #020617 100%)',
      fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
    }}>
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="COMBO" value={`×${combo}`} color="#fbbf24" />
      </div>

      {/* Lanes */}
      <div style={{ position: 'absolute', inset: '60px 8% 0 8%', display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((l) => {
          const isPulse = lanePulse[l];
          const judgment = judgments.findLast?.((j) => j.lane === l);
          return (
            <div
              key={l}
              style={{ flex: 1, position: 'relative', height: '100%' }}
            >
              <div
                onPointerDown={() => handleLaneTap(l)}
                style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(180deg, ${LANE_HUES[l]}08, ${LANE_HUES[l]}22)`,
                  border: `1px solid ${LANE_HUES[l]}33`,
                  borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: isPulse ? `inset 0 0 30px ${LANE_HUES[l]}aa, 0 0 24px ${LANE_HUES[l]}` : `inset 0 0 18px ${LANE_HUES[l]}22`,
                  transition: 'box-shadow 0.15s',
                  touchAction: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {/* Hit line */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '78%', height: 4,
                  background: LANE_HUES[l], boxShadow: `0 0 14px ${LANE_HUES[l]}`,
                }} />
                {/* Tap zone hint */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '70%', height: '20%',
                  background: `linear-gradient(180deg, transparent, ${LANE_HUES[l]}33, transparent)`,
                  pointerEvents: 'none',
                }} />
                {/* Notes */}
                {notes.filter((n) => n.lane === l).map((n) => (
                  <div key={n.id} style={{
                    position: 'absolute', left: '50%', top: `${n.y}%`,
                    transform: 'translate(-50%,-50%)',
                    width: 56, height: 26, borderRadius: 14,
                    background: `linear-gradient(180deg, ${LANE_HUES[l]}, ${LANE_HUES[l]}88)`,
                    boxShadow: `0 0 14px ${LANE_HUES[l]}, inset 0 1px 0 rgba(255,255,255,0.5)`,
                    border: '2px solid rgba(255,255,255,0.4)',
                  }} />
                ))}
              </div>
              {/* Judgment floats above the lane, outside overflow:hidden so it never gets clipped */}
              <AnimatePresence>
                {judgment && (
                  <motion.div key={judgment.id}
                    initial={{ opacity: 1, scale: 0.7, y: 0 }}
                    animate={{ opacity: 0, scale: 1.3, y: -40 }}
                    transition={{ duration: 0.7 }}
                    style={{
                      position: 'absolute', left: '50%', top: '70%',
                      transform: 'translate(-50%,-50%)',
                      color: judgment.col, fontWeight: 900, fontSize: 15,
                      textShadow: `0 0 14px ${judgment.col}`, pointerEvents: 'none',
                      letterSpacing: '0.1em', zIndex: 20,
                    }}>
                    {judgment.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

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
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.06)', zIndex: 10 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear' }} />
    </div>
  );
}
