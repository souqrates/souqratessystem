import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'BRIDGE BUILDER — Hold to grow a beam from one platform to the next. Release at the right length. Too short = fall. 45 seconds.';
const W = 320, H = 360, T = 45;

export default function BridgeBuilder({ phase, setPhase, onScoreUpdate }) {
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [crossed, setCrossed] = useState(0);
  const [beamLen, setBeamLen] = useState(0); const [stage, setStage] = useState('idle');
  const [px, setPx] = useState(40); const [next, setNext] = useState(200); const [nw, setNw] = useState(60);
  const holdRef = useRef(null); const beamRef = useRef(0); const scoreRef = useRef(0); const activeRef = useRef(false);

  const newGap = (pxv) => {
    const gap = 80 + Math.random() * 100;
    const newNext = Math.min(W - 80, pxv + gap);
    const wid = 40 + Math.random() * 50;
    setNext(newNext); setNw(wid);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setCrossed(0); setTime(T); setBeamLen(0); beamRef.current = 0;
    setStage('idle'); setPx(40); newGap(40); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; clearInterval(holdRef.current); };
    // eslint-disable-next-line
  }, [phase]);

  const start = () => {
    if (!activeRef.current || stage !== 'idle') return;
    setStage('hold'); beamRef.current = 0; setBeamLen(0);
    beep({ freq: 200, dur: 0.04 });
    holdRef.current = setInterval(() => { beamRef.current += 3; setBeamLen(beamRef.current); }, 30);
  };

  const release = () => {
    if (stage !== 'hold') return;
    clearInterval(holdRef.current);
    setStage('drop');
    const tip = px + 30 + beamRef.current;
    const inGap = tip > next && tip < next + nw;
    setTimeout(() => {
      if (inGap) {
        const accuracy = 1 - Math.abs(tip - (next + nw / 2)) / (nw / 2);
        const pts = Math.floor(40 + accuracy * 60);
        scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        setCrossed(c => c + 1);
        beep({ freq: 700, dur: 0.18, type: 'triangle', sweepTo: 1100 }); triggerHaptic('medium');
        const newPx = next + nw / 2 - 30;
        setPx(newPx); newGap(newPx);
      } else {
        beep({ freq: 140, dur: 0.3, type: 'sawtooth', sweepTo: 50 }); triggerHaptic('error');
        scoreRef.current = Math.max(0, scoreRef.current - 5); setScore(scoreRef.current);
      }
      setBeamLen(0); beamRef.current = 0; setStage('idle');
    }, 500);
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="GAPS" v={crossed} c="#ffcc00" /></HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <div onPointerDown={start} onPointerUp={release} style={{ position: 'relative', height: H, background: 'linear-gradient(180deg,#0a1530,#04030a)', borderRadius: 14, border: '1px solid rgba(0,245,160,0.2)', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
        <div style={{ position: 'absolute', bottom: 60, left: px - 30, width: 60, height: 80, background: 'linear-gradient(180deg,#00f5a0,#0a4030)', borderRadius: 4 }} />
        <div style={{ position: 'absolute', bottom: 60, left: next, width: nw, height: 80, background: 'linear-gradient(180deg,#ffcc00,#403000)', borderRadius: 4 }} />
        {(stage === 'hold' || stage === 'drop') && (
          <div style={{ position: 'absolute', bottom: 138, left: px + 30, width: beamLen, height: 6, background: 'linear-gradient(90deg,#00f5ff,#fff)', boxShadow: '0 0 14px #00f5ff', transformOrigin: 'left bottom', transform: stage === 'drop' ? 'rotate(90deg)' : 'rotate(0deg)', transition: stage === 'drop' ? 'transform 0.4s ease-in' : 'none' }} />
        )}
        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', color: 'rgba(148,163,184,0.7)', fontSize: 11, letterSpacing: '0.25em', fontFamily: 'Orbitron' }}>{stage === 'idle' ? 'HOLD TO BUILD' : stage === 'hold' ? 'RELEASE NOW' : '...'}</div>
      </div>
    </div>
  );
}
