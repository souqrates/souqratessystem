import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A circle pulses at 120 BPM. Tap in sync with every FOURTH pulse (the big one). Your deviation in milliseconds is measured. Keep average below 80ms. Score 20 perfect taps to win!';
const TARGET = 28;
const BPM = 120;
const BEAT_MS = (60 / BPM) * 1000;
const TAP_BEAT = 4;

export default function PulseMatch({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [beat, setBeat] = useState(0);
  const [avgDev, setAvgDev] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [lives, setLives] = useState(3);
  const [pulseKey, setPulseKey] = useState(0);

  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const activeRef = useRef(false);
  const beatRef = useRef(0);
  const beatStartRef = useRef(0);
  const devsRef = useRef([]);
  const ivRef = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(ivRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const handleTap = useCallback(() => {
    if (!activeRef.current) return;
    const offset = performance.now() - beatStartRef.current;
    const progress = offset % BEAT_MS;
    const isBig = beatRef.current % TAP_BEAT === TAP_BEAT - 1;
    if (!isBig) {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      beep({ freq: 220, dur: 0.12, type: 'sawtooth', vol: 0.12 });
      triggerHaptic('error');
      setFeedback({ label: 'WRONG BEAT!', color: '#ef4444', id: Date.now() });
      if (livesRef.current <= 0) endGame();
      return;
    }
    const halfBeat = BEAT_MS / 2;
    const dev = Math.abs(progress - halfBeat);
    devsRef.current.push(dev);
    const avg = devsRef.current.reduce((a, b) => a + b, 0) / devsRef.current.length;
    setAvgDev(Math.round(avg));
    if (dev < 60) {
      scoreRef.current++;
      setScore(scoreRef.current);
      const label = dev < 25 ? '◆ PERFECT' : dev < 45 ? '✓ GREAT' : 'GOOD';  // game-symbol
      const color = dev < 25 ? '#10b981' : dev < 45 ? '#22d3ee' : '#fbbf24';
      setFeedback({ label: `${label} (${Math.round(dev)}ms)`, color, id: Date.now() });
      chord([440, 660, 880], 0.05, 0.1, 'sine');
      triggerHaptic('success');
      if (scoreRef.current >= (game.targetScore || TARGET)) endGame();
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      setFeedback({ label: `LATE ${Math.round(dev)}ms`, color: '#f59e0b', id: Date.now() });
      beep({ freq: 300, dur: 0.08, vol: 0.09 });
      triggerHaptic('light');
      if (livesRef.current <= 0) endGame();
    }
  }, [endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3; beatRef.current = 0; devsRef.current = [];
    setScore(0); setLives(3); setBeat(0); setAvgDev(0); setFeedback(null);
    activeRef.current = true;
    beatStartRef.current = performance.now();
    ivRef.current = setInterval(() => {
      beatRef.current = (beatRef.current + 1) % (TAP_BEAT * 4);
      setBeat(b => (b + 1) % (TAP_BEAT * 4));
      setPulseKey(k => k + 1);
    }, BEAT_MS);
    return () => { clearInterval(ivRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 4} setPhase={setPhase} />;
  }

  const isBig = beat % TAP_BEAT === TAP_BEAT - 1;
  const mini = beat % TAP_BEAT;
  const color = '#22d3ee';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SYNCED" v={score} c={color} />
        <Hud label="AVG DEV" v={`${avgDev}ms`} c={avgDev < 60 ? '#10b981' : avgDev < 100 ? '#fbbf24' : '#ef4444'} />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />

      <div
        onPointerDown={handleTap}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 24, borderRadius: 16, overflow: 'hidden', minHeight: 340,
          background: 'radial-gradient(ellipse at 50% 50%, #001418 0%, #040810 100%)',
          border: `1px solid ${color}22`, cursor: 'pointer', touchAction: 'none',
        }}
      >
        {/* Mini beat counter */}
        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: TAP_BEAT }).map((_, i) => (
            <motion.div
              key={i}
              animate={mini === i ? { scale: 1.3, background: isBig ? color : '#fbbf24' } : { scale: 1, background: 'rgba(255,255,255,0.08)' }}
              transition={{ duration: 0.06 }}
              style={{ width: 10, height: 10, borderRadius: '50%' }}
            />
          ))}
        </div>

        {/* Pulsing circle */}
        <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[1, 0.6, 0.3].map((op, i) => (
            <motion.div
              key={`${pulseKey}-${i}`}
              initial={{ scale: isBig ? 0.8 : 0.92, opacity: isBig ? 0.9 : 0.5 }}
              animate={{ scale: isBig ? [0.8, 1.1, 1.05] : [0.92, 1.02, 1], opacity: [op, op * 0.3, op * 0.1] }}
              transition={{ duration: BEAT_MS / 1000, ease: 'easeOut' }}
              style={{
                position: 'absolute', borderRadius: '50%',
                width: 180 - i * 28, height: 180 - i * 28,
                border: `${isBig ? 3 : 1.5}px solid ${isBig ? color : `${color}66`}`,
                boxShadow: isBig ? `0 0 30px ${color}88` : 'none',
              }}
            />
          ))}
          <motion.div
            key={pulseKey}
            initial={{ scale: isBig ? 1.2 : 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.12, type: 'spring', stiffness: 500 }}
            style={{
              width: isBig ? 70 : 50, height: isBig ? 70 : 50, borderRadius: '50%',
              background: isBig ? `radial-gradient(circle, ${color}, ${color}88)` : `rgba(255,255,255,0.08)`,
              boxShadow: isBig ? `0 0 30px ${color}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isBig && <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#fff', fontWeight: 900 }}>TAP</span>}
          </motion.div>
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.9 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.25)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.16em' }}>
          TAP ON THE BIG PULSE
        </div>
      </div>
    </div>
  );
}
