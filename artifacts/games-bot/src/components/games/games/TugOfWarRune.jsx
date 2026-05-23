import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';

const RULES = 'TUG OF WAR RUNE — Rapid-tap to pull the magical rope toward your side. Reach 100 taps before time runs out. Anti-cheat: super-uniform taps detected as bots.';

const GOLD = '#ffd86b';
const LAVA = '#ff5722';

export default function TugOfWarRune({ phase, setPhase, game, onScoreUpdate }) {
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [enemyPull, setEnemyPull] = useState(0);
  const [stamina, setStamina] = useState(100);
  const [earnings, setEarnings] = useState(0);
  const [sparkles, setSparkles] = useState([]);
  const tapsRef = useRef(0);
  const lastTapsRef = useRef([]);
  const tickRef = useRef(null);
  const enemyRef = useRef(null);
  const cfgRef = useRef({ target: 100, time: 20, maxCps: 15 });
  const activeRef = useRef(false);

  const endGame = useCallback((won) => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    clearInterval(enemyRef.current);
    if (onScoreUpdate) onScoreUpdate(tapsRef.current);
    setEarnings(won ? Number(game?.prize || 0) : 0);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game]);

  const onTap = useCallback(() => {
    if (!activeRef.current) return;
    const now = Date.now();
    lastTapsRef.current = [...lastTapsRef.current, now].filter(t => now - t < 1000);
    // Anti-cheat: too fast or too uniform
    if (lastTapsRef.current.length > cfgRef.current.maxCps) return;
    if (lastTapsRef.current.length > 5) {
      const intervals = [];
      for (let i = 1; i < lastTapsRef.current.length; i++) intervals.push(lastTapsRef.current[i] - lastTapsRef.current[i - 1]);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
      if (variance < 8 && intervals.length > 6) return; // bot-like
    }
    tapsRef.current = Math.min(cfgRef.current.target, tapsRef.current + 1);
    setTaps(tapsRef.current);
    setStamina(s => Math.max(20, s - 0.4));
    if (onScoreUpdate) onScoreUpdate(tapsRef.current);
    const id = Math.random();
    setSparkles(s => [...s, { id, x: 40 + Math.random() * 20 }]);
    setTimeout(() => setSparkles(s => s.filter(p => p.id !== id)), 600);
    beep({ freq: 600 + Math.random() * 200, dur: 0.05, type: 'square' });
    triggerHaptic('light');
    if (tapsRef.current >= cfgRef.current.target) endGame(true);
  }, [onScoreUpdate, endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(122).then(cfg => {
      if (!mounted) return;
      cfgRef.current = {
        target: cfg.params?.target_taps ?? 100,
        time: cfg.time_limit_sec ?? 20,
        maxCps: cfg.params?.max_cps ?? 15,
      };
      setTimeLeft(cfgRef.current.time);
    });
    tapsRef.current = 0; lastTapsRef.current = [];
    setTaps(0); setEnemyPull(0); setStamina(100); setTimeLeft(20);
    activeRef.current = true;
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(tapsRef.current >= cfgRef.current.target); return 0; }
        return t - 1;
      });
      setStamina(s => Math.min(100, s + 2));
    }, 1000);
    enemyRef.current = setInterval(() => {
      setEnemyPull(p => Math.min(cfgRef.current.target, p + 1.3 + Math.random() * 1.5));
    }, 220);
    return () => { mounted = false; activeRef.current = false; clearInterval(tickRef.current); clearInterval(enemyRef.current); };
  }, [phase, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  const ratio = taps / Math.max(1, taps + enemyPull);

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #2a1808 0%, #050200 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="YOUR TAPS" val={taps} color={GOLD} />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 5 ? LAVA : '#fff'} />
        <Tile label="ENEMY" val={Math.round(enemyPull)} color="#a91b1b" />
      </div>

      {/* Arena */}
      <div style={{ position: 'relative', height: 200, borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(180deg, #4a1a08, #1a0500)', border: `1px solid ${GOLD}44`,
        boxShadow: `inset 0 0 60px ${LAVA}44` }}>
        {/* Lava cracks */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none',
          backgroundImage: `linear-gradient(40deg, transparent 49%, ${LAVA} 50%, transparent 51%),
                            linear-gradient(-30deg, transparent 49%, ${LAVA} 50%, transparent 51%)`,
          backgroundSize: '40% 100%, 30% 100%',
          backgroundPosition: '10% 0%, 70% 0%',
          backgroundRepeat: 'no-repeat',
        }} />

        {/* Center marker */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2,
          background: 'rgba(255,255,255,0.4)' }} />

        {/* Rope */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 6,
          transform: 'translateY(-50%)',
          background: `linear-gradient(90deg, ${GOLD}, #fff, ${GOLD})`,
          boxShadow: `0 0 20px ${GOLD}`,
        }} />

        {/* Rune marker */}
        <motion.div
          animate={{ left: `${ratio * 100}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          style={{
            position: 'absolute', top: '50%', width: 36, height: 36, transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, #fff 0%, ${GOLD} 40%, #b8800b 100%)`,
            border: `2px solid ${GOLD}`,
            boxShadow: `0 0 30px ${GOLD}, 0 0 60px ${GOLD}88`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>★</motion.div>

        {/* Sparkles */}
        <AnimatePresence>
          {sparkles.map(s => (
            <motion.div key={s.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -40, scale: 0.4 }}
              transition={{ duration: 0.6 }}
              style={{
                position: 'absolute', top: '50%', left: `${s.x}%`,
                width: 8, height: 8, borderRadius: '50%',
                background: GOLD, boxShadow: `0 0 10px ${GOLD}`,
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Stamina */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.18em', fontFamily: 'Orbitron, sans-serif' }}>
          <span>STAMINA</span><span>{Math.round(stamina)}%</span>
        </div>
        <div style={{ height: 6, marginTop: 4, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>
          <div style={{ height: '100%', width: `${stamina}%`, borderRadius: 999,
            background: `linear-gradient(90deg, ${LAVA}, ${GOLD})`,
            boxShadow: `0 0 10px ${GOLD}` }} />
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.94 }} onPointerDown={onTap}
        style={{
          marginTop: 14, width: '100%', padding: '26px 0', borderRadius: 14,
          background: `linear-gradient(135deg, ${LAVA}, ${GOLD})`,
          border: `2px solid ${GOLD}`, color: '#0a0500',
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, letterSpacing: '0.2em',
          boxShadow: `0 0 30px ${GOLD}66`,
          cursor: 'pointer',
        }}>
        PULL!
      </motion.button>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
      borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
