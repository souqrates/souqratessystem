import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Numbers 1–9 appear scattered on the screen. Tap them in ASCENDING ORDER as fast as possible! Complete 4 rounds to win!';
const TOTAL_ROUNDS = 6;
const DEFAULT_GAME_TIME = 55;

function shuffle(arr) {
  const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}

function makeNumbers(count) {
  const nums = shuffle(Array.from({ length: count }, (_, i) => i + 1));
  return nums.map(n => ({
    n, x: 8 + Math.random() * 76, y: 8 + Math.random() * 76,
  }));
}

export default function NumberSnipe({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [numbers, setNumbers] = useState([]);
  const [nextTarget, setNextTarget] = useState(1);
  const [feedback, setFeedback] = useState(null);
  const [roundsLeft, setRoundsLeft] = useState(TOTAL_ROUNDS);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const nextRef = useRef(1);
  const countRef = useRef(9);
  const roundsRef = useRef(TOTAL_ROUNDS);
  const roundStartRef = useRef(0);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TOTAL_ROUNDS) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const startRound = useCallback((count) => {
    countRef.current = count;
    nextRef.current = 1;
    setNextTarget(1);
    setNumbers(makeNumbers(count));
    roundStartRef.current = performance.now();
  }, []);

  const tap = useCallback((n) => {
    if (!activeRef.current) return;
    if (n !== nextRef.current) {
      setFeedback({ label: `Need ${nextRef.current}!`, color: '#ef4444', id: Date.now() });
      beep({ freq: 220, dur: 0.1, type: 'sawtooth', vol: 0.1 });
      triggerHaptic('error');
      return;
    }

    beep({ freq: 330 + n * 50, dur: 0.08, vol: 0.09 });
    triggerHaptic('light');
    setNumbers(ns => ns.filter(x => x.n !== n));
    nextRef.current++;
    setNextTarget(nextRef.current);

    if (nextRef.current > countRef.current) {
      const elapsed = (performance.now() - roundStartRef.current) / 1000;
      const speedBonus = elapsed < 5 ? 3 : elapsed < 8 ? 2 : 1;
      scoreRef.current += speedBonus;
      setScore(scoreRef.current);
      chord([523, 659, 784, 1047], 0.06, 0.15, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: `ROUND CLEAR! +${speedBonus}`, color: '#10b981', id: Date.now() });
      roundsRef.current--;
      setRoundsLeft(roundsRef.current);
      if (roundsRef.current <= 0 || scoreRef.current >= (game.targetScore || TOTAL_ROUNDS)) { endGame(); return; }
      const nextCount = Math.min(9, countRef.current + (scoreRef.current >= 2 ? 1 : 0));
      setTimeout(() => startRound(nextCount), 700);
    }
  }, [endGame, startRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; roundsRef.current = TOTAL_ROUNDS; countRef.current = 9;
    setScore(0); setTimeLeft(GAME_TIME); setRoundsLeft(TOTAL_ROUNDS); setFeedback(null);
    activeRef.current = true;
    startRound(9);
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { clearInterval(iv); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 8} setPhase={setPhase} />;
  }

  const color = '#22d3ee';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="ROUNDS" v={`${TOTAL_ROUNDS - roundsLeft}/${TOTAL_ROUNDS}`} c={color} />
        <Hud label="NEXT" v={nextTarget} c="#fbbf24" />
        <Hud label="TIME" v={`${timeLeft}s`} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={TOTAL_ROUNDS - roundsLeft} target={game.targetScore || TOTAL_ROUNDS} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={color} />

      <div style={{
        flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 50%, #001018 0%, #020508 100%)',
        border: `1px solid ${color}18`, minHeight: 280,
      }}>
        {numbers.map(({ n, x, y }) => (
          <motion.button
            key={n}
            onPointerDown={() => tap(n)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.82 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: 48, height: 48, borderRadius: '50%',
              background: n === nextTarget
                ? `radial-gradient(circle, ${color}, ${color}88)`
                : 'rgba(255,255,255,0.06)',
              border: `2px solid ${n === nextTarget ? color : 'rgba(255,255,255,0.12)'}`,
              boxShadow: n === nextTarget ? `0 0 20px ${color}88` : 'none',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18,
              color: n === nextTarget ? '#000' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', touchAction: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translate(-50%,-50%)',
            }}
          >
            {n}
          </motion.button>
        ))}

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, y: 0, scale: 0.9 }} animate={{ opacity: 0, y: -30, scale: 1.1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, color: feedback.color, textShadow: `0 0 14px ${feedback.color}`, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.22)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.14em' }}>
          TAP IN ORDER: 1 → 2 → 3 ...
        </div>
      </div>
    </div>
  );
}
