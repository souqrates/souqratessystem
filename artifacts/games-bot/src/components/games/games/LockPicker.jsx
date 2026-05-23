import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise, chord } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'LOCK PICKER — A rotor spins. Tap when the cyan needle aligns with the gold target. Sweet-spot taps score more. Speed ramps with every crack. 45 seconds.';
const T = 45;
const W = 320, H = 320;

export default function LockPicker({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [opens, setOpens] = useState(0);
  const [flash, setFlash] = useState(null);
  const angleRef = useRef(0); const targetRef = useRef(45); const speedRef = useRef(2.4); const dirRef = useRef(1);
  const scoreRef = useRef(0); const activeRef = useRef(false);
  const sparksRef = useRef([]); const ringsRef = useRef([]); const shakeRef = useRef(0);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setOpens(0); activeRef.current = true;
    targetRef.current = Math.random() * 360;
    angleRef.current = 0; speedRef.current = 2.4; dirRef.current = 1;
    sparksRef.current = []; ringsRef.current = []; shakeRef.current = 0;
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf;

    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const draw = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(draw); return; }
      _skzLastT = now;
      if (!activeRef.current) return;
      angleRef.current = (angleRef.current + speedRef.current * dirRef.current + 360) % 360;

      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      shakeRef.current *= 0.85;

      // Background
      const bg = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 240);
      bg.addColorStop(0, '#1a0c02');
      bg.addColorStop(0.55, '#0a0510');
      bg.addColorStop(1, '#02010a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(sx, sy);
      const cx = W / 2, cy = H / 2 - 6;
      const R = 120;

      // Outer brass ring
      const brass = ctx.createRadialGradient(cx, cy, R - 14, cx, cy, R + 24);
      brass.addColorStop(0, '#4a3a10');
      brass.addColorStop(0.5, '#a87a20');
      brass.addColorStop(1, '#2a1d05');
      ctx.fillStyle = brass;
      ctx.beginPath(); ctx.arc(cx, cy, R + 22, 0, Math.PI * 2); ctx.fill();
      // Inner cavity
      ctx.fillStyle = '#0a0612';
      ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.fill();

      // Tick marks
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const rIn = R - (i % 5 === 0 ? 14 : 8);
        const rOut = R - 2;
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,204,0,0.5)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
        ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
        ctx.stroke();
      }

      // Sweet spot arc around target (shrinks as score climbs)
      const tRad = (targetRef.current - 90) * Math.PI / 180;
      const shrink = Math.min(0.14, scoreRef.current / 8000);
      const arcSpan = Math.max(0.08, 0.22 - shrink);
      ctx.strokeStyle = 'rgba(255,204,0,0.18)';
      ctx.lineWidth = 22;
      ctx.beginPath(); ctx.arc(cx, cy, R - 12, tRad - arcSpan, tRad + arcSpan); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,204,0,0.45)';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, R - 12, tRad - 0.08, tRad + 0.08); ctx.stroke();

      // Target marker
      const tx = cx + Math.cos(tRad) * (R - 12);
      const ty = cy + Math.sin(tRad) * (R - 12);
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 22;
      const tg = ctx.createRadialGradient(tx, ty, 1, tx, ty, 14);
      tg.addColorStop(0, '#fff7c0');
      tg.addColorStop(0.5, '#ffcc00');
      tg.addColorStop(1, '#aa7700');
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Rings (animation)
      ringsRef.current = ringsRef.current.filter(r => {
        r.r += 3; r.a -= 0.03;
        if (r.a <= 0) return false;
        ctx.strokeStyle = r.col + Math.floor(r.a * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2); ctx.stroke();
        return true;
      });

      // Needle
      const aRad = (angleRef.current - 90) * Math.PI / 180;
      const nx = cx + Math.cos(aRad) * (R - 18);
      const ny = cy + Math.sin(aRad) * (R - 18);
      // Needle glow
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#00f5ff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.shadowBlur = 0;
      // Needle tip
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();

      // Center hub
      const hub = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
      hub.addColorStop(0, '#aef2ff');
      hub.addColorStop(0.5, '#00f5ff');
      hub.addColorStop(1, '#003848');
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 16;
      ctx.fillStyle = hub;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();

      // Sparks
      sparksRef.current = sparksRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 1;
        const a = Math.max(0, p.life / 30);
        ctx.fillStyle = p.col + Math.floor(a * 255).toString(16).padStart(2, '0');
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
        return p.life > 0;
      });

      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); cancelAnimationFrame(raf); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); cancelAnimationFrame(raf); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const lock = () => {
    if (!activeRef.current) return;
    const diff = Math.min(Math.abs(angleRef.current - targetRef.current), 360 - Math.abs(angleRef.current - targetRef.current));
    const cx = W / 2, cy = H / 2 - 6, R = 120;
    const windowDeg = Math.max(5, 12 - Math.floor(scoreRef.current / 140));
    if (diff < windowDeg) {
      const acc = 1 - diff / windowDeg; const pts = Math.floor(40 + acc * 60);
      scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      setOpens(v => v + 1); setFlash({ t: 'good', pts });
      chord([660, 990, 1320], 0.14, 0.16, 'triangle');
      setTimeout(() => beep({ freq: 1700, dur: 0.05, type: 'square' }), 90);
      triggerHaptic('medium');
      const aRad = (angleRef.current - 90) * Math.PI / 180;
      const nx = cx + Math.cos(aRad) * (R - 18);
      const ny = cy + Math.sin(aRad) * (R - 18);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2; const sp = 1 + Math.random() * 3.8;
        sparksRef.current.push({ x: nx, y: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 36, col: i % 2 ? '#ffcc00' : '#fff7c0' });
      }
      ringsRef.current.push({ r: 18, a: 0.9, col: '#ffcc00' });
      ringsRef.current.push({ r: 8, a: 0.7, col: '#ffffff' });
      shakeRef.current = 0;
      speedRef.current = Math.min(9.5, speedRef.current + 0.6);
      const reverseProb = Math.min(0.55, 0.25 + scoreRef.current / 1800);
      if (Math.random() < reverseProb) dirRef.current = -dirRef.current;
      targetRef.current = Math.random() * 360;
    } else {
      const penalty = 6 + Math.floor(scoreRef.current / 200);
      scoreRef.current = Math.max(0, scoreRef.current - penalty); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      setFlash({ t: 'bad' });
      beep({ freq: 180, dur: 0.22, type: 'sawtooth', sweepTo: 60 });
      noise({ dur: 0.18, vol: 0.2 });
      triggerHaptic('error');
      const aRad = (angleRef.current - 90) * Math.PI / 180;
      const nx = cx + Math.cos(aRad) * (R - 18);
      const ny = cy + Math.sin(aRad) * (R - 18);
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2; const sp = 1 + Math.random() * 3;
        sparksRef.current.push({ x: nx, y: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 28, col: '#ff3355' });
      }
      ringsRef.current.push({ r: 18, a: 0.7, col: '#ff3355' });
      ringsRef.current.push({ r: 30, a: 0.5, col: '#ff3355' });
      shakeRef.current = 16;
    }
    setTimeout(() => setFlash(null), 400);
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ffcc00" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="LOCKS" v={opens} c="#ff66cc" />
      </HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <div onPointerDown={lock} style={{
        position: 'relative', borderRadius: 18, padding: 8,
        background: 'linear-gradient(180deg, rgba(255,204,0,0.10), rgba(0,245,255,0.04))',
        border: '1px solid rgba(255,204,0,0.22)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.55), inset 0 0 30px rgba(255,204,0,0.06)',
        touchAction: 'none', cursor: 'pointer',
      }}>
        <canvas ref={cvRef} width={W} height={H} style={{ display: 'block', width: '100%', borderRadius: 14 }} />
        {flash && (
          <div style={{
            position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)',
            color: flash.t === 'good' ? '#00f5a0' : '#ff3355',
            fontWeight: 900, fontFamily: 'Orbitron, sans-serif', fontSize: 32,
            textShadow: `0 0 18px ${flash.t === 'good' ? '#00f5a0' : '#ff3355'}`,
            letterSpacing: '0.18em', pointerEvents: 'none',
          }}>{flash.t === 'good' ? `+${flash.pts}` : 'MISS'}</div>
        )}
        <p style={{
          textAlign: 'center', fontSize: 11, color: 'rgba(255,204,0,0.7)',
          letterSpacing: '0.3em', margin: '6px 0 2px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
        }}>TAP TO LOCK IN</p>
      </div>
    </div>
  );
}
