import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'SHAPE SHIFT — A silhouette is shown. Tap the matching shape from 4 options as fast as possible. 60 seconds.';
const SHAPES = ['triangle', 'square', 'pentagon', 'hexagon', 'star', 'diamond'];

function poly(cx, cy, r, sides, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2; pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`); }
  return pts.join(' ');
}
function star(cx, cy, r) { const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.5 : r; pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`); } return pts.join(' '); }
function shapePath(s, cx, cy, r) {
  if (s === 'triangle') return poly(cx, cy, r, 3, -Math.PI / 2);
  if (s === 'square') return poly(cx, cy, r, 4, Math.PI / 4);
  if (s === 'pentagon') return poly(cx, cy, r, 5, -Math.PI / 2);
  if (s === 'hexagon') return poly(cx, cy, r, 6);
  if (s === 'star') return star(cx, cy, r);
  if (s === 'diamond') return poly(cx, cy, r, 4);
  return '';
}

function genRound() {
  const target = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const others = SHAPES.filter(s => s !== target).sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [target, ...others].sort(() => Math.random() - 0.5);
  return { target, opts };
}

export default function ShapeShift({ phase, setPhase, onScoreUpdate }) {
  const [round, setRound] = useState(genRound());
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [combo, setCombo] = useState(0);
  const scoreRef = useRef(0); const comboRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);

  const next = () => { setRound(genRound()); startRef.current = Date.now(); };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; setScore(0); setCombo(0); setTime(60); activeRef.current = true; next();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (s) => {
    if (!activeRef.current) return;
    if (s === round.target) {
      const dt = (Date.now() - startRef.current) / 1000;
      const speed = Math.max(0, Math.floor((1.5 - dt) * 20));
      comboRef.current += 1; const pts = 20 + speed + comboRef.current * 4;
      scoreRef.current += pts; setScore(scoreRef.current); setCombo(comboRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 600 + comboRef.current * 30, dur: 0.08, type: 'triangle' }); triggerHaptic('light');
      next();
    } else {
      comboRef.current = 0; setCombo(0);
      scoreRef.current = Math.max(0, scoreRef.current - 10); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5ff" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ff66cc" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <div style={{ background: 'radial-gradient(ellipse at center,#04141a,#02010a)', borderRadius: 14, border: '1px solid rgba(0,245,255,0.2)', padding: 18, textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0 }}>MATCH</p>
        <svg width="160" height="160" style={{ margin: '8px auto', display: 'block' }}>
          <polygon points={shapePath(round.target, 80, 80, 55)} fill="#fff" style={{ filter: 'drop-shadow(0 0 16px #fff)' }} />
        </svg>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {round.opts.map((s, i) => (
          <button key={i} onPointerDown={() => tap(s)} style={{ padding: 12, borderRadius: 14, border: '2px solid #00f5ff44', background: 'rgba(0,245,255,0.06)', cursor: 'pointer', boxShadow: '0 0 12px #00f5ff22' }}>
            <svg width="90" height="90"><polygon points={shapePath(s, 45, 45, 32)} fill="#00f5ff" style={{ filter: 'drop-shadow(0 0 8px #00f5ff)' }} /></svg>
          </button>
        ))}
      </div>
    </div>
  );
}
