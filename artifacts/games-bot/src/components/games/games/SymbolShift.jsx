import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A grid of symbols is shown. ONE symbol changes! Tap the changed one before time runs out. Correct = +100, Wrong = -150. Grid grows 9→12 symbols and window shrinks 3s→1.5s after 400 pts. Reach 1200!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1200;
const ALL_SYMS = ['★','♦','♠','♣','♥','▲','●','■','◆','✦','❋','⬟'];
const BASE_COUNT = 9;
const BASE_WINDOW = 3000;
const MIN_WINDOW = 1500;

export default function SymbolShift({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [symbols, setSymbols] = useState([]);
  const [changedIdx, setChangedIdx] = useState(-1);
  const [windowMs, setWindowMs] = useState(BASE_WINDOW);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const changedRef = useRef(-1);
  const streakRef = useRef(0);
  const roundTimerRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getCount = () => scoreRef.current >= 400 ? 12 : BASE_COUNT;
  const getWindow = () => Math.max(MIN_WINDOW, BASE_WINDOW - Math.floor(scoreRef.current / 200) * 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(roundTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const count = getCount();
    const pool = ALL_SYMS.slice(0, count + 1);
    const base = Array.from({ length: count }, () => pool[Math.floor(Math.random() * count)]);
    const changeAt = Math.floor(Math.random() * count);
    const newSym = pool.find(s => s !== base[changeAt]) || pool[pool.length - 1];
    const after = [...base];
    after[changeAt] = newSym;
    changedRef.current = changeAt;
    setChangedIdx(changeAt);
    setSymbols(after);
    setWindowMs(getWindow());

    roundTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newRound, 400);
    }, getWindow());
  }, []);

  const tap = useCallback((idx) => {
    if (!activeRef.current) return;
    clearTimeout(roundTimerRef.current);
    if (idx === changedRef.current) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
    setTimeout(newRound, 300);
  }, [endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; streakRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    setTimeout(newRound, 400);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearTimeout(roundTimerRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const cols = symbols.length <= 9 ? 3 : 4;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ef4444" />
        <Hud label="STREAK" v={streak} c={streak >= 3 ? '#f59e0b' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'FOUND IT!' : 'MISSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Timer bar for this round */}
        <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
          <motion.div
            key={`${score}-${symbols.length}`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: windowMs / 1000, ease: 'linear' }}
            style={{ height: '100%', background: '#ef4444', borderRadius: 99 }}
          />
        </div>

        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 11, letterSpacing: '0.18em', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>FIND THE CHANGED SYMBOL</p>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, width: '100%' }}>
          {symbols.map((sym, i) => (
            <motion.button
              key={`${i}-${sym}`}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => tap(i)}
              style={{
                aspectRatio: '1', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1.5px solid rgba(255,255,255,0.08)',
                fontSize: 22, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#cbd5e1',
              }}
            >
              {sym}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
