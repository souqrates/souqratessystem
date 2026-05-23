import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'STACK CRUSH — Drop colored blocks. Same-color chains of 3+ explode for combo points. 90 seconds.';
const COLS = 6, ROWS = 10, T = 90;
const COLORS = ['#ff3355', '#00f5ff', '#ffcc00', '#00f5a0', '#ff66cc'];

function makeGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(-1)); }

function findChains(g) {
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (g[r][c] < 0 || seen[r][c]) continue;
    const v = g[r][c]; const stack = [[r, c]]; const group = [];
    while (stack.length) {
      const [rr, cc] = stack.pop(); if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || seen[rr][cc] || g[rr][cc] !== v) continue;
      seen[rr][cc] = true; group.push([rr, cc]);
      stack.push([rr + 1, cc], [rr - 1, cc], [rr, cc + 1], [rr, cc - 1]);
    }
    if (group.length >= 3) out.push(group);
  }
  return out;
}

function gravity(g) {
  for (let c = 0; c < COLS; c++) {
    const col = []; for (let r = 0; r < ROWS; r++) if (g[r][c] >= 0) col.push(g[r][c]);
    for (let r = 0; r < ROWS; r++) g[r][c] = r < ROWS - col.length ? -1 : col[r - (ROWS - col.length)];
  }
}

export default function StackCrush({ phase, setPhase, onScoreUpdate }) {
  const [grid, setGrid] = useState(makeGrid());
  const [next, setNext] = useState(Math.floor(Math.random() * COLORS.length));
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [chains, setChains] = useState(0);
  const scoreRef = useRef(0); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setChains(0); setGrid(makeGrid()); setNext(Math.floor(Math.random() * COLORS.length)); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const drop = (col) => {
    if (!activeRef.current) return;
    const g = grid.map(r => [...r]);
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) if (g[r][col] < 0) { row = r; break; }
    if (row < 0) { scoreRef.current = Math.max(0, scoreRef.current - 10); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current); beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error'); return; }
    g[row][col] = next;
    beep({ freq: 400 + next * 40, dur: 0.06, type: 'triangle' }); triggerHaptic('light');
    let chainCount = 0, mult = 1;
    while (true) {
      const ch = findChains(g); if (!ch.length) break;
      chainCount++; let crushed = 0;
      for (const grp of ch) { crushed += grp.length; for (const [r, c] of grp) g[r][c] = -1; }
      const pts = crushed * 20 * mult; scoreRef.current += pts; mult++;
      beep({ freq: 700 + chainCount * 80, dur: 0.18, type: 'triangle', sweepTo: 1100 }); triggerHaptic('medium');
      gravity(g);
    }
    if (chainCount > 0) { setChains(v => v + chainCount); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current); }
    setGrid(g); setNext(Math.floor(Math.random() * COLORS.length));
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ff6600" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="CHAINS" v={chains} c="#ffcc00" /></HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em' }}>NEXT</span>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: COLORS[next], boxShadow: `0 0 12px ${COLORS[next]}` }} />
      </div>
      <div style={{ background: 'radial-gradient(ellipse at center,#04141a,#02010a)', borderRadius: 14, border: '1px solid rgba(255,102,0,0.2)', padding: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gap: 3 }}>
          {Array.from({ length: COLS }).map((_, c) => (
            <button key={`btn${c}`} onPointerDown={() => drop(c)} style={{ padding: '4px 0', borderRadius: 6, border: '1px solid #ff660044', background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 900, fontSize: 14 }}>v</button>
          ))}
          {grid.map((row, r) => row.map((cell, c) => (
            <div key={`${r}-${c}`} style={{ aspectRatio: '1', borderRadius: 4, background: cell >= 0 ? COLORS[cell] : 'rgba(255,255,255,0.03)', boxShadow: cell >= 0 ? `0 0 8px ${COLORS[cell]}55` : 'none' }} />
          )))}
        </div>
      </div>
    </div>
  );
}
