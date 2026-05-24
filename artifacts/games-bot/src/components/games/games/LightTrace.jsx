import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TargetBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'LIGHT TRACE — A glowing orb wanders. Keep your finger ON the orb. Drift away and the bar drains. 60 seconds.';
const W = 320, H = 460;

function spawnTraps(count) {
  return Array.from({ length: count }, (_, i) => ({
    x: 30 + Math.random() * (W - 60),
    y: 30 + Math.random() * (H - 60),
    vx: (Math.random() < 0.5 ? 1 : -1) * (1.4 + Math.random() * 1.1),
    vy: (Math.random() < 0.5 ? 1 : -1) * (1.4 + Math.random() * 1.1),
    r: 16,
    id: i,
  }));
}

export default function LightTrace({ phase, setPhase, onScoreUpdate, game }) {
  const TARGET_SCORE = game?.targetScore || 300;
  const SCORE_PENALTY = game?.scorePenalty || 25;
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [hold, setHold] = useState(1);
  const stateRef = useRef({ orb: { x: W / 2, y: H / 2, vx: 1.4, vy: 1, r: 26 }, traps: [], finger: null, score: 0, hold: 1 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.score = 0; s.hold = 1; setScore(0); setTime(60); setHold(1);
    s.orb = { x: W / 2, y: H / 2, vx: 2.4, vy: 1.8, r: 24 };
    s.traps = spawnTraps(6);
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;
    let lastPenaltyTime = 0;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase(s.score >= TARGET_SCORE ? 'won' : 'lost'), 300); return 0; }
      return t - 1;
    }), 1000);
    let drift = 0;
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    const loop = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { raf = requestAnimationFrame(loop); return; }
      _skzLastT = now;
      if (!running) return;

      // Move orb
      const o = s.orb;
      o.x += o.vx; o.y += o.vy;
      if (o.x < o.r || o.x > W - o.r) o.vx *= -1;
      if (o.y < o.r || o.y > H - o.r) o.vy *= -1;
      drift += 0.0055;
      o.vx += (Math.random() - 0.5) * drift; o.vy += (Math.random() - 0.5) * drift;
      const v = Math.hypot(o.vx, o.vy); if (v > 4.6) { o.vx *= 4.6 / v; o.vy *= 4.6 / v; }

      // Move traps
      for (const trap of s.traps) {
        trap.x += trap.vx; trap.y += trap.vy;
        if (trap.x < trap.r || trap.x > W - trap.r) trap.vx *= -1;
        if (trap.y < trap.r || trap.y > H - trap.r) trap.vy *= -1;
      }

      const f = s.finger; let inside = false;
      if (f) inside = Math.hypot(f.x - o.x, f.y - o.y) < o.r;

      if (inside) {
        s.hold = Math.min(1, s.hold + 0.012);
        s.score += 2; setScore(s.score); onScoreUpdate?.(s.score);
        if (s.score % 40 === 0) beep({ freq: 700, dur: 0.04, vol: 0.08 });
      } else {
        s.hold = Math.max(0, s.hold - 0.006);
      }

      // Check finger on traps (penalise once per 600ms per trap)
      if (f && now - lastPenaltyTime > 600) {
        for (const trap of s.traps) {
          if (Math.hypot(f.x - trap.x, f.y - trap.y) < trap.r + 8) {
            s.score = Math.max(0, s.score - SCORE_PENALTY);
            setScore(s.score); onScoreUpdate?.(s.score);
            beep({ freq: 120, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
            lastPenaltyTime = now;
            break;
          }
        }
      }

      setHold(s.hold);
      if (s.hold <= 0) {
        s.hold = 0.3; // don't kill — just penalise hold drain
        s.score = Math.max(0, s.score - 10);
        setScore(s.score); onScoreUpdate?.(s.score);
      }

      // Draw
      ctx.fillStyle = 'rgba(4,3,10,0.4)'; ctx.fillRect(0, 0, W, H);

      // Draw traps
      for (const trap of s.traps) {
        ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(255,50,80,0.18)';
        ctx.beginPath(); ctx.arc(trap.x, trap.y, trap.r + 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c41e38';
        ctx.beginPath(); ctx.arc(trap.x, trap.y, trap.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2;
        const arm = trap.r * 0.55;
        ctx.beginPath();
        ctx.moveTo(trap.x - arm, trap.y - arm); ctx.lineTo(trap.x + arm, trap.y + arm);
        ctx.moveTo(trap.x + arm, trap.y - arm); ctx.lineTo(trap.x - arm, trap.y + arm);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw orb
      ctx.shadowColor = inside ? '#00f5a0' : '#ffcc00'; ctx.shadowBlur = 30;
      const grad = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, o.r);
      grad.addColorStop(0, '#fff'); grad.addColorStop(0.6, inside ? '#00f5a0' : '#ffcc00'); grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

      if (f) { ctx.strokeStyle = '#00f5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 14, 0, Math.PI * 2); ctx.stroke(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate, TARGET_SCORE, SCORE_PENALTY]);

  const local = (e) => { const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; };
  const set = (e) => { e.preventDefault(); stateRef.current.finger = local(e); };
  const clear = (e) => { e.preventDefault(); stateRef.current.finger = null; };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="HOLD" v={`${Math.round(hold * 100)}%`} c="#ffcc00" /></HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${hold * 100}%`, background: 'linear-gradient(90deg,#00f5a0,#ffcc00)', transition: 'width 0.1s' }} />
      </div>
      <canvas ref={cvRef} width={W} height={H} onPointerDown={set} onPointerMove={set} onPointerUp={clear} onPointerCancel={clear} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,160,0.18)', touchAction: 'none', background: '#04030a' }} />
    </div>
  );
}
