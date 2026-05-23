import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'PHOTON TRACE \u2014 A glowing photon path appears for 1 second. Then it FADES. Trace the path exactly with your finger. Accuracy = score. 90 seconds.';
const DEFAULT_GAME_TIME = 90;

function generatePath() {
  const pts = [];
  const steps = 6 + Math.floor(Math.random() * 3);
  let x = 10 + Math.random() * 20, y = 50;
  pts.push({ x, y });
  for (let i = 0; i < steps; i++) {
    x = Math.min(95, x + 8 + Math.random() * 14);
    y = Math.max(15, Math.min(85, y + (Math.random() - 0.5) * 50));
    pts.push({ x, y });
  }
  return pts;
}

function pointToSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / Math.max(0.0001, abx * abx + aby * aby)));
  const cx = ax + abx * t, cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function distToPath(x, y, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = pointToSeg(x, y, path[i-1].x, path[i-1].y, path[i].x, path[i].y);
    if (d < best) best = d;
  }
  return best;
}

export default function PhotonTrace({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [path, setPath] = useState([]);
  const [trace, setTrace] = useState([]);
  const [stage, setStage] = useState('show'); // show | trace | result
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);
  const [opacity, setOpacity] = useState(1);

  const pathRef = useRef([]);
  const traceRef = useRef([]);
  const scoreRef = useRef(0);
  const tickRef = useRef(null);
  const stageTimerRef = useRef(null);
  const activeRef = useRef(false);
  const trackingRef = useRef(false);
  const areaRef = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(stageTimerRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const finishTrace = useCallback(() => {
    const t = traceRef.current;
    const p = pathRef.current;
    if (t.length < 4 || p.length < 2) {
      setFlash({ type: 'fail' });
      setTimeout(() => setFlash(null), 320);
      noise({ dur: 0.18, vol: 0.16 });
      triggerHaptic('error');
    } else {
      // sample average distance
      let sum = 0;
      for (const pt of t) sum += distToPath(pt.x, pt.y, p);
      const avg = sum / t.length;
      const acc = Math.max(0, 100 - avg * 12);
      const pts = Math.floor(acc * 1.2);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      setFlash({ type: 'ok', pts, acc: Math.floor(acc) });
      beep({ freq: 600 + acc * 4, dur: 0.14, type: 'triangle' });
      triggerHaptic('medium');
      setTimeout(() => setFlash(null), 480);
    }
    setStage('result');
    stageTimerRef.current = setTimeout(() => startRound(), 700);
  }, [onScoreUpdate]);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const p = generatePath();
    pathRef.current = p; traceRef.current = [];
    setPath(p); setTrace([]); setOpacity(1); setStage('show');
    setRound(r => r + 1);
    stageTimerRef.current = setTimeout(() => {
      setOpacity(0.08); setStage('trace');
    }, 1100);
  }, []);

  const handlePtr = (e) => {
    if (stage !== 'trace' || !trackingRef.current) return;
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    traceRef.current.push({ x, y });
    setTrace([...traceRef.current]);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setRound(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    startRound();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => {
      activeRef.current = false;
      clearTimeout(stageTimerRef.current);
      clearInterval(tickRef.current);
    };
  }, [phase, startRound, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1a0a2a 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#ffcc00" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="ROUND" val={round} color="#ff66ee" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.25em', margin: 0 }}>
          {stage === 'show' ? 'MEMORIZE THE PATH' : stage === 'trace' ? 'TRACE IT NOW' : '\u2014'}
        </p>
      </div>
      <div
        ref={areaRef}
        onPointerDown={(e) => { trackingRef.current = true; handlePtr(e); }}
        onPointerMove={handlePtr}
        onPointerUp={() => { if (trackingRef.current) { trackingRef.current = false; if (stage === 'trace') finishTrace(); } }}
        onPointerLeave={() => { if (trackingRef.current) { trackingRef.current = false; if (stage === 'trace') finishTrace(); } }}
        style={{
          position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
          background: 'radial-gradient(circle at center, rgba(255,204,0,0.05), rgba(0,0,0,0.6))',
          border: '1px solid rgba(255,204,0,0.2)', touchAction: 'none', cursor: 'crosshair', minHeight: 360,
        }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {path.length > 1 && (
            <polyline points={path.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={`rgba(255,204,0,${opacity})`} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 6px rgba(255,204,0,${opacity}))`, transition: 'all 0.4s' }} />
          )}
          {trace.length > 1 && (
            <polyline points={trace.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="#00f5ff" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 5px #00f5ff)' }} />
          )}
          {path.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 1.4 : 0.9}
              fill={i === 0 ? '#00f5a0' : `rgba(255,204,0,${opacity})`}
              style={{ filter: `drop-shadow(0 0 4px ${i === 0 ? '#00f5a0' : 'rgba(255,204,0,0.8)'})` }} />
          ))}
        </svg>
        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, pointerEvents: 'none', textAlign: 'center',
                color: flash.type === 'ok' ? '#ffcc00' : '#ff3355',
                textShadow: `0 0 20px ${flash.type === 'ok' ? '#ffcc00' : '#ff3355'}`,
              }}>
              {flash.type === 'ok' ? <>+{flash.pts}<br /><span style={{ fontSize: 12 }}>ACC {flash.acc}%</span></> : 'INVALID'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
