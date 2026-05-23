import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import ResultOverlay from './ResultOverlay';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'A neon grid flashes — one cell is different from the rest. Tap the odd one out before time expires. 5 rounds, faster each time!';

const SHAPES = [
  { id: 0, label: 'circle',   draw: (ctx, x, y, s, col) => { ctx.beginPath(); ctx.arc(x, y, s * 0.38, 0, Math.PI * 2); ctx.fill(); } },
  { id: 1, label: 'square',   draw: (ctx, x, y, s, col) => { ctx.fillRect(x - s * 0.32, y - s * 0.32, s * 0.64, s * 0.64); } },
  { id: 2, label: 'triangle', draw: (ctx, x, y, s, col) => { ctx.beginPath(); ctx.moveTo(x, y - s * 0.38); ctx.lineTo(x + s * 0.38, y + s * 0.34); ctx.lineTo(x - s * 0.38, y + s * 0.34); ctx.closePath(); ctx.fill(); } },
  { id: 3, label: 'diamond',  draw: (ctx, x, y, s, col) => { ctx.beginPath(); ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x + s * 0.32, y); ctx.lineTo(x, y + s * 0.4); ctx.lineTo(x - s * 0.32, y); ctx.closePath(); ctx.fill(); } },
  { id: 4, label: 'cross',    draw: (ctx, x, y, s, col) => { const t = s * 0.13; ctx.fillRect(x - t, y - s * 0.38, t * 2, s * 0.76); ctx.fillRect(x - s * 0.38, y - t, s * 0.76, t * 2); } },
];

const COLORS = {
  base: ['#0ea5e9', '#06b6d4', '#10b981', '#0284c7'],
  odd:  ['#ffd700', '#f59e0b', '#ef4444', '#f97316'],
};

const GRID = 9;
const COLS = 3;
const W = 390;
const CELL_PAD = 12;
const CELL_S   = Math.floor((W - CELL_PAD * (COLS + 1)) / COLS);
const GRID_H   = CELL_S * COLS + CELL_PAD * (COLS + 1);

function makeGrid(round) {
  const baseShape = Math.floor(Math.random() * SHAPES.length);
  let oddShape = baseShape;
  while (oddShape === baseShape) oddShape = Math.floor(Math.random() * SHAPES.length);
  const baseColor = COLORS.base[Math.floor(Math.random() * COLORS.base.length)];
  const oddColor  = COLORS.odd[Math.floor(Math.random() * COLORS.odd.length)];
  const cells = Array(GRID).fill(null).map(() => ({ shape: baseShape, color: baseColor }));
  const oddIdx = Math.floor(Math.random() * GRID);
  cells[oddIdx] = { shape: oddShape, color: oddColor };
  return { cells, oddIdx };
}

export default function GridMaster({ phase, setPhase }) {
  const canvasRef = useRef();
  const [grid,     setGrid]     = useState(null);
  const [round,    setRound]    = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [earnings, setEarnings] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [flash,    setFlash]    = useState(null); // {idx, correct}
  const timerRef  = useRef();
  const gridRef   = useRef(null);

  const drawGrid = useCallback((g, highlightIdx = null, highlightOk = null) => {
    const canvas = canvasRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, GRID_H);

    // Background
    ctx.fillStyle = '#04030f';
    ctx.fillRect(0, 0, W, GRID_H);

    g.cells.forEach((cell, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = CELL_PAD + col * (CELL_S + CELL_PAD) + CELL_S / 2;
      const cy  = CELL_PAD + row * (CELL_S + CELL_PAD) + CELL_S / 2;
      const x   = CELL_PAD + col * (CELL_S + CELL_PAD);
      const y   = CELL_PAD + row * (CELL_S + CELL_PAD);

      const isHL  = highlightIdx === i;
      const color = isHL ? (highlightOk ? '#10b981' : '#ef4444') : cell.color;

      // Cell bg
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = isHL ? 28 : 8;
      ctx.fillStyle   = isHL
        ? (highlightOk ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)')
        : 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.roundRect(x, y, CELL_S, CELL_S, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = isHL ? color : `${cell.color}55`;
      ctx.lineWidth   = isHL ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL_S, CELL_S, 10);
      ctx.stroke();

      // Shape
      ctx.fillStyle = color;
      SHAPES[cell.shape].draw(ctx, cx, cy, CELL_S, color);
      ctx.restore();
    });
  }, []);

  const nextRound = useCallback((r) => {
    const g = makeGrid(r);
    gridRef.current = g;
    setGrid(g);
    const t = Math.max(2, 5 - r);
    setTimeLeft(t);
    setTimeout(() => drawGrid(g), 0);
    return t;
  }, [drawGrid]);

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); return; }
    setRound(0); setEarnings(0); setXpEarned(0); setFlash(null);
    nextRound(0);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing' || !grid) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          triggerHaptic('error');
          setPhase('lost');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [grid, phase]);

  const tap = useCallback((e) => {
    if (phase !== 'playing') return;
    const g = gridRef.current;
    if (!g) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = GRID_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;

    for (let i = 0; i < GRID; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = CELL_PAD + col * (CELL_S + CELL_PAD);
      const y   = CELL_PAD + row * (CELL_S + CELL_PAD);
      if (px >= x && px <= x + CELL_S && py >= y && py <= y + CELL_S) {
        clearInterval(timerRef.current);
        const correct = i === g.oddIdx;
        drawGrid(g, i, correct);
        setFlash({ idx: i, correct });

        if (correct) {
          triggerHaptic('success');
          const e2 = earnings + 8;
          setEarnings(e2);
          const r = round + 1;
          setRound(r);
          if (r >= 5) {
            const xp = 80 + Math.floor(e2 * 2);
            setXpEarned(xp);
            setTimeout(() => setPhase('won'), 500);
          } else {
            setTimeout(() => { setFlash(null); nextRound(r); }, 480);
          }
        } else {
          triggerHaptic('error');
          setTimeout(() => setPhase('lost'), 500);
        }
        return;
      }
    }
  }, [phase, round, earnings, drawGrid, nextRound]);

  useEffect(() => {
    if (grid) drawGrid(grid, flash?.idx, flash?.correct);
  }, [grid, flash, drawGrid]);

  if (phase === 'rules') return (
    <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>
  );

  const timePct  = timeLeft / 5;
  const timeColor = timePct > 0.5 ? '#10b981' : timePct > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(phase === 'won' || phase === 'lost') && (
        <ResultOverlay won={phase === 'won'} earnings={earnings} xpEarned={xpEarned} setPhase={setPhase} />
      )}

      {/* HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase', margin: 0 }}>Round</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', margin: 0, lineHeight: 1 }}>{round + 1}/5</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 900, color: timeColor, fontFamily: 'Orbitron, sans-serif', margin: 0 }}>{timeLeft}s</p>
        </div>
        <div style={{ background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: 'rgba(255,215,0,0.6)', textTransform: 'uppercase', margin: 0 }}>Earned</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#ffd700', fontFamily: 'Orbitron, sans-serif', margin: 0, lineHeight: 1 }}>${earnings}</p>
        </div>
      </div>

      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div style={{ height: '100%', background: timeColor, borderRadius: 99 }}
          animate={{ width: `${timePct * 100}%` }} transition={{ duration: 0.7 }} />
      </div>

      {/* Grid canvas */}
      <div style={{ borderRadius: 14, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={W} height={GRID_H}
          style={{ width: '100%', display: 'block', cursor: 'pointer', touchAction: 'none' }}
          onClick={tap}
          onTouchStart={e => { e.preventDefault(); tap(e.touches[0]); }}
        />
      </div>
    </div>
  );
}
