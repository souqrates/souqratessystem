import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'VORTEX LOCK — Two rings spin in opposite directions. Tap ONLY when BOTH gaps align with the top target slot. Perfect alignment = +150 + combo. Misalign = lose 150 and reset combo. Speed climbs each hit. 60s to reach the target.';
const W = 320, H = 380, T = 60;
const SLOT_DEG = 22;

export default function VortexLock({ phase, setPhase, game, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(T);
  const [combo, setCombo] = useState(0);
  const stateRef = useRef({ a1: 0, a2: Math.PI, v1: 0.025, v2: -0.03, score: 0, combo: 0, flash: 0 });
  const target = game?.targetScore || 1500;

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current;
    s.a1 = 0; s.a2 = Math.PI; s.v1 = 0.025; s.v2 = -0.03; s.score = 0; s.combo = 0; s.flash = 0;
    setScore(0); setCombo(0); setTime(T);
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase(s.score >= target ? 'won' : 'lost'), 250); return 0; }
      return t - 1;
    }), 1000);

    const drawRing = (cx, cy, r, angle, color, gapDeg) => {
      const gap = gapDeg * Math.PI / 180;
      ctx.lineWidth = 14;
      ctx.strokeStyle = color;
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle + gap / 2, angle + Math.PI * 2 - gap / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const loop = () => {
      if (!running) return;
      s.a1 += s.v1; s.a2 += s.v2;
      ctx.fillStyle = '#03020a'; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 + 10;

      // target slot at top (-PI/2)
      const slot = -Math.PI / 2;
      const slotRad = SLOT_DEG * Math.PI / 180;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 142, slot - slotRad / 2, slot + slotRad / 2);
      ctx.stroke();

      drawRing(cx, cy, 110, s.a1, '#00f5ff', SLOT_DEG);
      drawRing(cx, cy, 140, s.a2, '#ff66cc', SLOT_DEG);

      // alignment indicator
      const norm = a => { let x = ((a + Math.PI) % (Math.PI * 2)) - Math.PI; return x; };
      const d1 = Math.abs(norm(s.a1 + Math.PI - slot));
      const d2 = Math.abs(norm(s.a2 + Math.PI - slot));
      const aligned = d1 < slotRad / 2 && d2 < slotRad / 2;
      if (aligned) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 25;
        ctx.beginPath(); ctx.arc(cx, cy - 142, 7, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash})`; ctx.fillRect(0, 0, W, H);
        s.flash -= 0.06;
      }

      // center stats
      ctx.fillStyle = aligned ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.font = 'bold 26px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(aligned ? 'TAP!' : '···', cx, cy + 8);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate, target]);

  const tap = () => {
    const s = stateRef.current;
    const slot = -Math.PI / 2;
    const slotRad = SLOT_DEG * Math.PI / 180;
    const norm = a => { let x = ((a + Math.PI) % (Math.PI * 2)) - Math.PI; return x; };
    const d1 = Math.abs(norm(s.a1 + Math.PI - slot));
    const d2 = Math.abs(norm(s.a2 + Math.PI - slot));
    if (d1 < slotRad / 2 && d2 < slotRad / 2) {
      s.combo += 1;
      const precision = 1 - Math.max(d1, d2) / (slotRad / 2);
      const pts = 100 + Math.floor(precision * 80) + s.combo * 8;
      s.score += pts; s.flash = 0.7;
      setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
      s.v1 *= 1.05; s.v2 *= 1.05;
      chord([700, 1050, 1400], 0.07, 0.14, 'triangle');
      triggerHaptic('medium');
    } else {
      s.combo = 0; setCombo(0);
      s.score = Math.max(0, s.score - 150); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 130, dur: 0.18, type: 'sawtooth' });
      triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5ff" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="COMBO" v={`x${combo}`} c="#ff66cc" />
      </HudRow>
      <TargetBar score={score} target={target} label="LOCK TARGET" />
      <TimeBar totalTime={T} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={tap}
        style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,255,0.2)', touchAction: 'none', background: '#03020a' }} />
    </div>
  );
}
