import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'NUMBER TOWER — Three numbers appear. The prompt randomly asks for the LARGEST or SMALLEST. Tap fast and watch the prompt carefully. 45 seconds — total accumulated value wins.';
const T = 45;

export default function NumberTower({ phase, setPhase, onScoreUpdate }) {
  const [opts, setOpts] = useState([1, 2, 3]);
  const [mode, setMode] = useState('LARGEST'); // 'LARGEST' | 'SMALLEST'
  const [tower, setTower] = useState([]);
  const [score, setScore] = useState(0); const [time, setTime] = useState(T);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);
  const [tappedIdx, setTappedIdx] = useState(null);
  const scoreRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);
  const modeRef = useRef('LARGEST');

  const round = () => {
    const range = 9 + Math.floor(scoreRef.current / 25);
    const pick = () => 1 + Math.floor(Math.random() * range);
    let a, b, c;
    // Ensure no two are equal to avoid ambiguity
    do { a = pick(); b = pick(); c = pick(); } while (a === b || b === c || a === c);
    setOpts([a, b, c]);
    const nextMode = Math.random() < 0.5 ? 'LARGEST' : 'SMALLEST';
    modeRef.current = nextMode;
    setMode(nextMode);
    startRef.current = Date.now();
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(T); setTower([]); activeRef.current = true;
    round();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (v, idx) => {
    if (!activeRef.current) return;
    const target = modeRef.current === 'LARGEST' ? Math.max(...opts) : Math.min(...opts);
    setTappedIdx(idx);
    setTimeout(() => setTappedIdx(null), 180);
    if (v === target) {
      const dt = (Date.now() - startRef.current) / 1000;
      const speed = Math.max(0, Math.floor((2 - dt) * 5));
      const pts = v + speed;
      scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      setTower(t => [v, ...t].slice(0, 8));
      setFlash({ id: Math.random(), good: true, pts });
      setTimeout(() => setFlash(null), 360);
      chord([520, 780, 1040], 0.12, 0.14, 'triangle');
      triggerHaptic('medium');
    } else {
      const penalty = 3;
      scoreRef.current = Math.max(0, scoreRef.current - penalty); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      setFlash({ id: Math.random(), good: false, pts: -penalty });
      setShake(true);
      setTimeout(() => setShake(false), 220);
      setTimeout(() => setFlash(null), 360);
      beep({ freq: 180, dur: 0.18, type: 'sawtooth', sweepTo: 80, vol: 0.2 });
      triggerHaptic('error');
    }
    round();
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  const modeColor = mode === 'LARGEST' ? '#ffcc00' : '#00d4ff';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', transform: shake ? 'translate(2px,-1px)' : 'none', transition: 'transform 0.05s' }}>
      <HudRow><Hud label="TOTAL" v={score} c="#ffcc00" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="BLOCKS" v={tower.length} c="#00f5ff" /></HudRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-end', height: 200, padding: 6, background: 'linear-gradient(180deg,#1a0e02,#02010a)', borderRadius: 14, border: '1px solid rgba(255,204,0,0.2)' }}>
        {tower.slice().reverse().map((v, i) => (
          <div key={i} style={{ width: 32, height: 18 + v * 6, background: `linear-gradient(180deg,#ffcc00,#ff8800)`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900, fontFamily: 'Orbitron', fontSize: 13, boxShadow: '0 0 12px #ffcc0055' }}>{v}</div>
        ))}
      </div>
      <div style={{
        textAlign: 'center', padding: '14px 10px', borderRadius: 14,
        background: `linear-gradient(180deg, ${modeColor}22, ${modeColor}06)`,
        border: `2px solid ${modeColor}aa`,
        boxShadow: `0 0 24px ${modeColor}33, inset 0 0 18px ${modeColor}18`,
        transition: 'all 0.2s',
      }}>
        <p style={{ fontSize: 9, color: 'rgba(148,163,184,0.7)', letterSpacing: '0.3em', margin: 0, fontFamily: 'Orbitron, sans-serif' }}>TAP THE</p>
        <p style={{
          fontSize: 26, color: modeColor, margin: '4px 0 0', fontWeight: 900,
          fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.18em',
          textShadow: `0 0 16px ${modeColor}, 0 0 32px ${modeColor}88`,
        }}>{mode}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {opts.map((v, i) => (
          <button key={`${mode}-${i}`} onPointerDown={() => tap(v, i)} style={{ padding: '32px 0', borderRadius: 14, border: `2px solid ${modeColor}`, background: `linear-gradient(135deg,${modeColor}22,${modeColor}08)`, color: '#fff', fontSize: 36, fontWeight: 900, fontFamily: 'Orbitron', cursor: 'pointer', boxShadow: tappedIdx === i ? `0 0 30px ${modeColor}, inset 0 0 20px ${modeColor}66` : `0 0 14px ${modeColor}44`, textShadow: `0 0 14px ${modeColor}88`, transform: tappedIdx === i ? 'scale(0.97)' : 'scale(1)', transition: 'transform 0.1s, box-shadow 0.1s' }}>{v}</button>
        ))}
      </div>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0, scale: 0.6, y: 0 }}
            animate={{ opacity: 1, scale: 1.1, y: -20 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 28, pointerEvents: 'none',
              color: flash.good ? '#ffcc00' : '#ff3355',
              textShadow: `0 0 20px ${flash.good ? '#ffcc00' : '#ff3355'}`, zIndex: 10,
            }}
          >
            {flash.good ? `+${flash.pts}` : `${flash.pts}`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
