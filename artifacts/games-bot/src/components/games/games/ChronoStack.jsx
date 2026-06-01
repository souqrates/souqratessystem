import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'CHRONO STACK — Stack falling blocks perfectly. Every 8 seconds TIME REVERSES — your wobbliest blocks fly away. Only PERFECT stacks survive the reversal. 70 seconds.';
const W = 320, H = 380, T = 70;

export default function ChronoStack({ phase, setPhase, game, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(T);
  const [stackH, setStackH] = useState(0);
  const [warn, setWarn] = useState(0);
  const stateRef = useRef({
    stack: [], moving: null, dir: 1, speed: 2.2, score: 0, flash: 0,
    rewindTimer: 8, baseWidth: 90,
  });
  const target = game?.targetScore || 1500;

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current;
    s.stack = [{ x: W / 2 - 45, w: 90, perfect: true }];
    s.dir = 1; s.speed = 2.2; s.score = 0; s.flash = 0;
    s.rewindTimer = 8; s.baseWidth = 90;
    setScore(0); setStackH(1); setTime(T); setWarn(0);
    const newMoving = () => { const w = s.stack[s.stack.length - 1].w; s.moving = { x: 0, w, dir: Math.random() < 0.5 ? 1 : -1 }; };
    newMoving();

    const cv = cvRef.current; const ctx = cv.getContext('2d');
    let raf, running = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { running = false; clearInterval(iv); onScoreUpdate?.(s.score); setTimeout(() => setPhase(s.score >= target ? 'won' : 'lost'), 250); return 0; }
      return t - 1;
    }), 1000);

    const rewindIv = setInterval(() => {
      if (!running) return;
      s.rewindTimer -= 1;
      setWarn(s.rewindTimer <= 3 ? s.rewindTimer : 0);
      if (s.rewindTimer <= 0) {
        // rewind: remove all non-perfect blocks, keep base + perfects
        const survivors = s.stack.filter((b, i) => i === 0 || b.perfect);
        const lost = s.stack.length - survivors.length;
        s.stack = survivors;
        setStackH(s.stack.length);
        if (lost > 0) { beep({ freq: 120, dur: 0.4, type: 'sawtooth' }); triggerHaptic('error'); s.flash = 0.8; }
        else { chord([900, 1200, 1500], 0.1, 0.18, 'triangle'); triggerHaptic('medium'); }
        s.rewindTimer = 8;
        newMoving();
      }
    }, 1000);

    const loop = () => {
      if (!running) return;
      const m = s.moving;
      if (m) {
        m.x += m.dir * s.speed;
        if (m.x <= 0) { m.x = 0; m.dir = 1; }
        if (m.x + m.w >= W) { m.x = W - m.w; m.dir = -1; }
      }
      ctx.fillStyle = '#03020a'; ctx.fillRect(0, 0, W, H);
      // ground
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, H - 20, W, 20);
      // stack
      const baseY = H - 20;
      s.stack.forEach((b, i) => {
        const y = baseY - (i + 1) * 18;
        ctx.fillStyle = b.perfect ? '#00f5a0' : '#94a3b8';
        ctx.shadowColor = b.perfect ? '#00f5a0' : 'transparent';
        ctx.shadowBlur = b.perfect ? 12 : 0;
        ctx.fillRect(b.x, y, b.w, 16);
        ctx.shadowBlur = 0;
      });
      // moving block
      if (m) {
        const y = baseY - (s.stack.length + 1) * 18;
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 14;
        ctx.fillRect(m.x, y, m.w, 16);
        ctx.shadowBlur = 0;
      }
      // rewind warning ring
      if (s.rewindTimer <= 3) {
        const intensity = (4 - s.rewindTimer) / 3;
        ctx.strokeStyle = `rgba(255,51,85,${0.3 + intensity * 0.5})`;
        ctx.lineWidth = 3 + intensity * 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
      }
      if (s.flash > 0) { ctx.fillStyle = `rgba(255,51,85,${s.flash})`; ctx.fillRect(0, 0, W, H); s.flash -= 0.05; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); clearInterval(rewindIv); };
  }, [phase, setPhase, onScoreUpdate, target]);

  const drop = () => {
    const s = stateRef.current;
    if (!s.moving) return;
    const top = s.stack[s.stack.length - 1];
    const m = s.moving;
    const left = Math.max(top.x, m.x);
    const right = Math.min(top.x + top.w, m.x + m.w);
    const overlap = right - left;
    if (overlap <= 0) {
      // total miss → big penalty
      s.score = Math.max(0, s.score - 200); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 120, dur: 0.2, type: 'sawtooth' }); triggerHaptic('error');
      const w = top.w; s.moving = { x: 0, w, dir: Math.random() < 0.5 ? 1 : -1 };
      return;
    }
    const perfect = Math.abs(m.x - top.x) < 3;
    s.stack.push({ x: left, w: overlap, perfect });
    setStackH(s.stack.length);
    const pts = perfect ? 200 : Math.floor(60 * (overlap / m.w));
    s.score += pts; setScore(s.score); onScoreUpdate?.(s.score);
    s.speed = Math.min(7, s.speed + (perfect ? 0.05 : 0.15));
    if (perfect) { chord([900, 1300, 1700], 0.06, 0.16, 'triangle'); triggerHaptic('medium'); }
    else { beep({ freq: 500, dur: 0.06, type: 'triangle' }); triggerHaptic('light'); }
    s.moving = { x: 0, w: overlap, dir: Math.random() < 0.5 ? 1 : -1 };
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5a0" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="STACK" v={stackH} c="#ffcc00" />
      </HudRow>
      <TargetBar score={score} target={target} label="STACK TARGET" />
      <TimeBar totalTime={T} timeLeft={time} />
      <canvas ref={cvRef} width={W} height={H} onPointerDown={drop}
        style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(0,245,160,0.2)', touchAction: 'none', background: '#03020a' }} />
      <p style={{ textAlign: 'center', fontSize: 10, color: warn ? '#ff3355' : 'rgba(148,163,184,0.5)', letterSpacing: '0.25em', margin: 0, fontWeight: 700 }}>
        {warn ? `! REWIND IN ${warn}s` : 'TAP TO DROP — PERFECT STACKS SURVIVE THE REWIND'}
      </p>
    </div>
  );
}
