import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'WORD DROP — A target word is shown. Tap falling letters in correct order to spell it. The next required letter glows gold. RED letters are TRAPS — tapping one heavily reduces your score! 60 seconds.';
const WORDS = ['NEON', 'SKILL', 'BLITZ', 'PULSE', 'STAR', 'QUEST', 'WAVE', 'ARENA', 'CYBER', 'NOVA', 'FORGE', 'CHAMP'];
const W = 320, H = 360;
const HIT_RADIUS = 28;

export default function WordDrop({ phase, setPhase, onScoreUpdate }) {
  const cvRef = useRef(null);
  const [target, setTarget] = useState('NEON'); const [prog, setProg] = useState(0);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [solved, setSolved] = useState(0);
  const stateRef = useRef({ letters: [], target: 'NEON', prog: 0, spawn: 0, score: 0, particles: [], wave: 0, ripples: [] });

  const newWord = () => {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    stateRef.current.target = w; stateRef.current.prog = 0; setTarget(w); setProg(0);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; s.letters = []; s.particles = []; s.ripples = []; s.score = 0; s.spawn = 0; s.wave = 0; newWord();
    setScore(0); setSolved(0); setTime(60);
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
      s.wave += 0.04;
      s.spawn -= 1;
      // Harder: faster spawn, more traps as score climbs
      const trapBias = Math.min(0.35, 0.18 + s.score / 1500);
      if (s.spawn <= 0) {
        const need = s.target[s.prog];
        // Spawn 1–2 letters at once for density
        const burst = Math.random() < 0.35 ? 2 : 1;
        for (let k = 0; k < burst; k++) {
          const isTrap = Math.random() < trapBias;
          const wantNext = !isTrap && Math.random() < 0.55;
          const letter = wantNext ? need : String.fromCharCode(65 + Math.floor(Math.random() * 26));
          s.letters.push({
            x: 30 + Math.random() * (W - 60),
            y: -22 - k * 30,
            v: 1.6 + Math.random() * 1.4 + Math.min(1.2, s.score / 600),
            l: letter || need,
            drift: (Math.random() - 0.5) * 0.5,
            rot: 0,
            spin: (Math.random() - 0.5) * 0.025,
            trap: isTrap,
          });
        }
        s.spawn = Math.max(14, 26 - Math.floor(s.score / 60)) + Math.random() * 12;
      }
      s.letters.forEach(l => { l.y += l.v; l.x += l.drift; l.rot += l.spin; });
      s.letters = s.letters.filter(l => l.y < H + 30 && l.x > -30 && l.x < W + 30);

      // Background gradient
      const bg = ctx.createRadialGradient(W / 2, 40, 20, W / 2, H, 360);
      bg.addColorStop(0, '#062028');
      bg.addColorStop(0.5, '#040614');
      bg.addColorStop(1, '#02010a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Subtle horizon line near bottom
      ctx.strokeStyle = 'rgba(0,245,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H - 40); ctx.lineTo(W, H - 40); ctx.stroke();

      // Ripples (tap feedback)
      s.ripples = s.ripples.filter(r => {
        r.r += 2.2; r.a -= 0.04;
        if (r.a <= 0) return false;
        ctx.strokeStyle = r.col + Math.floor(r.a * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        return true;
      });

      // Particles
      s.particles = s.particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 1;
        const a = Math.max(0, p.life / 28);
        ctx.fillStyle = p.col + Math.floor(a * 255).toString(16).padStart(2, '0');
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
        return p.life > 0;
      });

      // Letters
      const need = s.target[s.prog];
      for (const l of s.letters) {
        const isNext = !l.trap && l.l === need;
        const col = l.trap ? '#ff3355' : isNext ? '#ffcc00' : '#00f5ff';
        const pulse = isNext ? 1 + Math.sin(s.wave * 3 + l.x * 0.02) * 0.08 : 1;
        ctx.save();
        ctx.translate(l.x, l.y); ctx.rotate(l.rot);
        // Outer aura
        ctx.shadowColor = col; ctx.shadowBlur = isNext ? 22 : 12;
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 20 * pulse);
        grad.addColorStop(0, col + 'cc');
        grad.addColorStop(0.55, col + '33');
        grad.addColorStop(1, col + '00');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2); ctx.fill();
        // Inner solid disc
        ctx.shadowBlur = 0;
        ctx.fillStyle = isNext ? 'rgba(40,30,0,0.85)' : 'rgba(0,16,24,0.85)';
        ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.fill();
        // Letter
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Orbitron, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = col; ctx.shadowBlur = isNext ? 12 : 6;
        ctx.fillText(l.l, 0, 1);
        ctx.shadowBlur = 0;
        // Border ring
        ctx.strokeStyle = col; ctx.lineWidth = isNext ? 2 : 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(iv); };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (e) => {
    const cv = cvRef.current; const r = cv.getBoundingClientRect(); const t = e.touches?.[0] ?? e;
    const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height);
    const s = stateRef.current;
    let best = -1, bd = HIT_RADIUS;
    s.letters.forEach((l, i) => { const d = Math.hypot(l.x - x, l.y - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) {
      s.ripples.push({ x, y, r: 4, a: 0.4, col: '#88aaaa' });
      return;
    }
    const L = s.letters[best];
    if (L.trap) {
      s.score = Math.max(0, s.score - 25); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 160, dur: 0.2, type: 'sawtooth', sweepTo: 60, vol: 0.22 });
      noise({ dur: 0.16, vol: 0.18 });
      triggerHaptic('error');
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2; const sp = 1.5 + Math.random() * 3;
        s.particles.push({ x: L.x, y: L.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 28, col: '#ff3355' });
      }
      s.ripples.push({ x: L.x, y: L.y, r: 8, a: 0.9, col: '#ff3355' });
      s.letters.splice(best, 1);
      return;
    }
    if (L.l === s.target[s.prog]) {
      s.prog += 1; setProg(s.prog);
      s.score += 10; setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 500 + s.prog * 50, dur: 0.06, type: 'triangle' }); triggerHaptic('light');
      // Hit burst
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2; const sp = 1.2 + Math.random() * 2.5;
        s.particles.push({ x: L.x, y: L.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 26, col: '#ffcc00' });
      }
      s.ripples.push({ x: L.x, y: L.y, r: 8, a: 0.8, col: '#ffcc00' });
      s.letters.splice(best, 1);
      if (s.prog >= s.target.length) {
        s.score += 40; setScore(s.score); setSolved(v => v + 1); onScoreUpdate?.(s.score);
        beep({ freq: 1000, dur: 0.2, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
        // Word complete celebration
        for (let i = 0; i < 28; i++) {
          const a = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 4;
          s.particles.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 40, col: i % 2 ? '#00f5ff' : '#ffcc00' });
        }
        newWord();
      }
    } else {
      s.score = Math.max(0, s.score - 5); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 140, dur: 0.15, type: 'sawtooth' });
      s.ripples.push({ x: L.x, y: L.y, r: 8, a: 0.7, col: '#ff3355' });
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5ff" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="WORDS" v={solved} c="#ffcc00" />
      </HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <div style={{
        display: 'flex', gap: 6, justifyContent: 'center', padding: '10px 8px',
        background: 'linear-gradient(180deg, rgba(0,245,255,0.10), rgba(0,245,255,0.02))',
        borderRadius: 14, border: '1px solid rgba(0,245,255,0.18)',
        boxShadow: 'inset 0 0 18px rgba(0,245,255,0.08)',
      }}>
        {target.split('').map((l, i) => {
          const done = i < prog;
          const active = i === prog;
          return (
            <div key={i} style={{
              width: 30, height: 38, borderRadius: 8,
              background: done ? 'linear-gradient(180deg,#00f5ff55,#00f5ff22)' : active ? 'linear-gradient(180deg,#ffcc0033,#ffcc0010)' : 'rgba(255,255,255,0.04)',
              border: `2px solid ${active ? '#ffcc00' : done ? '#00f5ff' : 'rgba(255,255,255,0.15)'}`,
              color: '#fff', fontWeight: 900, fontFamily: 'Orbitron, sans-serif', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: active ? '0 0 14px #ffcc0088' : done ? '0 0 10px #00f5ff66' : 'none',
              transition: 'all 0.2s',
            }}>{done ? l : active ? l : ''}</div>
          );
        })}
      </div>
      <div style={{
        position: 'relative', borderRadius: 18, padding: 6,
        background: 'linear-gradient(180deg, rgba(0,245,255,0.08), rgba(255,204,0,0.04))',
        border: '1px solid rgba(0,245,255,0.18)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,245,255,0.05)',
      }}>
        <canvas ref={cvRef} width={W} height={H} onPointerDown={tap} style={{ display: 'block', width: '100%', borderRadius: 14, touchAction: 'none' }} />
      </div>
    </div>
  );
}
