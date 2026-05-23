import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Stage, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';
import { isHighEnd, isMidEnd } from '../../../lib/deviceProfile';

const FANCY = isHighEnd() || isMidEnd();

const RULES = 'BEAT DROP — Notes fall in 4 lanes. Tap the lane when the note crosses the hit line. Perfect = bigger combo. 60 seconds.';
const LANES = 4, W = 320, H = 460;
const HIT_Y = H - 80, HIT_TOL = 32;
const LANE_COLORS = ['#ff3355', '#ffcc00', '#00f5a0', '#00f5ff'];

export default function BeatDrop({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0); const [combo, setCombo] = useState(0); const [time, setTime] = useState(60);
  const stateRef = useRef({ notes: [], score: 0, combo: 0, lanes: [false, false, false, false], spawnT: 0 });

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.notes = []; s.score = 0; s.combo = 0; s.spawnT = 0; s.lanes = [false, false, false, false]; s.frame = 0; s.beatPulse = 0; s.hitFlash = [];
    setScore(0); setCombo(0); setTime(60);
    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true, lastT = 0;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    const loop = (ts) => {
      if (ts - _skzLastT < _skzFI) { rafRef.current = requestAnimationFrame(loop); return; }
      _skzLastT = ts;
      if (!running) return;
      s.frame = (s.frame || 0) + 1;
      s.beatPulse = Math.max(0, (s.beatPulse || 0) - 0.05);
      s.hitFlash = (s.hitFlash || []).map(f => ({ ...f, life: f.life - 0.08 })).filter(f => f.life > 0);
      const dt = lastT ? (ts - lastT) / 1000 : 0.016; lastT = ts;
      s.spawnT -= dt;
      if (s.spawnT <= 0) { s.notes.push({ lane: Math.floor(Math.random() * LANES), y: -20 }); s.spawnT = 0.42 + Math.random() * 0.25; s.beatPulse = Math.min(1, (s.beatPulse || 0) + 0.5); beep({ freq: 240, dur: 0.03, vol: 0.06 }); }
      const speed = 280;
      s.notes.forEach(n => n.y += speed * dt);
      s.notes = s.notes.filter(n => {
        if (n.y > H + 20) { s.combo = 0; setCombo(0); return false; }
        return true;
      });
      ctx.fillStyle = '#04030a'; ctx.fillRect(0, 0, W, H);
      // Beat pulse background glow
      if (FANCY && s.beatPulse > 0) {
        const beatGrad = ctx.createRadialGradient(W / 2, HIT_Y, 0, W / 2, HIT_Y, 200);
        beatGrad.addColorStop(0, `rgba(255,204,0,${(s.beatPulse * 0.06).toFixed(3)})`);
        beatGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beatGrad; ctx.fillRect(0, 0, W, H);
      }
      const laneW = W / LANES;
      // Lane backgrounds with subtle gradient
      for (let i = 0; i < LANES; i++) {
        if (s.lanes[i]) {
          const lg = ctx.createLinearGradient(i * laneW, HIT_Y - 60, i * laneW, HIT_Y + 20);
          lg.addColorStop(0, `${LANE_COLORS[i]}00`);
          lg.addColorStop(1, `${LANE_COLORS[i]}40`);
          ctx.fillStyle = lg;
        } else {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0)';
        }
        ctx.fillRect(i * laneW, 0, laneW, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        ctx.strokeRect(i * laneW, 0, laneW, H);
      }
      // Hit zone — glowing band
      const hitBandAlpha = 0.06 + 0.03 * Math.sin(s.frame * 0.12);
      ctx.fillStyle = `rgba(255,204,0,${hitBandAlpha.toFixed(3)})`; ctx.fillRect(0, HIT_Y - HIT_TOL, W, HIT_TOL * 2);
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 14 + s.beatPulse * 8;
      ctx.beginPath(); ctx.moveTo(0, HIT_Y); ctx.lineTo(W, HIT_Y); ctx.stroke(); ctx.shadowBlur = 0;
      // Hit flash particles
      for (const f of (s.hitFlash || [])) {
        ctx.save();
        ctx.globalAlpha = f.life;
        ctx.shadowColor = f.color; ctx.shadowBlur = 20;
        ctx.strokeStyle = f.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, HIT_Y, (1 - f.life) * 28, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // Notes
      for (const n of s.notes) {
        const x = n.lane * laneW + laneW / 2;
        const nearHit = Math.abs(n.y - HIT_Y) < HIT_TOL * 1.5;
        ctx.shadowColor = LANE_COLORS[n.lane]; ctx.shadowBlur = nearHit ? 28 : 14;
        // Rounded note rectangle
        const nw = 52, nh = 22;
        ctx.fillStyle = LANE_COLORS[n.lane];
        ctx.beginPath();
        ctx.roundRect(x - nw / 2, n.y - nh / 2, nw, nh, 6);
        ctx.fill();
        // Bright center stripe
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.roundRect(x - nw / 2 + 4, n.y - 3, nw - 8, 6, 3); ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, setPhase, onScoreUpdate]);

  const hit = (lane) => {
    const s = stateRef.current;
    s.lanes[lane] = true; setTimeout(() => { s.lanes[lane] = false; }, 80);
    let best = -1, bestDist = Infinity;
    s.notes.forEach((n, i) => {
      if (n.lane !== lane) return;
      const d = Math.abs(n.y - HIT_Y);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best >= 0 && bestDist < HIT_TOL) {
      const perfect = bestDist < 10;
      const pts = (perfect ? 60 : 30) + s.combo * 4;
      s.score += pts; s.combo += 1;
      setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
      const laneW = W / LANES;
      s.hitFlash = s.hitFlash || [];
      s.hitFlash.push({ x: lane * laneW + laneW / 2, color: LANE_COLORS[lane], life: 1 });
      s.notes.splice(best, 1);
      beep({ freq: perfect ? 880 : 560, dur: 0.08, type: 'triangle' });
      triggerHaptic('light');
    } else {
      s.combo = 0; setCombo(0);
      beep({ freq: 140, dur: 0.08, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ff66ee" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ffcc00" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: '#04030a' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {LANE_COLORS.map((c, i) => (
          <button key={i} onPointerDown={() => hit(i)} style={{ padding: '18px 0', borderRadius: 12, border: `2px solid ${c}`, background: `${c}22`, color: '#fff', fontWeight: 900, fontFamily: 'Orbitron', boxShadow: `0 0 12px ${c}55`, cursor: 'pointer' }}>{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
