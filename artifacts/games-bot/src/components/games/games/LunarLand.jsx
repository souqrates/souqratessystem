import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'LUNAR LAND — Hold to throttle. Land softly inside the green pad. 90 seconds.';
const W = 320, H = 460, T = 90;

export default function LunarLand({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [lands, setLands] = useState(0);
  const stateRef = useRef({ ship: null, pad: null, thrust: false, score: 0, lands: 0 });

  const reset = () => {
    const s = stateRef.current;
    s.ship = { x: W / 2, y: 60, vx: (Math.random() - 0.5) * 1.4, vy: 0.3, fuel: 100, alive: true };
    s.pad = { x: 40 + Math.random() * (W - 140), w: 60 + Math.random() * 40, y: H - 18 };
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.score = 0; s.lands = 0; reset();
    setScore(0); setTime(T); setLands(0);
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
      const sh = s.ship;
      if (sh.alive) {
        sh.vy += 0.06;
        if (s.thrust && sh.fuel > 0) { sh.vy -= 0.16; sh.fuel = Math.max(0, sh.fuel - 0.6); }
        sh.x += sh.vx; sh.y += sh.vy;
        if (sh.x < 0 || sh.x > W) { sh.alive = false; }
        if (sh.y >= s.pad.y - 10) {
          const onPad = sh.x > s.pad.x && sh.x < s.pad.x + s.pad.w;
          const soft = Math.abs(sh.vy) < 2 && Math.abs(sh.vx) < 1.2;
          if (onPad && soft) {
            const acc = Math.max(0, 2 - Math.abs(sh.vy)) * 25 + Math.max(0, 1.2 - Math.abs(sh.vx)) * 25 + sh.fuel * 0.5;
            const pts = 80 + Math.floor(acc); s.score += pts; s.lands += 1; setScore(s.score); setLands(s.lands); onScoreUpdate?.(s.score);
            beep({ freq: 800, dur: 0.25, type: 'triangle', sweepTo: 1300 }); triggerHaptic('medium');
            sh.alive = false; setTimeout(reset, 700);
          } else {
            s.score = Math.max(0, s.score - 15); setScore(s.score); onScoreUpdate?.(s.score);
            beep({ freq: 120, dur: 0.3, type: 'sawtooth' }); triggerHaptic('error');
            sh.alive = false; setTimeout(reset, 700);
          }
        }
      }
      ctx.fillStyle = '#020310'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + (i * 17 % 50) / 200})`; ctx.fillRect((i * 53) % W, (i * 73) % (H - 80), 1, 1); }
      ctx.fillStyle = '#3a3460'; ctx.fillRect(0, s.pad.y + 6, W, 12);
      ctx.fillStyle = '#00f5a0'; ctx.shadowColor = '#00f5a0'; ctx.shadowBlur = 20; ctx.fillRect(s.pad.x, s.pad.y, s.pad.w, 6); ctx.shadowBlur = 0;
      if (sh.alive) {
        ctx.save(); ctx.translate(sh.x, sh.y);
        ctx.fillStyle = '#cfd8e3'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
        if (s.thrust && sh.fuel > 0) {
          ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(6, 8); ctx.lineTo(0, 18 + Math.random() * 8); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.restore();
      }
      ctx.fillStyle = '#fff'; ctx.font = '10px Orbitron'; ctx.fillText(`FUEL ${Math.floor(sh.fuel)}`, 10, 16); ctx.fillText(`vY ${sh.vy.toFixed(1)}`, 10, 30);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="LANDS" v={lands} c="#ffcc00" /></HudRow>
      <canvas ref={cvRef} width={W} height={H}
        onPointerDown={(e) => { e.preventDefault(); stateRef.current.thrust = true; }}
        onPointerUp={(e) => { e.preventDefault(); stateRef.current.thrust = false; }}
        onPointerLeave={() => { stateRef.current.thrust = false; }}
        style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,160,0.2)', touchAction: 'none' }} />
      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em', margin: 0 }}>HOLD TO THRUST</p>
    </div>
  );
}
