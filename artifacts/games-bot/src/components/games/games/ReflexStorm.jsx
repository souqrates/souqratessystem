import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar } from './_shell';

const RULES = 'REFLEX STORM — Three input types fire fast: TAP red, HOLD yellow, SWIPE blue. Don\'t miss. 90 seconds.';
const T = 90;
const TYPES = [
  { k: 'tap', label: 'TAP', color: '#ff3355' },
  { k: 'hold', label: 'HOLD', color: '#ffcc00' },
  { k: 'swipe', label: 'SWIPE', color: '#00f5ff' },
];

export default function ReflexStorm({ phase, setPhase, onScoreUpdate }) {
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [combo, setCombo] = useState(0);
  const [cmd, setCmd] = useState(null); const [progress, setProgress] = useState(0);
  const scoreRef = useRef(0); const comboRef = useRef(0); const activeRef = useRef(false);
  const startRef = useRef(0); const holdRef = useRef(0); const swipeRef = useRef(null); const cmdRef = useRef(null);

  const newCmd = () => {
    const t = TYPES[Math.floor(Math.random() * TYPES.length)];
    cmdRef.current = t; setCmd(t); setProgress(0); startRef.current = Date.now();
    beep({ freq: 600, dur: 0.05 });
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; setScore(0); setCombo(0); setTime(T); activeRef.current = true; newCmd();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    const timeoutCheck = setInterval(() => {
      if (!activeRef.current || !cmdRef.current) return;
      const dt = (Date.now() - startRef.current) / 1000;
      const limit = cmdRef.current.k === 'hold' ? 3 : 1.5;
      if (dt > limit) { fail(); }
    }, 100);
    return () => { clearInterval(iv); clearInterval(timeoutCheck); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const success = () => {
    const dt = (Date.now() - startRef.current) / 1000;
    const speed = Math.max(0, Math.floor((1.2 - dt) * 30));
    comboRef.current += 1; const pts = 30 + speed + comboRef.current * 4;
    scoreRef.current += pts; setScore(scoreRef.current); setCombo(comboRef.current); onScoreUpdate?.(scoreRef.current);
    beep({ freq: 800 + comboRef.current * 30, dur: 0.1, type: 'triangle', sweepTo: 1200 }); triggerHaptic('medium');
    newCmd();
  };
  const fail = () => {
    comboRef.current = 0; setCombo(0);
    scoreRef.current = Math.max(0, scoreRef.current - 15); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
    beep({ freq: 140, dur: 0.2, type: 'sawtooth' }); triggerHaptic('error');
    newCmd();
  };

  const down = (e) => {
    if (!activeRef.current || !cmdRef.current) return;
    if (cmdRef.current.k === 'tap') success();
    else if (cmdRef.current.k === 'hold') {
      const start = Date.now();
      holdRef.current = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / 800); setProgress(p);
        if (p >= 1) { clearInterval(holdRef.current); success(); }
      }, 30);
    } else if (cmdRef.current.k === 'swipe') {
      const t = e.touches?.[0] ?? e; swipeRef.current = { x: t.clientX, y: t.clientY };
    }
  };
  const up = (e) => {
    if (!activeRef.current || !cmdRef.current) return;
    if (cmdRef.current.k === 'hold' && holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; fail(); setProgress(0); }
    if (cmdRef.current.k === 'swipe' && swipeRef.current) {
      const t = e.changedTouches?.[0] ?? e; const dx = t.clientX - swipeRef.current.x; const dy = t.clientY - swipeRef.current.y;
      if (Math.hypot(dx, dy) > 50) success(); else fail();
      swipeRef.current = null;
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#ff66cc" /></HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <div onPointerDown={down} onPointerUp={up} onPointerCancel={up}
        style={{ height: 380, borderRadius: 14, border: `3px solid ${cmd?.color || '#fff'}`, background: `radial-gradient(ellipse at center, ${cmd?.color || '#fff'}22, #02010a)`, boxShadow: `0 0 32px ${cmd?.color || '#fff'}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, touchAction: 'none', userSelect: 'none', transition: 'all 0.2s' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5em', margin: 0 }}>{cmd?.k === 'hold' ? 'HOLD STEADY' : cmd?.k === 'swipe' ? 'SWIPE FAST' : 'TAP NOW'}</p>
        <p style={{ fontSize: 64, fontWeight: 900, color: cmd?.color || '#fff', fontFamily: 'Orbitron', textShadow: `0 0 32px ${cmd?.color || '#fff'}`, margin: 0 }}>{cmd?.label}</p>
        {cmd?.k === 'hold' && (
          <div style={{ width: '60%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: '#ffcc00', boxShadow: '0 0 12px #ffcc00', transition: 'width 0.05s linear' }} />
          </div>
        )}
      </div>
    </div>
  );
}
