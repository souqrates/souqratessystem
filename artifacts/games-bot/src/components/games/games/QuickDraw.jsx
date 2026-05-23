import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'QUICK DRAW — Wait for the GO. Tap as fast as possible. Tap too early = penalty. 10 rounds.';

export default function QuickDraw({ phase, setPhase, onScoreUpdate }) {
  const [stage, setStage] = useState('wait');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState(null);
  const startRef = useRef(0); const scoreRef = useRef(0); const roundRef = useRef(0); const activeRef = useRef(false); const toRef = useRef(null);

  const next = () => {
    if (!activeRef.current) return;
    if (roundRef.current >= 10) {
      onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 400); return;
    }
    setStage('wait'); setLast(null);
    toRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      setStage('go'); startRef.current = performance.now();
      beep({ freq: 900, dur: 0.18, type: 'triangle' });
    }, 900 + Math.random() * 2500);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; roundRef.current = 0; setScore(0); setRound(0); activeRef.current = true;
    next();
    return () => { activeRef.current = false; clearTimeout(toRef.current); };
    // eslint-disable-next-line
  }, [phase]);

  const tap = () => {
    if (!activeRef.current) return;
    if (stage === 'wait') {
      clearTimeout(toRef.current);
      setStage('foul'); setLast({ t: 'foul' });
      scoreRef.current = Math.max(0, scoreRef.current - 50); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 120, dur: 0.3, type: 'sawtooth' }); triggerHaptic('error');
      setTimeout(() => { roundRef.current += 1; setRound(roundRef.current); next(); }, 900);
    } else if (stage === 'go') {
      const dt = performance.now() - startRef.current;
      const pts = Math.max(0, Math.floor(500 - dt));
      scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      setStage('done'); setLast({ t: 'hit', ms: Math.round(dt), pts });
      beep({ freq: 1000, dur: 0.18, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
      setTimeout(() => { roundRef.current += 1; setRound(roundRef.current); next(); }, 900);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  const bg = stage === 'go' ? 'radial-gradient(circle,#00f5a0,#0a3a20)' : stage === 'foul' ? 'radial-gradient(circle,#ff3355,#3a0a10)' : 'radial-gradient(circle,#1a0e02,#02010a)';
  const lbl = stage === 'wait' ? 'WAIT...' : stage === 'go' ? 'TAP!' : stage === 'foul' ? 'TOO EARLY' : last?.t === 'hit' ? `${last.ms} ms` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="ROUND" v={`${round}/10`} c="#fff" /><Hud label="LAST" v={last?.t === 'hit' ? `${last.ms}ms` : '—'} c="#ffcc00" /></HudRow>
      <button onPointerDown={tap} style={{ minHeight: 360, borderRadius: 18, border: '2px solid rgba(255,255,255,0.08)', background: bg, color: '#fff', fontWeight: 900, fontFamily: 'Orbitron', fontSize: 38, cursor: 'pointer', userSelect: 'none' }}>{lbl}</button>
      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.25em', margin: 0 }}>WAIT FOR GREEN</p>
    </div>
  );
}
