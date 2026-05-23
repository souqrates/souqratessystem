import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'REACTION REVERSE \u2014 When the signal turns GREEN, tap as fast as you can. If it turns RED, DO NOT tap. Wrong tap = penalty. Faster correct taps = more points. 60 seconds.';
const DEFAULT_GAME_TIME = 60;

// Bot hits GREEN with avg 80ms reaction, avoids traps 80% of time
const BOT_REACT_MIN = 55;
const BOT_REACT_MAX = 180;

export default function ReactionReverse({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [state, setState] = useState('wait');
  const [score, setScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);
  const [botFlash, setBotFlash] = useState(null);

  const stateRef = useRef('wait');
  const cueAtRef = useRef(0);
  const scoreRef = useRef(0);
  const botRef = useRef(0);
  const cueTimerRef = useRef(null);
  const cueEndRef = useRef(null);
  const botCueTimerRef = useRef(null);
  const tickRef = useRef(null);
  const activeRef = useRef(false);

  const setS = (s) => { stateRef.current = s; setState(s); };

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(cueTimerRef.current);
    clearTimeout(cueEndRef.current);
    clearTimeout(botCueTimerRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    const playerWon = scoreRef.current >= botRef.current;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate]);

  // When a cue fires, bot reacts: hits GO fast, mostly avoids traps
  const botReactToCue = useCallback((isTrap, cueAt) => {
    if (!activeRef.current) return;
    const delay = BOT_REACT_MIN + Math.random() * (BOT_REACT_MAX - BOT_REACT_MIN);
    botCueTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      if (!isTrap) {
        // Bot hits GO
        const rt = delay;
        const pts = Math.max(20, Math.floor(120 - rt / 8));
        botRef.current += pts;
        setBotScore(botRef.current);
        setBotFlash(`+${pts}`);
        setTimeout(() => setBotFlash(null), 400);
      } else if (Math.random() < 0.2) {
        // Bot occasionally taps trap (20% error rate)
        botRef.current = Math.max(0, botRef.current - 15);
        setBotScore(botRef.current);
      } else {
        // Bot correctly avoids trap
        botRef.current += 10;
        setBotScore(botRef.current);
      }
    }, delay);
  }, []);

  const startCycle = useCallback(() => {
    if (!activeRef.current) return;
    setS('wait');
    // Harder: shorter cycles, more "DO NOT TAP" prompts, ramps with score
    const scoreScale = Math.min(1, scoreRef.current / 800);
    const delay = (500 + Math.random() * 1200) * (1 - scoreScale * 0.35);
    cueTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      // Bias toward traps — 55% base, rising with score
      const isTrap = Math.random() < (0.55 + scoreScale * 0.1);
      cueAtRef.current = Date.now();
      setS(isTrap ? 'trap' : 'go');
      botReactToCue(isTrap, cueAtRef.current);
      beep({ freq: isTrap ? 240 : 700, dur: 0.1, type: 'triangle' });
      triggerHaptic(isTrap ? 'warning' : 'light');
      const window = (isTrap ? 700 : 850) * (1 - scoreScale * 0.25);
      cueEndRef.current = setTimeout(() => {
        if (!activeRef.current) return;
        if (stateRef.current === 'go') {
          scoreRef.current = Math.max(0, scoreRef.current - 5);
          setScore(scoreRef.current);
          setFlash({ type: 'late' });
          triggerHaptic('error');
          setTimeout(() => setFlash(null), 350);
        } else if (stateRef.current === 'trap') {
          scoreRef.current += 10;
          setScore(scoreRef.current);
          setFlash({ type: 'avoid' });
          triggerHaptic('light');
          setTimeout(() => setFlash(null), 280);
        }
        startCycle();
      }, window);
    }, delay);
  }, []);

  const onTap = () => {
    if (!activeRef.current) return;
    const s = stateRef.current;
    if (s === 'go') {
      const rt = Date.now() - cueAtRef.current;
      const pts = Math.max(20, Math.floor(120 - rt / 8));
      scoreRef.current += pts;
      setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      setFlash({ type: 'hit', rt, pts });
      beep({ freq: 880, dur: 0.1, type: 'triangle' });
      triggerHaptic('medium');
      setTimeout(() => setFlash(null), 320);
      clearTimeout(cueEndRef.current);
      startCycle();
    } else if (s === 'trap') {
      scoreRef.current = Math.max(0, scoreRef.current - 15);
      setScore(scoreRef.current);
      setFlash({ type: 'trap' });
      noise({ dur: 0.2, vol: 0.2 });
      triggerHaptic('error');
      setTimeout(() => setFlash(null), 380);
      clearTimeout(cueEndRef.current);
      startCycle();
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 8);
      setScore(scoreRef.current);
      setFlash({ type: 'early' });
      triggerHaptic('warning');
      setTimeout(() => setFlash(null), 280);
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; botRef.current = 0;
    setScore(0); setBotScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    setS('wait');
    startCycle();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => {
      activeRef.current = false;
      clearTimeout(cueTimerRef.current);
      clearTimeout(cueEndRef.current);
      clearTimeout(botCueTimerRef.current);
      clearInterval(tickRef.current);
    };
  }, [phase, startCycle, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  const bg = state === 'go' ? '#00f5a0' : state === 'trap' ? '#ff3355' : '#162028';
  const label = state === 'go' ? 'TAP!' : state === 'trap' ? 'DO NOT TAP' : 'WAIT...';

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #061a1a 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="YOU" val={score} color="#00f5a0" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <div style={{ position: 'relative', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 8, color: 'rgba(249,115,22,0.7)', letterSpacing: '0.18em', margin: 0 }}>OPP</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#f97316', margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 12px #f9731655' }}>{botScore}</p>
          <AnimatePresence>
            {botFlash && (
              <motion.span key={botFlash + Math.random()} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -14 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{ position: 'absolute', top: 2, right: 6, fontSize: 9, fontWeight: 900, color: '#f97316', fontFamily: 'Orbitron, sans-serif', pointerEvents: 'none' }}>
                {botFlash}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        onPointerDown={onTap}
        animate={{ background: state === 'go'
          ? 'radial-gradient(circle at 35% 30%, #5fffd0 0%, #00f5a0 40%, #00553a 100%)'
          : state === 'trap'
          ? 'radial-gradient(circle at 35% 30%, #ffb3c1 0%, #ff3355 40%, #6a0014 100%)'
          : 'radial-gradient(circle at 35% 30%, #2a3a4a 0%, #11202a 50%, #050a12 100%)' }}
        transition={{ duration: 0.08 }}
        style={{
          flex: 1, marginTop: 4, borderRadius: 32, cursor: 'pointer',
          border: `3px solid ${bg}`,
          boxShadow: `0 0 70px ${bg}aa, inset 0 0 60px rgba(0,0,0,0.45), inset 0 0 20px ${bg}55`,
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 44,
          color: '#fff', textShadow: `0 0 28px ${bg}, 0 0 60px ${bg}`,
          letterSpacing: '0.18em',
          position: 'relative', overflow: 'hidden',
        }}>
        {/* Inner pulsing ring on active states */}
        {(state === 'go' || state === 'trap') && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: '20%',
              borderRadius: '50%',
              border: `2px solid ${bg}`,
              boxShadow: `0 0 30px ${bg}`,
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Subtle waiting shimmer */}
        {state === 'wait' && (
          <motion.div
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at center, rgba(0,212,255,0.1), transparent 60%)',
              pointerEvents: 'none',
            }}
          />
        )}
        <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
      </motion.button>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              padding: '8px 18px', borderRadius: 999,
              background: flash.type === 'hit' || flash.type === 'avoid' ? 'rgba(0,245,160,0.2)' : 'rgba(255,77,109,0.2)',
              border: `1px solid ${flash.type === 'hit' || flash.type === 'avoid' ? '#00f5a0' : '#ff4d6d'}`,
              color: flash.type === 'hit' || flash.type === 'avoid' ? '#00f5a0' : '#ff4d6d',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.15em',
            }}>
            {flash.type === 'hit' && `HIT ${flash.rt}ms +${flash.pts}`}
            {flash.type === 'avoid' && 'CLEAN +10'}
            {flash.type === 'trap' && 'TRAP -15'}
            {flash.type === 'early' && 'TOO EARLY -8'}
            {flash.type === 'late' && 'TOO LATE -5'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
