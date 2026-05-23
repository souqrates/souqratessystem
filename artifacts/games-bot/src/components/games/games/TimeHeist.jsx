import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';
import { getFrameInterval } from '../../../lib/canvasQuality';

const RULES = 'TIME HEIST — Sneak from START to VAULT and back. Red lasers patrol the bank. If hit, REWIND time (3 charges). 20 seconds. Reach the vault and return alive to win the jewels.';

const RED = '#ff2a4d';
const CYAN = '#00d4ff';
const GOLD = '#ffd86b';

const GRID = 8;

export default function TimeHeist({ phase, setPhase, game, onScoreUpdate }) {
  const [pos, setPos] = useState({ x: 0, y: GRID - 1 });
  const [hasVault, setHasVault] = useState(false);
  const [rewindsLeft, setRewindsLeft] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);
  const [earnings, setEarnings] = useState(0);
  const [history, setHistory] = useState([]);
  const guardsRef = useRef([]);
  const tickRef = useRef(null);
  const animRef = useRef(null);
  const activeRef = useRef(false);
  const phaseTRef = useRef(0);

  const ended = useCallback((won) => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    cancelAnimationFrame(animRef.current);
    if (onScoreUpdate) onScoreUpdate(won ? 1 : 0);
    setEarnings(won ? Number(game?.prize || 0) : 0);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game]);

  const guards = useCallback(() => {
    // 2 horizontal moving lasers
    const t = phaseTRef.current / 1000;
    return [
      { row: 2, x: (Math.sin(t * 1.4) * 0.5 + 0.5) * (GRID - 1) },
      { row: 5, x: (Math.sin(t * 1.1 + Math.PI / 2) * 0.5 + 0.5) * (GRID - 1) },
    ];
  }, []);

  const reset = useCallback(() => {
    setPos({ x: 0, y: GRID - 1 });
    setHasVault(false);
    setHistory([]);
  }, []);

  const onMove = useCallback((dx, dy) => {
    if (!activeRef.current) return;
    setPos(p => {
      const nx = Math.max(0, Math.min(GRID - 1, p.x + dx));
      const ny = Math.max(0, Math.min(GRID - 1, p.y + dy));
      setHistory(h => [...h.slice(-12), { x: nx, y: ny }]);
      // Check laser collision
      const g = guards();
      const onLaser = g.some(gg => Math.abs(gg.x - nx) < 0.6 && gg.row === ny);
      if (onLaser) {
        beep({ freq: 200, dur: 0.2, type: 'sawtooth', sweepTo: 80 });
        triggerHaptic('error');
        // Auto-rewind
        setRewindsLeft(r => {
          if (r > 0) {
            return r - 1;
          }
          ended(false);
          return r;
        });
        return { x: 0, y: GRID - 1 };
      }
      // Vault at (GRID-1, 0)
      if (nx === GRID - 1 && ny === 0 && !hasVault) {
        setHasVault(true);
        beep({ freq: 880, dur: 0.18, type: 'triangle' });
        triggerHaptic('medium');
      }
      // Back to start with vault = win
      if (nx === 0 && ny === GRID - 1 && hasVault) {
        ended(true);
      }
      beep({ freq: 440, dur: 0.06, type: 'square' });
      triggerHaptic('light');
      return { x: nx, y: ny };
    });
  }, [guards, hasVault, ended]);

  const rewind = useCallback(() => {
    if (rewindsLeft <= 0) return;
    setRewindsLeft(r => r - 1);
    setPos(history.length > 4 ? history[history.length - 4] : { x: 0, y: GRID - 1 });
    setHistory(h => h.slice(0, -3));
    beep({ freq: 600, dur: 0.2, type: 'sine', sweepTo: 1000 });
    triggerHaptic('medium');
  }, [rewindsLeft, history]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(121).then(cfg => {
      if (!mounted) return;
      setRewindsLeft(cfg.params?.rewinds ?? 3);
      setTimeLeft(cfg.time_limit_sec ?? 20);
    });
    reset();
    activeRef.current = true;
    phaseTRef.current = 0;
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    const loop = (ts) => {
      if (ts - _skzLastT < _skzFI) { rafRef.current = requestAnimationFrame(loop); return; }
      _skzLastT = ts;
      phaseTRef.current = ts;
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { ended(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { mounted = false; activeRef.current = false; clearInterval(tickRef.current); cancelAnimationFrame(animRef.current); };
  }, [phase, reset, ended]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  const gs = guards();

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1a0008 0%, #050000 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 5 ? RED : '#fff'} />
        <Tile label="REWIND" val={rewindsLeft} color={CYAN} />
        <Tile label="VAULT" val={hasVault ? 'GOT IT' : 'EMPTY'} color={hasVault ? GOLD : 'rgba(255,255,255,0.4)'} />
      </div>

      {/* Bank floor — 8x8 grid */}
      <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #2a0010, #0a0005)',
        border: `1px solid ${RED}44`,
        backgroundImage: `linear-gradient(rgba(255,42,77,0.08) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,42,77,0.08) 1px, transparent 1px)`,
        backgroundSize: `${100 / GRID}% ${100 / GRID}%`,
      }}>
        {/* Start */}
        <Cell row={GRID - 1} col={0} color={CYAN} label="S" />
        {/* Vault */}
        <Cell row={0} col={GRID - 1} color={GOLD} label="V" glow={!hasVault} />

        {/* Lasers (horizontal beams) */}
        {gs.map((g, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${(g.row / GRID) * 100}%`, height: `${100 / GRID}%`,
            background: `linear-gradient(90deg, transparent 0%, ${RED}44 20%, ${RED}88 50%, ${RED}44 80%, transparent 100%)`,
            boxShadow: `0 0 16px ${RED}`,
            pointerEvents: 'none',
          }} />
        ))}
        {/* Laser emitters */}
        {gs.map((g, i) => (
          <motion.div key={`em-${i}`}
            style={{
              position: 'absolute',
              left: `${(g.x / GRID) * 100}%`, top: `${(g.row / GRID) * 100}%`,
              width: `${100 / GRID}%`, height: `${100 / GRID}%`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            animate={{ x: 0 }}
          >
            <div style={{ width: '60%', height: '60%', borderRadius: '50%',
              background: RED, boxShadow: `0 0 18px ${RED}` }} />
          </motion.div>
        ))}

        {/* Player */}
        <motion.div
          animate={{
            left: `${(pos.x / GRID) * 100}%`,
            top: `${(pos.y / GRID) * 100}%`,
          }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          style={{
            position: 'absolute', width: `${100 / GRID}%`, height: `${100 / GRID}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <div style={{
            width: '64%', height: '64%', borderRadius: '50%',
            background: hasVault ? `radial-gradient(circle, ${GOLD}, #8a5a00)` : `radial-gradient(circle, ${CYAN}, #003a55)`,
            boxShadow: `0 0 18px ${hasVault ? GOLD : CYAN}`,
            border: '2px solid #fff',
          }} />
        </motion.div>
      </div>

      {/* D-pad */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, justifyItems: 'center' }}>
        <div />
        <Btn onClick={() => onMove(0, -1)}>▲</Btn>
        <div />
        <Btn onClick={() => onMove(-1, 0)}>◀</Btn>
        <Btn onClick={rewind} color={CYAN}>↺</Btn>
        <Btn onClick={() => onMove(1, 0)}>▶</Btn>
        <div />
        <Btn onClick={() => onMove(0, 1)}>▼</Btn>
        <div />
      </div>
    </div>
  );
}

function Cell({ row, col, color, label, glow }) {
  return (
    <motion.div
      animate={glow ? { boxShadow: [`0 0 12px ${color}`, `0 0 24px ${color}`, `0 0 12px ${color}`] } : {}}
      transition={{ duration: 1.6, repeat: Infinity }}
      style={{
        position: 'absolute',
        left: `${(col / GRID) * 100}%`, top: `${(row / GRID) * 100}%`,
        width: `${100 / GRID}%`, height: `${100 / GRID}%`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}22`, border: `1px solid ${color}88`,
        fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color, fontSize: 12,
        textShadow: `0 0 8px ${color}`,
      }}>
      {label}
    </motion.div>
  );
}

function Btn({ children, onClick, color = '#fff' }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} onPointerDown={onClick}
      style={{
        width: 56, height: 56, borderRadius: 14, cursor: 'pointer',
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}44`,
        color, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22,
        boxShadow: `0 0 14px ${color}22`,
      }}>
      {children}
    </motion.button>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
      borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
