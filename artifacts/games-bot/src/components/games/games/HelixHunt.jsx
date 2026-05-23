import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'HELIX HUNT — Drag to spin the double helix. Tap when the target sphere is in the gold zone. 90 seconds.';
const W = 320, H = 420, T = 90;

export default function HelixHunt({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [hits, setHits] = useState(0);
  const stateRef = useRef({ rot: 0, drag: null, spheres: [], target: 0, score: 0, hits: 0 });

  const seed = () => {
    const s = stateRef.current;
    s.spheres = []; const colors = ['#ff3355', '#00f5ff', '#ffcc00', '#00f5a0', '#ff66cc'];
    for (let i = 0; i < 8; i++) s.spheres.push({ y: 40 + i * 45, color: colors[Math.floor(Math.random() * colors.length)], phase: Math.random() * Math.PI * 2 });
    s.target = Math.floor(Math.random() * 5);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.rot = 0; s.score = 0; s.hits = 0; seed();
    setScore(0); setTime(T); setHits(0);
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
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.strokeRect(20, H / 2 - 24, W - 40, 48); ctx.setLineDash([]);
      const colors = ['#ff3355', '#00f5ff', '#ffcc00', '#00f5a0', '#ff66cc'];
      ctx.fillStyle = colors[s.target]; ctx.font = 'bold 12px Orbitron'; ctx.shadowColor = colors[s.target]; ctx.shadowBlur = 8;
      ctx.fillText(`TARGET: ${['RED', 'CYAN', 'GOLD', 'GREEN', 'PINK'][s.target]}`, 22, H / 2 - 30); ctx.shadowBlur = 0;
      for (const sp of s.spheres) {
        const angle = s.rot + sp.phase;
        const x1 = W / 2 + Math.cos(angle) * 70;
        const x2 = W / 2 - Math.cos(angle) * 70;
        const z1 = Math.sin(angle), z2 = -Math.sin(angle);
        const r1 = 10 + z1 * 4, r2 = 10 + z2 * 4;
        const a1 = 0.4 + (z1 + 1) * 0.3, a2 = 0.4 + (z2 + 1) * 0.3;
        ctx.globalAlpha = a1; ctx.shadowColor = sp.color; ctx.shadowBlur = 12;
        ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(x1, sp.y, r1, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a2; ctx.beginPath(); ctx.arc(x2, sp.y, r2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const local = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; };
  const down = (e) => { e.preventDefault(); stateRef.current.drag = local(e); };
  const move = (e) => {
    e.preventDefault(); const s = stateRef.current; if (!s.drag) return;
    const p = local(e); s.rot += (p.x - s.drag.x) * 0.02; s.drag = p;
  };
  const up = (e) => {
    e.preventDefault(); const s = stateRef.current;
    if (s.drag) { s.drag = null; }
    const colors = ['#ff3355', '#00f5ff', '#ffcc00', '#00f5a0', '#ff66cc'];
    const tColor = colors[s.target];
    let success = false;
    for (const sp of s.spheres) {
      if (sp.color !== tColor) continue;
      if (sp.y < H / 2 - 24 || sp.y > H / 2 + 24) continue;
      const angle = s.rot + sp.phase;
      if (Math.abs(Math.sin(angle)) < 0.25) {
        s.score += 60; s.hits += 1; setScore(s.score); setHits(s.hits); onScoreUpdate?.(s.score);
        beep({ freq: 1000, dur: 0.18, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
        s.target = Math.floor(Math.random() * 5); success = true; break;
      }
    }
    if (!success) {
      s.score = Math.max(0, s.score - 10); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 140, dur: 0.2, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ff66cc" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="HITS" v={hits} c="#00f5ff" /></HudRow>
      <canvas ref={cvRef} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(255,102,204,0.2)', touchAction: 'none' }} />
      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em', margin: 0 }}>DRAG TO SPIN, RELEASE TO LOCK</p>
    </div>
  );
}
