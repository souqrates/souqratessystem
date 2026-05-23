import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A path lights up on the grid — memorize it! Then trace the exact same path by swiping over the nodes in order. Score 20 to win!';
const TARGET = 28;
const COLS = 4;
const ROWS = 5;
const NODES = COLS * ROWS;

function generatePath(length) {
  const path = [Math.floor(Math.random() * NODES)];
  const visited = new Set(path);
  const dirs = [-COLS, COLS, -1, 1];
  while (path.length < length) {
    const last = path[path.length - 1];
    const row = Math.floor(last / COLS);
    const neighbors = dirs
      .map(d => {
        const next = last + d;
        if (next < 0 || next >= NODES) return null;
        if (d === -1 && row !== Math.floor(next / COLS)) return null;
        if (d === 1 && row !== Math.floor(next / COLS)) return null;
        return next;
      })
      .filter(n => n !== null && !visited.has(n));
    if (neighbors.length === 0) break;
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    path.push(next);
    visited.add(next);
  }
  return path;
}

export default function PathTrace({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [path, setPath] = useState([]);
  const [showPath, setShowPath] = useState(false);
  const [tracing, setTracing] = useState([]);
  const [mode, setMode] = useState('watch');
  const [feedback, setFeedback] = useState(null);
  const [pathLen, setPathLen] = useState(3);

  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const activeRef = useRef(false);
  const pathRef = useRef([]);
  const tracingRef = useRef([]);
  const pathLenRef = useRef(3);
  const isDragging = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const startRound = useCallback((len) => {
    pathLenRef.current = len;
    setPathLen(len);
    const p = generatePath(len);
    pathRef.current = p;
    setPath(p);
    setTracing([]);
    tracingRef.current = [];
    setMode('watch');
    setShowPath(true);

    let i = 0;
    const flash = () => {
      if (i >= p.length) {
        setTimeout(() => { setShowPath(false); setMode('input'); }, 400);
        return;
      }
      beep({ freq: 330 + i * 30, dur: 0.18, vol: 0.08 });
      i++;
      setTimeout(flash, 350);
    };
    setTimeout(flash, 300);
  }, []);

  const enterNode = useCallback((idx) => {
    if (!activeRef.current || mode !== 'input' || !isDragging.current) return;
    if (tracingRef.current.includes(idx)) return;

    const expected = pathRef.current[tracingRef.current.length];
    if (idx !== expected) {
      isDragging.current = false;
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG PATH!', color: '#ef4444', id: Date.now() });
      beep({ freq: 200, dur: 0.18, type: 'sawtooth', vol: 0.12 });
      setTracing([]);
      tracingRef.current = [];
      if (livesRef.current <= 0) { endGame(); return; }
      setTimeout(() => startRound(Math.max(2, pathLenRef.current)), 700);
      setMode('watch');
      return;
    }

    tracingRef.current = [...tracingRef.current, idx];
    setTracing([...tracingRef.current]);
    beep({ freq: 440 + tracingRef.current.length * 40, dur: 0.07, vol: 0.07 });
    triggerHaptic('light');

    if (tracingRef.current.length >= pathRef.current.length) {
      isDragging.current = false;
      const pts = pathRef.current.length;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      chord([523, 659, 784], 0.06, 0.14, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: `+${pts} TRACED!`, color: '#10b981', id: Date.now() });
      setTimeout(() => startRound(Math.min(12, pathLenRef.current + 1)), 700);
      setMode('watch');
    }
  }, [mode, endGame, startRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3;
    setScore(0); setLives(3); setFeedback(null);
    activeRef.current = true;
    startRound(4);
    return () => { activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const color = '#f97316';
  const pathSet = new Set(path);
  const tracedSet = new Set(tracing);
  const nextNode = mode === 'input' ? pathRef.current[tracingRef.current.length] : -1;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c={color} />
        <Hud label="PATH" v={pathLen} c="#94a3b8" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, borderRadius: 16, padding: 12,
        background: 'radial-gradient(ellipse at 50% 50%, #060300 0%, #020100 100%)',
        border: `1px solid ${color}18`,
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.16em', color: mode === 'watch' ? '#fbbf24' : color }}>
          {showPath ? 'MEMORIZE THE PATH' : mode === 'input' ? 'TRACE THE PATH' : '...'}
        </div>

        <div
          onPointerDown={(e) => { if (mode !== 'input') return; isDragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerUp={() => { isDragging.current = false; }}
          onPointerLeave={() => { isDragging.current = false; }}
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 10,
            width: '100%', maxWidth: 280, touchAction: 'none',
          }}
        >
          {Array.from({ length: NODES }).map((_, i) => {
            const isPath = pathSet.has(i) && showPath;
            const isTraced = tracedSet.has(i);
            const isNext = i === nextNode && mode === 'input';
            const pathIdx = path.indexOf(i);
            const isFirst = pathIdx === 0;
            return (
              <motion.div
                key={i}
                onPointerEnter={() => enterNode(i)}
                onPointerDown={() => enterNode(i)}
                animate={isPath ? { scale: 1.1, boxShadow: `0 0 20px ${color}88` } : { scale: 1 }}
                style={{
                  height: 44, borderRadius: 12, cursor: mode === 'input' ? 'pointer' : 'default',
                  background: isTraced ? `${color}55` : isPath ? `${color}44` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${isTraced ? color : isPath ? `${color}aa` : isNext ? `${color}66` : 'rgba(255,255,255,0.07)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 11,
                  color: isPath && showPath ? (isFirst ? '#fff' : color) : isTraced ? '#fff' : 'transparent',
                  boxShadow: isNext ? `0 0 16px ${color}66` : 'none',
                  userSelect: 'none',
                }}
              >
                {isPath && showPath && isFirst ? '1' : ''}
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
