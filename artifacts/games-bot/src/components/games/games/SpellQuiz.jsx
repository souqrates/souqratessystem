import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'SPELL QUIZ — A word is shown. Tap letters in correct order. Correct word = +50 pts + speed bonus. Wrong letter = -5 pts. Reach the target score and hold it until time runs out to win! 60 seconds.';
const WORDS = ['NEON', 'PIXEL', 'PULSE', 'ARENA', 'BLITZ', 'NOVA', 'QUEST', 'FORGE', 'COSMIC', 'STAR', 'CHAMP', 'GOLD'];

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

function newQuiz() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  let letters = word.split('');
  while (letters.length < 7) letters.push(String.fromCharCode(65 + Math.floor(Math.random() * 26)));
  return { word, letters: shuffle(letters) };
}

export default function SpellQuiz({ phase, setPhase, onScoreUpdate, game }) {
  const TARGET = game?.targetScore || 400;
  const [quiz, setQuiz] = useState(newQuiz());
  const [used, setUsed] = useState([]); const [prog, setProg] = useState(0);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [solved, setSolved] = useState(0);
  const scoreRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);

  const fresh = () => { setQuiz(newQuiz()); setUsed([]); setProg(0); startRef.current = Date.now(); };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(60); setSolved(0); activeRef.current = true; fresh();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase(scoreRef.current >= TARGET ? 'won' : 'lost'), 300); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const tap = (i, l) => {
    if (!activeRef.current || used.includes(i)) return;
    if (l === quiz.word[prog]) {
      setUsed(u => [...u, i]); const np = prog + 1; setProg(np);
      beep({ freq: 500 + np * 50, dur: 0.06, type: 'triangle' }); triggerHaptic('light');
      if (np >= quiz.word.length) {
        const dt = (Date.now() - startRef.current) / 1000;
        const speed = Math.max(0, Math.floor((6 - dt) * 12));
        const pts = 50 + quiz.word.length * 6 + speed;
        scoreRef.current += pts; setScore(scoreRef.current); setSolved(v => v + 1); onScoreUpdate?.(scoreRef.current);
        beep({ freq: 1000, dur: 0.2, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
        setTimeout(fresh, 500);
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 5); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow><Hud label="SCORE" v={score} c="#00f5a0" /><Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} /><Hud label="SOLVED" v={solved} c="#ffcc00" /></HudRow>
      <TimeBar totalTime={60} timeLeft={time} />
      <TargetBar score={score} target={TARGET} label="TARGET" />
      <div style={{ background: 'radial-gradient(ellipse at center,#04141a,#02010a)', borderRadius: 14, border: '1px solid rgba(0,245,160,0.2)', padding: 14 }}>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3em', margin: 0, textAlign: 'center' }}>SPELL</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '12px 0' }}>
          {quiz.word.split('').map((l, i) => (
            <div key={i} style={{ width: 34, height: 44, borderRadius: 8, background: i < prog ? '#00f5a044' : 'rgba(255,255,255,0.04)', border: `2px solid ${i === prog ? '#ffcc00' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontFamily: 'Orbitron', fontSize: 18 }}>{i < prog ? l : '_'}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {quiz.letters.map((l, i) => {
            const dis = used.includes(i);
            return <button key={i} disabled={dis} onPointerDown={() => tap(i, l)} style={{ padding: '14px 0', borderRadius: 10, border: '2px solid #00f5a0', background: dis ? '#00f5a015' : '#00f5a022', color: '#fff', fontWeight: 900, fontFamily: 'Orbitron', fontSize: 18, cursor: dis ? 'default' : 'pointer', boxShadow: dis ? 'none' : '0 0 12px #00f5a055', opacity: dis ? 0.35 : 1 }}>{l}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
