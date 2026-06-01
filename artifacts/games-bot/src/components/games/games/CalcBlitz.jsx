import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A math equation appears. Tap the CORRECT answer from 4 options! Wrong = score penalty and combo reset. Reach the target score before time runs out to win!';
const TARGET = 55;
const DEFAULT_GAME_TIME = 40;

function makeQuestion(level) {
  const ops = level < 3 ? ['+', '-'] : level < 6 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer, label;
  if (op === '+') { a = Math.floor(Math.random() * (10 + level * 4)); b = Math.floor(Math.random() * (10 + level * 4)); answer = a + b; label = `${a} + ${b}`; }
  else if (op === '-') { a = Math.floor(Math.random() * (15 + level * 4)); b = Math.floor(Math.random() * a); answer = a - b; label = `${a} - ${b}`; }
  else if (op === '×') { a = Math.floor(Math.random() * (4 + level)); b = Math.floor(Math.random() * (4 + level)); answer = a * b; label = `${a} × ${b}`; }
  else { b = Math.floor(Math.random() * 9) + 1; a = b * (Math.floor(Math.random() * 9) + 1); answer = a / b; label = `${a} ÷ ${b}`; }

  const wrongSet = new Set([answer]);
  const wrongs = [];
  while (wrongs.length < 3) {
    let w = answer + (Math.floor(Math.random() * 10) - 5);
    if (w < 0) w = answer + Math.floor(Math.random() * 6) + 1;
    if (!wrongSet.has(w)) { wrongSet.add(w); wrongs.push(w); }
  }
  const options = [answer, ...wrongs].sort(() => Math.random() - 0.5);
  return { label, answer, options };
}

const OPT_COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#fbbf24'];

export default function CalcBlitz({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [question, setQuestion] = useState(null);
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

  const nextQuestion = useCallback(() => {
    setQuestion(makeQuestion(levelRef.current));
    setChosen(null);
  }, []);

  const tap = useCallback((val, answer) => {
    if (!activeRef.current || chosen !== null) return;
    setChosen(val);

    if (val === answer) {
      comboRef.current++;
      const bonus = comboRef.current >= 4 ? 2 : 1;
      scoreRef.current += bonus;
      levelRef.current = Math.min(10, Math.floor(scoreRef.current / 5) + 1);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      beep({ freq: 660 + comboRef.current * 40, dur: 0.07, vol: 0.1 });
      triggerHaptic('success');
      const label = comboRef.current >= 4 ? `★×${comboRef.current} +${bonus}` : `✓ +${bonus}`;
      setFeedback({ label, color: comboRef.current >= 4 ? '#fbbf24' : '#10b981', id: Date.now() });
      setTimeout(nextQuestion, 420);
    } else {
      comboRef.current = 0;
      setCombo(0);
      scoreRef.current = Math.max(0, scoreRef.current - 3);
      setScore(scoreRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG! -3', color: '#ef4444', id: Date.now() });
      beep({ freq: 200, dur: 0.15, type: 'sawtooth', vol: 0.12 });
      setTimeout(nextQuestion, 600);
    }
  }, [chosen, endGame, nextQuestion]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; levelRef.current = 1;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setFeedback(null);
    activeRef.current = true;
    nextQuestion();
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 2} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="COMBO" v={combo >= 3 ? `${combo}x` : combo} c={combo >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c="#f97316" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color="#3b82f6" />

      <div style={{
        position: 'relative',
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, borderRadius: 16, padding: 16,
        background: 'radial-gradient(ellipse at 50% 50%, #000812 0%, #020508 100%)',
        border: '1px solid rgba(59,130,246,0.1)',
        overflow: 'hidden',
      }}>
        {question && (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={question.label}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.18 }}
                style={{
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36,
                  color: '#fff', textShadow: '0 0 30px rgba(59,130,246,0.5)',
                  letterSpacing: '0.04em',
                }}
              >
                {question.label} = ?
              </motion.div>
            </AnimatePresence>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 280 }}>
              {question.options.map((opt, i) => {
                const isChosen = chosen === opt;
                const isCorrect = opt === question.answer;
                const showResult = chosen !== null;
                const col = OPT_COLORS[i];
                return (
                  <motion.button
                    key={`${question.label}-${i}`}
                    onPointerDown={() => tap(opt, question.answer)}
                    whileTap={chosen === null ? { scale: 0.92 } : {}}
                    style={{
                      height: 72, borderRadius: 16, cursor: chosen === null ? 'pointer' : 'default',
                      background: showResult
                        ? isCorrect ? 'rgba(16,185,129,0.25)' : isChosen ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'
                        : `radial-gradient(circle at 40% 35%, ${col}22, ${col}11)`,
                      border: `2px solid ${showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : 'rgba(255,255,255,0.05)') : `${col}55`}`,
                      fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22,
                      color: showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : `${col}44`) : col,
                    }}
                  >
                    {opt}
                  </motion.button>
                );
              })}
            </div>
          </>
        )}

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shockwave ring on correct answer */}
        <AnimatePresence>
          {feedback && feedback.color !== '#ef4444' && (
            <motion.div
              key={`sw-${feedback.id}`}
              initial={{ opacity: 0.7, scale: 0.2 }}
              animate={{ opacity: 0, scale: 2.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              style={{
                position: 'absolute', width: 180, height: 180, borderRadius: '50%',
                border: `2px solid ${feedback.color}`,
                boxShadow: `0 0 22px ${feedback.color}, inset 0 0 22px ${feedback.color}66`,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
