import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap letters to form words. Correct word = +100 × word length. Wrong = -150. After 600 pts, fewer letters appear making it harder. Longer words score way more! Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;
const WORD_BANK = [
  { word: 'CAT', pts: 3 }, { word: 'DOG', pts: 3 }, { word: 'SUN', pts: 3 },
  { word: 'FIRE', pts: 4 }, { word: 'MOON', pts: 4 }, { word: 'STAR', pts: 4 },
  { word: 'GAME', pts: 4 }, { word: 'CODE', pts: 4 }, { word: 'FAST', pts: 4 },
  { word: 'JUMP', pts: 4 }, { word: 'GOLD', pts: 4 }, { word: 'COOL', pts: 4 },
  { word: 'BLAST', pts: 5 }, { word: 'SCORE', pts: 5 }, { word: 'SPEED', pts: 5 },
  { word: 'LASER', pts: 5 }, { word: 'STORM', pts: 5 }, { word: 'FLAME', pts: 5 },
  { word: 'POWER', pts: 5 }, { word: 'SWIFT', pts: 5 }, { word: 'BRAVE', pts: 5 },
  { word: 'ROCKET', pts: 6 }, { word: 'DRAGON', pts: 6 }, { word: 'TURBO', pts: 5 },
];

function genLetters(word, level) {
  const needed = word.split('');
  const extras = Math.max(2, 4 - Math.floor(level / 3));
  const alphabet = 'ABCDEFGHIJKLMNOPRSTUVWXY';
  const pool = [...needed];
  for (let i = 0; i < extras; i++) pool.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  return pool.sort(() => Math.random() - 0.5).map((l, i) => ({ id: i, letter: l }));
}

export default function WordSwipe({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [targetWord, setTargetWord] = useState('');
  const [letters, setLetters] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getLevel = () => Math.floor(scoreRef.current / 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const level = getLevel();
    const pool = level < 3 ? WORD_BANK.filter(w => w.pts <= 4) : WORD_BANK;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const letts = genLetters(entry.word, level);
    setTargetWord(entry.word);
    setLetters(letts);
    setChosen([]);
  }, []);

  const tapLetter = useCallback((id) => {
    if (!activeRef.current) return;
    setChosen(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      const formed = next.map(lid => letters.find(l => l.id === lid)?.letter || '').join('');
      if (formed === targetWord) {
        const pts = targetWord.length * 100;
        scoreRef.current = Math.max(0, scoreRef.current + pts);
        setScore(scoreRef.current);
        triggerHaptic('medium');
        chord([660, 880, 1100], 0.06, 0.1, 'triangle');
        setFlash({ type: 'good', id: Date.now(), pts });
        onScoreUpdate?.(scoreRef.current);
        setTimeout(newRound, 500);
      } else if (formed.length >= targetWord.length) {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.1, vol: 0.1 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setTimeout(() => setChosen([]), 400);
      } else {
        beep({ freq: 400 + next.length * 50, dur: 0.06, vol: 0.08 });
      }
      return next;
    });
  }, [letters, targetWord, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newRound();

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

  const formed = chosen.map(id => letters.find(l => l.id === id)?.letter || '').join('');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="WORD" v={targetWord.length} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? `+${flash.pts}!` : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Target word hidden hint */}
        <div style={{ display: 'flex', gap: 6 }}>
          {targetWord.split('').map((_, i) => (
            <div key={i} style={{ width: 28, height: 28, borderRadius: 6, border: '2px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#f59e0b', fontSize: 16 }}>
              {formed[i] || ''}
            </div>
          ))}
        </div>

        {/* Letters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 280 }}>
          {letters.map(l => {
            const sel = chosen.includes(l.id);
            const selOrder = chosen.indexOf(l.id);
            return (
              <motion.button
                key={l.id}
                whileTap={{ scale: 0.88 }}
                onPointerDown={() => tapLetter(l.id)}
                style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: sel ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${sel ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                  color: sel ? '#f59e0b' : '#cbd5e1',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20,
                  cursor: 'pointer',
                  boxShadow: sel ? '0 0 14px #f59e0b44' : 'none',
                  position: 'relative',
                }}
              >
                {l.letter}
                {sel && <span style={{ position: 'absolute', top: 1, right: 4, fontSize: 8, color: '#f59e0b88', fontFamily: 'monospace' }}>{selOrder + 1}</span>}
              </motion.button>
            );
          })}
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onPointerDown={() => setChosen([])}
          style={{ padding: '8px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.7)', fontSize: 11, cursor: 'pointer' }}
        >
          CLEAR
        </motion.button>
      </div>
    </div>
  );
}
