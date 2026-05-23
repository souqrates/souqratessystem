import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'AIR PUCK — Slide your paddle to block incoming pucks. Each block scores; let one pass = penalty. 60 seconds.';
const W = 320, H = 460;

export default function AirPuck({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [misses, setMisses] = useState(0);
  const stateRef = useRef({ paddle: { x: W / 2, w: 80 }, pucks: [], spawn: 0, score: 0, miss: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.pucks = []; s.spawn = 0; s.score = 0; s.miss = 0; s.paddle = { x: W / 2, w: 80 };
    setScore(0); setTime(60); setMisses(0);
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
      if (s.spawn <= 0) {
        s.pucks.push({ x: 20 + Math.random() * (W - 40), y: -16, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 2.5 });
        s.spawn = 30 - Math.min(15, s.score / 20);
      }
      s.pucks = s.pucks.filter(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 14 || p.x > W - 14) p.vx *= -1;
        if (p.y > H - 30 && p.y < H - 10 && Math.abs(p.x - s.paddle.x) < s.paddle.w / 2 + 14) {
          p.vy *= -1; p.vx = (p.x - s.paddle.x) * 0.08; p.y = H - 30;
          s.score += 15 + Math.floor(Math.abs(p.vy) * 2); setScore(s.score); onScoreUpdate?.(s.score);
          beep({ freq: 600, dur: 0.07, type: 'triangle' }); triggerHaptic('light');
          return true;
        }
        if (p.y > H + 20) { s.miss += 1; setMisses(s.miss); s.score = Math.max(0, s.score - 8); setScore(s.score); onScoreUpdate?.(s.score); beep({ freq: 120, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error'); return false; }
        return true;
      });
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke(); }
      for (const p of s.pucks) { ctx.shadowColor = '#ff66cc'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff66cc'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 18; ctx.fillStyle = '#00f5ff';
      ctx.fillRect(s.paddle.x - s.paddle.w / 2, H - 22, s.paddle.w, 10);
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const move = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; stateRef.current.paddle.x = Math.max(40, Math.min(W - 40, (t.clientX - r.left) * (W / r.width))); };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5ff" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="MISSED" v={misses} c="#ff3355" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={move} onPointerMove={move} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,255,0.18)', touchAction: 'none' }} />
    </div>
  );
}
