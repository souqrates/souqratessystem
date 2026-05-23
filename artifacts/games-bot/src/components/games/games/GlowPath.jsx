import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'GLOW PATH — Cells light up in sequence. Tap them in the same order. Pattern grows each round. 60 seconds.';
const N = 4;

export default function GlowPath({ phase, setPhase, onScoreUpdate }) {
  const [seq, setSeq] = useState([]); const [active, setActive] = useState(-1); const [stage, setStage] = useState('show');
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [round, setRound] = useState(0);
  const seqRef = useRef([]); const inputRef = useRef(0); const scoreRef = useRef(0); const activeRef = useRef(false);

  const play = async (s) => {
    setStage('show'); setActive(-1);
    for (const i of s) {
      await new Promise(r => setTimeout(r, 280));
      if (!activeRef.current) return;
      setActive(i); beep({ freq: 300 + i * 60, dur: 0.18, type: 'triangle' });
      await new Promise(r => setTimeout(r, 260));
      setActive(-1);
    }
    setStage('input');
  };

  const nextRound = () => {
    const s = [...seqRef.current, Math.floor(Math.random() * N * N)];
    seqRef.current = s; inputRef.current = 0; setSeq(s); setRound(s.length);
    play(s);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    seqRef.current = []; inputRef.current = 0; scoreRef.current = 0;
    setSeq([]); setScore(0); setRound(0); setTime(60); activeRef.current = true;
    setTimeout(nextRound, 500);
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (i) => {
    if (!activeRef.current || stage !== 'input') return;
    setActive(i); setTimeout(() => setActive(-1), 130);
    beep({ freq: 300 + i * 60, dur: 0.1 }); triggerHaptic('light');
    if (i === seqRef.current[inputRef.current]) {
      inputRef.current += 1;
      if (inputRef.current >= seqRef.current.length) {
        const pts = 20 + seqRef.current.length * 6; scoreRef.current += pts;
        setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 1000, dur: 0.2, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
        setTimeout(nextRound, 500);
      }
    } else {
      beep({ freq: 120, dur: 0.25, type: 'sawtooth' }); triggerHaptic('error');
      scoreRef.current = Math.max(0, scoreRef.current - 15); setScore(scoreRef.current);
      seqRef.current = []; setSeq([]); setRound(0);
      setTimeout(nextRound, 700);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="ROUND" v={round} c="#00f5ff" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.25em', margin: 0 }}>{stage === 'show' ? 'MEMORIZE' : 'REPEAT'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, gap: 8, padding: 12, background: 'radial-gradient(ellipse at top,#042020,#02010a)', borderRadius: 14, border: '1px solid rgba(0,245,160,0.18)' }}>
        {Array.from({ length: N * N }, (_, i) => {
          const isOn = active === i;
          return (
            <button key={i} disabled={stage !== 'input'} onPointerDown={() => tap(i)} style={{ aspectRatio: '1', borderRadius: 12, border: `2px solid ${isOn ? '#00f5a0' : 'rgba(255,255,255,0.1)'}`, background: isOn ? 'radial-gradient(circle,#00f5a0,#00f5a022)' : 'rgba(255,255,255,0.03)', boxShadow: isOn ? '0 0 32px #00f5a0, inset 0 0 28px #00f5a0aa' : 'none', cursor: stage === 'input' ? 'pointer' : 'default', transition: 'all 0.1s' }} />
          );
        })}
      </div>
    </div>
  );
}
