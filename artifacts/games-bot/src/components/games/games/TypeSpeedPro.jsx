import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Type the displayed word as fast as possible. Each correct letter = +10. Complete word = +50 bonus. Wrong letter = -50. Words get longer after 400 pts. Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;

const WORDS_EASY = ['TAP', 'HIT', 'RUN', 'WIN', 'FLY', 'ZAP', 'ACE', 'ZEN'];
const WORDS_MED = ['SPEED', 'FLASH', 'QUICK', 'BLAST', 'STORM', 'SCORE', 'LASER', 'POWER'];
const WORDS_HARD = ['MASTER', 'TURBO', 'ROCKET', 'STRIKE', 'REFLEX', 'DRAGON', 'BLAZE'];

const KEYBOARD = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
];

export default function TypeSpeedPro({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [word, setWord] = useState('');
  const [typed, setTyped] = useState('');
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newWord = useCallback(() => {
    if (!activeRef.current) return;
    const level = Math.floor(scoreRef.current / 400);
    const pool = level === 0 ? WORDS_EASY : level === 1 ? WORDS_MED : WORDS_HARD;
    const w = pool[Math.floor(Math.random() * pool.length)];
    setWord(w);
    setTyped('');
  }, []);

  const keyPress = useCallback((key) => {
    if (!activeRef.current) return;
    if (key === '⌫') {
      setTyped(prev => prev.slice(0, -1));
      return;
    }
    setTyped(prev => {
      const next = prev + key;
      const expected = word[prev.length];
      if (key !== expected) {
        scoreRef.current = Math.max(0, scoreRef.current - 50);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.06, vol: 0.06 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        return prev;
      }
      beep({ freq: 400 + prev.length * 30, dur: 0.04, vol: 0.06 });
      scoreRef.current = Math.max(0, scoreRef.current + 10);
      setScore(scoreRef.current);

      if (next === word) {
        scoreRef.current = Math.max(0, scoreRef.current + 50);
        setScore(scoreRef.current);
        triggerHaptic('medium');
        chord([660, 880], 0.05, 0.09, 'triangle');
        setFlash({ type: 'good', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setTimeout(newWord, 300);
      } else {
        onScoreUpdate?.(scoreRef.current);
      }
      return next;
    });
  }, [word, endGame, onScoreUpdate, newWord, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newWord();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="WORD" v={word.length} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'WORD DONE!' : 'WRONG KEY!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Word display */}
        <div style={{ display: 'flex', gap: 6 }}>
          {word.split('').map((ch, i) => {
            const done = i < typed.length;
            const current = i === typed.length;
            return (
              <div key={i} style={{
                width: 32, height: 40, borderRadius: 8,
                background: done ? 'rgba(245,158,11,0.2)' : current ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `2px solid ${done ? '#f59e0b' : current ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16,
                color: done ? '#f59e0b' : current ? '#fff' : '#475569',
              }}>
                {ch}
              </div>
            );
          })}
        </div>

        {/* Keyboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {KEYBOARD.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 3 }}>
              {row.map(key => (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.85 }}
                  onPointerDown={() => keyPress(key)}
                  style={{
                    width: key === '⌫' ? 42 : 28,
                    height: 36,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: key === '⌫' ? '#ef4444' : '#cbd5e1',
                    fontFamily: 'Orbitron, sans-serif',
                    fontWeight: 700, fontSize: key === '⌫' ? 14 : 11,
                    cursor: 'pointer',
                  }}
                >
                  {key}
                </motion.button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
