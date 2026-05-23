import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'ECHO PULSE — Listen to the rhythm of 4 pads, then tap them back in order. 90 seconds.';
const T = 90;
const PADS = [
  { c: '#ff3355', f: 300 },
  { c: '#ffcc00', f: 420 },
  { c: '#00f5a0', f: 540 },
  { c: '#00f5ff', f: 700 },
];

export default function EchoPulse({ phase, setPhase, onScoreUpdate }) {
  const [seq, setSeq] = useState([]); const [show, setShow] = useState(-1); const [idx, setIdx] = useState(0);
  const [phase2, setPhase2] = useState('preview');
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [round, setRound] = useState(1);
  const scoreRef = useRef(0); const activeRef = useRef(false);

  const start = (r) => {
    const len = Math.min(9, 3 + Math.floor(r / 2));
    const s = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    setSeq(s); setIdx(0); setPhase2('preview');
    let k = 0;
    const tick = () => {
      if (!activeRef.current) return;
      setShow(s[k]); beep({ freq: PADS[s[k]].f, dur: 0.2, type: 'triangle' });
      setTimeout(() => setShow(-1), 300);
      k++;
      if (k < s.length) setTimeout(tick, 500);
      else setTimeout(() => setPhase2('input'), 600);
    };
    tick();
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setRound(1); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    start(1);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (i) => {
    if (!activeRef.current || phase2 !== 'input') return;
    setShow(i); setTimeout(() => setShow(-1), 150);
    if (i === seq[idx]) {
      const ni = idx + 1; setIdx(ni); beep({ freq: PADS[i].f, dur: 0.12, type: 'triangle' }); triggerHaptic('light');
      if (ni >= seq.length) {
        const pts = 50 + round * 20; scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 1100, dur: 0.25, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
        const nr = round + 1; setRound(nr); setTimeout(() => start(nr), 600);
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 15); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 140, dur: 0.2, type: 'sawtooth' }); triggerHaptic('error');
      setTimeout(() => start(round), 400);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5ff" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="ROUND" v={round} c="#ffcc00" /></HudRow>
      <div style={{ background: 'radial-gradient(ellipse at center,#04141a,#02010a)', borderRadius: 14, border: '1px solid rgba(0,245,255,0.2)', padding: 18 }}>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0, textAlign: 'center', marginBottom: 14 }}>{phase2 === 'preview' ? 'LISTEN' : 'REPEAT'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PADS.map((p, i) => (
            <button key={i} disabled={phase2 !== 'input'} onPointerDown={() => tap(i)} style={{ aspectRatio: '1', borderRadius: 16, border: `3px solid ${p.c}`, background: show === i ? p.c : `${p.c}22`, boxShadow: show === i ? `0 0 32px ${p.c}` : `0 0 12px ${p.c}55`, transition: 'all 0.1s', cursor: phase2 === 'input' ? 'pointer' : 'default' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
