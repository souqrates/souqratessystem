import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { getFrameInterval } from '../../../lib/canvasQuality';
import { TimeBar } from './_shell';

const RULES = 'SUMO PUSH — HOLD to charge your push, RELEASE in the green zone for max power. Perfect timing = critical hits. Score from clean charges over 60 seconds. Outscore your opponent!';
const GAME_TIME = 60;

// Bot executes a "push" every BOT_CYCLE_MS — scores STRONG/PERFECT randomly
const BOT_CYCLE_MIN = 2200;
const BOT_CYCLE_MAX = 3800;

export default function SumoPush({ phase, setPhase, onScoreUpdate, game }) {
  const DURATION = game?.durationSeconds || GAME_TIME;
  const [charge, setCharge] = useState(0);
  const [score, setScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);
  const [botFlash, setBotFlash] = useState(null);
  const [shock, setShock] = useState(false);

  const chargeRef = useRef(0);
  const scoreRef = useRef(0);
  const botRef = useRef(0);
  const botComboRef = useRef(0);
  const comboRef = useRef(0);
  const holdingRef = useRef(false);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const botTimerRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(tickRef.current);
    clearTimeout(botTimerRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    const playerWon = scoreRef.current >= botRef.current;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate]);

  const scheduleBotPush = useCallback(() => {
    if (!activeRef.current) return;
    const delay = BOT_CYCLE_MIN + Math.random() * (BOT_CYCLE_MAX - BOT_CYCLE_MIN);
    botTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      // Bot hits PERFECT 40%, STRONG 40%, OK 20%
      const r = Math.random();
      let pts;
      if (r < 0.4) { pts = 90 + botComboRef.current * 5; botComboRef.current++; }
      else if (r < 0.8) { pts = 55; botComboRef.current++; }
      else { pts = 25; botComboRef.current = 0; }
      botRef.current += pts;
      setBotScore(botRef.current);
      setBotFlash({ pts, id: Math.random() });
      setTimeout(() => setBotFlash(null), 500);
      scheduleBotPush();
    }, delay);
  }, []);

  let _skzLastT = 0;
  const _skzFI = getFrameInterval();
  const tick = useCallback((now = performance.now()) => {
    if (now - _skzLastT < _skzFI) { rafRef.current = requestAnimationFrame(tick); return; }
    _skzLastT = now;
    if (!activeRef.current) return;
    if (holdingRef.current) {
      chargeRef.current = Math.min(100, chargeRef.current + 1.4);
      setCharge(chargeRef.current);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const onDown = () => {
    if (!activeRef.current) return;
    holdingRef.current = true;
    chargeRef.current = 0;
    setCharge(0);
  };
  const onUp = () => {
    if (!activeRef.current) return;
    holdingRef.current = false;
    const c = chargeRef.current;
    let pts = 0; let label = 'WEAK';
    if (c >= 75 && c <= 90) { pts = 90 + comboRef.current * 5; label = 'PERFECT'; comboRef.current += 1; }
    else if (c >= 60 && c < 75) { pts = 55; label = 'STRONG'; comboRef.current += 1; }
    else if (c >= 90) { pts = 20; label = 'OVERCHARGE'; comboRef.current = 0; }
    else if (c >= 35) { pts = 25; label = 'OK'; comboRef.current = 0; }
    else { pts = 8; label = 'WEAK'; comboRef.current = 0; }
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    setFlash({ label, pts, id: Math.random() });
    setTimeout(() => setFlash(null), 600);
    if (label === 'PERFECT') {
      setShock(true);
      setTimeout(() => setShock(false), 250);
      beep({ freq: 880, dur: 0.18, type: 'square' });
      triggerHaptic('medium');
    } else if (label === 'OVERCHARGE') {
      noise({ dur: 0.2, vol: 0.18 });
      triggerHaptic('error');
    } else {
      beep({ freq: 360, dur: 0.12, type: 'triangle' });
      triggerHaptic('light');
    }
    chargeRef.current = 0;
    setCharge(0);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    chargeRef.current = 0; scoreRef.current = 0; comboRef.current = 0; botRef.current = 0; botComboRef.current = 0;
    setScore(0); setBotScore(0); setCombo(0); setCharge(0); setTimeLeft(DURATION);
    activeRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
    scheduleBotPush();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); clearTimeout(botTimerRef.current); };
  }, [phase, tick, endGame, scheduleBotPush]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #2e0a0a 0%, #04020a 100%)',
      transform: shock ? 'scale(1.02)' : 'scale(1)', transition: 'transform 0.12s',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* HUD — YOU vs OPPONENT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="YOU" val={score} color="#ff6b6b" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <div style={{ position: 'relative', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 8, color: 'rgba(249,115,22,0.7)', letterSpacing: '0.18em', margin: 0 }}>OPP</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#f97316', margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 12px #f9731655' }}>{botScore}</p>
          <AnimatePresence>
            {botFlash && (
              <motion.span key={botFlash.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -14 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{ position: 'absolute', top: 2, right: 6, fontSize: 9, fontWeight: 900, color: '#f97316', fontFamily: 'Orbitron, sans-serif', pointerEvents: 'none' }}>
                +{botFlash.pts}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Tile label="COMBO" val={`x${combo}`} color="#ffcc00" />

      <div style={{ position: 'relative', height: 28, borderRadius: 10, overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ position: 'absolute', left: '75%', right: '10%', top: 0, bottom: 0,
          background: 'linear-gradient(90deg, rgba(0,245,160,0.45), rgba(0,245,160,0.2))',
          borderLeft: '2px dashed #00f5a0', borderRight: '2px dashed #00f5a0' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${charge}%`,
          background: charge > 90 ? 'linear-gradient(90deg, #ffcc00, #ff3355)' : charge > 75 ? 'linear-gradient(90deg, #00f5a0, #ffcc00)' : 'linear-gradient(90deg, #ff6b6b, #ff3355)',
          boxShadow: 'inset 0 0 14px rgba(0,0,0,0.4)', transition: 'background 0.1s' }} />
      </div>
      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <motion.button
        whileTap={{ scale: 0.96 }}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={() => holdingRef.current && onUp()}
        style={{
          flex: 1, marginTop: 6, borderRadius: 26, cursor: 'pointer',
          border: `3px solid ${charge > 90 ? '#ff3355' : charge > 75 ? '#00f5a0' : '#ff6b6b'}`,
          background: 'radial-gradient(circle at center, #ff6b6b22, #ff6b6b06)',
          boxShadow: `0 0 50px ${charge > 75 ? '#00f5a0aa' : '#ff6b6b88'}, inset 0 0 50px rgba(0,0,0,0.4)`,
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 26,
          color: '#fff', textShadow: '0 0 18px #ff6b6b', letterSpacing: '0.1em',
          transition: 'border 0.15s, box-shadow 0.15s',
        }}>
        HOLD &amp; RELEASE
      </motion.button>

      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            style={{
              position: 'absolute', bottom: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 30, pointerEvents: 'none',
              color: flash.label === 'PERFECT' ? '#00f5a0' : flash.label === 'OVERCHARGE' ? '#ff3355' : '#ffcc00',
              textShadow: '0 0 22px currentColor', textAlign: 'center',
            }}>
            {flash.label}<br />
            <span style={{ fontSize: 18 }}>+{flash.pts}</span>
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
