import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TargetBar } from './_shell';

const RULES = 'ECHO CHAMBER — Listen to the tone sequence then repeat it on the matching pads. Starts at 3 tones and ramps up FAST. Mistakes cost score and restart the chain shorter. Hit TARGET in 60s.';
const TONES = [
  { hz: 261, c: '#ff3355' },
  { hz: 329, c: '#ffcc00' },
  { hz: 392, c: '#00f5a0' },
  { hz: 440, c: '#00f5ff' },
  { hz: 523, c: '#ff66cc' },
  { hz: 659, c: '#ffa500' },
];

const MAX_SCORE = 540;
const TARGET_SCORE = Math.round(MAX_SCORE * 2 / 3); // 360
const START_LEN = 3;

function injectCSS(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}

injectCSS('ec-styles', `
  @keyframes ec-ripple {
    0%   { box-shadow: 0 0 0 0px rgba(255,255,255,0.55), var(--ec-base-shadow); }
    40%  { box-shadow: 0 0 0 14px rgba(255,255,255,0.12), var(--ec-base-shadow); }
    100% { box-shadow: 0 0 0 28px rgba(255,255,255,0), var(--ec-base-shadow); }
  }
  .ec-pad-ripple {
    animation: ec-ripple 0.55s ease-out forwards;
  }
`);

export default function EchoChamber({ phase, setPhase, onScoreUpdate }) {
  const [stage, setStage] = useState('show');
  const [seq, setSeq] = useState([]);
  const [active, setActive] = useState(-1);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [round, setRound] = useState(0);
  const seqRef = useRef([]); const inputRef = useRef(0); const scoreRef = useRef(0); const activeRef = useRef(false);
  // Track ripple trigger per pad (incremented to re-trigger animation)
  const [rippleTick, setRippleTick] = useState(() => Array(TONES.length).fill(0));

  useEffect(() => {
    if (phase !== 'playing') return;
    seqRef.current = []; inputRef.current = 0; scoreRef.current = 0;
    setSeq([]); setScore(0); setRound(0); setTime(60); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) {
        activeRef.current = false; clearInterval(iv);
        onScoreUpdate?.(scoreRef.current);
        const won = scoreRef.current >= TARGET_SCORE;
        triggerHaptic(won ? 'heavy' : 'error');
        setTimeout(() => setPhase(won ? 'won' : 'lost'), 300);
        return 0;
      }
      return t - 1;
    }), 1000);
    setTimeout(nextRound, 400);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const triggerRipple = (padIdx) => {
    setRippleTick(prev => {
      const next = [...prev];
      next[padIdx] = prev[padIdx] + 1;
      return next;
    });
  };

  const playSeq = async (s) => {
    setStage('show'); setActive(-1);
    const baseGap = Math.max(70, 220 - s.length * 10);
    const onDur = Math.max(120, 260 - s.length * 12);
    for (let i = 0; i < s.length; i++) {
      await new Promise(r => setTimeout(r, baseGap));
      if (!activeRef.current) return;
      setActive(s[i]);
      triggerRipple(s[i]);
      beep({ freq: TONES[s[i]].hz, dur: onDur / 1000, type: 'sine' });
      await new Promise(r => setTimeout(r, onDur));
      setActive(-1);
    }
    setStage('input');
  };

  const nextRound = () => {
    let s;
    if (seqRef.current.length === 0) {
      s = Array.from({ length: START_LEN }, () => Math.floor(Math.random() * TONES.length));
    } else {
      s = [...seqRef.current, Math.floor(Math.random() * TONES.length)];
    }
    seqRef.current = s; inputRef.current = 0; setSeq(s); setRound(s.length);
    playSeq(s);
  };

  const tap = (i) => {
    if (!activeRef.current || stage !== 'input') return;
    setActive(i);
    triggerRipple(i);
    setTimeout(() => setActive(-1), 120);
    beep({ freq: TONES[i].hz, dur: 0.16, type: 'sine' }); triggerHaptic('light');
    if (i === seqRef.current[inputRef.current]) {
      inputRef.current += 1;
      if (inputRef.current >= seqRef.current.length) {
        const pts = 25 + seqRef.current.length * 10;
        scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 1000, dur: 0.2, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
        setTimeout(nextRound, 400);
      }
    } else {
      beep({ freq: 90, dur: 0.32, type: 'sawtooth' }); triggerHaptic('error');
      scoreRef.current = Math.max(0, scoreRef.current - 20);
      setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      const trimmed = seqRef.current.slice(0, Math.max(START_LEN - 1, seqRef.current.length - 2));
      seqRef.current = trimmed; setSeq(trimmed); setRound(trimmed.length);
      setTimeout(nextRound, 700);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ff66cc" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="LENGTH" v={round} c="#00f5ff" />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} max={MAX_SCORE} label="TARGET TO WIN" />

      {/* Stage status badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '0 0 2px',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 20px',
          borderRadius: 999,
          background: stage === 'show'
            ? 'linear-gradient(90deg, #b38000 0%, #ffcc00 50%, #b38000 100%)'
            : 'linear-gradient(90deg, #007a50 0%, #00f5a0 50%, #007a50 100%)',
          boxShadow: stage === 'show'
            ? '0 0 18px #ffcc0088, inset 0 1px 0 rgba(255,255,255,0.25)'
            : '0 0 18px #00f5a088, inset 0 1px 0 rgba(255,255,255,0.25)',
          transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: 15 }}>{stage === 'show' ? '👂' : '🎯'}</span>
          <span style={{
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 900,
            fontSize: 13,
            letterSpacing: '0.25em',
            color: stage === 'show' ? '#1a0d00' : '#001a0d',
          }}>
            {stage === 'show' ? 'LISTEN' : 'REPEAT'}
          </span>
        </div>
      </div>

      {/* Pad grid (helper color dots removed — pure memory) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gridTemplateRows: '1fr 1fr',
        gap: 8,
        padding: 6,
        background: 'radial-gradient(ellipse at top, #1a0a20 0%, #02010a 100%)',
        borderRadius: 14,
        border: '1px solid rgba(255,102,204,0.22)',
        minHeight: 360,
      }}>
        {TONES.map((t, i) => {
          const isActive = active === i;
          const baseShadow = `0 0 14px ${t.c}33`;
          return (
            <button
              key={i}
              disabled={stage !== 'input'}
              onPointerDown={() => tap(i)}
              className={isActive ? 'ec-pad-ripple' : undefined}
              style={{
                '--ec-base-shadow': isActive
                  ? `0 0 40px ${t.c}, inset 0 0 30px ${t.c}88`
                  : baseShadow,
                position: 'relative',
                borderRadius: 16,
                cursor: stage === 'input' ? 'pointer' : 'default',
                border: `2px solid ${t.c}`,
                background: isActive
                  ? `radial-gradient(circle, ${t.c}, ${t.c}55)`
                  : `linear-gradient(135deg,${t.c}22,${t.c}06)`,
                boxShadow: isActive
                  ? `0 0 40px ${t.c}, inset 0 0 30px ${t.c}88`
                  : baseShadow,
                transition: 'background 0.08s, border 0.08s',
                color: '#fff',
                fontSize: 22,
                fontFamily: 'Orbitron',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <span style={{ lineHeight: 1, fontSize: 24, textShadow: isActive ? `0 0 12px ${t.c}` : 'none' }}>♪</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
