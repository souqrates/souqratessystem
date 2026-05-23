import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import PremiumStage from './_premiumStage';
import { TimeBar } from './_shell';

const RULES = 'SPIDER WEB \u2014 Drag a line through the highlighted nodes IN ORDER without lifting your finger. Don\u2019t cross existing strands. Each successful pattern = score. 60 seconds.';
const DEFAULT_GAME_TIME = 60;
const NODES = 9;

function layoutNodes() {
  // 3x3 grid with slight jitter for organic web look
  const arr = [];
  for (let i = 0; i < NODES; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    arr.push({
      id: i,
      x: 18 + col * 32 + (Math.random() - 0.5) * 6,
      y: 18 + row * 32 + (Math.random() - 0.5) * 6,
    });
  }
  return arr;
}

function randPath(len) {
  const all = Array.from({ length: NODES }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, len);
}

export default function SpiderWeb({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [nodes, setNodes] = useState(layoutNodes());
  const [target, setTarget] = useState(randPath(4));
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pointer, setPointer] = useState(null);

  const nodesRef = useRef(nodes);
  const targetRef = useRef(target);
  const progressRef = useRef(0);
  const scoreRef = useRef(0);
  const roundRef = useRef(1);
  const tickRef = useRef(null);
  const activeRef = useRef(false);
  const trackingRef = useRef(false);
  const areaRef = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const nextRound = useCallback(() => {
    roundRef.current += 1;
    const len = Math.min(7, 4 + Math.floor(roundRef.current / 2));
    const n = layoutNodes();
    const t = randPath(len);
    nodesRef.current = n; targetRef.current = t;
    progressRef.current = 0;
    setNodes(n); setTarget(t); setProgress(0); setRound(roundRef.current);
  }, []);

  const checkAt = (xPct, yPct) => {
    const idx = progressRef.current;
    if (idx >= targetRef.current.length) return;
    const next = nodesRef.current[targetRef.current[idx]];
    if (Math.hypot(xPct - next.x, yPct - next.y) < 6) {
      progressRef.current += 1;
      setProgress(progressRef.current);
      beep({ freq: 440 + progressRef.current * 50, dur: 0.06, type: 'triangle' });
      triggerHaptic('light');
      if (progressRef.current >= targetRef.current.length) {
        const pts = 40 + targetRef.current.length * 10;
        scoreRef.current += pts;
        setScore(scoreRef.current);
        if (onScoreUpdate) onScoreUpdate(scoreRef.current);
        triggerHaptic('medium');
        setTimeout(nextRound, 350);
      }
    } else {
      // check if hit wrong node (penalty reset)
      for (const n of nodesRef.current) {
        if (Math.hypot(xPct - n.x, yPct - n.y) < 5 && targetRef.current.slice(0, progressRef.current).indexOf(n.id) === -1 && n.id !== targetRef.current[idx]) {
          progressRef.current = 0;
          setProgress(0);
          noise({ dur: 0.15, vol: 0.16 });
          triggerHaptic('error');
          return;
        }
      }
    }
  };

  const handlePtr = (e) => {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPointer({ x, y });
    if (trackingRef.current) checkAt(x, y);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; roundRef.current = 1; progressRef.current = 0;
    const n = layoutNodes(); const t = randPath(4);
    nodesRef.current = n; targetRef.current = t;
    setNodes(n); setTarget(t); setProgress(0); setScore(0); setTimeLeft(GAME_TIME); setRound(1);
    activeRef.current = true;
    tickRef.current = setInterval(() => {
      setTimeLeft(s => { if (s <= 1) { endGame(); return 0; } return s - 1; });
    }, 1000);
    return () => { activeRef.current = false; clearInterval(tickRef.current); };
  }, [phase, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  const completed = target.slice(0, progress);

  return (
    <PremiumStage accent="#00f5ff" accent2="#00f5a0">
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#00f5ff" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="ROUND" val={round} color="#ffcc00" />
        <Tile label="STEP" val={`${progress}/${target.length}`} color="#00f5a0" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div
        ref={areaRef}
        onPointerDown={(e) => { trackingRef.current = true; handlePtr(e); }}
        onPointerMove={(e) => handlePtr(e)}
        onPointerUp={() => { trackingRef.current = false; setPointer(null); }}
        onPointerLeave={() => { trackingRef.current = false; setPointer(null); }}
        style={{
          position: 'relative', flex: 1, borderRadius: 14, overflow: 'hidden',
          background: 'radial-gradient(circle at center, rgba(0,245,255,0.05), rgba(0,0,0,0.5))',
          border: '1px solid rgba(0,245,255,0.2)', touchAction: 'none', cursor: 'crosshair', minHeight: 380,
        }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {/* web background lines */}
          {nodes.map((a) => nodes.filter(b => b.id > a.id && Math.hypot(a.x - b.x, a.y - b.y) < 35).map(b => (
            <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="rgba(0,245,255,0.08)" strokeWidth="0.25" />
          )))}
          {/* completed path */}
          {completed.length > 1 && (
            <polyline points={completed.map(i => `${nodes[i].x},${nodes[i].y}`).join(' ')}
              fill="none" stroke="#00f5a0" strokeWidth="0.7" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 4px #00f5a0)' }} />
          )}
          {/* current to pointer */}
          {trackingRef.current && pointer && completed.length > 0 && (
            <line x1={nodes[completed[completed.length - 1]].x} y1={nodes[completed[completed.length - 1]].y}
              x2={pointer.x} y2={pointer.y} stroke="rgba(255,204,0,0.7)" strokeWidth="0.5"
              strokeDasharray="1 1" style={{ filter: 'drop-shadow(0 0 3px #ffcc00)' }} />
          )}
        </svg>
        {nodes.map((n) => {
          const isNext = progress < target.length && target[progress] === n.id;
          const isDone = completed.includes(n.id);
          const isTarget = target.includes(n.id);
          return (
            <motion.div
              key={n.id}
              animate={{ scale: isNext ? [1, 1.2, 1] : 1 }}
              transition={{ repeat: isNext ? Infinity : 0, duration: 0.9 }}
              style={{
                position: 'absolute', left: `${n.x}%`, top: `${n.y}%`,
                transform: 'translate(-50%,-50%)',
                width: 24, height: 24, borderRadius: '50%',
                background: isDone ? '#00f5a0' : isNext ? '#ffcc00' : isTarget ? 'rgba(0,245,255,0.6)' : 'rgba(148,163,184,0.4)',
                border: `2px solid ${isDone ? '#00f5a0' : isNext ? '#ffcc00' : isTarget ? '#00f5ff' : 'rgba(148,163,184,0.5)'}`,
                boxShadow: isNext ? '0 0 18px #ffcc00' : isDone ? '0 0 14px #00f5a0' : isTarget ? '0 0 10px #00f5ff' : 'none',
              }} />
          );
        })}
        <p style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
          fontSize: 10, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em', margin: 0 }}>
          DRAG THROUGH NODES IN ORDER
        </p>
      </div>
    </div>
    </PremiumStage>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 7, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.14em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
