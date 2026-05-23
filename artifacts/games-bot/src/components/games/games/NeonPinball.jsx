import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';
import { isHighEnd, isMidEnd } from '../../../lib/deviceProfile';

const FANCY = isHighEnd() || isMidEnd();

const RULES = 'NEON PINBALL — Drag down on the ball to charge, release to launch. Hit glowing bumpers for points and combos. 60 seconds.';
const W = 320, H = 460, BALL = 12;

export default function NeonPinball({ phase, setPhase, onScoreUpdate }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(60);
  const [combo, setCombo] = useState(0);
  const stateRef = useRef({ ball: { x: W / 2, y: H - 40, vx: 0, vy: 0, idle: true }, bumpers: [], drag: null, combo: 0, lastHit: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current;
    s.score = 0; s.combo = 0; s.frame = 0;
    s.bumpers = Array.from({ length: 7 }, () => ({
      x: 40 + Math.random() * (W - 80), y: 60 + Math.random() * (H - 200),
      r: 16 + Math.random() * 10, hue: Math.random() * 360, pulse: 0,
    }));
    s.ball = { x: W / 2, y: H - 40, vx: 0, vy: 0, idle: true, trail: [] };
    // Static background stars
    s.stars = FANCY ? Array.from({ length: 35 }, (_, i) => ({
      x: (i * 137.5) % W, y: (i * 93.7) % H,
      r: 0.5 + (i % 3) * 0.4, phase: i * 0.7,
    })) : [];
    setScore(0); setCombo(0); setTime(60);

    const cv = canvasRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;

    const tick = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(tick); onScoreUpdate?.(s.score); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);

    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const loop = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(loop); return; }
      _skzLastT = now;
      if (!running) return;
      s.frame = (s.frame || 0) + 1;
      const b = s.ball;
      if (!b.idle) {
        if (FANCY) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.shift(); }
        b.x += b.vx; b.y += b.vy;
        b.vy += 0.18;
        b.vx *= 0.997; b.vy *= 0.997;
        if (b.x < BALL) { b.x = BALL; b.vx *= -0.85; beep({ freq: 220, dur: 0.05 }); }
        if (b.x > W - BALL) { b.x = W - BALL; b.vx *= -0.85; beep({ freq: 220, dur: 0.05 }); }
        if (b.y < BALL) { b.y = BALL; b.vy *= -0.85; }
        if (b.y > H - BALL) {
          b.y = H - 40; b.x = W / 2; b.vx = 0; b.vy = 0; b.idle = true;
          s.combo = 0; setCombo(0);
        }
        for (const bp of s.bumpers) {
          const dx = b.x - bp.x, dy = b.y - bp.y; const d = Math.hypot(dx, dy);
          if (d < bp.r + BALL) {
            const n = { x: dx / d, y: dy / d };
            const vd = b.vx * n.x + b.vy * n.y;
            b.vx -= 2 * vd * n.x; b.vy -= 2 * vd * n.y;
            b.vx *= 1.05; b.vy *= 1.05;
            b.x = bp.x + n.x * (bp.r + BALL); b.y = bp.y + n.y * (bp.r + BALL);
            bp.pulse = 1;
            s.combo += 1;
            const pts = Math.floor(10 * Math.sqrt(b.vx * b.vx + b.vy * b.vy)) + s.combo * 3;
            s.score += pts;
            setScore(s.score); setCombo(s.combo);
            onScoreUpdate?.(s.score);
            beep({ freq: 440 + s.combo * 40, dur: 0.08, type: 'triangle' });
            triggerHaptic('light');
          }
        }
      }

      // Background
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      const bgGrad = ctx.createRadialGradient(W / 2, H * 0.3, 20, W / 2, H / 2, 280);
      bgGrad.addColorStop(0, 'rgba(0,120,200,0.06)'); bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);
      // Twinkling stars
      if (FANCY) {
        s.stars.forEach(st => {
          st.phase += 0.04;
          const alpha = 0.15 + 0.3 * Math.sin(st.phase);
          ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
        });
      }
      // Bumpers
      for (const bp of s.bumpers) {
        bp.pulse *= 0.88;
        const r = bp.r + bp.pulse * 8;
        const pulsePct = 0.08 + 0.04 * Math.sin(s.frame * 0.07 + bp.hue);
        // Outer glow ring
        ctx.save();
        ctx.globalAlpha = 0.25 + bp.pulse * 0.3;
        ctx.shadowColor = `hsl(${bp.hue},100%,65%)`; ctx.shadowBlur = 30 + bp.pulse * 20;
        ctx.strokeStyle = `hsl(${bp.hue},100%,70%)`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bp.x, bp.y, r + 6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // Core
        ctx.shadowColor = `hsl(${bp.hue},100%,60%)`; ctx.shadowBlur = 22 + bp.pulse * 30;
        const bumpGrad = ctx.createRadialGradient(bp.x - r * 0.3, bp.y - r * 0.3, 0, bp.x, bp.y, r);
        bumpGrad.addColorStop(0, `hsl(${bp.hue},100%,85%)`);
        bumpGrad.addColorStop(0.5, `hsl(${bp.hue},100%,${55 + bp.pulse * 25}%)`);
        bumpGrad.addColorStop(1, `hsl(${bp.hue},100%,30%)`);
        ctx.fillStyle = bumpGrad;
        ctx.beginPath(); ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2); ctx.fill();
        // Score multiplier ring indicator
        if (bp.pulse > 0.1) {
          ctx.save();
          ctx.globalAlpha = bp.pulse * 0.8;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(bp.x, bp.y, r + bp.pulse * 14, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        ctx.shadowBlur = 0;
      }
      // Ball trail
      if (FANCY && b.trail) {
        b.trail.forEach((pt, i) => {
          const a = (i / b.trail.length) * 0.5;
          const tr = BALL * 0.4 * (i / b.trail.length);
          ctx.fillStyle = `rgba(0,245,255,${a.toFixed(2)})`;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, tr, 0, Math.PI * 2); ctx.fill();
        });
      }
      // Ball
      ctx.save();
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 30;
      const ballGrad = ctx.createRadialGradient(b.x - 3, b.y - 3, 0, b.x, b.y, BALL);
      ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.5, '#b0f8ff'); ballGrad.addColorStop(1, '#00c8e8');
      ctx.fillStyle = ballGrad;
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Aim line
      if (s.drag && b.idle) {
        const dx = b.x - s.drag.x, dy = b.y - s.drag.y;
        const power = Math.min(1, Math.hypot(dx, dy) / 80);
        ctx.save();
        ctx.strokeStyle = `rgba(255,204,0,${0.4 + power * 0.5})`; ctx.lineWidth = 2 + power * 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(s.drag.x, s.drag.y); ctx.stroke();
        ctx.setLineDash([]);
        // Power indicator dot at drag point
        ctx.fillStyle = `rgba(255,204,0,${power})`;
        ctx.beginPath(); ctx.arc(s.drag.x, s.drag.y, 4 + power * 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(tick); };
  }, [phase, setPhase, onScoreUpdate]);

  const local = (e) => {
    const cv = canvasRef.current; const r = cv.getBoundingClientRect();
    const t = e.touches?.[0] ?? e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  };

  const down = (e) => { e.preventDefault(); const s = stateRef.current; if (!s.ball.idle) return; s.drag = local(e); };
  const move = (e) => { e.preventDefault(); const s = stateRef.current; if (!s.drag || !s.ball.idle) return; s.drag = local(e); };
  const up = (e) => {
    e.preventDefault(); const s = stateRef.current; if (!s.drag || !s.ball.idle) return;
    const dx = s.ball.x - s.drag.x, dy = s.ball.y - s.drag.y;
    const m = Math.min(14, Math.hypot(dx, dy) / 8);
    const ang = Math.atan2(dy, dx);
    s.ball.vx = Math.cos(ang) * m; s.ball.vy = Math.sin(ang) * m; s.ball.idle = false;
    s.drag = null;
    beep({ freq: 700, dur: 0.1, type: 'sawtooth', sweepTo: 200 });
    triggerHaptic('medium');
  };

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Hud label="SCORE" v={score} c="#ff66cc" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="COMBO" v={`x${combo}`} c="#ffcc00" />
      </div>
      <motion.canvas
        ref={canvasRef} width={W} height={H}
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        style={{ width: '100%', borderRadius: 14, touchAction: 'none', background: '#04030a', border: '1px solid rgba(255,255,255,0.08)' }}
      />
    </div>
  );
}
function Hud({ label, v, c }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color: c, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${c}55` }}>{v}</p>
    </div>
  );
}
