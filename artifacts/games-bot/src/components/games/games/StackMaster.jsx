import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap to drop each block onto the stack. Perfect alignment = +100. Slight overhang cuts the block. Big miss = -150 and block is lost. Tower must stay balanced. Reach 2000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 2000;

const STACK_W = 220;
const BLOCK_H = 28;
const BASE_W = 160;

export default function StackMaster({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [blocks, setBlocks] = useState([]);
  const [movingX, setMovingX] = useState(0);
  const [movingW, setMovingW] = useState(BASE_W);
  const [movingY, setMovingY] = useState(0);
  const [flash, setFlash] = useState(null);
  const [height, setHeight] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const movingXRef = useRef(0);
  const dirRef = useRef(1);
  const blocksRef = useRef([]);
  const movingWRef = useRef(BASE_W);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSpeed = () => 60 + Math.floor(scoreRef.current / 200) * 10;
  const PADDING = 20;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const spawnNext = useCallback((newBlocks) => {
    const w = movingWRef.current;
    movingXRef.current = PADDING;
    dirRef.current = 1;
    const lvl = newBlocks.length;
    setMovingY(lvl);
    setMovingX(PADDING);
    setMovingW(w);
  }, []);

  const drop = useCallback(() => {
    if (!activeRef.current) return;
    const curX = movingXRef.current;
    const curW = movingWRef.current;
    const topBlock = blocksRef.current[blocksRef.current.length - 1] || { x: (STACK_W - BASE_W) / 2, w: BASE_W };
    const overlap_left = Math.max(curX, topBlock.x);
    const overlap_right = Math.min(curX + curW, topBlock.x + topBlock.w);
    const overlap = overlap_right - overlap_left;

    if (overlap <= 0) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      movingWRef.current = Math.max(40, topBlock.w * 0.8);
      spawnNext(blocksRef.current);
      return;
    }

    const perfect = Math.abs(overlap - curW) < 4;
    if (perfect) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      beep({ freq: 600, dur: 0.07, vol: 0.09 });
    } else {
      scoreRef.current = Math.max(0, scoreRef.current + 50);
      setScore(scoreRef.current);
      triggerHaptic('light');
      beep({ freq: 450, dur: 0.07, vol: 0.08 });
    }
    onScoreUpdate?.(scoreRef.current);

    const newBlock = { x: overlap_left, w: overlap, level: blocksRef.current.length };
    blocksRef.current = [...blocksRef.current, newBlock];
    movingWRef.current = overlap;
    setBlocks([...blocksRef.current]);
    setHeight(blocksRef.current.length);

    spawnNext(blocksRef.current);
  }, [endGame, onScoreUpdate, spawnNext, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    movingWRef.current = BASE_W; movingXRef.current = PADDING; dirRef.current = 1;
    blocksRef.current = [{ x: (STACK_W - BASE_W) / 2, w: BASE_W, level: -1 }];
    setScore(0); setTimeLeft(GAME_TIME);
    setBlocks([{ x: (STACK_W - BASE_W) / 2, w: BASE_W, level: -1 }]);
    setMovingW(BASE_W); setMovingX(PADDING); setMovingY(1); setHeight(1);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const speed = getSpeed();

      movingXRef.current += dirRef.current * speed * dt;
      const maxX = STACK_W - movingWRef.current - PADDING;
      if (movingXRef.current >= maxX) { movingXRef.current = maxX; dirRef.current = -1; }
      if (movingXRef.current <= PADDING) { movingXRef.current = PADDING; dirRef.current = 1; }
      setMovingX(movingXRef.current);
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
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const VISIBLE = 6;
  const startLevel = Math.max(0, blocks.length - VISIBLE);
  const visibleBlocks = blocks.slice(startLevel);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="HEIGHT" v={height} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 8px 16px', cursor: 'pointer' }}
        onPointerDown={drop}
      >
        <MomentumFlash msg={flash?.type === 'good' ? 'PERFECT!' : 'MISSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ position: 'relative', width: STACK_W, height: (VISIBLE + 1) * (BLOCK_H + 4) }}>
          {/* Moving block */}
          <div style={{
            position: 'absolute',
            left: movingX,
            top: 0,
            width: movingW,
            height: BLOCK_H,
            background: 'rgba(245,158,11,0.4)',
            border: '2px solid #f59e0b',
            borderRadius: 6,
            boxShadow: '0 0 12px rgba(245,158,11,0.4)',
          }} />

          {/* Stack blocks */}
          {visibleBlocks.map((b, i) => {
            const top = (VISIBLE - (i + 1)) * (BLOCK_H + 4) + BLOCK_H + 4;
            const idx = startLevel + i;
            const hue = 180 + idx * 15;
            return (
              <div key={b.level} style={{
                position: 'absolute',
                left: b.x,
                top,
                width: b.w,
                height: BLOCK_H,
                background: `hsla(${hue}, 60%, 50%, 0.3)`,
                border: `2px solid hsla(${hue}, 60%, 60%, 0.6)`,
                borderRadius: 6,
              }} />
            );
          })}
        </div>

        <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11, letterSpacing: '0.15em', marginTop: 8 }}>TAP TO DROP</p>
      </div>
    </div>
  );
}
