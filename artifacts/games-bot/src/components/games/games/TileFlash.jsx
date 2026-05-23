import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tiles briefly light up — memorize which ones! Then tap the exact same tiles from memory. Get it right = more tiles next round. 3 mistakes and you lose. Score 20 to win!';
const TARGET = 28;
const GRID_SIZE = 16; // 4x4

export default function TileFlash({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [lit, setLit] = useState(new Set()); // tiles to memorize
  const [showing, setShowing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [mode, setMode] = useState('watch');
  const [feedback, setFeedback] = useState(null);
  const [roundCount, setRoundCount] = useState(3);

  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const activeRef = useRef(false);
  const litRef = useRef(new Set());
  const roundCountRef = useRef(3);
  const timersRef = useRef([]);

  const safeTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter(t => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    safeTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore, safeTimeout]);

  const startRound = useCallback((count) => {
    roundCountRef.current = count;
    setRoundCount(count);
    const indices = [];
    while (indices.length < count) {
      const r = Math.floor(Math.random() * GRID_SIZE);
      if (!indices.includes(r)) indices.push(r);
    }
    const litSet = new Set(indices);
    litRef.current = litSet;
    setLit(litSet);
    setSelected(new Set());
    setMode('watch');
    setShowing(true);
    indices.forEach((_, i) => beep({ freq: 440 + i * 30, dur: 0.15, vol: 0.07 }));
    safeTimeout(() => {
      setShowing(false);
      setLit(new Set());
      setMode('input');
    }, 700 + count * 50);
  }, [safeTimeout]);

  const toggleTile = useCallback((idx) => {
    if (!activeRef.current || mode !== 'input') return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      beep({ freq: 440, dur: 0.07, vol: 0.07 });
      triggerHaptic('light');
      return next;
    });
  }, [mode]);

  const submit = useCallback(() => {
    if (!activeRef.current || mode !== 'input') return;
    const correct = [...litRef.current].every(i => selected.has(i)) && selected.size === litRef.current.size;
    if (correct) {
      const pts = roundCountRef.current;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      chord([523, 659, 784], 0.06, 0.14, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: `+${pts} PERFECT!`, color: '#10b981', id: Date.now() });
      const next = Math.min(GRID_SIZE, roundCountRef.current + 1);
      safeTimeout(() => startRound(next), 600);
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG!', color: '#ef4444', id: Date.now() });
      beep({ freq: 200, dur: 0.2, type: 'sawtooth', vol: 0.12 });
      if (livesRef.current <= 0) { endGame(); return; }
      safeTimeout(() => startRound(Math.max(2, roundCountRef.current - 1)), 600);
    }
    setMode('watch');
  }, [mode, selected, endGame, startRound, safeTimeout]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3;
    setScore(0); setLives(3); setFeedback(null);
    activeRef.current = true;
    startRound(3);
    return () => {
      activeRef.current = false;
      clearAllTimers();
    };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const color = '#22d3ee';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c={color} />
        <Hud label="TILES" v={roundCount} c="#94a3b8" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, borderRadius: 16, padding: 12,
        background: 'radial-gradient(ellipse at 50% 50%, #00080f 0%, #020508 100%)',
        border: `1px solid ${color}18`,
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.16em', color: mode === 'watch' ? '#fbbf24' : color }}>
          {showing ? `MEMORIZE ${roundCount} TILES` : mode === 'input' ? 'SELECT THE LIT TILES' : '...'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%', maxWidth: 300 }}>
          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isLit = lit.has(i);
            const isSel = selected.has(i);
            return (
              <motion.button
                key={i}
                onPointerDown={() => toggleTile(i)}
                whileTap={mode === 'input' ? { scale: 0.88 } : {}}
                animate={isLit ? { backgroundColor: color, boxShadow: `0 0 20px ${color}88` } : {}}
                style={{
                  height: 56, borderRadius: 12, cursor: mode === 'input' ? 'pointer' : 'default',
                  background: isLit
                    ? color
                    : isSel
                      ? `${color}44`
                      : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${isLit ? color : isSel ? color : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isSel ? `0 0 16px ${color}55` : 'none',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              />
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

        {mode === 'input' && (
          <motion.button
            onPointerDown={submit}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '12px 40px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${color}33, ${color}18)`,
              border: `2px solid ${color}88`,
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13,
              color, letterSpacing: '0.12em',
              boxShadow: `0 0 20px ${color}33`,
            }}
          >
            SUBMIT ({selected.size}/{roundCount})
          </motion.button>
        )}
      </div>
    </div>
  );
}
