import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'FROG LEAP — Tap to jump from pad to pad. Pads slide horizontally. Land on the next pad. 60 seconds — go as far as possible.';
const W = 320, H = 460;

export default function FrogLeap({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [combo, setCombo] = useState(0);
  const stateRef = useRef({ frog: { x: W / 2, y: H - 80, jump: null }, pads: [], score: 0, combo: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.score = 0; s.combo = 0;
    setScore(0); setCombo(0); setTime(60);
    s.pads = []; for (let i = 0; i < 6; i++) s.pads.push({ x: 60 + Math.random() * (W - 120), y: H - 80 - i * 70, vx: (Math.random() - 0.5) * 2.5, w: 70 });
    s.frog = { x: s.pads[0].x, y: s.pads[0].y - 20, jump: null, pad: 0 };
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
      s.pads.forEach(p => {
        p.x += p.vx;
        if (p.x < 30 || p.x > W - 30) p.vx *= -1;
      });
      if (s.frog.jump) {
        const j = s.frog.jump; j.t += 0.05;
        const u = j.t; s.frog.x = j.x0 + (j.x1 - j.x0) * u;
        s.frog.y = j.y0 + (j.y1 - j.y0) * u - Math.sin(u * Math.PI) * 60;
        if (u >= 1) {
          const next = s.pads[j.padTo];
          if (next && Math.abs(s.frog.x - next.x) < next.w / 2 + 10) {
            s.combo += 1; const pts = 25 + s.combo * 3; s.score += pts;
            setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
            beep({ freq: 500 + s.combo * 30, dur: 0.07, type: 'triangle' }); triggerHaptic('light');
            s.frog.pad = j.padTo;
            for (let i = 0; i < j.padTo + 1; i++) {
              s.pads.shift();
              s.pads.push({ x: 60 + Math.random() * (W - 120), y: -20 - Math.random() * 60, vx: (Math.random() - 0.5) * (2.5 + s.combo * 0.1), w: 70 });
            }
            s.pads.forEach((p, idx) => p.y = H - 80 - idx * 70);
            s.frog.pad = 0;
          } else {
            s.combo = 0; setCombo(0);
            beep({ freq: 120, dur: 0.3, type: 'sawtooth' }); triggerHaptic('error');
          }
          s.frog.jump = null;
        }
      } else {
        const p = s.pads[s.frog.pad]; if (p) { s.frog.x = p.x; s.frog.y = p.y - 20; }
      }
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(0,80,40,0.2)'); grad.addColorStop(1, 'rgba(20,140,80,0.05)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      for (const p of s.pads) {
        ctx.shadowColor = '#00f5a0'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#0a5a3a'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w / 2, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00f5a0'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, p.w / 2 - 6, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.shadowColor = '#9aff66'; ctx.shadowBlur = 16; ctx.fillStyle = '#9aff66';
      ctx.beginPath(); ctx.ellipse(s.frog.x, s.frog.y, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(s.frog.x - 5, s.frog.y - 4, 2, 0, Math.PI * 2); ctx.arc(s.frog.x + 5, s.frog.y - 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const jump = () => {
    const s = stateRef.current; if (s.frog.jump) return;
    const next = s.frog.pad + 1; const target = s.pads[next];
    if (!target) return;
    s.frog.jump = { t: 0, x0: s.frog.x, y0: s.frog.y, x1: target.x, y1: target.y - 20, padTo: next };
    beep({ freq: 300, dur: 0.08, type: 'triangle', sweepTo: 600 });
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#9aff66" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ffcc00" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={jump} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(154,255,102,0.18)', touchAction: 'none' }} />
    </div>
  );
}
