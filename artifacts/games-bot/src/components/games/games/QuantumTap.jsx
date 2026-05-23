import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'QUANTUM TAP — Particles shimmer between states. Tap only when both halves are aligned (quantum sync). 90 seconds.';
const W = 320, H = 380, T = 90;

export default function QuantumTap({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [combo, setCombo] = useState(0);
  const stateRef = useRef({ t: 0, score: 0, combo: 0, hit: 0, miss: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.t = 0; s.score = 0; s.combo = 0; s.hit = 0; s.miss = 0;
    setScore(0); setCombo(0); setTime(T);
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
      s.t += 0.04;
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      const sync = Math.abs(Math.cos(s.t));
      const cx = W / 2, cy = H / 2;
      const off = Math.sin(s.t) * 90;
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#00f5ff';
      ctx.beginPath(); ctx.arc(cx - off, cy, 36 + sync * 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff66cc'; ctx.shadowColor = '#ff66cc';
      ctx.beginPath(); ctx.arc(cx + off, cy, 36 + sync * 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (sync > 0.96) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 + (sync - 0.96) * 60;
        ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.stroke();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const tap = () => {
    const s = stateRef.current; const sync = Math.abs(Math.cos(s.t));
    if (sync > 0.92) {
      s.combo += 1; const pts = 30 + Math.floor((sync - 0.92) * 800) + s.combo * 3;
      s.score += pts; setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
      beep({ freq: 1000 + s.combo * 25, dur: 0.1, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
    } else {
      s.combo = 0; setCombo(0); s.score = Math.max(0, s.score - 12); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 140, dur: 0.15, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5ff" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ff66cc" /></HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={tap} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,255,0.2)', touchAction: 'none' }} />
      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em', margin: 0 }}>TAP AT THE SYNC FLASH</p>
    </div>
  );
}
