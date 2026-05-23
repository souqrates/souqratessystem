import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Slide blocks to free the RED block to the exit (right side). Every move costs 1 move. Solve in MIN moves = +100. Extra moves = -20 each. Wrong direction drag = -150. Reach 800 in 180 seconds!';
const DEFAULT_GAME_TIME = 180;
const TARGET = 800;

const GRID = 6;

function buildPuzzle(level) {
  const blocks = [
    { id: 'red', r: 2, c: 0, len: 2, horiz: true, color: '#ef4444' },
  ];
  const count = 3 + Math.min(level, 5);
  const used = new Set();
  used.add('2,0'); used.add('2,1');
  const attempts = count * 10;
  let added = 0;
  for (let i = 0; i < attempts && added < count; i++) {
    const horiz = Math.random() > 0.5;
    const len = Math.random() > 0.6 ? 3 : 2;
    const r = Math.floor(Math.random() * GRID);
    const c = Math.floor(Math.random() * (GRID - len + 1));
    const cells = horiz
      ? Array.from({ length: len }, (_, k) => `${r},${c + k}`)
      : Array.from({ length: len }, (_, k) => `${r + k},${c}`);
    if (cells.some(cell => used.has(cell))) continue;
    cells.forEach(cell => used.add(cell));
    blocks.push({ id: `b${added}`, r, c, len, horiz, color: '#64748b' });
    added++;
  }
  return blocks;
}

export default function BlockEscape({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [blocks, setBlocks] = useState([]);
  const [moves, setMoves] = useState(0);
  const [flash, setFlash] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [solved, setSolved] = useState(false);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const movesRef = useRef(0);
  const levelRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const CELL = 46;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPuzzle = useCallback(() => {
    levelRef.current = Math.floor(scoreRef.current / 200);
    setSolved(false);
    movesRef.current = 0;
    setMoves(0);
    setBlocks(buildPuzzle(levelRef.current));
    setDragging(null);
  }, []);

  const checkWin = useCallback((bl) => {
    const red = bl.find(b => b.id === 'red');
    if (!red) return;
    if (red.c + red.len >= GRID) {
      const extra = Math.max(0, movesRef.current - (3 + levelRef.current));
      const pts = Math.max(0, 100 - extra * 20);
      scoreRef.current = Math.max(0, scoreRef.current + pts);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setSolved(true);
      setTimeout(newPuzzle, 800);
    }
  }, [endGame, onScoreUpdate, newPuzzle, TARGET_SCORE]);

  const startDrag = useCallback((id, e) => {
    if (!activeRef.current || solved) return;
    e.preventDefault();
    setDragging(id);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [solved]);

  const endDrag = useCallback((e) => {
    if (!dragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const block = blocks.find(b => b.id === dragging);
    if (!block) { setDragging(null); setDragStart(null); return; }

    if (block.horiz) {
      if (Math.abs(dx) < 10) { setDragging(null); setDragStart(null); return; }
      if (Math.abs(dy) > Math.abs(dx)) {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.08, vol: 0.07 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setDragging(null); setDragStart(null); return;
      }
      const steps = dx > 0 ? 1 : -1;
      const newC = Math.max(0, Math.min(GRID - block.len, block.c + steps));
      if (newC === block.c) { setDragging(null); setDragStart(null); return; }
      const occupied = new Set();
      blocks.forEach(b => { if (b.id !== dragging) { for (let k = 0; k < b.len; k++) occupied.add(b.horiz ? `${b.r},${b.c+k}` : `${b.r+k},${b.c}`); } });
      let finalC = block.c;
      for (let cc = block.c + steps; steps > 0 ? cc <= newC : cc >= newC; cc += steps) {
        const cells = Array.from({ length: block.len }, (_, k) => `${block.r},${cc + k}`);
        if (cells.some(cell => occupied.has(cell))) break;
        finalC = cc;
      }
      if (finalC === block.c) { setDragging(null); setDragStart(null); return; }
      movesRef.current++;
      setMoves(movesRef.current);
      beep({ freq: 300, dur: 0.05, vol: 0.06 });
      const newBlocks = blocks.map(b => b.id === dragging ? { ...b, c: finalC } : b);
      setBlocks(newBlocks);
      checkWin(newBlocks);
    } else {
      if (Math.abs(dy) < 10) { setDragging(null); setDragStart(null); return; }
      if (Math.abs(dx) > Math.abs(dy)) {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.08, vol: 0.07 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setDragging(null); setDragStart(null); return;
      }
      const steps = dy > 0 ? 1 : -1;
      const newR = Math.max(0, Math.min(GRID - block.len, block.r + steps));
      if (newR === block.r) { setDragging(null); setDragStart(null); return; }
      const occupied = new Set();
      blocks.forEach(b => { if (b.id !== dragging) { for (let k = 0; k < b.len; k++) occupied.add(b.horiz ? `${b.r},${b.c+k}` : `${b.r+k},${b.c}`); } });
      let finalR = block.r;
      for (let rr = block.r + steps; steps > 0 ? rr <= newR : rr >= newR; rr += steps) {
        const cells = Array.from({ length: block.len }, (_, k) => `${rr + k},${block.c}`);
        if (cells.some(cell => occupied.has(cell))) break;
        finalR = rr;
      }
      if (finalR === block.r) { setDragging(null); setDragStart(null); return; }
      movesRef.current++;
      setMoves(movesRef.current);
      beep({ freq: 300, dur: 0.05, vol: 0.06 });
      const newBlocks = blocks.map(b => b.id === dragging ? { ...b, r: finalR } : b);
      setBlocks(newBlocks);
    }
    setDragging(null); setDragStart(null);
  }, [dragging, dragStart, blocks, checkWin, onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newPuzzle();

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
        <Hud label="SCORE" v={score} c="#f97316" />
        <Hud label="MOVES" v={moves} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'ESCAPED!' : 'WRONG WAY!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div
          style={{ position: 'relative', width: GRID * CELL + (GRID - 1) * 3, height: GRID * CELL + (GRID - 1) * 3 }}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          {/* Grid lines */}
          {Array.from({ length: GRID * GRID }, (_, i) => {
            const r = Math.floor(i / GRID);
            const c = i % GRID;
            return (
              <div key={i} style={{
                position: 'absolute',
                left: c * (CELL + 3), top: r * (CELL + 3),
                width: CELL, height: CELL,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4,
              }} />
            );
          })}

          {/* Exit marker */}
          <div style={{
            position: 'absolute',
            right: -16, top: 2 * (CELL + 3) + CELL / 2 - 8,
            width: 14, height: 16,
            background: '#ef4444',
            borderRadius: '0 4px 4px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: '#fff', fontWeight: 900,
          }}>▶</div>

          {/* Blocks */}
          {blocks.map(b => (
            <motion.div
              key={b.id}
              onPointerDown={(e) => startDrag(b.id, e)}
              animate={{
                left: b.c * (CELL + 3),
                top: b.r * (CELL + 3),
                width: b.horiz ? b.len * CELL + (b.len - 1) * 3 : CELL,
                height: b.horiz ? CELL : b.len * CELL + (b.len - 1) * 3,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'absolute',
                background: `${b.color}cc`,
                border: `2px solid ${b.color}`,
                borderRadius: 8,
                cursor: dragging === b.id ? 'grabbing' : 'grab',
                boxShadow: b.id === 'red' ? `0 0 16px ${b.color}88` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'none',
              }}
            >
              {b.id === 'red' && <span style={{ fontSize: 18 }}>🚗</span>}
            </motion.div>
          ))}
        </div>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>SLIDE RED BLOCK TO EXIT →</p>
      </div>
    </div>
  );
}
