import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Stroop challenge! A color name is shown in a different ink color. Tap the INK COLOR (not the word)! The word will try to trick you. Wrong tap = score penalty. Reach the target before time runs out!';
const TARGET = 60;
const DEFAULT_GAME_TIME = 40;

const PALETTE = [
  { name: 'RED',    color: '#ef4444' },
  { name: 'BLUE',   color: '#3b82f6' },
  { name: 'GREEN',  color: '#10b981' },
  { name: 'YELLOW', color: '#fbbf24' },
];

function makeRound() {
  const wordIdx = Math.floor(Math.random() * PALETTE.length);
  let inkIdx = Math.floor(Math.random() * PALETTE.length);
  // ensure mismatch at least 40% of time, always differ by at least sometimes
  if (Math.random() < 0.55 && inkIdx === wordIdx) {
    inkIdx = (inkIdx + 1 + Math.floor(Math.random() * (PALETTE.length - 1))) % PALETTE.length;
  }
  return { word: PALETTE[wordIdx], ink: PALETTE[inkIdx] };
}

export default function ColorRush({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [round, setRound] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextRound = useCallback(() => {
    setRound(makeRound());
    setChosen(null);
  }, []);

  const tap = useCallback((palIdx) => {
    if (!activeRef.current || chosen !== null || !round) return;
    setChosen(palIdx);
    const correct = PALETTE.indexOf(round.ink);

    if (palIdx === correct) {
      comboRef.current++;
      const bonus = comboRef.current >= 5 ? 2 : 1;
      scoreRef.current += bonus;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      beep({ freq: 660 + comboRef.current * 30, dur: 0.07, vol: 0.1 });
      triggerHaptic('success');
      const label = comboRef.current >= 5 ? `★×${comboRef.current} +${bonus}` : '✓ CORRECT';
      setFeedback({ label, color: '#10b981', id: Date.now() });
      setTimeout(nextRound, 380);
    } else {
      comboRef.current = 0;
      setCombo(0);
      scoreRef.current = Math.max(0, scoreRef.current - 3);
      setScore(scoreRef.current);
      triggerHaptic('error');
      setFeedback({ label: 'WRONG! -3', color: '#ef4444', id: Date.now() });
      beep({ freq: 200, dur: 0.15, type: 'sawtooth', vol: 0.12 });
      setTimeout(nextRound, 600);
    }
  }, [chosen, round, endGame, nextRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setFeedback(null);
    activeRef.current = true;
    nextRound();
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
        <Hud label="SCORE" v={score} c="#fbbf24" />
        <Hud label="COMBO" v={combo >= 4 ? `${combo}x` : combo} c={combo >= 4 ? '#f97316' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c="#f97316" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color="#fbbf24" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 24, borderRadius: 16, padding: 16,
        background: 'radial-gradient(ellipse at 50% 50%, #080400 0%, #030200 100%)',
        border: '1px solid rgba(251,191,36,0.1)',
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(148,163,184,0.4)' }}>
          TAP THE INK COLOR
        </div>

        {round && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${round.word.name}-${round.ink.name}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              style={{
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 42,
                color: round.ink.color,
                textShadow: `0 0 30px ${round.ink.color}66`,
                letterSpacing: '0.04em',
              }}
            >
              {round.word.name}
            </motion.div>
          </AnimatePresence>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 280 }}>
          {PALETTE.map((p, i) => {
            const isChosen = chosen === i;
            const isCorrect = round && i === PALETTE.indexOf(round.ink);
            const showResult = chosen !== null;
            return (
              <motion.button
                key={p.name}
                onPointerDown={() => tap(i)}
                whileTap={chosen === null ? { scale: 0.92 } : {}}
                style={{
                  position: 'relative',
                  height: 72, borderRadius: 16, cursor: chosen === null ? 'pointer' : 'default',
                  background: showResult
                    ? isCorrect ? 'rgba(16,185,129,0.25)' : isChosen ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'
                    : `radial-gradient(circle at 40% 35%, ${p.color}55, ${p.color}15)`,
                  border: `3px solid ${showResult ? (isCorrect ? '#10b981' : isChosen ? '#ef4444' : `${p.color}22`) : p.color}`,
                  boxShadow: !showResult ? `0 0 18px ${p.color}55, inset 0 0 14px ${p.color}33` : 'none',
                  overflow: 'hidden',
                }}
              >
                {/* Solid color core (visual cue — no text, since the word is the trick) */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: showResult && !isCorrect && !isChosen ? `${p.color}33` : p.color,
                  boxShadow: showResult ? 'none' : `0 0 16px ${p.color}, 0 0 4px #fff`,
                  border: '2px solid rgba(255,255,255,0.25)',
                  margin: '0 auto',
                }} />
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
