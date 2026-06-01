import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'LANE SPRINT — Rapid-tap the GO pad. Each tap moves you forward. Highest distance in 30 seconds wins.';
const T = 30;

export default function LaneSprint({ phase, setPhase, onScoreUpdate }) {
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [pulse, setPulse] = useState(0);
  const scoreRef = useRef(0); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const tap = () => {
    if (!activeRef.current) return;
    scoreRef.current += 1; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
    setPulse(p => p + 1);
    if (scoreRef.current % 5 === 0) { beep({ freq: 600, dur: 0.04, vol: 0.1 }); triggerHaptic('light'); }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  const progress = Math.min(100, scoreRef.current / 1.5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <HudRow><Hud label="TAPS" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 5 ? '#ff3355' : '#fff'} /><Hud label="SPEED" v={`${Math.round(scoreRef.current / Math.max(1, T - time))}/s`} c="#ffcc00" /></HudRow>
      <div style={{ background: 'linear-gradient(180deg,#062018,#020108)', borderRadius: 14, padding: 16, border: '1px solid rgba(0,245,160,0.2)' }}>
        <div style={{ height: 18, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#00f5a0,#ffcc00)', boxShadow: '0 0 18px #00f5a0', transition: 'width 0.08s' }} />
          <div style={{ position: 'absolute', top: 0, left: `${progress}%`, transform: 'translate(-50%,-4px)', width: 14, height: 14, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(148,163,184,0.6)', marginTop: 6, fontFamily: 'Orbitron' }}><span>START</span><span>FINISH</span></div>
      </div>
      <button onPointerDown={tap} style={{ padding: '60px 0', borderRadius: 18, border: '3px solid #00f5a0', background: `radial-gradient(circle, #00f5a0${30 + (pulse % 2) * 15}, #00f5a008)`, color: '#fff', fontSize: 38, fontWeight: 900, fontFamily: 'Orbitron', cursor: 'pointer', boxShadow: '0 0 30px #00f5a055, inset 0 0 30px #00f5a022', userSelect: 'none' }}>SPRINT</button>
    </div>
  );
}
