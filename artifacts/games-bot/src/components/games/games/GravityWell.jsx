import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';
import { isHighEnd, isMidEnd } from '../../../lib/deviceProfile';

const RULES = 'GRAVITY WELL — Drag from the launcher to aim. A black hole bends your trajectory. Land probes inside the gold ring. 60 seconds.';
const W = 320, H = 460;

const HIGH_END = isHighEnd();
const MID_END = isMidEnd();
const FANCY_STARS = HIGH_END || MID_END;

export default function GravityWell({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [shots, setShots] = useState(0);
  const stateRef = useRef({ launcher: { x: 40, y: H - 40 }, well: { x: 0, y: 0 }, target: { x: 0, y: 0, r: 28 }, probe: null, drag: null, score: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.score = 0; setScore(0); setTime(60); setShots(0);
    s.well = { x: 130 + Math.random() * 60, y: 160 + Math.random() * 80 };
    s.target = { x: W - 60, y: 80 + Math.random() * 60, r: 28 };
    s.probe = null; s.drag = null;
    s.frame = 0;

    // Initialize background stars once
    s.stars = Array.from({ length: 40 }, (_, i) => ({
      x: (i * 73 + 17) % W,
      y: (i * 137 + 31) % H,
      r: 0.7 + ((i * 53) % 10) / 10,
      phase: (i * 0.71) % (Math.PI * 2),
    }));

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

      s.frame++;

      if (s.probe) {
        const dx = s.well.x - s.probe.x, dy = s.well.y - s.probe.y;
        const d = Math.max(20, Math.hypot(dx, dy));
        const f = 280 / (d * d); s.probe.vx += (dx / d) * f; s.probe.vy += (dy / d) * f;
        s.probe.x += s.probe.vx; s.probe.y += s.probe.vy;
        s.probe.t += 1;

        // Update trail
        if (!s.probe.trail) s.probe.trail = [];
        s.probe.trail.push({ x: s.probe.x, y: s.probe.y });
        if (s.probe.trail.length > 8) s.probe.trail.shift();

        if (d < 12) { s.probe = null; beep({ freq: 100, dur: 0.3, type: 'sawtooth', sweepTo: 30 }); triggerHaptic('error'); }
        else if (Math.hypot(s.probe.x - s.target.x, s.probe.y - s.target.y) < s.target.r) {
          const pts = Math.max(20, 120 - s.probe.t); s.score += pts;
          setScore(s.score); onScoreUpdate?.(s.score);
          beep({ freq: 900, dur: 0.2, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
          s.probe = null;
          s.well = { x: 100 + Math.random() * 120, y: 140 + Math.random() * 140 };
          s.target = { x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * 100, r: 28 };
        } else if (s.probe.x < -20 || s.probe.x > W + 20 || s.probe.y < -20 || s.probe.y > H + 20) {
          s.probe = null;
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────

      // Background
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);

      // Stars
      if (FANCY_STARS) {
        for (const star of s.stars) {
          star.phase += 0.04;
          const alpha = 0.15 + 0.25 * Math.sin(star.phase);
          ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect((i * 73) % W, (i * 137) % H, 1, 1);
        }
      }

      // ── Gravity well ──────────────────────────────────────────────────────
      ctx.save(); ctx.translate(s.well.x, s.well.y);
      const rot = (s.frame * 0.012) % (Math.PI * 2);

      // Outer accretion disk — 3 concentric ellipses with slight rotation
      const diskData = [
        { rx: 72, ry: 28, angle: rot,         color: 'rgba(0,180,255,0.13)', lw: 3 },
        { rx: 60, ry: 22, angle: rot + 0.6,   color: 'rgba(0,220,255,0.18)', lw: 2 },
        { rx: 48, ry: 16, angle: rot + 1.1,   color: 'rgba(100,230,255,0.22)', lw: 1.5 },
      ];
      for (const d of diskData) {
        ctx.save();
        ctx.rotate(d.angle);
        ctx.beginPath(); ctx.ellipse(0, 0, d.rx, d.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = d.color; ctx.lineWidth = d.lw; ctx.stroke();
        ctx.restore();
      }

      // Rotating lensing arcs around the hole
      const arcRot = (s.frame * 0.022) % (Math.PI * 2);
      const arcAngles = [arcRot, arcRot + (Math.PI * 2 / 3), arcRot + (Math.PI * 4 / 3)];
      ctx.strokeStyle = 'rgba(0,210,255,0.35)'; ctx.lineWidth = 1.5;
      for (const baseAngle of arcAngles) {
        ctx.beginPath();
        ctx.arc(0, 0, 38, baseAngle, baseAngle + 0.7);
        ctx.stroke();
      }

      // Dark core gradient (drawn on top so it occludes disk edges)
      const wg = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      wg.addColorStop(0, '#000');
      wg.addColorStop(0.28, '#05010f');
      wg.addColorStop(0.6, 'rgba(5,1,15,0.82)');
      wg.addColorStop(1, 'transparent');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();

      // Event horizon ring
      ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2;
      ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();

      // ── Target zone ───────────────────────────────────────────────────────
      const pulseFill = 0.05 + 0.04 * Math.sin(s.frame * 0.08);
      // Pulsing inner fill
      ctx.beginPath(); ctx.arc(s.target.x, s.target.y, s.target.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,204,0,${pulseFill.toFixed(4)})`; ctx.fill();
      // Bright gold ring
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 3;
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(s.target.x, s.target.y, s.target.r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      // Subtle crosshair
      const ch = s.target.r * 0.45;
      ctx.strokeStyle = 'rgba(255,204,0,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.target.x - ch, s.target.y); ctx.lineTo(s.target.x + ch, s.target.y);
      ctx.moveTo(s.target.x, s.target.y - ch); ctx.lineTo(s.target.x, s.target.y + ch);
      ctx.stroke();

      // ── Launcher ─────────────────────────────────────────────────────────
      ctx.fillStyle = '#00f5ff'; ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(s.launcher.x, s.launcher.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

      // ── Probe with trail ─────────────────────────────────────────────────
      if (s.probe) {
        // Trail — faded dots
        if (s.probe.trail) {
          const trailLen = s.probe.trail.length;
          for (let ti = 0; ti < trailLen; ti++) {
            const tp = s.probe.trail[ti];
            const frac = (ti + 1) / trailLen; // 0..1, older = smaller frac
            const alpha = frac * 0.5;
            const radius = 1.5 + frac * 2;
            ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.beginPath(); ctx.arc(tp.x, tp.y, radius, 0, Math.PI * 2); ctx.fill();
          }
        }
        // Glowing head
        ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(s.probe.x, s.probe.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ── Aim line ─────────────────────────────────────────────────────────
      if (s.drag && !s.probe) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(s.launcher.x, s.launcher.y); ctx.lineTo(s.drag.x, s.drag.y); ctx.stroke();
        ctx.setLineDash([]);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const local = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; };
  const down = (e) => { e.preventDefault(); const s = stateRef.current; if (s.probe) return; s.drag = local(e); };
  const move = (e) => { e.preventDefault(); const s = stateRef.current; if (!s.drag || s.probe) return; s.drag = local(e); };
  const up = (e) => {
    e.preventDefault(); const s = stateRef.current; if (!s.drag || s.probe) return;
    const dx = s.drag.x - s.launcher.x, dy = s.drag.y - s.launcher.y;
    const m = Math.min(8, Math.hypot(dx, dy) / 22);
    const ang = Math.atan2(dy, dx);
    s.probe = { x: s.launcher.x, y: s.launcher.y, vx: Math.cos(ang) * m, vy: Math.sin(ang) * m, t: 0, trail: [] };
    s.drag = null; setShots(n => n + 1);
    beep({ freq: 600, dur: 0.08 }); triggerHaptic('medium');
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="SHOTS" v={shots} c="#00f5ff" /></HudRow>
      <canvas ref={cvRef} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(255,204,0,0.18)', touchAction: 'none' }} />
    </div>
  );
}
