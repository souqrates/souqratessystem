import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'STAR MAP — A constellation flashes. Tap the stars in the same order from memory. 90 seconds.';
const W = 320, H = 380, T = 90;

function genConst(n) {
  const stars = [];
  for (let i = 0; i < n; i++) stars.push({ x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 80) });
  return stars;
}

export default function StarMap({ phase, setPhase, onScoreUpdate, game }) {
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [round, setRound] = useState(1);
  const [stars, setStars] = useState([]); const [showSeq, setShowSeq] = useState(-1); const [idx, setIdx] = useState(0);
  const [phase2, setPhase2] = useState('preview'); const scoreRef = useRef(0); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setRound(1); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) {
        activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current);
        const target = game?.targetScore || 300;
        setTimeout(() => setPhase(scoreRef.current >= target ? 'won' : 'lost'), 300);
        return 0;
      }
      return t - 1;
    }), 1000);
    startRound(1);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const startRound = (r) => {
    const n = Math.min(8, 3 + Math.floor(r / 2));
    const s = genConst(n); setStars(s); setIdx(0); setPhase2('preview');
    let k = 0;
    const tick = () => {
      if (!activeRef.current) return;
      setShowSeq(k); beep({ freq: 500 + k * 60, dur: 0.1, type: 'triangle' });
      k++;
      if (k < n) setTimeout(tick, 500);
      else setTimeout(() => { setShowSeq(-1); setPhase2('input'); }, 500);
    };
    tick();
  };

  const tap = (i) => {
    if (!activeRef.current || phase2 !== 'input') return;
    if (i === idx) {
      const ni = idx + 1; setIdx(ni); beep({ freq: 700 + ni * 40, dur: 0.08, type: 'triangle' }); triggerHaptic('light');
      if (ni >= stars.length) {
        const pts = 60 + round * 20; scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 1100, dur: 0.2, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
        const nr = round + 1; setRound(nr); setTimeout(() => startRound(nr), 600);
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 10); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 140, dur: 0.2, type: 'sawtooth' }); triggerHaptic('error');
      setPhase2('preview'); setTimeout(() => startRound(round), 400);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="ROUND" v={round} c="#ff66cc" /></HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <TargetBar score={score} target={game?.targetScore || 300} label="TARGET TO WIN" />
      <svg width={W} height={H} style={{
        width: '100%', borderRadius: 14,
        border: '1px solid rgba(255,204,0,0.28)',
        background: 'radial-gradient(ellipse at 50% 30%, #0a0a3a 0%, #03051a 50%, #01010a 100%)',
        boxShadow: 'inset 0 0 40px rgba(80,40,140,0.25)',
      }}>
        <defs>
          <filter id="starGlow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="starCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="40%" stopColor="#ffcc00" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffcc00" stopOpacity="0.4" />
          </radialGradient>
        </defs>

        {/* Ambient distant stars (decorative twinkle) */}
        {Array.from({ length: 28 }).map((_, i) => {
          const x = (i * 137) % W;
          const y = (i * 79) % H;
          const r = (i % 3 === 0) ? 1.4 : 0.8;
          return (
            <circle key={`amb-${i}`} cx={x} cy={y} r={r} fill="#fff" opacity={0.18 + (i % 5) * 0.08}>
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur={`${2 + (i % 4)}s`} repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* Constellation connecting lines (drawn first so stars sit on top) */}
        {phase2 === 'input' && idx > 1 && stars.slice(0, idx).map((s, i) =>
          i > 0 ? (
            <line
              key={`ln-${i}`}
              x1={stars[i - 1].x} y1={stars[i - 1].y}
              x2={s.x} y2={s.y}
              stroke="#ffcc00" strokeWidth={1.5}
              opacity={0.55}
              filter="url(#starGlow)"
            />
          ) : null
        )}
        {/* Preview sequence lines */}
        {phase2 === 'preview' && showSeq > 0 && stars.slice(0, showSeq + 1).map((s, i) =>
          i > 0 ? (
            <line
              key={`pln-${i}`}
              x1={stars[i - 1].x} y1={stars[i - 1].y}
              x2={s.x} y2={s.y}
              stroke="#ffcc00" strokeWidth={1.2}
              opacity={0.35}
              strokeDasharray="3 3"
            />
          ) : null
        )}

        {stars.map((s, i) => {
          const lit = phase2 === 'preview' ? i <= showSeq : i < idx;
          const isNext = phase2 === 'input' && i === idx;
          return (
            <g key={i} onPointerDown={() => tap(i)} style={{ cursor: 'pointer' }}>
              <circle cx={s.x} cy={s.y} r={22} fill="transparent" />
              {/* Twinkle ring on lit / next stars */}
              {(lit || isNext) && (
                <circle cx={s.x} cy={s.y} r={14} fill="none" stroke="#ffcc00" strokeWidth={1} opacity={0.5}>
                  <animate attributeName="r" values="10;18;10" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.05;0.6" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Star core */}
              <circle
                cx={s.x} cy={s.y}
                r={lit ? 9 : 4.5}
                fill={lit ? 'url(#starCore)' : 'rgba(220,220,255,0.7)'}
                filter={lit ? 'url(#starGlow)' : undefined}
                style={{ transition: 'r 0.2s' }}
              />
              {/* Just-shown marker during preview */}
              {showSeq === i && phase2 === 'preview' && (
                <circle cx={s.x} cy={s.y} r={16} fill="none" stroke="#fff" strokeWidth={2} opacity={0.85}>
                  <animate attributeName="r" values="6;20;6" dur="0.6s" repeatCount="2" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em', margin: 0 }}>{phase2 === 'preview' ? 'MEMORIZE THE SEQUENCE' : 'TAP IN ORDER'}</p>
    </div>
  );
}
