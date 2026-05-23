import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';
import { getFrameInterval } from '../../../lib/canvasQuality';

const RULES = 'INK TRAP ARENA — A swarm of glowing fish swims in dark water. Drop ink blobs (5 charges) to trap them. Each blob expands then locks the cells beneath. Trap 70% of the swarm in 30s.';

const CYAN = '#00e0ff';
const INK = '#5a00ff';
const GOLD = '#ffd86b';

const GRID = 12;
const FISH = 18;

export default function InkTrapArena({ phase, setPhase, game, onScoreUpdate }) {
  const [fish, setFish] = useState([]);
  const [blobs, setBlobs] = useState([]);
  const [traps, setTraps] = useState([]);
  const [chargesLeft, setChargesLeft] = useState(5);
  const [timeLeft, setTimeLeft] = useState(30);
  const [earnings, setEarnings] = useState(0);
  const cfgRef = useRef({ grid: 12, charges: 5, target: 70, time: 30 });
  const tickRef = useRef(null);
  const animRef = useRef(null);
  const activeRef = useRef(false);
  const fishRef = useRef([]);
  const trapsRef = useRef([]);

  const endGame = useCallback((won, pct) => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    cancelAnimationFrame(animRef.current);
    if (onScoreUpdate) onScoreUpdate(pct);
    setEarnings(won ? Number(game?.prize || 0) : 0);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game]);

  const dropBlob = useCallback((e) => {
    if (!activeRef.current || chargesLeft <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = Math.random();
    setChargesLeft(c => c - 1);
    setBlobs(b => [...b, { id, x, y, r: 4 }]);
    beep({ freq: 220, dur: 0.3, type: 'sine', sweepTo: 90 });
    triggerHaptic('medium');
    // Expand
    let r = 4;
    const grow = setInterval(() => {
      r += 1.6;
      setBlobs(b => b.map(bl => bl.id === id ? { ...bl, r } : bl));
      if (r >= 18) {
        clearInterval(grow);
        // Lock cells under blob
        const cellW = 100 / cfgRef.current.grid;
        const newTraps = [];
        for (let gx = 0; gx < cfgRef.current.grid; gx++) {
          for (let gy = 0; gy < cfgRef.current.grid; gy++) {
            const cx = gx * cellW + cellW / 2;
            const cy = gy * cellW + cellW / 2;
            const dx = cx - x, dy = cy - y;
            if (dx * dx + dy * dy < r * r) newTraps.push({ gx, gy });
          }
        }
        trapsRef.current = [...trapsRef.current, ...newTraps];
        setTraps([...trapsRef.current]);
        setTimeout(() => setBlobs(b => b.filter(bl => bl.id !== id)), 400);
      }
    }, 30);
  }, [chargesLeft]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(124).then(cfg => {
      if (!mounted) return;
      cfgRef.current = {
        grid: cfg.params?.grid ?? 12,
        charges: cfg.params?.ink_charges ?? 5,
        target: cfg.target_score ?? 70,
        time: cfg.time_limit_sec ?? 30,
      };
      setChargesLeft(cfgRef.current.charges);
      setTimeLeft(cfgRef.current.time);
    });
    // Init fish
    fishRef.current = Array.from({ length: FISH }).map((_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      trapped: false,
      hue: Math.random() > 0.7 ? GOLD : CYAN,
    }));
    setFish([...fishRef.current]);
    trapsRef.current = [];
    setTraps([]);
    setBlobs([]);
    activeRef.current = true;
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const loop = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(loop); return; }
      _skzLastT = now;
      const cellW = 100 / cfgRef.current.grid;
      fishRef.current = fishRef.current.map(f => {
        if (f.trapped) return f;
        let nx = f.x + f.vx;
        let ny = f.y + f.vy;
        let vx = f.vx, vy = f.vy;
        if (nx < 4 || nx > 96) { vx = -vx; nx = f.x + vx; }
        if (ny < 4 || ny > 96) { vy = -vy; ny = f.y + vy; }
        // Slight wander
        vx += (Math.random() - 0.5) * 0.04;
        vy += (Math.random() - 0.5) * 0.04;
        vx = Math.max(-0.6, Math.min(0.6, vx));
        vy = Math.max(-0.6, Math.min(0.6, vy));
        // Check trapped
        const gx = Math.floor(nx / cellW);
        const gy = Math.floor(ny / cellW);
        const trapped = trapsRef.current.some(t => t.gx === gx && t.gy === gy);
        if (trapped) {
          triggerHaptic('light');
          beep({ freq: 660, dur: 0.05, type: 'triangle' });
        }
        return { ...f, x: nx, y: ny, vx, vy, trapped };
      });
      setFish([...fishRef.current]);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          const trapped = fishRef.current.filter(f => f.trapped).length;
          const pct = Math.round((trapped / fishRef.current.length) * 100);
          endGame(pct >= cfgRef.current.target, pct);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { mounted = false; activeRef.current = false; clearInterval(tickRef.current); cancelAnimationFrame(animRef.current); };
  }, [phase, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  const trapped = fish.filter(f => f.trapped).length;
  const pct = fish.length > 0 ? Math.round((trapped / fish.length) * 100) : 0;

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #001428 0%, #000308 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="INK" val={chargesLeft} color={INK} />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 5 ? '#ef4444' : '#fff'} />
        <Tile label="TRAPPED" val={`${pct}%`} color={pct >= cfgRef.current.target ? '#10b981' : CYAN} />
      </div>

      <div onClick={dropBlob}
        style={{
          position: 'relative', aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden',
          cursor: chargesLeft > 0 ? 'crosshair' : 'not-allowed',
          background: 'radial-gradient(ellipse at center, #00253d 0%, #000510 80%)',
          border: `1px solid ${CYAN}33`,
          boxShadow: `inset 0 0 80px ${CYAN}22`,
        }}>
        {/* Water caustics */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle at 25% 30%, ${CYAN}22 0%, transparent 20%),
                            radial-gradient(circle at 75% 60%, ${CYAN}22 0%, transparent 25%),
                            radial-gradient(circle at 50% 80%, ${CYAN}22 0%, transparent 22%)`,
        }} />

        {/* Trap cells */}
        {traps.map((t, i) => {
          const cellW = 100 / cfgRef.current.grid;
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${t.gx * cellW}%`, top: `${t.gy * cellW}%`,
              width: `${cellW}%`, height: `${cellW}%`,
              background: `${INK}55`,
              boxShadow: `inset 0 0 8px ${INK}`,
              pointerEvents: 'none',
            }} />
          );
        })}

        {/* Blobs */}
        {blobs.map(b => (
          <div key={b.id} style={{
            position: 'absolute',
            left: `${b.x}%`, top: `${b.y}%`,
            width: `${b.r * 2}%`, height: `${b.r * 2}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${INK}cc 0%, ${INK}66 60%, transparent 100%)`,
            boxShadow: `0 0 30px ${INK}`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Fish */}
        {fish.map(f => (
          <motion.div key={f.id}
            animate={{ left: `${f.x}%`, top: `${f.y}%`, opacity: f.trapped ? 0.4 : 1 }}
            transition={{ duration: 0.05, ease: 'linear' }}
            style={{
              position: 'absolute',
              width: 14, height: 8, transform: 'translate(-50%, -50%)',
              background: `radial-gradient(ellipse, ${f.hue} 0%, ${f.hue}44 100%)`,
              borderRadius: '50%',
              boxShadow: `0 0 12px ${f.hue}`,
              pointerEvents: 'none',
              filter: f.trapped ? 'grayscale(0.6)' : 'none',
            }} />
        ))}
      </div>

      <p style={{ marginTop: 10, fontSize: 11, color: 'rgba(148,163,184,0.65)', textAlign: 'center',
        letterSpacing: '0.16em', fontFamily: 'Orbitron, sans-serif' }}>
        TAP THE WATER TO DROP INK
      </p>
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
