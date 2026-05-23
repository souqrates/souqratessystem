import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval } from '../../../lib/canvasQuality';

const RULES = 'SUSHI BELT — A target sushi is shown. Tap only the matching one on the belt. Wrong tap = penalty. 60 seconds.';
const W = 320, H = 380;
const SUSHI = ['🍣', '🍤', '🍙', '🥢', '🐙', '🦐'];

export default function SushiBelt({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [combo, setCombo] = useState(0); const [target, setTarget] = useState(SUSHI[0]);
  const stateRef = useRef({ items: [], spawn: 0, score: 0, combo: 0, target: SUSHI[0], speed: 1.5 });

  const newTarget = () => { const t = SUSHI[Math.floor(Math.random() * SUSHI.length)]; stateRef.current.target = t; setTarget(t); };

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.items = []; s.spawn = 0; s.score = 0; s.combo = 0; s.speed = 1.5; newTarget();
    setScore(0); setCombo(0); setTime(60);
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const loop = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(loop); return; }
      _skzLastT = now;
      if (!running) return;
      s.spawn -= 1;
      if (s.spawn <= 0) { s.items.push({ x: -30, y: 100 + Math.random() * 200, e: SUSHI[Math.floor(Math.random() * SUSHI.length)] }); s.spawn = 32; }
      s.items.forEach(it => it.x += s.speed);
      s.items = s.items.filter(it => it.x < W + 40);
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      for (let i = 60; i < H - 30; i += 80) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, i, W, 50);
        ctx.strokeStyle = 'rgba(255,204,0,0.2)'; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(0, i + 25); ctx.lineTo(W, i + 25); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const it of s.items) { ctx.fillText(it.e, it.x, it.y); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (e) => {
    const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e;
    const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height);
    const s = stateRef.current;
    let best = -1, bd = 28;
    s.items.forEach((it, i) => { const d = Math.hypot(it.x - x, it.y - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    const it = s.items[best];
    if (it.e === s.target) {
      s.combo += 1; const pts = 25 + s.combo * 4; s.score += pts;
      setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
      beep({ freq: 700 + s.combo * 25, dur: 0.08, type: 'triangle' }); triggerHaptic('light');
      s.items.splice(best, 1);
      if (s.score % 100 < 25) { newTarget(); s.speed = Math.min(4, s.speed + 0.2); }
    } else {
      s.combo = 0; setCombo(0); s.score = Math.max(0, s.score - 10); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ff66cc" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <div style={{ textAlign: 'center', padding: 12, background: 'rgba(255,204,0,0.08)', borderRadius: 12, border: '1px solid rgba(255,204,0,0.25)' }}>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0 }}>GRAB ONLY</p>
        <div style={{ fontSize: 48, lineHeight: 1, margin: '4px 0' }}>{target}</div>
      </div>
      <canvas ref={cvRef} width={W} height={H} onPointerDown={tap} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(255,204,0,0.18)', touchAction: 'none' }} />
    </div>
  );
}
