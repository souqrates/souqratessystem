import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'React to the signal as fast as possible!\nGREEN circle — Tap ONCE immediately\nRED circle — Do NOT tap (penalty!)\nYELLOW circle — Tap TWICE fast\n\nBe quick but accurate! 25 correct signals to win!';
const TARGET = 25;
const SIGNALS = [
  { type: 'green',  color: '#22c55e', label: 'TAP!',        action: 1 },
  { type: 'red',    color: '#ef4444', label: "DON'T TAP!",  action: 0 },
  { type: 'yellow', color: '#eab308', label: 'DOUBLE TAP!', action: 2 },
];

export default function SignalSnap({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [current, setCurrent] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [reactionTime, setReactionTime] = useState(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(4);
  const activeRef = useRef(false);
  const signalTimeRef = useRef(0);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const nextSignalRef = useRef(null);
  const currentRef = useRef(null);
  const waitingRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(tapTimerRef.current);
    clearTimeout(nextSignalRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextSignal = useCallback(() => {
    if (!activeRef.current) return;
    waitingRef.current = false;
    tapCountRef.current = 0;
    const sig = SIGNALS[Math.floor(Math.random() * SIGNALS.length)];
    currentRef.current = sig;
    setCurrent(sig);
    signalTimeRef.current = performance.now();
    nextSignalRef.current = setTimeout(() => {
      if (!waitingRef.current && sig.action !== 0) {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        setFeedback({ label: 'TOO SLOW!', color: '#ef4444' });
        triggerHaptic('error');
        setCurrent(null);
        currentRef.current = null;
        if (livesRef.current <= 0) { endGame(); return; }
        setTimeout(nextSignal, 600);
      }
    }, 850);
  }, [endGame]);

  const handleTap = useCallback(() => {
    if (!activeRef.current || !currentRef.current) return;
    const sig = currentRef.current;
    tapCountRef.current++;
    const rt = Math.round(performance.now() - signalTimeRef.current);

    if (sig.action === 0) {
      // Red — should not tap
      clearTimeout(nextSignalRef.current);
      waitingRef.current = true;
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      beep({ freq: 200, dur: 0.2, type: 'sawtooth', vol: 0.15 });
      triggerHaptic('error');
      setFeedback({ label: '✗ WRONG!', color: '#ef4444' });
      setCurrent(null); currentRef.current = null;
      if (livesRef.current <= 0) { endGame(); return; }
      setTimeout(nextSignal, 900);
    } else if (sig.action === 1) {
      clearTimeout(nextSignalRef.current);
      waitingRef.current = true;
      scoreRef.current++;
      setScore(scoreRef.current);
      const speed = rt < 350 ? '! ' : '';
      beep({ freq: 660, dur: 0.07, vol: 0.1 });
      triggerHaptic('success');
      setReactionTime(rt);
      setFeedback({ label: `${speed}${rt}ms`, color: rt < 400 ? '#10b981' : '#fbbf24' });
      setCurrent(null); currentRef.current = null;
      setTimeout(nextSignal, 500);
    } else if (sig.action === 2) {
      if (tapCountRef.current === 2) {
        clearTimeout(tapTimerRef.current);
        clearTimeout(nextSignalRef.current);
        waitingRef.current = true;
        scoreRef.current++;
        setScore(scoreRef.current);
        chord([440, 660], 0.05, 0.1, 'triangle');
        triggerHaptic('success');
        setFeedback({ label: '✓✓ DOUBLE!', color: '#f59e0b' });
        setCurrent(null); currentRef.current = null;
        setTimeout(nextSignal, 600);
      } else {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = setTimeout(() => {
          if (tapCountRef.current < 2 && activeRef.current) {
            clearTimeout(nextSignalRef.current);
            livesRef.current = Math.max(0, livesRef.current - 1);
            setLives(livesRef.current);
            beep({ freq: 220, dur: 0.15, type: 'sawtooth', vol: 0.12 });
            triggerHaptic('error');
            setFeedback({ label: 'NEED 2 TAPS', color: '#ef4444' });
            setCurrent(null); currentRef.current = null;
            if (livesRef.current <= 0) { endGame(); return; }
            setTimeout(nextSignal, 800);
          }
        }, 500);
      }
    }
  }, [endGame, nextSignal]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3; tapCountRef.current = 0;
    setScore(0); setLives(3); setCurrent(null); setFeedback(null); setReactionTime(null);
    activeRef.current = true; waitingRef.current = false; currentRef.current = null;
    nextSignalRef.current = setTimeout(nextSignal, 500);
    return () => { clearTimeout(tapTimerRef.current); clearTimeout(nextSignalRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const sigColor = current?.color ?? '#64748b';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="CORRECT" v={score} c="#10b981" />
        <Hud label="STREAK" v={`${score}/${game.targetScore || TARGET}`} c="rgba(148,163,184,0.5)" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />

      <div
        onPointerDown={handleTap}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, borderRadius: 16, overflow: 'hidden', minHeight: 340,
          background: current ? `radial-gradient(ellipse at 50% 40%, ${sigColor}22, #050810 70%)` : 'radial-gradient(ellipse at 50% 50%, #0a0a14, #050810)',
          border: `2px solid ${current ? sigColor + '44' : 'rgba(255,255,255,0.06)'}`,
          cursor: 'pointer', touchAction: 'none',
          transition: 'background 0.1s, border-color 0.1s',
        }}
      >
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.type}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: current.color, margin: '0 auto', boxShadow: `0 0 40px ${current.color}88, inset 0 3px 8px rgba(255,255,255,0.25)` }} />
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: sigColor, margin: '12px 0 0', textShadow: `0 0 20px ${sigColor}` }}>
                {current.label}
              </p>
            </motion.div>
          )}
          {!current && (
            <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.2em' }}>WAIT…</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.label + feedback.color}
              initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'absolute', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: feedback.color, textShadow: `0 0 16px ${feedback.color}`, pointerEvents: 'none' }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'absolute', bottom: 14, fontSize: 10, color: 'rgba(148,163,184,0.25)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.16em' }}>
          TAP ANYWHERE
        </div>
      </div>
    </div>
  );
}
