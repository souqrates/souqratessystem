import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { TargetBar } from './_shell';

const RULES = 'RUNE FORGE — A rune pattern shows briefly. Trace the dots in the same order without lifting. 60 seconds — perfect tracings forge stars.';
const W = 320, H = 360;

function genRune(steps) {
  const dots = []; const cols = 4, rows = 5;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push({ id: r * cols + c, x: 40 + c * 80, y: 30 + r * 70 });
  const path = []; const used = new Set();
  let cur = dots[Math.floor(Math.random() * dots.length)]; path.push(cur.id); used.add(cur.id);
  for (let i = 1; i < steps; i++) {
    const opts = dots.filter(d => !used.has(d.id));
    opts.sort(() => Math.random() - 0.5);
    cur = opts[0]; path.push(cur.id); used.add(cur.id);
  }
  return { dots, path };
}

export default function RuneForge({ phase, setPhase, onScoreUpdate, game }) {
  const TARGET_SCORE = game?.targetScore || 200;
  const SCORE_PENALTY = game?.scorePenalty || 30;
  const [rune, setRune] = useState(() => genRune(4));
  const [stage, setStage] = useState('show');
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60);
  const scoreRef = useRef(0); const stepsRef = useRef(4); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; stepsRef.current = 4; setScore(0); setTime(60); activeRef.current = true;
    const r = genRune(4); setRune(r); setProgress(0); setStage('show');
    const t0 = setTimeout(() => setStage('input'), 2000);
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); clearTimeout(t0); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const next = () => {
    stepsRef.current = Math.min(8, stepsRef.current + 1);
    const r = genRune(stepsRef.current);
    setRune(r); setProgress(0); setStage('show');
    setTimeout(() => activeRef.current && setStage('input'), 1500 + stepsRef.current * 150);
  };

  const tap = (id) => {
    if (stage !== 'input' || !activeRef.current) return;
    if (rune.path[progress] === id) {
      const np = progress + 1; setProgress(np);
      beep({ freq: 420 + np * 60, dur: 0.08, type: 'triangle' });
      triggerHaptic('light');
      if (np >= rune.path.length) {
        const pts = 50 + rune.path.length * 8;
        scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 800, dur: 0.2, type: 'triangle', sweepTo: 1400 });
        triggerHaptic('medium');
        setTimeout(next, 500);
      }
    } else {
      beep({ freq: 140, dur: 0.2, type: 'sawtooth', sweepTo: 60 });
      triggerHaptic('error');
      scoreRef.current = Math.max(0, scoreRef.current - SCORE_PENALTY);
      setScore(scoreRef.current);
      onScoreUpdate?.(scoreRef.current);
      setProgress(0);
    }
  };

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  const showPath = stage === 'show';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Hud label="SCORE" v={score} c="#ffcc00" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="LEVEL" v={stepsRef.current - 3} c="#ff66cc" />
      </div>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <div style={{ background: 'radial-gradient(ellipse at center, #1a0820 0%, #02010a 100%)', borderRadius: 14, border: '1px solid rgba(255,204,0,0.15)', padding: 12 }}>
        <p style={{ textAlign: 'center', fontSize: 11, color: showPath ? '#ffcc00' : '#00f5ff', letterSpacing: '0.25em', margin: '0 0 8px' }}>{showPath ? 'MEMORIZE' : 'TRACE THE RUNE'}</p>
        <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
          {showPath && rune.path.length > 1 && rune.path.slice(0, -1).map((id, i) => {
            const a = rune.dots[id], b = rune.dots[rune.path[i + 1]];
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffcc00" strokeWidth="3" opacity="0.7" style={{ filter: 'drop-shadow(0 0 6px #ffcc00)' }} />;
          })}
          {!showPath && rune.path.slice(0, progress).map((id, i) => {
            if (i === 0) return null;
            const a = rune.dots[rune.path[i - 1]], b = rune.dots[id];
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#00f5ff" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 6px #00f5ff)' }} />;
          })}
          {rune.dots.map(d => {
            const inPath = rune.path.includes(d.id);
            const reached = stage === 'input' && rune.path.slice(0, progress).includes(d.id);
            const showOrder = showPath && inPath;
            return (
              <g key={d.id} onPointerDown={() => tap(d.id)} style={{ cursor: 'pointer' }}>
                <circle cx={d.x} cy={d.y} r="18" fill="rgba(255,255,255,0.04)" stroke={reached ? '#00f5ff' : showOrder ? '#ffcc00' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
                {showOrder && <text x={d.x} y={d.y + 5} textAnchor="middle" fill="#ffcc00" fontSize="14" fontWeight="900" fontFamily="Orbitron">{rune.path.indexOf(d.id) + 1}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
function Hud({ label, v, c }) {
  return <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
    <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
    <p style={{ fontSize: 18, fontWeight: 900, color: c, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${c}55` }}>{v}</p>
  </div>;
}
