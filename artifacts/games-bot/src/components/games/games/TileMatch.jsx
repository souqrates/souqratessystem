import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'TILE MATCH — Tap two adjacent tiles to swap. Match 3 or more in a row/column to score. 60 seconds.';
const N = 7;
const COLORS = ['#ff3355', '#ffcc00', '#00f5a0', '#00f5ff', '#ff66cc'];

function rnd() { return Math.floor(Math.random() * COLORS.length); }
function newGrid() { return Array.from({ length: N }, () => Array.from({ length: N }, rnd)); }

export default function TileMatch({ phase, setPhase, onScoreUpdate }) {
  const [grid, setGrid] = useState(newGrid);
  const [sel, setSel] = useState(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [combo, setCombo] = useState(0);
  const scoreRef = useRef(0); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setCombo(0); setTime(60); setGrid(newGrid()); setSel(null); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const findMatches = (g) => {
    const m = Array.from({ length: N }, () => Array(N).fill(false));
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 2; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) m[r][c] = m[r][c + 1] = m[r][c + 2] = true;
    for (let c = 0; c < N; c++) for (let r = 0; r < N - 2; r++) if (g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) m[r][c] = m[r + 1][c] = m[r + 2][c] = true;
    return m;
  };

  const resolve = (g, chain = 0) => {
    const m = findMatches(g);
    let cnt = 0; m.forEach(row => row.forEach(x => x && cnt++));
    if (cnt === 0) { if (chain > 0) setCombo(chain); return; }
    const pts = cnt * 10 + chain * 20;
    scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
    beep({ freq: 500 + chain * 100, dur: 0.1, type: 'triangle' }); triggerHaptic('light');
    for (let c = 0; c < N; c++) {
      const col = []; for (let r = 0; r < N; r++) if (!m[r][c]) col.push(g[r][c]);
      while (col.length < N) col.unshift(rnd());
      for (let r = 0; r < N; r++) g[r][c] = col[r];
    }
    setGrid([...g.map(r => [...r])]);
    setTimeout(() => resolve(g, chain + 1), 320);
  };

  const tap = (r, c) => {
    if (!activeRef.current) return;
    if (!sel) { setSel({ r, c }); return; }
    if (Math.abs(sel.r - r) + Math.abs(sel.c - c) !== 1) { setSel({ r, c }); return; }
    const g = grid.map(row => [...row]);
    [g[sel.r][sel.c], g[r][c]] = [g[r][c], g[sel.r][sel.c]];
    setSel(null); setGrid(g);
    beep({ freq: 400, dur: 0.05 });
    const m = findMatches(g); let any = false; m.forEach(row => row.forEach(x => { if (x) any = true; }));
    if (any) setTimeout(() => resolve(g, 1), 200);
    else { setTimeout(() => { const g2 = grid.map(row => [...row]); setGrid(g2); }, 250); beep({ freq: 140, dur: 0.15, type: 'sawtooth' }); }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ff66cc" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, gap: 3, padding: 8, background: 'radial-gradient(ellipse at top,#06121f,#02010a)', borderRadius: 14, border: '1px solid rgba(0,245,255,0.18)' }}>
        {grid.flatMap((row, r) => row.map((v, c) => {
          const isSel = sel && sel.r === r && sel.c === c;
          return (
            <div key={`${r}-${c}`} onPointerDown={() => tap(r, c)} style={{ aspectRatio: '1', borderRadius: 6, background: `linear-gradient(135deg,${COLORS[v]},${COLORS[v]}88)`, boxShadow: isSel ? `0 0 14px ${COLORS[v]}, inset 0 0 12px #fff` : `0 0 6px ${COLORS[v]}55`, cursor: 'pointer', border: isSel ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)', transition: 'box-shadow 0.1s' }} />
          );
        }))}
      </div>
    </div>
  );
}
