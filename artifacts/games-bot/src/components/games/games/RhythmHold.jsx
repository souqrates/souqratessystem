import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Notes scroll from right to left on a lane. HOLD when a note is over the hit line, RELEASE in the gap between notes. Stay on beat — 120 BPM! Hit 25 beats to win!';
const TARGET = 35;
const BPM = 120;
const BEAT_MS = (60 / BPM) * 1000;
const LANE_SCROLL_PX_PER_MS = 0.18;
const NOTE_WIDTH = 48;
const NOTE_SPACING = 2.2;

function generatePattern() {
  const notes = [];
  for (let i = 0; i < 32; i++) {
    if (Math.random() < 0.6) notes.push({ beat: i, hold: Math.random() < 0.3 });
    else notes.push(null);
  }
  return notes;
}

export default function RhythmHold({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(40);
  const [laneOffset, setLaneOffset] = useState(0);
  const [holding, setHolding] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(4);
  const activeRef = useRef(false);
  const holdingRef = useRef(false);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const patternRef = useRef(generatePattern());
  const beatScoreRef = useRef(new Set());

  const HIT_X = 60;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const checkBeat = useCallback((offset) => {
    const pattern = patternRef.current;
    for (let i = 0; i < pattern.length; i++) {
      if (!pattern[i]) continue;
      const noteX = 340 - (offset - i * BEAT_MS * LANE_SCROLL_PX_PER_MS);
      const noteWorldX = i * NOTE_SPACING * NOTE_WIDTH;
      const noteScreenX = noteWorldX - offset * LANE_SCROLL_PX_PER_MS * 1000;
      const distToHit = Math.abs(noteScreenX - HIT_X);
      if (distToHit < NOTE_WIDTH * 0.6 && !beatScoreRef.current.has(i)) {
        if (holdingRef.current) {
          beatScoreRef.current.add(i);
          scoreRef.current++;
          setScore(scoreRef.current);
          beep({ freq: 660 + (i % 5) * 60, dur: 0.06, vol: 0.09 });
          triggerHaptic('light');
          setFeedback({ label: '✓', color: '#10b981', id: Date.now() });  // game-symbol
          if (scoreRef.current >= (game.targetScore || TARGET)) endGame();
        }
      }
    }
  }, [endGame]);

  const animate = useCallback((ts) => {
    if (!activeRef.current) return;
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = ts - lastTimeRef.current;
    lastTimeRef.current = ts;
    const offset = (ts - startTimeRef.current);
    setLaneOffset(offset * LANE_SCROLL_PX_PER_MS * 1000);
    checkBeat(offset);
    rafRef.current = requestAnimationFrame(animate);
  }, [checkBeat]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3;
    setScore(0); setLives(3); setTimeLeft(40); setFeedback(null); setHolding(false);
    patternRef.current = generatePattern();
    beatScoreRef.current.clear(); holdingRef.current = false;
    activeRef.current = true;
    startTimeRef.current = performance.now();
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { cancelAnimationFrame(rafRef.current); clearInterval(iv); activeRef.current = false; holdingRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const pattern = patternRef.current;
  const color = '#e879f9';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="HITS" v={score} c={color} />
        <Hud label="HOLDING" v={holding ? '●' : '○'} c={holding ? color : '#94a3b8'} />
        <Hud label="TIME" v={`${timeLeft}s`} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={60} timeLeft={timeLeft} color={color} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 4 }}>
        {/* Lane */}
        <div style={{
          position: 'relative', height: 80, borderRadius: 14, overflow: 'hidden',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {/* Hit line */}
          <div style={{ position: 'absolute', left: HIT_X, top: 0, bottom: 0, width: 3, background: color, boxShadow: `0 0 12px ${color}88`, zIndex: 2 }} />

          {/* Notes */}
          {pattern.map((n, i) => {
            if (!n) return null;
            const x = i * NOTE_SPACING * NOTE_WIDTH - laneOffset;
            if (x < -NOTE_WIDTH || x > 340) return null;
            return (
              <div key={i} style={{
                position: 'absolute', left: x, top: '50%', transform: 'translateY(-50%)',
                width: n.hold ? NOTE_WIDTH * 1.8 : NOTE_WIDTH, height: 36,
                borderRadius: 10,
                background: `linear-gradient(90deg, ${color}88, ${color}44)`,
                border: `2px solid ${color}`,
                boxShadow: `0 0 12px ${color}55`,
              }} />
            );
          })}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.8 }} animate={{ opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
              style={{ textAlign: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color: feedback.color, textShadow: `0 0 16px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hold button */}
        <motion.button
          onPointerDown={() => { if (!activeRef.current) return; holdingRef.current = true; setHolding(true); triggerHaptic('light'); }}
          onPointerUp={() => { holdingRef.current = false; setHolding(false); }}
          onPointerLeave={() => { holdingRef.current = false; setHolding(false); }}
          style={{
            flex: 1, borderRadius: 18, cursor: 'pointer',
            background: holding ? `linear-gradient(160deg, ${color}33, ${color}11)` : 'rgba(255,255,255,0.03)',
            border: `2px solid ${holding ? color : 'rgba(255,255,255,0.07)'}`,
            boxShadow: holding ? `0 0 32px ${color}55` : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.08s, border-color 0.08s',
          }}
        >
          <span style={{ fontSize: 40 }}>♪</span>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 12, color: holding ? color : 'rgba(148,163,184,0.4)', letterSpacing: '0.12em' }}>
            {holding ? '— HOLDING —' : 'HOLD ON BEAT'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
