import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Watch the color sequence, then repeat it! Each round adds one more color. Memorize carefully — wrong tap = score penalty. Reach the target score before time runs out to win!';
const TARGET = 35;
const COLORS = [
  { id: 0, color: '#ef4444', freq: 261 },
  { id: 1, color: '#3b82f6', freq: 329 },
  { id: 2, color: '#10b981', freq: 392 },
  { id: 3, color: '#fbbf24', freq: 523 },
];

export default function ColorCode({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [sequence, setSequence] = useState([]);
  const [showing, setShowing] = useState(false);
  const [showIdx, setShowIdx] = useState(-1);
  const [inputIdx, setInputIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [mode, setMode] = useState('watch'); // watch | input

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const seqRef = useRef([]);
  const inputIdxRef = useRef(0);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const playSequence = useCallback((seq) => {
    setMode('watch');
    setShowing(true);
    setShowIdx(-1);
    let i = 0;
    const next = () => {
      if (i >= seq.length) {
        setShowIdx(-1);
        setShowing(false);
        setMode('input');
        inputIdxRef.current = 0;
        setInputIdx(0);
        return;
      }
      setShowIdx(seq[i]);
      beep({ freq: COLORS[seq[i]].freq, dur: 0.25, vol: 0.12 });
      i++;
      setTimeout(() => { setShowIdx(-1); setTimeout(next, 100); }, 280);
    };
    setTimeout(next, 400);
  }, []);

  const startRound = useCallback((seq) => {
    seqRef.current = seq;
    setSequence(seq);
    playSequence(seq);
  }, [playSequence]);

  const tap = useCallback((colorId) => {
    if (!activeRef.current || mode !== 'input') return;
    const expected = seqRef.current[inputIdxRef.current];
    beep({ freq: COLORS[colorId].freq, dur: 0.15, vol: 0.1 });

    if (colorId !== expected) {
      scoreRef.current = Math.max(0, scoreRef.current - 3);
      setScore(scoreRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG! -3', color: '#ef4444', id: Date.now() });
      beep({ freq: 200, dur: 0.2, type: 'sawtooth', vol: 0.12 });
      const shorter = Math.max(1, seqRef.current.length - 1);
      setTimeout(() => startRound(seqRef.current.slice(0, shorter)), 600);
      setMode('watch');
      return;
    }

    triggerHaptic('light');
    inputIdxRef.current++;
    setInputIdx(inputIdxRef.current);

    if (inputIdxRef.current >= seqRef.current.length) {
      scoreRef.current += seqRef.current.length;
      setScore(scoreRef.current);
      chord([523, 659, 784], 0.06, 0.15, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: '✓ CORRECT!', color: '#10b981', id: Date.now() });
      const newSeq = [...seqRef.current, Math.floor(Math.random() * 4)];
      setTimeout(() => startRound(newSeq), 700);
      setMode('watch');
    }
  }, [mode, endGame, startRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const GAME_TIME = game?.durationSeconds || 50;
    scoreRef.current = 0;
    inputIdxRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setInputIdx(0); setFeedback(null);
    activeRef.current = true;
    const initSeq = [Math.floor(Math.random() * 4)];
    startRound(initSeq);
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
        <Hud label="SCORE" v={score} c="#22d3ee" />
        <Hud label="STEP" v={`${Math.min(inputIdx, sequence.length)}/${sequence.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c="#f97316" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={game?.durationSeconds || 50} timeLeft={timeLeft} color="#22d3ee" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, borderRadius: 16, padding: 16,
        background: 'radial-gradient(ellipse at 50% 50%, #040c14 0%, #020508 100%)',
        border: '1px solid rgba(34,211,238,0.08)',
      }}>
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.16em',
          color: mode === 'watch' ? '#fbbf24' : '#10b981',
          textShadow: `0 0 12px ${mode === 'watch' ? '#fbbf2466' : '#10b98166'}`,
        }}>
          {mode === 'watch' ? 'WATCH THE SEQUENCE' : 'YOUR TURN — REPEAT IT'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 260 }}>
          {COLORS.map(c => (
            <motion.button
              key={c.id}
              onPointerDown={() => tap(c.id)}
              whileTap={mode === 'input' ? { scale: 0.92 } : {}}
              animate={showIdx === c.id ? { scale: 1.08, boxShadow: `0 0 40px ${c.color}` } : { scale: 1, boxShadow: `0 0 0px ${c.color}00` }}
              transition={{ duration: 0.1 }}
              style={{
                height: 90, borderRadius: 18, cursor: mode === 'input' ? 'pointer' : 'default',
                background: showIdx === c.id
                  ? `radial-gradient(circle at 40% 35%, ${c.color}, ${c.color}88)`
                  : `radial-gradient(circle at 40% 35%, ${c.color}44, ${c.color}22)`,
                border: `2px solid ${showIdx === c.id ? c.color : `${c.color}55`}`,
                opacity: mode === 'watch' ? (showIdx === c.id ? 1 : 0.5) : 1,
                transition: 'opacity 0.15s',
              }}
            />
          ))}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
