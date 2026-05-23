import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';
import { isHighEnd, isMidEnd } from '../../../lib/deviceProfile';

const RULES = 'COMET TRAIL — Drag the comet across the sky. Collect blue orbs, dodge red asteroids. 60 seconds.';
const W = 320, H = 460;

// Precompute 50 static star positions once at module load, reused every frame
const BASE_STAR_COUNT = 50;
const STATIC_STARS = Array.from({ length: BASE_STAR_COUNT }, (_, i) => ({
  x: (i * 137.508 + 42) % W,
  y: (i * 97.321 + 17) % H,
  r: 0.5 + (i % 3) * 0.5,
  phase: (i * 0.417) % (Math.PI * 2),
  speed: 0.02 + (i % 5) * 0.008,
}));

function drawSpaceBackground(ctx, t, starCount) {
  // Deep space gradient instead of flat fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#020510');
  grad.addColorStop(0.5, '#04030a');
  grad.addColorStop(1, '#060212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Twinkling stars with opacity oscillation
  for (let i = 0; i < starCount; i++) {
    const s = STATIC_STARS[i];
    const opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
    ctx.fillStyle = `rgba(220,235,255,${opacity.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCometTrail(ctx, trail) {
  // Multi-color gradient trail: red tip → orange → yellow near the comet head
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const a = i / trail.length; // 0 = oldest tail tip, 1 = nearest to head

    let r, g, b;
    if (a < 0.33) {
      // Deep red at the tail tip
      const blend = a / 0.33;
      r = 200;
      g = Math.round(30 + blend * 110);
      b = 20;
    } else if (a < 0.66) {
      // Orange in the middle
      const blend = (a - 0.33) / 0.33;
      r = 255;
      g = Math.round(140 + blend * 75);
      b = 20;
    } else {
      // Bright yellow toward the head
      const blend = (a - 0.66) / 0.34;
      r = 255;
      g = Math.round(215 + blend * 40);
      b = Math.round(20 + blend * 70);
    }

    const alpha = a * 0.78;
    const radius = 2 + 9 * a;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawComet(ctx, x, y) {
  // Wide outer glow ring (golden hue)
  ctx.shadowColor = '#ffcc00';
  ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(255,200,60,0.15)';
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fill();

  // Mid warm glow
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(255,240,160,0.5)';
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();

  // Bright white core
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawOrb(ctx, o) {
  // Outer diffuse glow ring
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(0,200,255,0.15)';
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.r + 9, 0, Math.PI * 2);
  ctx.fill();

  // Concentric mid ring
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(0,230,255,0.42)';
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
  ctx.fill();

  // Bright inner core
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#b8f8ff';
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.r * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Star/cross sparkle overlay
  const arm = o.r + 6;
  const diag = arm * 0.58;
  ctx.strokeStyle = 'rgba(180,248,255,0.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(o.x - arm, o.y);
  ctx.lineTo(o.x + arm, o.y);
  ctx.moveTo(o.x, o.y - arm);
  ctx.lineTo(o.x, o.y + arm);
  ctx.moveTo(o.x - diag, o.y - diag);
  ctx.lineTo(o.x + diag, o.y + diag);
  ctx.moveTo(o.x + diag, o.y - diag);
  ctx.lineTo(o.x - diag, o.y + diag);
  ctx.stroke();
}

function drawRock(ctx, o) {
  const sides = 7;
  // Irregular radius multipliers give a jagged asteroid silhouette
  const jagged = [1.0, 0.72, 0.92, 0.65, 0.88, 0.74, 0.96];

  // Red halo ring (stroked, slightly larger than body)
  ctx.shadowColor = '#ff3355';
  ctx.shadowBlur = 24;
  ctx.strokeStyle = 'rgba(255,60,80,0.32)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const rr = (o.r + 9) * jagged[i % jagged.length];
    const px = o.x + Math.cos(angle) * rr;
    const py = o.y + Math.sin(angle) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Main jagged polygon body
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#c41e38';
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const rr = o.r * jagged[i % jagged.length];
    const px = o.x + Math.cos(angle) * rr;
    const py = o.y + Math.sin(angle) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Lighter facet highlight on upper-left portion
  ctx.shadowBlur = 3;
  ctx.fillStyle = 'rgba(255,110,120,0.5)';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const rr = o.r * jagged[i % jagged.length] * 0.55;
    const px = o.x + Math.cos(angle) * rr;
    const py = o.y + Math.sin(angle) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

export default function CometTrail({ phase, setPhase, onScoreUpdate, game }) {
  const TARGET_SCORE = game?.targetScore || 200;
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [combo, setCombo] = useState(0);
  const stateRef = useRef({ comet: { x: W / 2, y: H - 60, trail: [] }, orbs: [], rocks: [], spawn: 0, score: 0, combo: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.comet = { x: W / 2, y: H - 60, trail: [] }; s.orbs = []; s.rocks = []; s.spawn = 0; s.score = 0; s.combo = 0;
    setScore(0); setCombo(0); setTime(60);
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase(s.score >= TARGET_SCORE ? 'won' : 'lost'), 300); return 0; }
      return t - 1;
    }), 1000);
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;

    // Determine star count once: only on high/mid devices, scaled by tier
    const showStars = isHighEnd() || isMidEnd();
    const starCount = showStars ? scaleParticles(BASE_STAR_COUNT) : 0;

    const loop = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(loop); return; }
      _skzLastT = now;
      if (!running) return;

      // --- Gameplay logic (unchanged) ---
      s.spawn -= 1;
      if (s.spawn <= 0) {
        const isRock = Math.random() < 0.55;
        const speed = isRock ? 1.8 + Math.random() * 2.8 : 1.4 + Math.random() * 1.8;
        const obj = { x: 20 + Math.random() * (W - 40), y: -20, vy: speed, r: isRock ? 18 : 12 };
        if (isRock) s.rocks.push(obj); else s.orbs.push(obj);
        s.spawn = 22 + Math.random() * 20;
      }
      [...s.orbs, ...s.rocks].forEach(o => o.y += o.vy);
      s.comet.trail.push({ x: s.comet.x, y: s.comet.y });
      if (s.comet.trail.length > 14) s.comet.trail.shift();
      s.orbs = s.orbs.filter(o => {
        if (Math.hypot(o.x - s.comet.x, o.y - s.comet.y) < o.r + 14) {
          s.combo += 1; const pts = 20 + s.combo * 3; s.score += pts;
          setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
          beep({ freq: 600 + s.combo * 30, dur: 0.07, type: 'triangle' }); triggerHaptic('light'); return false;
        }
        return o.y < H + 30;
      });
      s.rocks = s.rocks.filter(o => {
        if (Math.hypot(o.x - s.comet.x, o.y - s.comet.y) < o.r + 14) {
          s.combo = 0; setCombo(0); s.score = Math.max(0, s.score - 20); setScore(s.score); onScoreUpdate?.(s.score);
          beep({ freq: 140, dur: 0.2, type: 'sawtooth', sweepTo: 60 }); triggerHaptic('error'); return false;
        }
        return o.y < H + 30;
      });

      // --- Drawing ---
      const t = now * 0.001; // seconds, for star twinkle oscillation
      drawSpaceBackground(ctx, t, starCount);
      drawCometTrail(ctx, s.comet.trail);
      drawComet(ctx, s.comet.x, s.comet.y);
      for (const o of s.orbs) drawOrb(ctx, o);
      for (const o of s.rocks) drawRock(ctx, o);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const local = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; };
  const move = (e) => { e.preventDefault(); const p = local(e); stateRef.current.comet.x = p.x; stateRef.current.comet.y = p.y; };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#00f5ff" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={move} onPointerMove={move} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(255,204,0,0.18)', touchAction: 'none', background: '#020510' }} />
    </div>
  );
}
