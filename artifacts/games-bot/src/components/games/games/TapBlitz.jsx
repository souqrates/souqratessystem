import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { getAudioContext } from '../../../lib/audioPool';

const RULES = 'TAP BLITZ ONLINE — Tap glowing targets as fast as you can! Targets appear and fade — small targets = more points. Build combos by hitting multiple in a row without missing. 30 seconds — your total score competes against your opponent!';

const DEFAULT_GAME_TIME = 30;
const SPAWN_INTERVAL = 650;
const TARGET_LIFE = 1600;

function popSound(freq) {
  try {
    const ac = getAudioContext();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.28, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    o.start(); o.stop(ac.currentTime + 0.1);
  } catch {}
}

let nid = 0;

export default function TapBlitz({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [targets,  setTargets]  = useState([]);
  const [score,    setScore]    = useState(0);
  const [combo,    setCombo]    = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [hits,     setHits]     = useState([]);

  const scoreRef  = useRef(0);
  const comboRef  = useRef(0);
  const spawnRef  = useRef();
  const timerRef  = useRef();
  const targetsRef = useRef([]);
  const gameOverRef = useRef(false);
  const expireTimersRef = useRef([]);

  const endGame = useCallback(() => {
    clearInterval(spawnRef.current); clearInterval(timerRef.current);
    gameOverRef.current = true;
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('medium');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const spawn = useCallback(() => {
    if (gameOverRef.current) return;
    const id = nid++;
    const size = 30 + Math.random() * 38;
    const pts = Math.max(1, Math.round(60 / size * 8));
    const t = { id, x: 6 + Math.random() * (100 - 12), y: 6 + Math.random() * (100 - 12), size, pts, born: Date.now() };
    targetsRef.current = [...targetsRef.current, t];
    setTargets([...targetsRef.current]);
    // Auto-expire
    const expireId = setTimeout(() => {
      expireTimersRef.current = expireTimersRef.current.filter(x => x !== expireId);
      if (gameOverRef.current) return;
      const exists = targetsRef.current.find(x => x.id === id);
      if (exists) {
        comboRef.current = 0; setCombo(0);
        targetsRef.current = targetsRef.current.filter(x => x.id !== id);
        setTargets([...targetsRef.current]);
      }
    }, TARGET_LIFE);
    expireTimersRef.current.push(expireId);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(spawnRef.current); clearInterval(timerRef.current); return; }
    gameOverRef.current = false; scoreRef.current = 0; comboRef.current = 0;
    targetsRef.current = []; expireTimersRef.current = [];
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setTargets([]); setHits([]);
    let t = GAME_TIME;
    timerRef.current = setInterval(() => { t--; setTimeLeft(t); if (t <= 0) endGame(); }, 1000);
    spawnRef.current = setInterval(spawn, SPAWN_INTERVAL);
    return () => {
      clearInterval(spawnRef.current); clearInterval(timerRef.current);
      expireTimersRef.current.forEach(id => clearTimeout(id)); expireTimersRef.current = [];
    };
  }, [phase]);

  const tap = useCallback((id, pts, x, y) => {
    if (gameOverRef.current) return;
    comboRef.current++;
    const bonus = Math.floor(comboRef.current / 3) * 2;
    const total = pts + bonus;
    scoreRef.current += total;
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    targetsRef.current = targetsRef.current.filter(t => t.id !== id);
    setTargets([...targetsRef.current]);
    // Hit float text
    const hid = Date.now() + Math.random();
    setHits(h => [...h, { id: hid, x, y, pts: `+${total}` }]);
    setTimeout(() => setHits(h => h.filter(x => x.id !== hid)), 700);
    popSound(440 + Math.min(comboRef.current * 30, 300));
    triggerHaptic('light');
  }, [onScoreUpdate]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;

  const tp = timeLeft / GAME_TIME;
  const tc = tp > 0.5 ? '#10b981' : tp > 0.25 ? '#f59e0b' : '#ef4444';

  const COLORS = ['#f43f5e', '#00d4ff', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HudCard label="Score" value={score} color="#f43f5e" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <motion.p animate={timeLeft <= 10 ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}
            style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>{timeLeft}</motion.p>
        </div>
        <HudCard label={combo >= 3 ? `COMBO x${combo}!` : 'Combo'} value={combo} color={combo >= 5 ? '#ffd700' : combo >= 3 ? '#f59e0b' : '#64748b'} />
      </div>

      {/* Play area */}
      <div style={{ position: 'relative', height: 340, borderRadius: 18, overflow: 'hidden', background: 'radial-gradient(ellipse at center, #0c0c18 0%, #060608 100%)', border: '1px solid rgba(244,63,94,0.12)', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)' }}>
        {/* Background grid lines */}
        {[1,2,3,4].map(i => <div key={i} style={{ position: 'absolute', left: `${i * 20}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.02)' }} />)}
        {[1,2,3].map(i => <div key={i} style={{ position: 'absolute', top: `${i * 25}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.02)' }} />)}

        {/* Targets */}
        <AnimatePresence>
          {targets.map((t, idx) => {
            const age = (Date.now() - t.born) / TARGET_LIFE;
            const col = COLORS[t.id % COLORS.length];
            const rings = Math.floor(t.size / 18);
            return (
              <motion.button key={t.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 - age * 0.35 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onPointerDown={() => tap(t.id, t.pts, t.x, t.y)}
                style={{
                  position: 'absolute',
                  left: `${t.x}%`, top: `${t.y}%`,
                  width: t.size, height: t.size,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: `radial-gradient(circle at 35% 30%, ${col}ff, ${col}88, ${col}22)`,
                  boxShadow: `0 0 ${t.size * 0.5}px ${col}70, 0 0 ${t.size}px ${col}20`,
                }}>
                {/* Inner rings */}
                {Array.from({ length: rings }).map((_, ri) => (
                  <div key={ri} style={{ position: 'absolute', inset: `${(ri + 1) * 20}%`, borderRadius: '50%', border: `1px solid rgba(255,255,255,${0.3 - ri * 0.08})` }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: Math.max(9, t.size * 0.28), fontWeight: 900, color: '#fff', textShadow: `0 0 8px ${col}` }}>{t.pts}</span>
                </div>
                {/* Countdown ring */}
                <svg style={{ position: 'absolute', inset: -2, width: t.size + 4, height: t.size + 4 }}>
                  <circle cx={(t.size + 4) / 2} cy={(t.size + 4) / 2} r={(t.size) / 2}
                    fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.5"
                    strokeDasharray={Math.PI * t.size}
                    strokeDashoffset={Math.PI * t.size * age}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.1s linear' }} />
                </svg>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Floating score texts */}
        <AnimatePresence>
          {hits.map(h => (
            <motion.div key={h.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -50, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'absolute', left: `${h.x}%`, top: `${h.y}%`, transform: 'translate(-50%,-50%)', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, color: '#ffd700', textShadow: '0 0 12px rgba(255,215,0,0.8)', pointerEvents: 'none', zIndex: 10 }}>
              {h.pts}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Idle hint */}
        {targets.length === 0 && (
          <motion.p animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,0.25)', fontSize: 13, margin: 0 }}>
            Get ready...
          </motion.p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div animate={{ width: `${(timeLeft / GAME_TIME) * 100}%` }} transition={{ duration: 0.9 }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${tc}, ${tc}88)`, borderRadius: 99 }} />
        </div>
      </div>
    </div>
  );
}

function HudCard({ label, value, color }) {
  return (
    <div style={{ background: `${color}07`, border: `1px solid ${color}20`, borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}60`, margin: 0, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</p>
      <motion.p key={String(value)} initial={{ scale: 1.3, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color, margin: 0 }}>{value}</motion.p>
    </div>
  );
}
