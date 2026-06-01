import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Colored dots burst onto the screen briefly. Count the TARGET COLOR dots, then tap the correct number! Score 25 to win!';
const TARGET = 25;
const DEFAULT_GAME_TIME = 55;
const SHOW_MS = 900;

const DOT_COLORS = [
  { name: 'RED',   color: '#ef4444' },
  { name: 'BLUE',  color: '#3b82f6' },
  { name: 'GREEN', color: '#10b981' },
];

function makeRound(level) {
  const totalDots = 6 + level * 2;
  const targetColor = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  const targetCount = 2 + Math.floor(Math.random() * Math.min(6, level + 2));
  const dots = [];
  for (let i = 0; i < totalDots; i++) {
    const col = i < targetCount ? targetColor : DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
    dots.push({ color: col, x: 10 + Math.random() * 80, y: 15 + Math.random() * 70 });
  }
  // shuffle
  for (let i = dots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [dots[i], dots[j]] = [dots[j], dots[i]]; }

  const wrongSet = new Set([targetCount]);
  const options = [targetCount];
  while (options.length < 4) {
    let w = targetCount + (Math.floor(Math.random() * 6) - 3);
    if (w < 0) w = targetCount + 1;
    if (!wrongSet.has(w)) { wrongSet.add(w); options.push(w); }
  }
  options.sort(() => Math.random() - 0.5);
  return { dots, targetColor, targetCount, options };
}

const OPT_COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#fbbf24'];

export default function CountBurst({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [round, setRound] = useState(null);
  const [showing, setShowing] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const levelRef = useRef(1);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextRound = useCallback(() => {
    const r = makeRound(levelRef.current);
    setRound(r);
    setChosen(null);
    setShowing(true);
    setTimeout(() => setShowing(false), SHOW_MS);
  }, []);

  const tap = useCallback((val) => {
    if (!activeRef.current || chosen !== null || !round || showing) return;
    setChosen(val);
    if (val === round.targetCount) {
      comboRef.current++;
      scoreRef.current++;
      levelRef.current = Math.min(8, Math.floor(scoreRef.current / 5) + 1);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      chord([523, 659], 0.06, 0.1, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: comboRef.current >= 3 ? `★×${comboRef.current} CORRECT!` : '✓ CORRECT', color: '#10b981', id: Date.now() });  // game-symbol
      setTimeout(nextRound, 500);
    } else {
      comboRef.current = 0;
      setCombo(0);
      triggerHaptic('error');
      setFeedback({ label: `WRONG! It was ${round.targetCount}`, color: '#ef4444', id: Date.now() });
      beep({ freq: 220, dur: 0.15, type: 'sawtooth', vol: 0.12 });
      setTimeout(nextRound, 700);
    }
  }, [chosen, round, showing, endGame, nextRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; levelRef.current = 1;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setFeedback(null);
    activeRef.current = true;
    nextRound();
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="COMBO" v={combo >= 3 ? `${combo}x` : combo} c={combo >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={`${timeLeft}s`} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color="#10b981" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, borderRadius: 16, padding: 12,
        background: 'radial-gradient(ellipse at 50% 50%, #001206 0%, #020508 100%)',
        border: '1px solid rgba(16,185,129,0.1)',
      }}>
        {round && (
          <>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.14em', color: '#94a3b8' }}>
              COUNT THE <span style={{ color: round.targetColor.color, fontWeight: 900 }}>{round.targetColor.name}</span> DOTS
            </div>

            {/* Dot field */}
            <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 14, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <AnimatePresence>
                {showing && round.dots.map((d, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ delay: i * 0.025, type: 'spring', stiffness: 600, damping: 20 }}
                    style={{
                      position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
                      transform: 'translate(-50%,-50%)',
                      width: 22, height: 22, borderRadius: '50%',
                      background: d.color.color,
                      boxShadow: `0 0 10px ${d.color.color}88`,
                    }}
                  />
                ))}
              </AnimatePresence>
              {!showing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.12em' }}>
                  HOW MANY <span style={{ color: round.targetColor.color, margin: '0 4px', fontWeight: 900 }}>{round.targetColor.name}</span> ?
                </div>
              )}
            </div>

            {!showing && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, width: '100%' }}>
                {round.options.map((opt, i) => {
                  const isChosen = chosen === opt;
                  const isCorrect = opt === round.targetCount;
                  const showResult = chosen !== null;
                  const col = OPT_COLORS[i];
                  return (
                    <motion.button
                      key={`${round.targetCount}-${i}`}
                      onPointerDown={() => tap(opt)}
                      whileTap={chosen === null ? { scale: 0.9 } : {}}
                      style={{
                        height: 56, borderRadius: 14, cursor: chosen === null ? 'pointer' : 'default',
                        background: showResult ? (isCorrect ? 'rgba(16,185,129,0.25)' : isChosen ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)') : `${col}18`,
                        border: `2px solid ${showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : 'rgba(255,255,255,0.05)') : `${col}55`}`,
                        fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20,
                        color: showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : `${col}44`) : col,
                      }}
                    >
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            )}

            <AnimatePresence>
              {feedback && (
                <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                  style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
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
