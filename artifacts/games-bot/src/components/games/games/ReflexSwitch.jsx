import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { tone, chord, noiseHit, hudColor } from './_groupKit';

const DEFAULT_GAME_TIME = 90;
const RULES = 'REFLEX SWITCH — Four glowing buttons. The active ones light up — TAP THEM FAST. Reaction time = points. Sometimes 2 light up simultaneously. Wrong button or letting one expire = penalty. Speeds escalate brutally. 90 seconds to prove your reflexes.';

const BUTTONS = [
  { id: 0, hue: '#06b6d4', glow: '#22d3ee', label: 'ALPHA' },
  { id: 1, hue: '#10b981', glow: '#34d399', label: 'BETA' },
  { id: 2, hue: '#fbbf24', glow: '#fde047', label: 'GAMMA' },
  { id: 3, hue: '#ec4899', glow: '#f472b6', label: 'DELTA' },
];

export default function ReflexSwitch({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [combo, setCombo] = useState(0);
  const [active, setActive] = useState(new Map()); // id -> { birth, life }
  const [flashes, setFlashes] = useState([]);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const activeRef = useRef(new Map());
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const checkRef = useRef(null);
  const gameActiveRef = useRef(false);

  const addScore = useCallback((p) => {
    scoreRef.current = Math.max(0, scoreRef.current + p);
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
  }, [onScoreUpdate]);

  const activateButton = useCallback(() => {
    if (!gameActiveRef.current) return;
    const tier = Math.min(4, Math.floor(scoreRef.current / 400));
    const life = Math.max(750, 1700 - tier * 220);
    const available = [0, 1, 2, 3].filter((i) => !activeRef.current.has(i));
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    activeRef.current.set(pick, { birth: Date.now(), life });
    setActive(new Map(activeRef.current));
    tone(440 + pick * 80, 0.08, 'sine', 0.18);
    // Occasionally double-activate
    if (tier >= 2 && Math.random() < 0.25 && available.length > 1) {
      const rest = available.filter((x) => x !== pick);
      const second = rest[Math.floor(Math.random() * rest.length)];
      activeRef.current.set(second, { birth: Date.now(), life });
      setActive(new Map(activeRef.current));
    }
  }, []);

  const handleTap = useCallback((id) => {
    if (!gameActiveRef.current) return;
    if (activeRef.current.has(id)) {
      const { birth, life } = activeRef.current.get(id);
      const elapsed = Date.now() - birth;
      const ratio = elapsed / life;
      let pts;
      if (ratio < 0.3) pts = 40;
      else if (ratio < 0.6) pts = 25;
      else pts = 15;
      comboRef.current += 1;
      setCombo(comboRef.current);
      const bonus = comboRef.current >= 5 ? Math.floor(pts * 0.4) : 0;
      const total = pts + bonus;
      addScore(total);
      activeRef.current.delete(id);
      setActive(new Map(activeRef.current));
      tone(600 + id * 60, 0.1, 'triangle', 0.22, 220);
      triggerHaptic('light');
      setFlashes((prev) => [...prev.slice(-6), { id: Math.random(), btnId: id, pts: total, col: BUTTONS[id].hue }]);
      setTimeout(() => setFlashes((prev) => prev.slice(1)), 600);
      if (comboRef.current % 5 === 0) chord([523, 659, 784, 1047], 0.04, 0.16, 'sine', 0.2);
    } else {
      addScore(-20);
      comboRef.current = 0;
      setCombo(0);
      noiseHit(0.15, 0.18);
      triggerHaptic('error');
      setFlashes((prev) => [...prev.slice(-6), { id: Math.random(), btnId: id, pts: -20, col: '#ef4444' }]);
      setTimeout(() => setFlashes((prev) => prev.slice(1)), 600);
    }
  }, [addScore]);

  useEffect(() => {
    if (phase !== 'playing') return;
    gameActiveRef.current = true;
    scoreRef.current = 0; comboRef.current = 0;
    activeRef.current = new Map();
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setActive(new Map()); setFlashes([]);

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        gameActiveRef.current = false;
        clearInterval(timerRef.current);
        clearTimeout(spawnRef.current);
        clearInterval(checkRef.current);
        triggerHaptic('heavy');
        setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);

    const sched = () => {
      if (!gameActiveRef.current) return;
      activateButton();
      const tier = Math.min(4, Math.floor(scoreRef.current / 400));
      spawnRef.current = setTimeout(sched, Math.max(500, 1300 - tier * 200));
    };
    setTimeout(sched, 600);

    checkRef.current = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, { birth, life }] of activeRef.current) {
        if (now - birth > life) {
          activeRef.current.delete(id);
          changed = true;
          comboRef.current = 0;
          setCombo(0);
          addScore(-15);
          noiseHit(0.12, 0.15);
        }
      }
      if (changed) setActive(new Map(activeRef.current));
    }, 80);

    return () => {
      gameActiveRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(spawnRef.current);
      clearInterval(checkRef.current);
    };
  }, [phase, activateButton, addScore, setPhase]);

  if (phase === 'rules') return (
    <div style={{ padding: 24, color: '#cbd5e1', fontFamily: 'Orbitron,sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>★</div>
      <h2 style={{ color: '#22d3ee', fontSize: 22, margin: '8px 0 14px', textShadow: '0 0 18px #22d3ee' }}>REFLEX SWITCH</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
    </div>
  );

  const tc = hudColor(timeLeft, GAME_TIME);

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, #0c1124 0%, #020617 70%)',
      fontFamily: 'Orbitron,sans-serif', userSelect: 'none', touchAction: 'none',
      padding: '70px 16px 30px',
    }}>
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 10 }}>
        <Hud label="SCORE" value={score.toLocaleString()} color="#22d3ee" />
        <Hud label="TIME" value={`${timeLeft}s`} color={tc} pulse={timeLeft <= 15} />
        <Hud label="COMBO" value={`×${combo}`} color="#fbbf24" />
      </div>

      <div style={{
        marginTop: 30,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        maxWidth: 400, margin: '30px auto 0',
      }}>
        {BUTTONS.map((b) => {
          const isActive = active.has(b.id);
          const data = active.get(b.id);
          const ratio = data ? Math.min(1, (Date.now() - data.birth) / data.life) : 0;
          const myFlash = flashes.slice().reverse().find((f) => f.btnId === b.id);
          return (
            <motion.button
              key={b.id}
              onPointerDown={() => handleTap(b.id)}
              animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.4, repeat: isActive ? Infinity : 0 }}
              style={{
                aspectRatio: '1', borderRadius: 22,
                border: `3px solid ${isActive ? b.glow : `${b.hue}33`}`,
                background: isActive
                  ? `radial-gradient(circle at 40% 35%, ${b.glow}, ${b.hue} 70%)`
                  : `radial-gradient(circle at 40% 35%, ${b.hue}33, ${b.hue}11 80%)`,
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isActive
                  ? `0 0 40px ${b.glow}, 0 0 80px ${b.glow}66, inset 0 0 30px ${b.glow}44`
                  : `inset 0 0 20px ${b.hue}22`,
                transition: 'box-shadow 0.15s, background 0.15s, border 0.15s',
                outline: 'none',
              }}>
              <div style={{
                fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: 16,
                color: isActive ? '#fff' : `${b.hue}aa`, letterSpacing: '0.15em',
                textShadow: isActive ? `0 0 14px ${b.glow}` : 'none',
              }}>{b.label}</div>
              {isActive && (
                <div style={{
                  position: 'absolute', bottom: 12, left: '15%', right: '15%', height: 5,
                  background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(1 - ratio) * 100}%`, height: '100%',
                    background: ratio < 0.5 ? '#10b981' : ratio < 0.8 ? '#f59e0b' : '#ef4444',
                    boxShadow: '0 0 8px currentColor', transition: 'width 0.08s linear',
                  }} />
                </div>
              )}
              <AnimatePresence>
                {myFlash && (
                  <motion.div key={myFlash.id}
                    initial={{ opacity: 1, scale: 0.7, y: 0 }}
                    animate={{ opacity: 0, scale: 1.5, y: -40 }}
                    transition={{ duration: 0.55 }}
                    style={{
                      position: 'absolute', left: '50%', top: '20%',
                      transform: 'translate(-50%,-50%)',
                      color: myFlash.col, fontWeight: 900, fontSize: 22,
                      textShadow: `0 0 14px ${myFlash.col}`, pointerEvents: 'none',
                    }}>
                    {myFlash.pts > 0 ? `+${myFlash.pts}` : myFlash.pts}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
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
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.06)', zIndex: 10 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear' }} />
    </div>
  );
}
