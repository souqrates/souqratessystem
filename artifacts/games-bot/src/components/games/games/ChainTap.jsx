import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Circles appear in a chain. Drag your finger through them IN ORDER without lifting! Start at circle 1, trace through to the last. Miss or lift = restart the chain. Score 20 to win!';
const TARGET = 20;
const DEFAULT_GAME_TIME = 55;
const CHAIN_LEN_START = 6;

function makeChain(len) {
  const nodes = [];
  for (let i = 0; i < len; i++) {
    const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
    const r = 30 + Math.random() * 18;
    nodes.push({
      n: i + 1,
      x: 50 + r * Math.cos(angle) + (Math.random() - 0.5) * 12,
      y: 50 + r * Math.sin(angle) + (Math.random() - 0.5) * 12,
    });
  }
  return nodes;
}

export default function ChainTap({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [chain, setChain] = useState([]);
  const [traced, setTraced] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [chainLen, setChainLen] = useState(CHAIN_LEN_START);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const isDragging = useRef(false);
  const tracedRef = useRef([]);
  const chainRef = useRef([]);
  const chainLenRef = useRef(CHAIN_LEN_START);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextChain = useCallback((len) => {
    chainLenRef.current = len;
    setChainLen(len);
    const c = makeChain(len);
    chainRef.current = c;
    setChain(c);
    tracedRef.current = [];
    setTraced([]);
    isDragging.current = false;
  }, []);

  const enterNode = useCallback((nodeN, containerRect, clientX, clientY) => {
    if (!activeRef.current || !isDragging.current) return;
    if (tracedRef.current.includes(nodeN)) return;
    const expected = tracedRef.current.length + 1;

    if (nodeN !== expected) {
      if (tracedRef.current.length === 0 && nodeN !== 1) return;
      isDragging.current = false;
      triggerHaptic('error');
      setFeedback({ label: 'BROKEN CHAIN!', color: '#ef4444', id: Date.now() });
      beep({ freq: 220, dur: 0.15, type: 'sawtooth', vol: 0.12 });
      tracedRef.current = [];
      setTraced([]);
      setTimeout(() => isDragging.current = false, 0);
      return;
    }

    tracedRef.current = [...tracedRef.current, nodeN];
    setTraced([...tracedRef.current]);
    beep({ freq: 330 + nodeN * 50, dur: 0.07, vol: 0.08 });
    triggerHaptic('light');

    if (tracedRef.current.length >= chainRef.current.length) {
      isDragging.current = false;
      scoreRef.current++;
      setScore(scoreRef.current);
      chord([523, 659, 784], 0.06, 0.14, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: `✓ CHAIN COMPLETE!`, color: '#10b981', id: Date.now() });  // game-symbol
      const next = Math.min(8, chainLenRef.current + (scoreRef.current % 4 === 0 ? 1 : 0));
      setTimeout(() => nextChain(next), 600);
    }
  }, [endGame, nextChain]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setFeedback(null);
    activeRef.current = true;
    nextChain(CHAIN_LEN_START);
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 4} setPhase={setPhase} />;
  }

  const color = '#a3e635';
  const tracedSet = new Set(traced);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c={color} />
        <Hud label="CHAIN" v={chainLen} c="#94a3b8" />
        <Hud label="TIME" v={`${timeLeft}s`} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={color} />

      <div style={{
        flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 50%, #040800 0%, #020400 100%)',
        border: `1px solid ${color}18`, minHeight: 280, touchAction: 'none',
        cursor: 'crosshair',
      }}
        onPointerDown={(e) => {
          if (!activeRef.current) return;
          isDragging.current = true;
          tracedRef.current = [];
          setTraced([]);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={() => { isDragging.current = false; }}
        onPointerMove={(e) => {
          if (!isDragging.current || !activeRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * 100;
          const py = ((e.clientY - rect.top) / rect.height) * 100;
          chain.forEach(node => {
            const dx = node.x - px;
            const dy = node.y - py;
            if (Math.hypot(dx * rect.width / 100, dy * rect.height / 100) < 24) {
              enterNode(node.n, rect, e.clientX, e.clientY);
            }
          });
        }}
      >
        {/* Connection lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {chain.map((node, i) => {
            if (i === 0) return null;
            const prev = chain[i - 1];
            const bothTraced = tracedSet.has(node.n) && tracedSet.has(prev.n);
            return (
              <line key={i}
                x1={`${prev.x}%`} y1={`${prev.y}%`}
                x2={`${node.x}%`} y2={`${node.y}%`}
                stroke={bothTraced ? color : 'rgba(255,255,255,0.06)'}
                strokeWidth={bothTraced ? 3 : 1.5}
                strokeDasharray={bothTraced ? 'none' : '4,4'}
              />
            );
          })}
        </svg>

        {chain.map(node => {
          const isTraced = tracedSet.has(node.n);
          const isNext = traced.length + 1 === node.n;
          return (
            <div
              key={node.n}
              style={{
                position: 'absolute', left: `${node.x}%`, top: `${node.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 46, height: 46, borderRadius: '50%',
                background: isTraced
                  ? `radial-gradient(circle, ${color}, ${color}88)`
                  : isNext ? `${color}22` : 'rgba(255,255,255,0.05)',
                border: `2.5px solid ${isTraced ? color : isNext ? color : 'rgba(255,255,255,0.12)'}`,
                boxShadow: isTraced ? `0 0 20px ${color}99` : isNext ? `0 0 16px ${color}55` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14,
                color: isTraced ? '#000' : isNext ? color : 'rgba(255,255,255,0.4)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {node.n}
            </div>
          );
        })}

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, y: 0, scale: 0.9 }} animate={{ opacity: 0, y: -30, scale: 1.1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: feedback.color, textShadow: `0 0 14px ${feedback.color}`, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.22)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.14em' }}>
          DRAG THROUGH 1 → {chainLen} WITHOUT LIFTING
        </div>
      </div>
    </div>
  );
}
