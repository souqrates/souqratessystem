import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'BOMB DEFUSE — A clue tells you which wire color to cut. Cut the correct wire fast. Wrong wire = penalty. 60 seconds.';
const COLORS = [{ c: '#ff3355', n: 'RED' }, { c: '#ffcc00', n: 'YELLOW' }, { c: '#00f5a0', n: 'GREEN' }, { c: '#00f5ff', n: 'CYAN' }, { c: '#ff66cc', n: 'PINK' }];

function genBomb() {
  const wires = [...COLORS].sort(() => Math.random() - 0.5);
  const target = wires[Math.floor(Math.random() * wires.length)];
  return { wires, target };
}

export default function BombDefuse({ phase, setPhase, onScoreUpdate }) {
  const [bomb, setBomb] = useState(genBomb());
  const [badCuts, setBadCuts] = useState([]);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [defused, setDefused] = useState(0);
  const scoreRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);

  const newBomb = () => { setBomb(genBomb()); setBadCuts([]); startRef.current = Date.now(); };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(60); setDefused(0); activeRef.current = true; newBomb();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const onCut = (color) => {
    if (!activeRef.current || badCuts.includes(color.n)) return;
    if (color.n === bomb.target.n) {
      const dt = (Date.now() - startRef.current) / 1000;
      const speed = Math.max(0, Math.floor((4 - dt) * 25));
      const pts = 60 + speed;
      scoreRef.current += pts; setScore(scoreRef.current); setDefused(d => d + 1); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 1000, dur: 0.22, type: 'triangle', sweepTo: 1500 }); triggerHaptic('medium');
      setTimeout(newBomb, 400);
    } else {
      setBadCuts(c => [...c, color.n]);
      scoreRef.current = Math.max(0, scoreRef.current - 12); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 120, dur: 0.25, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ff3355" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="DEFUSED" v={defused} c="#00f5a0" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <div style={{ background: 'radial-gradient(ellipse at center, #1a0814 0%, #02010a 100%)', borderRadius: 14, border: '1px solid rgba(255,51,85,0.2)', padding: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0 }}>CUT THE</p>
        <p style={{ fontSize: 36, fontFamily: 'Orbitron', fontWeight: 900, color: bomb.target.c, margin: '6px 0 14px', textShadow: `0 0 24px ${bomb.target.c}` }}>{bomb.target.n}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 12 }}>
          {bomb.wires.map(w => {
            const isCut = badCuts.includes(w.n);
            return (
              <div key={w.n} onPointerDown={() => onCut(w)} style={{ height: 28, display: 'flex', alignItems: 'center', cursor: isCut ? 'default' : 'pointer', opacity: isCut ? 0.4 : 1 }}>
                <div style={{ flex: 1, height: 8, background: w.c, borderRadius: 4, boxShadow: `0 0 16px ${w.c}55`, position: 'relative' }}>
                  {isCut && <div style={{ position: 'absolute', left: '40%', width: 24, height: 24, top: -8, background: '#000', transform: 'rotate(45deg)' }} />}
                </div>
                <span style={{ marginLeft: 12, color: w.c, fontFamily: 'Orbitron', fontWeight: 900, fontSize: 13, minWidth: 60 }}>{w.n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
