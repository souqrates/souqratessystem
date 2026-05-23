import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'CODE STRIKE — A 4-digit code is hinted by colored pegs. Guess fast for more points. 90 seconds.';
const T = 90;

const genCode = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 6));

function feedback(code, guess) {
  let exact = 0, partial = 0;
  const c = [...code], g = [...guess];
  for (let i = 0; i < 4; i++) if (c[i] === g[i]) { exact++; c[i] = -1; g[i] = -2; }
  for (let i = 0; i < 4; i++) if (g[i] >= 0) { const j = c.indexOf(g[i]); if (j >= 0) { partial++; c[j] = -1; } }
  return { exact, partial };
}

const COLORS = ['#ff3355', '#00f5ff', '#ffcc00', '#00f5a0', '#ff66cc', '#a98cff'];

export default function CodeStrike({ phase, setPhase, onScoreUpdate }) {
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [solved, setSolved] = useState(0);
  const [code, setCode] = useState(genCode()); const [guess, setGuess] = useState([0, 0, 0, 0]);
  const [history, setHistory] = useState([]); const scoreRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);

  const fresh = () => { setCode(genCode()); setGuess([0, 0, 0, 0]); setHistory([]); startRef.current = Date.now(); };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setSolved(0); activeRef.current = true; fresh();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const cycle = (i) => {
    if (!activeRef.current) return;
    const g = [...guess]; g[i] = (g[i] + 1) % 6; setGuess(g);
    beep({ freq: 400 + g[i] * 60, dur: 0.05, type: 'triangle' }); triggerHaptic('light');
  };

  const submit = () => {
    if (!activeRef.current) return;
    const fb = feedback(code, guess); const h = [...history, { g: guess, fb }]; setHistory(h);
    if (fb.exact === 4) {
      const dt = (Date.now() - startRef.current) / 1000;
      const speed = Math.max(0, Math.floor((20 - dt) * 5));
      const pts = 100 + speed + Math.max(0, (8 - h.length) * 15);
      scoreRef.current += pts; setScore(scoreRef.current); setSolved(v => v + 1); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 1200, dur: 0.25, type: 'triangle', sweepTo: 1600 }); triggerHaptic('medium');
      setTimeout(fresh, 600);
    } else {
      beep({ freq: 500, dur: 0.1, type: 'triangle' }); triggerHaptic('light');
      if (h.length >= 8) { scoreRef.current = Math.max(0, scoreRef.current - 15); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current); setTimeout(fresh, 400); }
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="SOLVED" v={solved} c="#ffcc00" /></HudRow>
      <div style={{ background: 'radial-gradient(ellipse at center,#04141a,#02010a)', borderRadius: 14, border: '1px solid rgba(0,245,160,0.2)', padding: 12, maxHeight: 220, overflowY: 'auto' }}>
        {history.length === 0 && <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em', margin: '20px 0' }}>NO GUESSES YET</p>}
        {history.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', gap: 4 }}>{h.g.map((c, j) => <div key={j} style={{ width: 22, height: 22, borderRadius: '50%', background: COLORS[c], boxShadow: `0 0 8px ${COLORS[c]}` }} />)}</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: h.fb.exact }).map((_, k) => <div key={`e${k}`} style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px #fff' }} />)}
              {Array.from({ length: h.fb.partial }).map((_, k) => <div key={`p${k}`} style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffcc00' }} />)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {guess.map((c, i) => <button key={i} onPointerDown={() => cycle(i)} style={{ width: 50, height: 50, borderRadius: '50%', background: COLORS[c], border: '2px solid #fff4', boxShadow: `0 0 12px ${COLORS[c]}` }} />)}
      </div>
      <button onPointerDown={submit} style={{ padding: 12, borderRadius: 12, border: '2px solid #00f5a0', background: 'linear-gradient(135deg,#00f5a022,#00f5a044)', color: '#fff', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: '0.3em' }}>STRIKE</button>
    </div>
  );
}
