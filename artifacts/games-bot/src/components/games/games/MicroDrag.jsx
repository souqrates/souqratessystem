import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Drag each colored block precisely into its matching outline. Perfect fit (within 8px) = +100. Sloppy drop = -150. More blocks after 400 pts. Reach 1000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

const W = 280;
const H = 220;

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

function genBlocks(count) {
  const blocks = [];
  const targets = [];
  for (let i = 0; i < count; i++) {
    const color = COLORS[i % COLORS.length];
    const tw = 36 + Math.random() * 20;
    const th = 36 + Math.random() * 20;
    const tx = 20 + (i % 2) * (W / 2 - 20) + Math.random() * 30;
    const ty = 20 + Math.floor(i / 2) * (H / 2 - 10) + Math.random() * 20;
    targets.push({ id: i, color, x: tx, y: ty, w: tw, h: th });
    // Block starts on opposite side
    blocks.push({ id: i, color, x: W - tx - tw, y: H - ty - th, w: tw, h: th, placed: false });
  }
  return { blocks, targets };
}

export default function MicroDrag({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [blocks, setBlocks] = useState([]);
  const [targets, setTargets] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [flash, setFlash] = useState(null);
  const svgRef = useRef(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getCount = () => Math.min(4, 2 + Math.floor(scoreRef.current / 400));

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const { blocks: b, targets: t } = genBlocks(getCount());
    setBlocks(b);
    setTargets(t);
    setDragging(null);
  }, []);

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: e.clientX, y: e.clientY };
    const rect = svg.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }, []);

  const startDrag = useCallback((id, e) => {
    if (!activeRef.current) return;
    e.preventDefault();
    const pt = getSVGPoint(e);
    const block = blocks.find(b => b.id === id);
    if (!block || block.placed) return;
    setDragging(id);
    setDragOffset({ x: pt.x - block.x, y: pt.y - block.y });
    setDragPos({ x: block.x, y: block.y });
  }, [blocks, getSVGPoint]);

  const onMove = useCallback((e) => {
    if (dragging === null) return;
    const pt = getSVGPoint(e);
    setDragPos({ x: pt.x - dragOffset.x, y: pt.y - dragOffset.y });
  }, [dragging, dragOffset, getSVGPoint]);

  const onDrop = useCallback(() => {
    if (dragging === null) return;
    const block = blocks.find(b => b.id === dragging);
    const target = targets.find(t => t.id === dragging);
    if (!block || !target) { setDragging(null); return; }

    const dx = Math.abs(dragPos.x - target.x);
    const dy = Math.abs(dragPos.y - target.y);
    if (dx < 12 && dy < 12) {
      // Perfect fit
      const newBlocks = blocks.map(b => b.id === dragging ? { ...b, x: target.x, y: target.y, placed: true } : b);
      setBlocks(newBlocks);
      setDragging(null);
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      if (newBlocks.every(b => b.placed)) {
        setTimeout(newRound, 600);
      }
    } else {
      setDragging(null);
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.08, vol: 0.08 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      // Reset block position
      const orig = genBlocks(getCount()).blocks.find(b => b.id === dragging);
      if (orig) {
        setBlocks(prev => prev.map(b => b.id === dragging ? { ...b, x: orig.x, y: orig.y } : b));
      }
    }
  }, [dragging, blocks, targets, dragPos, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newRound();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#06b6d4" />
        <Hud label="PLACED" v={`${blocks.filter(b => b.placed).length}/${blocks.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'PRECISE!' : 'TOO FAR!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg
          ref={svgRef}
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, touchAction: 'none' }}
          onPointerMove={onMove}
          onPointerUp={onDrop}
          onPointerLeave={onDrop}
        >
          {/* Targets */}
          {targets.map(t => (
            <rect key={t.id} x={t.x} y={t.y} width={t.w} height={t.h} rx={4} fill={`${t.color}15`} stroke={t.color} strokeWidth={1.5} strokeDasharray="4 3" />
          ))}

          {/* Blocks */}
          {blocks.map(b => {
            const pos = dragging === b.id ? dragPos : b;
            return (
              <rect
                key={b.id}
                x={pos.x} y={pos.y}
                width={b.w} height={b.h}
                rx={4}
                fill={`${b.color}${b.placed ? '55' : '33'}`}
                stroke={b.color}
                strokeWidth={2}
                style={{ cursor: b.placed ? 'default' : 'grab', filter: dragging === b.id ? `drop-shadow(0 0 8px ${b.color}88)` : 'none' }}
                onPointerDown={(e) => startDrag(b.id, e)}
              />
            );
          })}
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>DRAG BLOCKS TO MATCHING OUTLINES</p>
      </div>
    </div>
  );
}
