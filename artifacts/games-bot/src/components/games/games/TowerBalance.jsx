import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A block falls from above. Tap CATCH when it aligns with the tower! Perfect = +100, off-center = partial, miss = -150 and block falls. Earthquakes get stronger every 300 pts. Stack 15 blocks for the win!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1500;
const TOTAL_BLOCKS = 15;

export default function TowerBalance({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [blocks, setBlocks] = useState([]);
  const [fallingX, setFallingX] = useState(50);
  const [flash, setFlash] = useState(null);
  const [quakeX, setQuakeX] = useState(0);
  const [placed, setPlaced] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const fallingRef = useRef(50);
  const dirRef = useRef(1);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const placedRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const catchBlock = useCallback(() => {
    if (!activeRef.current) return;
    const x = fallingRef.current;
    const topBlock = placedRef.current > 0 ? 50 : 50;
    const offset = Math.abs(x - topBlock);
    if (offset < 5) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([520, 700, 880], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now(), pts: 100 });
    } else if (offset < 15) {
      scoreRef.current = Math.max(0, scoreRef.current + 50);
      setScore(scoreRef.current);
      triggerHaptic('light');
      beep({ freq: 500, dur: 0.1, vol: 0.1 });
      setFlash({ type: 'ok', id: Date.now(), pts: 50 });
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.15, vol: 0.15 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);

    placedRef.current++;
    setPlaced(placedRef.current);
    setBlocks(prev => [{ x, id: placedRef.current }, ...prev].slice(0, TOTAL_BLOCKS));

    if (placedRef.current >= TOTAL_BLOCKS || scoreRef.current >= TARGET_SCORE) {
      endGame(); return;
    }

    // Earthquake effect
    if (scoreRef.current >= 300) {
      const intensity = Math.floor(scoreRef.current / 300) * 3;
      setQuakeX((Math.random() - 0.5) * intensity);
      setTimeout(() => setQuakeX(0), 300);
    }
    fallingRef.current = 50;
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; placedRef.current = 0; fallingRef.current = 50; dirRef.current = 1;
    setScore(0); setPlaced(0); setBlocks([]); setTimeLeft(GAME_TIME); setFallingX(50); setQuakeX(0);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const lvl = Math.floor(scoreRef.current / 300);
      const speed = 25 + lvl * 5;
      fallingRef.current += dirRef.current * speed * dt;
      if (fallingRef.current >= 85) { fallingRef.current = 85; dirRef.current = -1; }
      if (fallingRef.current <= 15) { fallingRef.current = 15; dirRef.current = 1; }
      setFallingX(fallingRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 12)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#06b6d4" />
        <Hud label="BLOCKS" v={`${placed}/${TOTAL_BLOCKS}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, position: 'relative', background: 'radial-gradient(ellipse at center, #0a1628 0%, #030810 100%)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(6,182,212,0.12)', cursor: 'pointer' }}
        onPointerDown={catchBlock}
      >
        <MomentumFlash msg={flash?.type === 'good' ? 'PERFECT!' : flash?.type === 'ok' ? 'GOOD!' : 'DROPPED!'} color={flash?.type === 'good' ? '#10b981' : flash?.type === 'ok' ? '#f59e0b' : '#ef4444'} trigger={flash?.id} />

        {/* Falling block */}
        <motion.div
          animate={{ left: `${fallingX + quakeX}%`, top: '12%' }}
          transition={{ duration: 0, ease: 'linear' }}
          style={{
            position: 'absolute', width: 48, height: 20, marginLeft: -24,
            borderRadius: 4, background: 'rgba(6,182,212,0.7)',
            border: '2px solid #06b6d4', boxShadow: '0 0 14px #06b6d488',
          }}
        />

        {/* Tower of blocks */}
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: `translateX(-50%) translateX(${quakeX}px)`, display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 3 }}>
          {blocks.map((b, i) => (
            <div key={b.id} style={{
              width: 48, height: 18, borderRadius: 3,
              background: `rgba(6,182,212,${0.8 - i * 0.05})`,
              border: '1.5px solid #06b6d488',
              marginLeft: (b.x - 50) * 0.3,
            }} />
          ))}
        </div>

        <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: 'rgba(148,163,184,0.4)', fontSize: 10, letterSpacing: '0.12em' }}>TAP TO PLACE BLOCK</p>
      </div>
    </div>
  );
}
