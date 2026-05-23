import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { TimeBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';

const RULES = 'SUSHI SLICE PRO — Drag a horizontal line across the fish to cut a slice exactly 5.00 mm. Perfect (±0.15 mm) = +200. Each round shrinks tolerance. 60 seconds.';

const PINK = '#ff6b8e';
const NEON = '#00f5ff';

export default function SushiSlicePro({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [round, setRound] = useState(1);
  const [lastResult, setLastResult] = useState(null);
  const [cutY, setCutY] = useState(null);
  const [fish, setFish] = useState({ top: 30, bottom: 80 }); // mm coordinates
  const [earnings, setEarnings] = useState(0);
  const scoreRef = useRef(0);
  const cfgRef = useRef({ target: 800, time: 60, target_mm: 5, perfect: 0.15 });
  const tickRef = useRef(null);
  const activeRef = useRef(false);
  const stageRef = useRef(null);

  const newFish = useCallback(() => {
    // fish height varies — slice must be exactly target_mm from top edge
    const top = 25 + Math.random() * 10;
    const bottom = top + 40 + Math.random() * 25;
    setFish({ top, bottom });
    setCutY(null);
  }, []);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    const won = scoreRef.current >= cfgRef.current.target;
    setEarnings(won ? Number(game?.prize || 0) : 0);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(118).then(cfg => {
      if (!mounted) return;
      cfgRef.current = {
        target: cfg.target_score ?? 800,
        time: cfg.time_limit_sec ?? 60,
        target_mm: cfg.params?.target_mm ?? 5,
        perfect: cfg.params?.perfect_err_mm ?? 0.15,
      };
      setTimeLeft(cfgRef.current.time);
    });
    scoreRef.current = 0; setScore(0); setRound(1); setLastResult(null);
    activeRef.current = true;
    newFish();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { mounted = false; activeRef.current = false; clearInterval(tickRef.current); };
  }, [phase, endGame, newFish]);

  const onCut = useCallback((y, h) => {
    if (!activeRef.current) return;
    if (stageRef.current) return;
    stageRef.current = true;
    // Convert pixel Y to mm using fish.top as reference
    // We use the fish container — 1 px = 0.1 mm (so 50 px = 5 mm). For tolerance use the actual ratio.
    const cutMm = (y - h * (fish.top / 120)) / (h / 120);
    const err = Math.abs(cfgRef.current.target_mm - cutMm);
    const perfect = err <= cfgRef.current.perfect;
    const good = err <= cfgRef.current.perfect * 4;
    const pts = perfect ? 200 : good ? 80 : Math.max(0, 30 - Math.floor(err * 10));
    scoreRef.current += pts;
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    setCutY(y);
    setLastResult({ err: err.toFixed(2), pts, perfect });
    beep({ freq: perfect ? 1200 : good ? 700 : 240, dur: 0.16, type: perfect ? 'sine' : 'triangle' });
    triggerHaptic(perfect ? 'medium' : good ? 'light' : 'error');
    setTimeout(() => {
      setLastResult(null);
      setRound(r => r + 1);
      newFish();
      stageRef.current = null;
    }, 1100);
  }, [fish, onScoreUpdate, newFish]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1a0820 0%, #050208 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <Tile label="SCORE" val={score} color={NEON} />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="ROUND" val={round} color={PINK} />
      </div>

      <TimeBar totalTime={60} timeLeft={timeLeft} />

      <CutZone fish={fish} targetMm={cfgRef.current.target_mm} onCut={onCut} cutY={cutY} />

      <AnimatePresence>
        {lastResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)',
              padding: '8px 18px', borderRadius: 999, zIndex: 5,
              background: lastResult.perfect ? `${NEON}22` : 'rgba(255,107,142,0.18)',
              border: `1px solid ${lastResult.perfect ? NEON : PINK}`,
              color: lastResult.perfect ? NEON : PINK,
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14,
              boxShadow: `0 0 24px ${lastResult.perfect ? NEON : PINK}66` }}>
            {lastResult.perfect ? `PERFECT +${lastResult.pts}` : `${lastResult.err} mm · +${lastResult.pts}`}
          </motion.div>
        )}
      </AnimatePresence>

      <p style={{ marginTop: 10, textAlign: 'center', fontSize: 10, letterSpacing: '0.18em',
        color: 'rgba(148,163,184,0.55)', fontFamily: 'Orbitron, sans-serif' }}>
        TARGET · {cfgRef.current.target_mm.toFixed(2)} mm · TAP-DRAG TO SLICE
      </p>
    </div>
  );
}

function CutZone({ fish, targetMm, onCut, cutY }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const onMove = (e) => {
    const rect = ref.current?.getBoundingClientRect(); if (!rect) return;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    setHover(y);
  };
  const onDown = (e) => {
    onMove(e);
  };
  const onUp = () => {
    if (hover != null && ref.current) {
      onCut(hover, ref.current.offsetHeight);
    }
    setHover(null);
  };
  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: 'relative', height: 340, borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(180deg, #1a0e08, #0a0504)',
        border: `1px solid ${PINK}33`, touchAction: 'none', cursor: 'crosshair',
      }}
    >
      {/* Cutting board grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.1,
        backgroundImage: `repeating-linear-gradient(90deg, ${PINK} 0 1px, transparent 1px 30px)` }} />

      {/* Fish (sashimi) — full piece with target slice marked */}
      <div style={{
        position: 'absolute', left: '20%', right: '20%',
        top: `${(fish.top / 120) * 100}%`, height: `${((fish.bottom - fish.top) / 120) * 100}%`,
        borderRadius: 16,
        background: `linear-gradient(180deg, #ff8fa3 0%, #ff6b8e 30%, #d44a6e 70%, #b1335a 100%)`,
        boxShadow: `0 0 30px ${PINK}66, inset 0 4px 12px rgba(255,255,255,0.15)`,
      }}>
        {/* Marbling lines */}
        {[20, 45, 70].map(p => (
          <div key={p} style={{ position: 'absolute', left: 8, right: 8, top: `${p}%`, height: 1,
            background: 'rgba(255,255,255,0.25)' }} />
        ))}
      </div>

      {/* Target line — desired cut at top + targetMm */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: `${((fish.top + targetMm) / 120) * 100}%`, height: 1,
        background: NEON, boxShadow: `0 0 10px ${NEON}`,
      }}>
        <span style={{ position: 'absolute', right: 6, top: -16, fontSize: 9, color: NEON,
          fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.18em' }}>TARGET</span>
      </div>

      {/* Hover knife guide */}
      {hover != null && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: hover, height: 2,
          background: '#fff', boxShadow: '0 0 12px #fff' }} />
      )}

      {/* Confirmed cut */}
      {cutY != null && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: cutY, height: 2,
          background: '#ef4444', boxShadow: '0 0 14px #ef4444' }} />
      )}

      {/* Ruler ticks */}
      <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 20 }}>
        {Array.from({ length: 13 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, top: `${(i / 12) * 100}%`,
            color: NEON, fontSize: 8, fontFamily: 'Orbitron, sans-serif',
            opacity: 0.6,
          }}>{i * 10}</div>
        ))}
      </div>
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
