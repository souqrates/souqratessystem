import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { Hud, HudRow, Rules, TargetBar } from './_shell';

const RULES = 'CIPHER CRACK — Symbols map to letters. Tap the matching letter for each cipher glyph to decode the word. Faster solves = more points. Hit the TARGET in 60s to win.';
const SYMS = ['\u2620', '\u2625', '\u2627', '\u2630', '\u2643', '\u2646', '\u2648', '\u2649', '\u264C', '\u2651', '\u2655', '\u2658'];
const WORDS = ['CODE', 'CIPHER', 'SECRET', 'MATRIX', 'NEURAL', 'PULSE', 'QUANTUM', 'ORBIT', 'PIXEL', 'NOVA', 'COSMIC', 'BLITZ'];

const MAX_SCORE = 720;
const TARGET_SCORE = Math.round(MAX_SCORE * 2 / 3); // 480

function genPuzzle() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const letters = [...new Set(word.split(''))];
  const map = {}; const shuffled = [...SYMS].sort(() => Math.random() - 0.5);
  letters.forEach((l, i) => map[l] = shuffled[i]);
  return { word, map };
}

export default function CipherCrack({ phase, setPhase, onScoreUpdate }) {
  const [puzzle, setPuzzle] = useState(genPuzzle());
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [solved, setSolved] = useState(0);
  const [flash, setFlash] = useState(null);
  const scoreRef = useRef(0); const startRef = useRef(0); const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setTime(60); setSolved(0); activeRef.current = true;
    const p = genPuzzle(); setPuzzle(p); setProgress(0); startRef.current = Date.now();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) {
        activeRef.current = false; clearInterval(iv);
        onScoreUpdate?.(scoreRef.current);
        const won = scoreRef.current >= TARGET_SCORE;
        triggerHaptic(won ? 'heavy' : 'error');
        setTimeout(() => setPhase(won ? 'won' : 'lost'), 300);
        return 0;
      }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase, setPhase, onScoreUpdate]);

  const tap = (letter) => {
    if (!activeRef.current) return;
    if (puzzle.word[progress] === letter) {
      const np = progress + 1; setProgress(np);
      beep({ freq: 500 + np * 50, dur: 0.06, type: 'triangle' }); triggerHaptic('light');
      if (np >= puzzle.word.length) {
        const dt = (Date.now() - startRef.current) / 1000;
        const speed = Math.max(1, 10 - dt) * 10;
        const pts = 50 + puzzle.word.length * 8 + speed;
        scoreRef.current += pts; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        setSolved(s => s + 1); setFlash({ t: 'good', pts: Math.round(pts) });
        beep({ freq: 880, dur: 0.2, type: 'triangle', sweepTo: 1400 }); triggerHaptic('medium');
        setTimeout(() => setFlash(null), 600);
        setTimeout(() => { const np2 = genPuzzle(); setPuzzle(np2); setProgress(0); startRef.current = Date.now(); }, 700);
      }
    } else {
      beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
      setFlash({ t: 'bad' }); setTimeout(() => setFlash(null), 400);
      scoreRef.current = Math.max(0, scoreRef.current - 5); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  const alpha = [...new Set(puzzle.word.split(''))].sort();
  const currentSym = puzzle.map[puzzle.word[progress] || ''] || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5ff" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="SOLVED" v={solved} c="#ffcc00" />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} max={MAX_SCORE} label="TARGET TO WIN" />

      <div style={{
        background: 'radial-gradient(ellipse at top, #0a2a3a 0%, #050018 60%, #02010a 100%)',
        borderRadius: 18, border: '1px solid rgba(0,245,255,0.25)',
        padding: 18, position: 'relative',
        boxShadow: 'inset 0 0 40px rgba(0,245,255,0.08), 0 8px 30px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Decorative scanline */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(180deg, transparent 0, transparent 3px, rgba(0,245,255,0.025) 3px, rgba(0,245,255,0.025) 4px)',
        }} />

        <p style={{
          textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.7)',
          letterSpacing: '0.35em', margin: 0, fontFamily: 'Orbitron, sans-serif',
        }}>· DECODE ·</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '16px 0', flexWrap: 'wrap', position: 'relative' }}>
          {puzzle.word.split('').map((l, i) => {
            const done = i < progress;
            const active = i === progress;
            return (
              <div key={i} style={{
                width: 54, height: 72, borderRadius: 12,
                background: done
                  ? 'linear-gradient(180deg, rgba(0,245,255,0.22), rgba(0,245,255,0.06))'
                  : active
                    ? 'linear-gradient(180deg, rgba(255,204,0,0.18), rgba(255,204,0,0.04))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: `2px solid ${done ? '#00f5ff' : active ? '#ffcc00' : 'rgba(255,255,255,0.14)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: done
                  ? '0 0 18px rgba(0,245,255,0.45), inset 0 0 12px rgba(0,245,255,0.2)'
                  : active
                    ? '0 0 22px rgba(255,204,0,0.55), inset 0 0 14px rgba(255,204,0,0.18)'
                    : 'inset 0 0 8px rgba(0,0,0,0.4)',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  fontSize: 26, color: done ? '#00f5ff' : '#ffcc00',
                  textShadow: `0 0 10px ${done ? '#00f5ff' : '#ffcc00'}`,
                  lineHeight: 1,
                }}>{puzzle.map[l]}</div>
                <div style={{
                  fontSize: 16, fontWeight: 900, color: done ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontFamily: 'Orbitron, sans-serif', marginTop: 4, letterSpacing: '0.05em',
                }}>{done ? l : '_'}</div>
              </div>
            );
          })}
        </div>

        <div style={{
          textAlign: 'center', margin: '14px 0 16px', position: 'relative',
        }}>
          <p style={{
            fontSize: 10, color: 'rgba(148,163,184,0.7)', letterSpacing: '0.3em',
            margin: 0, fontFamily: 'Orbitron, sans-serif',
          }}>NEXT GLYPH</p>
          <div style={{
            display: 'inline-block', marginTop: 6,
            fontSize: 42, color: '#ffcc00',
            textShadow: '0 0 22px #ffcc00, 0 0 40px rgba(255,204,0,0.5)',
            animation: 'pulse 1.4s ease-in-out infinite',
            lineHeight: 1,
          }}>{currentSym}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {alpha.map(l => (
            <button key={l} onPointerDown={() => tap(l)} style={{
              padding: '18px 0', borderRadius: 12,
              border: '2px solid rgba(0,245,255,0.5)',
              background: 'linear-gradient(180deg, rgba(0,245,255,0.18), rgba(0,245,255,0.04))',
              color: '#fff', fontWeight: 900, fontSize: 22,
              fontFamily: 'Orbitron, sans-serif', cursor: 'pointer',
              boxShadow: '0 0 14px rgba(0,245,255,0.25), inset 0 0 10px rgba(0,245,255,0.1)',
              letterSpacing: '0.05em',
              transition: 'transform 0.1s',
            }}>{l}</button>
          ))}
        </div>
        {flash && (
          <div style={{
            position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
            color: flash.t === 'good' ? '#00f5a0' : '#ff3355',
            fontWeight: 900, fontFamily: 'Orbitron, sans-serif', fontSize: 26,
            textShadow: `0 0 16px ${flash.t === 'good' ? '#00f5a0' : '#ff3355'}`,
            pointerEvents: 'none',
          }}>{flash.t === 'good' ? `+${flash.pts}` : 'WRONG'}</div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }`}</style>
    </div>
  );
}
