import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A shadow silhouette is shown. Pick the matching shape from 4 options! Speed bonus: the faster you tap, the more points. Score 30 to win!';
const TARGET = 40;
const TIME_LIMIT_MS = 2500;

const SHAPES = [
  { id: 0, label: '▲', name: 'Triangle' },
  { id: 1, label: '■', name: 'Square' },
  { id: 2, label: '●', name: 'Circle' },
  { id: 3, label: '⬡', name: 'Hexagon' },
  { id: 4, label: '★', name: 'Star' },
  { id: 5, label: '◆', name: 'Diamond' },
  { id: 6, label: '✦', name: 'Cross' },
  { id: 7, label: '⬟', name: 'Octagon' },
];

const OPT_COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24'];

function shuffle(arr) {
  const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}

function makeRound() {
  const correct = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const pool = SHAPES.filter(s => s.id !== correct.id);
  const distractors = shuffle(pool).slice(0, 3);
  const options = shuffle([correct, ...distractors]);
  return { correct, options };
}

export default function ShadowSnap({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [round, setRound] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_MS);
  const [feedback, setFeedback] = useState(null);
  const [chosen, setChosen] = useState(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const activeRef = useRef(false);
  const spawnTimeRef = useRef(0);
  const ivRef = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(ivRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextRound = useCallback(() => {
    clearInterval(ivRef.current);
    const r = makeRound();
    setRound(r);
    setChosen(null);
    setTimeLeft(TIME_LIMIT_MS);
    spawnTimeRef.current = performance.now();
    ivRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 100) {
          clearInterval(ivRef.current);
          livesRef.current = Math.max(0, livesRef.current - 1);
          setLives(livesRef.current);
          triggerHaptic('error');
          setFeedback({ label: 'TOO SLOW!', color: '#ef4444', id: Date.now() });
          beep({ freq: 200, dur: 0.2, type: 'sawtooth', vol: 0.12 });
          if (livesRef.current <= 0) { endGame(); return 0; }
          setTimeout(nextRound, 600);
          return 0;
        }
        return t - 100;
      });
    }, 100);
  }, [endGame]);

  const tap = useCallback((optId, correct) => {
    if (!activeRef.current || chosen !== null) return;
    clearInterval(ivRef.current);
    setChosen(optId);
    const elapsed = performance.now() - spawnTimeRef.current;
    const speedBonus = elapsed < 1200 ? 3 : elapsed < 2200 ? 2 : 1;

    if (optId === correct.id) {
      scoreRef.current += speedBonus;
      setScore(scoreRef.current);
      chord([523, 659], 0.06, 0.12, 'triangle');
      triggerHaptic('success');
      const label = speedBonus === 3 ? `★ FAST +${speedBonus}` : speedBonus === 2 ? `✓ QUICK +${speedBonus}` : `✓ +${speedBonus}`;
      setFeedback({ label, color: speedBonus === 3 ? '#fbbf24' : '#10b981', id: Date.now() });
      setTimeout(nextRound, 550);
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG!', color: '#ef4444', id: Date.now() });
      beep({ freq: 220, dur: 0.18, type: 'sawtooth', vol: 0.12 });
      if (livesRef.current <= 0) { endGame(); return; }
      setTimeout(nextRound, 700);
    }
  }, [chosen, endGame, nextRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3;
    setScore(0); setLives(3); setFeedback(null);
    activeRef.current = true;
    nextRound();
    return () => { activeRef.current = false; clearInterval(ivRef.current); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const pct = (timeLeft / TIME_LIMIT_MS) * 100;
  const barColor = pct > 60 ? '#10b981' : pct > 30 ? '#fbbf24' : '#ef4444';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#fbbf24" />
        <Hud label="SPEED" v={`${Math.round(timeLeft / 100 * 10) / 10}s`} c="#94a3b8" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />

      {/* Timer bar */}
      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pct}%`, backgroundColor: barColor }} transition={{ duration: 0.1 }}
          style={{ height: '100%', borderRadius: 4 }} />
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, borderRadius: 16, padding: 16,
        background: 'radial-gradient(ellipse at 50% 50%, #080600 0%, #030200 100%)',
        border: '1px solid rgba(251,191,36,0.1)',
      }}>
        {round && (
          <>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.16em', color: 'rgba(148,163,184,0.5)' }}>
              MATCH THE SHADOW
            </div>

            {/* Shadow target */}
            <div style={{
              width: 100, height: 100, borderRadius: 20,
              background: 'rgba(0,0,0,0.8)', border: '2px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 56, filter: 'brightness(0) contrast(0)',
              color: '#fff',
            }}>
              {round.correct.label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 280 }}>
              {round.options.map((opt, i) => {
                const isChosen = chosen === opt.id;
                const isCorrect = opt.id === round.correct.id;
                const showResult = chosen !== null;
                const col = OPT_COLORS[i];
                return (
                  <motion.button
                    key={opt.id}
                    onPointerDown={() => tap(opt.id, round.correct)}
                    whileTap={chosen === null ? { scale: 0.92 } : {}}
                    style={{
                      height: 80, borderRadius: 16, cursor: chosen === null ? 'pointer' : 'default',
                      background: showResult
                        ? isCorrect ? 'rgba(16,185,129,0.25)' : isChosen ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'
                        : `radial-gradient(circle at 40% 35%, ${col}22, ${col}11)`,
                      border: `2px solid ${showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : 'rgba(255,255,255,0.05)') : `${col}55`}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 36, color: showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : `${col}44`) : col,
                    }}
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                  style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
                  {feedback.label}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
