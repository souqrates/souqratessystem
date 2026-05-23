import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'DISC SLAM — Drag-flick the disc through the gate. Higher gates give more points. 60 seconds.';
const W = 320, H = 460;

export default function DiscSlam({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [scored, setScored] = useState(0);
  const stateRef = useRef({ disc: { x: W / 2, y: H - 60, vx: 0, vy: 0, idle: true }, gate: { x: W / 2, y: 100, w: 80, vx: 1.5 }, drag: null, score: 0, scored: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.score = 0; s.scored = 0;
    s.disc = { x: W / 2, y: H - 60, vx: 0, vy: 0, idle: true }; s.gate = { x: W / 2, y: 100, w: 80, vx: 1.5 }; s.drag = null;
    setScore(0); setTime(60); setScored(0);
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
      s.gate.x += s.gate.vx;
      if (s.gate.x < s.gate.w / 2 + 10 || s.gate.x > W - s.gate.w / 2 - 10) s.gate.vx *= -1;
      if (!s.disc.idle) {
        s.disc.x += s.disc.vx; s.disc.y += s.disc.vy; s.disc.vy += 0.08;
        if (s.disc.y < s.gate.y + 6 && s.disc.y > s.gate.y - 6 && Math.abs(s.disc.x - s.gate.x) < s.gate.w / 2) {
          const acc = 1 - Math.abs(s.disc.x - s.gate.x) / (s.gate.w / 2);
          const pts = 40 + Math.floor(acc * 60);
          s.score += pts; s.scored += 1; setScore(s.score); setScored(s.scored); onScoreUpdate?.(s.score);
          beep({ freq: 1000, dur: 0.16, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
          s.disc = { x: W / 2, y: H - 60, vx: 0, vy: 0, idle: true };
          s.gate.w = Math.max(50, s.gate.w - 4); s.gate.vx = Math.sign(s.gate.vx) * (Math.abs(s.gate.vx) + 0.2);
        }
        if (s.disc.y < -20 || s.disc.y > H + 20 || s.disc.x < -20 || s.disc.x > W + 20) {
          s.disc = { x: W / 2, y: H - 60, vx: 0, vy: 0, idle: true };
          beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
        }
      }
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#ff66cc'; ctx.lineWidth = 4; ctx.shadowColor = '#ff66cc'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(s.gate.x - s.gate.w / 2, s.gate.y); ctx.lineTo(s.gate.x + s.gate.w / 2, s.gate.y); ctx.stroke();
      ctx.fillStyle = '#ff66cc';
      ctx.beginPath(); ctx.arc(s.gate.x - s.gate.w / 2, s.gate.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.gate.x + s.gate.w / 2, s.gate.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#00f5ff'; ctx.beginPath(); ctx.ellipse(s.disc.x, s.disc.y, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (s.drag && s.disc.idle) { ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.disc.x, s.disc.y); ctx.lineTo(s.drag.x, s.drag.y); ctx.stroke(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const local = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; };
  const down = (e) => { e.preventDefault(); if (!stateRef.current.disc.idle) return; stateRef.current.drag = local(e); };
  const move = (e) => { e.preventDefault(); if (stateRef.current.drag && stateRef.current.disc.idle) stateRef.current.drag = local(e); };
  const up = (e) => {
    e.preventDefault(); const s = stateRef.current; if (!s.drag || !s.disc.idle) return;
    const dx = s.disc.x - s.drag.x, dy = s.disc.y - s.drag.y;
    const m = Math.min(14, Math.hypot(dx, dy) / 14);
    const ang = Math.atan2(dy, dx);
    s.disc.vx = Math.cos(ang) * m; s.disc.vy = Math.sin(ang) * m; s.disc.idle = false;
    s.drag = null; beep({ freq: 500, dur: 0.06 }); triggerHaptic('light');
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ff66cc" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="GOALS" v={scored} c="#00f5ff" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(255,102,204,0.2)', touchAction: 'none' }} />
    </div>
  );
}
