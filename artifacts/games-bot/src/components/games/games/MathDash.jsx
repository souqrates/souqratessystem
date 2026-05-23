import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Solve math problems fast! Correct answer = +100 + (streak × 10). Wrong = -150, streak resets. Time per question shrinks from 2s to 0.8s. Keep a 10x streak for massive bonuses! Reach 2000 in 60s!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 2000;
const BASE_WINDOW = 2000;
const MIN_WINDOW = 800;

function genQuestion(level) {
  const ops = level < 3 ? ['+', '-'] : level < 6 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === '+') { a = Math.floor(Math.random() * (10 + level * 5)) + 1; b = Math.floor(Math.random() * (10 + level * 5)) + 1; answer = a + b; }
  else if (op === '-') { a = Math.floor(Math.random() * (20 + level * 5)) + 10; b = Math.floor(Math.random() * a) + 1; answer = a - b; }
  else if (op === '×') { a = Math.floor(Math.random() * (5 + level)) + 2; b = Math.floor(Math.random() * (5 + level)) + 2; answer = a * b; }
  else { b = Math.floor(Math.random() * 9) + 2; a = b * (Math.floor(Math.random() * 9) + 1); answer = a / b; }
  const opts = new Set([answer]);
  while (opts.size < 4) opts.add(answer + (Math.floor(Math.random() * 10) - 5));
  const options = [...opts].sort(() => Math.random() - 0.5);
  return { question: `${a} ${op} ${b}`, answer, options };
}

export default function MathDash({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [question, setQuestion] = useState(null);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState(null);
  const [windowMs, setWindowMs] = useState(BASE_WINDOW);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const streakRef = useRef(0);
  const qTimerRef = useRef(null);
  const levelRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(qTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const nextQuestion = useCallback(() => {
    if (!activeRef.current) return;
    levelRef.current = Math.floor(scoreRef.current / 200);
    const win = Math.max(MIN_WINDOW, BASE_WINDOW - levelRef.current * 200);
    setWindowMs(win);
    const q = genQuestion(levelRef.current);
    setQuestion(q);
    clearTimeout(qTimerRef.current);
    qTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(nextQuestion, 300);
    }, win);
  }, []);

  const answer = useCallback((val) => {
    if (!activeRef.current || !question) return;
    clearTimeout(qTimerRef.current);
    if (val === question.answer) {
      streakRef.current++;
      const pts = 100 + streakRef.current * 10;
      scoreRef.current = Math.max(0, scoreRef.current + pts);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      if (streakRef.current >= 10) chord([660, 880, 1100, 1320], 0.06, 0.1, 'triangle');
      else beep({ freq: 440 + streakRef.current * 30, dur: 0.07, vol: 0.09 });
      setFlash({ type: 'good', id: Date.now(), pts });
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
    setTimeout(nextQuestion, 200);
  }, [question, endGame, onScoreUpdate, nextQuestion, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0; levelRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    nextQuestion();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearTimeout(qTimerRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="STREAK" v={streak} c={streak >= 5 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? `+${flash.pts}!` : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {question && (
          <>
            {/* Timer bar for question */}
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div
                key={question.question}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: windowMs / 1000, ease: 'linear' }}
                style={{ height: '100%', background: '#3b82f6', borderRadius: 99 }}
              />
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36, color: '#fff', letterSpacing: '0.04em', textShadow: '0 0 20px rgba(59,130,246,0.5)' }}>
              {question.question} = ?
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
              {question.options.map((opt, i) => (
                <motion.button
                  key={`${question.question}-${i}`}
                  whileTap={{ scale: 0.88 }}
                  onPointerDown={() => answer(opt)}
                  style={{
                    padding: '18px 8px', borderRadius: 14,
                    background: 'rgba(59,130,246,0.1)',
                    border: '2px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd', fontFamily: 'Orbitron, sans-serif',
                    fontWeight: 900, fontSize: 22, cursor: 'pointer',
                  }}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
