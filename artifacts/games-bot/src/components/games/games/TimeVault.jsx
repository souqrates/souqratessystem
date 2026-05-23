import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'TIME VAULT — Solve a math/logic puzzle before the vault timer expires. 90 seconds total.';
const T = 90;

function genPuzzle() {
  const type = Math.floor(Math.random() * 3);
  if (type === 0) {
    const a = 2 + Math.floor(Math.random() * 30), b = 2 + Math.floor(Math.random() * 30);
    const ans = a + b; const opts = [ans, ans + 1, ans - 2, ans + 4 + Math.floor(Math.random() * 5)].sort(() => Math.random() - 0.5);
    return { q: `${a} + ${b}`, ans, opts };
  }
  if (type === 1) {
    const a = 5 + Math.floor(Math.random() * 11), b = 2 + Math.floor(Math.random() * 9);
    const ans = a * b; const opts = [ans, ans + b, ans - a, ans + 2 * b].sort(() => Math.random() - 0.5);
    return { q: `${a} x ${b}`, ans, opts };
  }
  const seq = []; const start = Math.floor(Math.random() * 8) + 1; const step = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < 4; i++) seq.push(start + i * step);
  const ans = seq[3] + step; const opts = [ans, ans + 1, ans - step, ans + step].sort(() => Math.random() - 0.5);
  return { q: `${seq[0]}, ${seq[1]}, ${seq[2]}, ?`, ans, opts };
}

export default function TimeVault({ phase, setPhase, onScoreUpdate }) {
  const [puzzle, setPuzzle] = useState(genPuzzle());
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [solved, setSolved] = useState(0);
  const [vault, setVault] = useState(8);
  const scoreRef = useRef(0); const activeRef = useRef(false); const vaultRef = useRef(null);

  const fresh = () => { setPuzzle(genPuzzle()); setVault(8); };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setSolved(0); activeRef.current = true; fresh();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    vaultRef.current = setInterval(() => setVault(v => {
      if (v <= 1) {
        scoreRef.current = Math.max(0, scoreRef.current - 15); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 140, dur: 0.25, type: 'sawtooth' }); triggerHaptic('error');
        fresh(); return 8;
      }
      return v - 1;
    }), 1000);
    return () => { clearInterval(iv); clearInterval(vaultRef.current); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (n) => {
    if (!activeRef.current) return;
    if (n === puzzle.ans) {
      const pts = 50 + vault * 8; scoreRef.current += pts; setScore(scoreRef.current); setSolved(v => v + 1); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 1100, dur: 0.22, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
      fresh();
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 10); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
      setVault(v => Math.max(1, v - 2));
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="SOLVED" v={solved} c="#00f5a0" /></HudRow>
      <div style={{ background: 'radial-gradient(ellipse at center,#1a1004,#04030a)', borderRadius: 14, border: '2px solid #ffcc00', boxShadow: '0 0 24px #ffcc0055', padding: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,204,0,0.7)', letterSpacing: '0.4em', margin: 0 }}>VAULT TIMER</p>
        <p style={{ fontSize: 48, fontWeight: 900, color: vault <= 3 ? '#ff3355' : '#ffcc00', fontFamily: 'Orbitron', textShadow: `0 0 24px ${vault <= 3 ? '#ff3355' : '#ffcc00'}`, margin: '4px 0' }}>{vault}</p>
        <div style={{ height: 6, background: 'rgba(255,204,0,0.1)', borderRadius: 3, overflow: 'hidden', margin: '8px 0' }}>
          <div style={{ width: `${(vault / 8) * 100}%`, height: '100%', background: vault <= 3 ? '#ff3355' : '#ffcc00', boxShadow: `0 0 12px ${vault <= 3 ? '#ff3355' : '#ffcc00'}`, transition: 'width 0.8s linear' }} />
        </div>
        <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', fontFamily: 'Orbitron', textShadow: '0 0 16px #fff', margin: '16px 0 8px' }}>{puzzle.q}</p>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0 }}>= ?</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {puzzle.opts.map((o, i) => (
          <button key={i} onPointerDown={() => tap(o)} style={{ padding: '18px 0', borderRadius: 12, border: '2px solid #ffcc00', background: 'linear-gradient(135deg,#ffcc0022,#ffcc0044)', color: '#fff', fontSize: 22, fontWeight: 900, fontFamily: 'Orbitron', boxShadow: '0 0 12px #ffcc0044' }}>{o}</button>
        ))}
      </div>
    </div>
  );
}
