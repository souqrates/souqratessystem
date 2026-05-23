import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';

const RULES = 'QUAKE TYCOON — 10 towers stand. You have 3 earthquakes (power 1-10). Destroy ALL towers using the LEAST power. Higher towers need stronger quakes. Less power used = more score.';
const CYAN = '#00d4ff';
const RED = '#ff3d5e';

export default function QuakeTycoon({ phase, setPhase, game, onScoreUpdate }) {
  const [towers, setTowers] = useState([]);
  const [quakesLeft, setQuakesLeft] = useState(3);
  const [power, setPower] = useState(5);
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const stateRef = useRef({ towers: [], quakesLeft: 3, powerUsed: 0, target: 700 });

  const buildCity = useCallback(() => {
    const hp = [120, 240, 180, 300, 90, 270, 150, 210, 60, 330];
    const t = hp.map((h, i) => ({ id: i, hp: h, max: h, alive: true, h: 60 + h * 0.4 }));
    setTowers(t);
    stateRef.current.towers = t;
    stateRef.current.quakesLeft = 3;
    stateRef.current.powerUsed = 0;
    setQuakesLeft(3);
  }, []);

  const endGame = useCallback((allDown) => {
    const remaining = stateRef.current.towers.filter(t => t.alive).length;
    const used = stateRef.current.powerUsed;
    const time = 0;
    const sc = allDown ? Math.max(0, 10000 - used * 100 - time * 10 - remaining * 500) / 10 : 0;
    setScore(Math.round(sc));
    if (onScoreUpdate) onScoreUpdate(Math.round(sc));
    const won = allDown && Math.round(sc) >= stateRef.current.target;
    setEarnings(won ? Number(game?.prize || 0) : 0);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 500);
  }, [setPhase, onScoreUpdate, game]);

  const triggerQuake = useCallback(() => {
    if (stateRef.current.quakesLeft <= 0) return;
    stateRef.current.quakesLeft -= 1;
    stateRef.current.powerUsed += power;
    setQuakesLeft(stateRef.current.quakesLeft);
    setShake(true);
    setTimeout(() => setShake(false), 600);
    beep({ freq: 80 + power * 8, dur: 0.35, type: 'sawtooth', sweepTo: 30 });
    triggerHaptic('heavy');
    const dmg = power * 32;
    const next = stateRef.current.towers.map(t => {
      if (!t.alive) return t;
      const nh = t.hp - dmg;
      if (nh <= 0) return { ...t, hp: 0, alive: false };
      return { ...t, hp: nh };
    });
    stateRef.current.towers = next;
    setTowers(next);
    const allDown = next.every(t => !t.alive);
    if (allDown || stateRef.current.quakesLeft <= 0) {
      setTimeout(() => endGame(allDown), 800);
    }
  }, [power, endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(119).then(cfg => {
      if (!mounted) return;
      stateRef.current.target = cfg.target_score ?? 700;
    });
    setScore(0); setPower(5);
    buildCity();
    return () => { mounted = false; };
  }, [phase, buildCity]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #001a2e 0%, #02060a 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="QUAKES" val={quakesLeft} color={CYAN} />
        <Tile label="POWER USED" val={stateRef.current.powerUsed} color={RED} />
        <Tile label="SCORE" val={score} color="#ffd86b" />
      </div>

      {/* Cityscape */}
      <motion.div
        animate={{}}
        style={{
          position: 'relative', height: 280, borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(180deg, #001a3a 0%, #00050f 80%, #1a0a00 100%)',
          border: `1px solid ${CYAN}44`,
        }}
      >
        {/* Skyline cyber glow */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${CYAN}, ${RED}, ${CYAN}, transparent)`,
          boxShadow: `0 -4px 16px ${CYAN}` }} />
        {/* Towers */}
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 4, display: 'flex',
          alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, height: '90%' }}>
          {towers.map(t => (
            <AnimatePresence key={t.id} mode="wait">
              {t.alive ? (
                <motion.div key="up"
                  initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 60, opacity: 0, rotate: (Math.random() - 0.5) * 30 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    width: '8%', height: `${(t.h / 200) * 100}%`,
                    background: `linear-gradient(180deg, ${CYAN}66, ${CYAN}22 30%, #001a2e)`,
                    border: `1px solid ${CYAN}88`,
                    borderRadius: '2px 2px 0 0',
                    boxShadow: `0 0 10px ${CYAN}33, inset 0 0 6px ${CYAN}33`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                  {/* Window lights */}
                  {Array.from({ length: Math.floor(t.h / 14) }).map((_, j) => (
                    <div key={j} style={{
                      position: 'absolute', left: 2, right: 2,
                      top: `${5 + j * (1 / (Math.floor(t.h / 14) + 1)) * 95}%`, height: 2,
                      background: Math.random() > 0.3 ? '#ffd86b' : 'transparent',
                      opacity: t.hp / t.max,
                    }} />
                  ))}
                </motion.div>
              ) : (
                <div key="down" style={{ width: '8%', height: 4, background: '#330000',
                  borderRadius: 1, opacity: 0.6 }} />
              )}
            </AnimatePresence>
          ))}
        </div>
        {/* Crack overlay during quake */}
        {shake && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(120deg, transparent 49%, ${RED}88 50%, transparent 51%),
                              linear-gradient(-30deg, transparent 49%, ${RED}88 50%, transparent 51%)`,
            backgroundSize: '60% 100%, 40% 100%',
            backgroundPosition: '20% 0%, 60% 0%',
            backgroundRepeat: 'no-repeat',
          }} />
        )}
      </motion.div>

      {/* Power slider */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', letterSpacing: '0.18em', fontFamily: 'Orbitron, sans-serif' }}>POWER</span>
          <span style={{ fontSize: 18, color: RED, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, textShadow: `0 0 12px ${RED}` }}>{power}</span>
        </div>
        <input type="range" min={1} max={10} value={power} onChange={(e) => setPower(Number(e.target.value))}
          style={{ width: '100%', accentColor: RED }} />
      </div>

      <motion.button whileTap={{ scale: 0.96 }} onPointerDown={triggerQuake} disabled={quakesLeft <= 0}
        style={{
          marginTop: 12, width: '100%', padding: '18px 0', borderRadius: 14, cursor: quakesLeft <= 0 ? 'not-allowed' : 'pointer',
          background: quakesLeft > 0 ? `linear-gradient(135deg, ${RED}, ${CYAN})` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${RED}66`, opacity: quakesLeft <= 0 ? 0.4 : 1,
          color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, letterSpacing: '0.16em',
          boxShadow: `0 0 24px ${RED}55`,
        }}>
        UNLEASH QUAKE
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
