import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'CANNON FIRE — Drag to aim & set power. Release to fire at moving ships. 60 seconds.';
const W = 320, H = 460;

export default function CannonFire({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [hits, setHits] = useState(0);
  const stateRef = useRef({ cannon: { x: W / 2, y: H - 30 }, ships: [], shells: [], drag: null, spawn: 0, score: 0, hits: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.ships = []; s.shells = []; s.spawn = 0; s.score = 0; s.hits = 0; s.drag = null;
    setScore(0); setTime(60); setHits(0);
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
      if (s.spawn <= 0) { const dir = Math.random() > 0.5 ? 1 : -1; s.ships.push({ x: dir > 0 ? -30 : W + 30, y: 60 + Math.random() * 200, vx: dir * (1 + Math.random() * 1.5) }); s.spawn = 80; }
      s.ships.forEach(sh => sh.x += sh.vx);
      s.ships = s.ships.filter(sh => sh.x > -50 && sh.x < W + 50);
      s.shells.forEach(sh => { sh.x += sh.vx; sh.y += sh.vy; sh.vy += 0.18; });
      s.shells = s.shells.filter(sh => {
        for (let i = 0; i < s.ships.length; i++) {
          if (Math.hypot(sh.x - s.ships[i].x, sh.y - s.ships[i].y) < 22) {
            s.score += 50 + Math.floor(Math.abs(s.ships[i].vx) * 10);
            s.hits += 1; setHits(s.hits); setScore(s.score); onScoreUpdate?.(s.score);
            s.ships.splice(i, 1);
            beep({ freq: 200, dur: 0.2, type: 'sawtooth', sweepTo: 60 }); triggerHaptic('medium');
            return false;
          }
        }
        return sh.y < H + 20 && sh.x > -20 && sh.x < W + 20;
      });
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      const seaGrad = ctx.createLinearGradient(0, H * 0.7, 0, H);
      seaGrad.addColorStop(0, 'rgba(0,80,140,0.5)'); seaGrad.addColorStop(1, 'rgba(0,20,40,0.9)');
      ctx.fillStyle = seaGrad; ctx.fillRect(0, H * 0.7, W, H * 0.3);
      for (const sh of s.ships) {
        ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff3355';
        ctx.fillRect(sh.x - 18, sh.y - 6, 36, 12);
        ctx.beginPath(); ctx.moveTo(sh.x - 16, sh.y - 6); ctx.lineTo(sh.x + 16, sh.y - 6); ctx.lineTo(sh.x + 10, sh.y - 16); ctx.lineTo(sh.x - 10, sh.y - 16); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }
      for (const sh of s.shells) { ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
      ctx.fillStyle = '#a98cff'; ctx.fillRect(s.cannon.x - 14, s.cannon.y, 28, 18);
      if (s.drag) {
        const dx = s.drag.x - s.cannon.x, dy = s.drag.y - s.cannon.y;
        const ang = Math.atan2(dy, dx);
        ctx.strokeStyle = '#a98cff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s.cannon.x, s.cannon.y); ctx.lineTo(s.cannon.x + Math.cos(ang) * 30, s.cannon.y + Math.sin(ang) * 30); ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(169,140,255,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.cannon.x, s.cannon.y); ctx.lineTo(s.drag.x, s.drag.y); ctx.stroke(); ctx.setLineDash([]);
      } else { ctx.strokeStyle = '#a98cff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s.cannon.x, s.cannon.y); ctx.lineTo(s.cannon.x, s.cannon.y - 30); ctx.stroke(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const local = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; };
  const down = (e) => { e.preventDefault(); stateRef.current.drag = local(e); };
  const move = (e) => { e.preventDefault(); if (stateRef.current.drag) stateRef.current.drag = local(e); };
  const up = (e) => {
    e.preventDefault(); const s = stateRef.current; if (!s.drag) return;
    const dx = s.cannon.x - s.drag.x, dy = s.cannon.y - s.drag.y;
    const power = Math.min(14, Math.hypot(dx, dy) / 14);
    const ang = Math.atan2(dy, dx);
    s.shells.push({ x: s.cannon.x, y: s.cannon.y - 20, vx: Math.cos(ang) * power, vy: Math.sin(ang) * power });
    s.drag = null;
    beep({ freq: 90, dur: 0.18, type: 'sawtooth' }); triggerHaptic('medium');
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#a98cff" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="HITS" v={hits} c="#ffcc00" /></HudRow>
      <canvas ref={cvRef} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(169,140,255,0.18)', touchAction: 'none' }} />
    </div>
  );
}
