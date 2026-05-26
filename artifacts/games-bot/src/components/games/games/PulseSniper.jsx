import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'PULSE SNIPER — A dot weaves in a Lissajous curve at high speed. Tap WHERE IT WILL BE in 0.5 seconds — not where it is now. Closer = more points. Speed climbs with every hit. 60 seconds.';
const W = 320, H = 380, T = 60;

export default function PulseSniper({ phase, setPhase, game, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(T);
  const [combo, setCombo] = useState(0);
  const stateRef = useRef({ t: 0, speed: 0.04, score: 0, combo: 0, lastTap: null, flash: 0, ax: 110, ay: 130, fx: 1.3, fy: 1.7, px: 0, py: 0 });
  const target = game?.targetScore || 1500;

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current;
    s.t = 0; s.speed = 0.04; s.score = 0; s.combo = 0; s.lastTap = null; s.flash = 0;
    s.fx = 1.3 + Math.random() * 0.6; s.fy = 1.7 + Math.random() * 0.7;
    setScore(0); setCombo(0); setTime(T);
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase(s.score >= target ? 'won' : 'lost'), 250); return 0; }
      return t - 1;
    }), 1000);

    const trail = [];
    const dotPos = (tt) => ({
      x: W / 2 + Math.sin(tt * s.fx) * s.ax,
      y: H / 2 + Math.sin(tt * s.fy) * s.ay,
    });

    const loop = () => {
      if (!running) return;
      s.t += s.speed;
      const now = dotPos(s.t);
      const future = dotPos(s.t + 0.5);
      s.px = now.x; s.py = now.y;
      trail.push({ x: now.x, y: now.y });
      if (trail.length > 18) trail.shift();

      ctx.fillStyle = '#03020a'; ctx.fillRect(0, 0, W, H);
      // crosshair guide
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

      // trail
      trail.forEach((p, i) => {
        const a = (i / trail.length);
        ctx.fillStyle = `rgba(0,245,255,${a * 0.5})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + a * 4, 0, Math.PI * 2); ctx.fill();
      });

      // current dot
      ctx.fillStyle = '#00f5ff'; ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(now.x, now.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // ghost future (faint, for first 6s as tutorial)
      if (s.t < 6) {
        ctx.strokeStyle = 'rgba(255,204,0,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(future.x, future.y, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,204,0,0.6)'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText('FUTURE', future.x, future.y + 28);
      }

      // tap feedback ring
      if (s.lastTap && performance.now() - s.lastTap.at < 400) {
        const age = (performance.now() - s.lastTap.at) / 400;
        ctx.strokeStyle = `rgba(${s.lastTap.ok ? '0,245,160' : '255,51,85'},${1 - age})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.lastTap.x, s.lastTap.y, 12 + age * 28, 0, Math.PI * 2); ctx.stroke();
      }

      if (s.flash > 0) { ctx.fillStyle = `rgba(0,245,255,${s.flash})`; ctx.fillRect(0, 0, W, H); s.flash -= 0.06; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate, target]);

  const tap = (e) => {
    const cv = cvRef.current;
    const rect = cv.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    const x = (t.clientX - rect.left) / rect.width * W;
    const y = (t.clientY - rect.top) / rect.height * H;
    const s = stateRef.current;
    const future = {
      x: W / 2 + Math.sin((s.t + 0.5) * s.fx) * s.ax,
      y: H / 2 + Math.sin((s.t + 0.5) * s.fy) * s.ay,
    };
    const dist = Math.hypot(future.x - x, future.y - y);
    const ok = dist < 50;
    s.lastTap = { x, y, at: performance.now(), ok };
    if (ok) {
      s.combo += 1;
      const precision = 1 - dist / 50;
      const pts = 80 + Math.floor(precision * 120) + s.combo * 6;
      s.score += pts; s.flash = 0.4;
      setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
      s.speed = Math.min(0.09, s.speed + 0.002);
      chord([800 + s.combo * 30, 1200, 1700], 0.06, 0.14, 'triangle'); triggerHaptic('medium');
    } else {
      s.combo = 0; setCombo(0);
      s.score = Math.max(0, s.score - 80); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 140, dur: 0.15, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5ff" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="COMBO" v={`x${combo}`} c="#ffcc00" />
      </HudRow>
      <TargetBar score={score} target={target} label="SNIPE TARGET" />
      <TimeBar totalTime={T} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={tap}
        style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,255,0.2)', touchAction: 'none', background: '#03020a' }} />
      <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.25em', margin: 0 }}>TAP WHERE THE DOT WILL BE IN 0.5s</p>
    </div>
  );
}
