import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'WHACK MOLE — Smash moles when they pop up! Correct hit = +20 pts + combo bonus. Bomb hit = -25 pts. Reach the target score and hold it until time runs out to win! 45 seconds.';
const T = 45, ROWS = 3, COLS = 3;

export default function WhackMole({ phase, setPhase, onScoreUpdate, game }) {
  const TARGET = game?.targetScore || 300;
  const [holes, setHoles] = useState(Array(ROWS * COLS).fill(null));
  const [score, setScore] = useState(0); const [time, setTime] = useState(T); const [combo, setCombo] = useState(0);
  const holesRef = useRef(Array(ROWS * COLS).fill(null));
  const scoreRef = useRef(0); const comboRef = useRef(0); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; holesRef.current = Array(ROWS * COLS).fill(null);
    setHoles([...holesRef.current]); setScore(0); setCombo(0); setTime(T); activeRef.current = true;
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); clearInterval(spawn); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase(scoreRef.current >= TARGET ? 'won' : 'lost'), 300); return 0; }
      return t - 1;
    }), 1000);
    const spawn = setInterval(() => {
      if (!activeRef.current) return;
      const empty = holesRef.current.map((v, i) => v ? -1 : i).filter(i => i >= 0);
      if (!empty.length) return;
      const idx = empty[Math.floor(Math.random() * empty.length)];
      const isBomb = Math.random() < 0.18;
      const expireT = 800 + Math.random() * 700;
      holesRef.current[idx] = { type: isBomb ? 'bomb' : 'mole', born: Date.now(), life: expireT };
      setHoles([...holesRef.current]);
      setTimeout(() => {
        if (holesRef.current[idx] && holesRef.current[idx].born + expireT <= Date.now() + 5) {
          if (holesRef.current[idx].type === 'mole') { comboRef.current = 0; setCombo(0); }
          holesRef.current[idx] = null; setHoles([...holesRef.current]);
        }
      }, expireT + 10);
    }, 350);
    return () => { clearInterval(iv); clearInterval(spawn); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const tap = (i) => {
    if (!activeRef.current) return;
    const h = holesRef.current[i]; if (!h) return;
    if (h.type === 'mole') {
      comboRef.current += 1; const pts = 20 + comboRef.current * 3;
      scoreRef.current += pts; setScore(scoreRef.current); setCombo(comboRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 600 + comboRef.current * 30, dur: 0.07, type: 'triangle' }); triggerHaptic('light');
    } else {
      comboRef.current = 0; setCombo(0);
      scoreRef.current = Math.max(0, scoreRef.current - 25); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 90, dur: 0.3, type: 'sawtooth' }); triggerHaptic('error');
    }
    holesRef.current[i] = null; setHoles([...holesRef.current]);
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="COMBO" v={`x${combo}`} c="#00f5a0" /></HudRow>
      <TimeBar totalTime={T} timeLeft={time} />
      <TargetBar score={score} target={TARGET} label="TARGET" />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gap: 8, padding: 12, background: 'radial-gradient(ellipse at top,#1a0e02,#02010a)', borderRadius: 14, border: '1px solid rgba(255,204,0,0.18)' }}>
        {holes.map((h, i) => (
          <button key={i} onPointerDown={() => tap(i)} style={{ aspectRatio: '1', borderRadius: 999, border: '2px solid rgba(255,255,255,0.08)', background: 'radial-gradient(circle at center,#1a0c00,#000)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            {h && <div style={{ position: 'absolute', inset: 8, borderRadius: 999, background: h.type === 'mole' ? 'radial-gradient(circle,#a86b3a,#5a3010)' : 'radial-gradient(circle,#ff3355,#5a0a14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, animation: 'mole-pop 0.15s ease-out' }}>{h.type === 'mole' ? '🦔' : '💣'}</div>}
          </button>
        ))}
      </div>
      <style>{`@keyframes mole-pop { 0%{transform:scale(0.4);} 100%{transform:scale(1);} }`}</style>
    </div>
  );
}
