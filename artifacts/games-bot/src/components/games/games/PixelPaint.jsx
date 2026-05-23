import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'PIXEL PAINT — Match the target pattern by toggling cells. Faster matches = bigger score. 90 seconds.';
const N = 5, T = 90;

const genPattern = () => Array.from({ length: N * N }, () => Math.random() > 0.5 ? 1 : 0);

export default function PixelPaint({ phase, setPhase, onScoreUpdate }) {
  const [target, setTarget] = useState(genPattern());
  const [board, setBoard] = useState(Array(N * N).fill(0));
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [done, setDone] = useState(0);
  const scoreRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);

  const fresh = () => { setTarget(genPattern()); setBoard(Array(N * N).fill(0)); startRef.current = Date.now(); };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setDone(0); activeRef.current = true; fresh();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const toggle = (i) => {
    if (!activeRef.current) return;
    const b = [...board]; b[i] = b[i] ? 0 : 1; setBoard(b);
    beep({ freq: 400 + (b[i] ? 200 : 0), dur: 0.04, type: 'triangle' }); triggerHaptic('light');
    if (b.every((v, j) => v === target[j])) {
      const dt = (Date.now() - startRef.current) / 1000;
      const speed = Math.max(0, Math.floor((15 - dt) * 6));
      const pts = 80 + speed; scoreRef.current += pts; setScore(scoreRef.current); setDone(v => v + 1); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 1100, dur: 0.2, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
      setTimeout(fresh, 400);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ff66cc" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="DONE" v={done} c="#00f5ff" /></HudRow>
      <div style={{ background: 'radial-gradient(ellipse at center,#04141a,#02010a)', borderRadius: 14, border: '1px solid rgba(255,102,204,0.2)', padding: 12 }}>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0, textAlign: 'center', marginBottom: 8 }}>TARGET</p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, gap: 2, maxWidth: 140, margin: '0 auto 12px' }}>
          {target.map((v, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: 2, background: v ? '#ff66cc' : 'rgba(255,255,255,0.06)', boxShadow: v ? '0 0 6px #ff66cc' : 'none' }} />)}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0, textAlign: 'center', marginBottom: 6 }}>YOUR CANVAS</p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, gap: 4 }}>
          {board.map((v, i) => <button key={i} onPointerDown={() => toggle(i)} style={{ aspectRatio: '1', borderRadius: 6, border: '2px solid #ff66cc44', background: v ? '#ff66cc' : 'rgba(255,102,204,0.06)', boxShadow: v ? '0 0 12px #ff66cc' : 'none', transition: 'all 0.15s' }} />)}
        </div>
      </div>
    </div>
  );
}
