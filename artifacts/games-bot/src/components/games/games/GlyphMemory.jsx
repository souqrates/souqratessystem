import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A 3×3 grid briefly flashes with symbols. Memorize them, then tap them in the ORDER shown! Each round adds more symbols. Wrong tap = score penalty. Reach the target before time runs out!';
const TARGET = 50;
const GLYPHS = ['★', '◆', '▲', '●', '■', '✦', '⬟', '⬡', '✿'];
const GLYPH_COLORS = ['#f43f5e','#3b82f6','#10b981','#fbbf24','#a855f7','#22d3ee','#fb923c','#84cc16','#ec4899'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GlyphMemory({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [grid, setGrid] = useState([]); // array of 9 cell objects
  const [sequence, setSequence] = useState([]); // indices to tap in order
  const [revealing, setRevealing] = useState(false);
  const [revealIdx, setRevealIdx] = useState(-1);
  const [inputIdx, setInputIdx] = useState(0);
  const [mode, setMode] = useState('watch');
  const [feedback, setFeedback] = useState(null);
  const [tapped, setTapped] = useState([]);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const seqRef = useRef([]);
  const inputIdxRef = useRef(0);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const startRound = useCallback((seqLen) => {
    const indices = shuffle([0,1,2,3,4,5,6,7,8]).slice(0, seqLen);
    const newGrid = GLYPHS.map((g, i) => ({ glyph: g, color: GLYPH_COLORS[i], idx: i }));
    seqRef.current = indices;
    setSequence(indices);
    setGrid(newGrid);
    setTapped([]);
    inputIdxRef.current = 0;
    setInputIdx(0);
    setMode('watch');
    setRevealing(true);

    let i = 0;
    const showNext = () => {
      if (i >= indices.length) {
        setTimeout(() => {
          setRevealing(false);
          setRevealIdx(-1);
          setMode('input');
        }, 400);
        return;
      }
      setRevealIdx(indices[i]);
      beep({ freq: 300 + i * 40, dur: 0.2, vol: 0.09 });
      i++;
      setTimeout(() => { setRevealIdx(-1); setTimeout(showNext, 180); }, 500);
    };
    setTimeout(showNext, 300);
  }, []);

  const tap = useCallback((cellIdx) => {
    if (!activeRef.current || mode !== 'input') return;
    const expected = seqRef.current[inputIdxRef.current];

    if (cellIdx !== expected) {
      scoreRef.current = Math.max(0, scoreRef.current - 4);
      setScore(scoreRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG ORDER! -4', color: '#ef4444', id: Date.now() });
      beep({ freq: 200, dur: 0.18, type: 'sawtooth', vol: 0.12 });
      const len = Math.max(2, seqRef.current.length - 1);
      setTimeout(() => startRound(len), 700);
      setMode('watch');
      return;
    }

    setTapped(t => [...t, cellIdx]);
    beep({ freq: 440 + inputIdxRef.current * 60, dur: 0.1, vol: 0.09 });
    triggerHaptic('light');
    inputIdxRef.current++;
    setInputIdx(inputIdxRef.current);

    if (inputIdxRef.current >= seqRef.current.length) {
      const pts = seqRef.current.length;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      chord([523, 659, 784], 0.06, 0.14, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: `+${pts} CORRECT!`, color: '#10b981', id: Date.now() });
      setTimeout(() => startRound(Math.min(9, seqRef.current.length + 1)), 700);
      setMode('watch');
    }
  }, [mode, endGame, startRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const GAME_TIME = game?.durationSeconds || 55;
    scoreRef.current = 0; inputIdxRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setFeedback(null);
    activeRef.current = true;
    startRound(2);
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
        <Hud label="SCORE" v={score} c="#a855f7" />
        <Hud label="SEQ" v={`${Math.min(inputIdx, sequence.length)}/${sequence.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c="#f97316" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={game?.durationSeconds || 55} timeLeft={timeLeft} color="#a855f7" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, borderRadius: 16, padding: 12,
        background: 'radial-gradient(ellipse at 50% 50%, #08040f 0%, #030208 100%)',
        border: '1px solid rgba(168,85,247,0.1)',
      }}>
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.16em',
          color: mode === 'watch' ? '#fbbf24' : '#a855f7',
        }}>
          {mode === 'watch' ? (revealing ? 'MEMORIZE THE ORDER' : 'GETTING READY...') : `TAP IN ORDER (${inputIdx}/${sequence.length})`}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 280 }}>
          {grid.map((cell, i) => {
            const isRevealing = revealIdx === i;
            const isTapped = tapped.includes(i);
            const isNext = mode === 'input' && seqRef.current[inputIdxRef.current] === i;
            return (
              <motion.button
                key={i}
                onPointerDown={() => tap(i)}
                whileTap={mode === 'input' ? { scale: 0.88 } : {}}
                animate={isRevealing ? { scale: 1.1, boxShadow: `0 0 32px ${cell.color}` } : { scale: 1 }}
                transition={{ duration: 0.1 }}
                style={{
                  height: 72, borderRadius: 14, cursor: mode === 'input' ? 'pointer' : 'default',
                  background: isRevealing
                    ? `radial-gradient(circle, ${cell.color}55, ${cell.color}22)`
                    : isTapped
                      ? `rgba(16,185,129,0.2)`
                      : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${isRevealing ? cell.color : isTapped ? '#10b981' : isNext ? `${cell.color}88` : 'rgba(255,255,255,0.07)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, color: isRevealing ? cell.color : isTapped ? '#10b981' : `${cell.color}66`,
                  fontWeight: 900,
                  boxShadow: isNext && mode === 'input' ? `0 0 20px ${cell.color}44` : 'none',
                }}
              >
                {cell.glyph}
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
      </div>
    </div>
  );
}
