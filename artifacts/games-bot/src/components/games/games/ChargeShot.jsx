import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Hold the button to charge the power bar. Release EXACTLY when the bar is inside the green zone to score! The zone shrinks with each successful shot. Miss = score penalty. Reach the target score before time runs out to win!';
const TARGET = 35;
const CHARGE_SPEED = 2.0;
const MIN_ZONE = 0.04;

export default function ChargeShot({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [zoneStart, setZoneStart] = useState(0.72);
  const [zoneEnd, setZoneEnd] = useState(0.88);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const scoreRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const zoneRef = useRef({ start: 0.72, end: 0.88 });

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const animateCharge = useCallback((ts) => {
    if (!activeRef.current) return;
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = (ts - lastTimeRef.current) / 1000;
    lastTimeRef.current = ts;
    if (chargingRef.current) {
      chargeRef.current = Math.min(1, chargeRef.current + dt * CHARGE_SPEED);
    }
    setChargeLevel(chargeRef.current);
    rafRef.current = requestAnimationFrame(animateCharge);
  }, []);

  const startCharge = useCallback(() => {
    if (!activeRef.current) return;
    chargingRef.current = true;
    chargeRef.current = 0;
    lastTimeRef.current = 0;
    setIsCharging(true);
    triggerHaptic('light');
  }, []);

  const release = useCallback(() => {
    if (!activeRef.current || !chargingRef.current) return;
    chargingRef.current = false;
    setIsCharging(false);
    const v = chargeRef.current;
    const { start, end } = zoneRef.current;
    const inZone = v >= start && v <= end;
    const dist = inZone ? 0 : Math.min(Math.abs(v - start), Math.abs(v - end));
    if (inZone) {
      scoreRef.current++;
      setScore(scoreRef.current);
      const newRound = scoreRef.current + 1;
      setRound(newRound);
      const shrink = Math.max(MIN_ZONE, (end - start) * 0.85);
      const newStart = Math.max(0.1, end - shrink - Math.random() * 0.1);
      const newEnd = Math.min(0.95, newStart + shrink);
      zoneRef.current = { start: newStart, end: newEnd };
      setZoneStart(newStart);
      setZoneEnd(newEnd);
      chord([660, 990, 1320], 0.07, 0.14, 'sine');
      triggerHaptic('success');
      setFeedback({ label: '✓ PERFECT!', color: '#10b981' });
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 2);
      setScore(scoreRef.current);
      beep({ freq: 200, dur: 0.18, type: 'sawtooth', vol: 0.15 });
      triggerHaptic('error');
      setFeedback({ label: dist < 0.12 ? 'CLOSE! -2' : 'MISS -2', color: '#ef4444' });
    }
    chargeRef.current = 0;
    setChargeLevel(0);
    setTimeout(() => setFeedback(null), 600);
  }, [endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const GAME_TIME = game?.durationSeconds || 45;
    scoreRef.current = 0; chargeRef.current = 0; chargingRef.current = false;
    zoneRef.current = { start: 0.72, end: 0.88 };
    setScore(0); setRound(1); setChargeLevel(0); setIsCharging(false);
    setZoneStart(0.72); setZoneEnd(0.88); setFeedback(null); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animateCharge);
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { cancelAnimationFrame(rafRef.current); clearInterval(iv); activeRef.current = false; chargingRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 4} setPhase={setPhase} />;
  }

  const color = '#10b981';
  const barColor = chargeLevel >= zoneStart && chargeLevel <= zoneEnd ? '#10b981'
    : chargeLevel > zoneEnd ? '#ef4444' : '#3b82f6';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c={color} />
        <Hud label="ROUND" v={round} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c="#f97316" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={game?.durationSeconds || 45} timeLeft={timeLeft} color={color} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 28, padding: '16px 20px',
        borderRadius: 16, background: 'radial-gradient(ellipse at 50% 30%, #001a10 0%, #050810 100%)',
        border: `1px solid ${color}22`,
      }}>
        {/* Progress bar */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div style={{ fontSize: 10, fontFamily: 'Orbitron, sans-serif', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.16em', marginBottom: 8, textAlign: 'center' }}>
            CHARGE LEVEL
          </div>
          <div style={{ position: 'relative', height: 36, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Zone band */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
              left: `${zoneStart * 100}%`, width: `${(zoneEnd - zoneStart) * 100}%`,
              background: 'rgba(16,185,129,0.25)', border: '1px solid #10b98166',
            }} />
            {/* Fill */}
            <motion.div
              style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 99,
                background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                boxShadow: isCharging ? `0 0 18px ${barColor}88` : 'none',
              }}
              animate={{ width: `${chargeLevel * 100}%` }}
              transition={{ duration: 0 }}
            />
          </div>
          {/* Zone labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.3)' }}>EMPTY</span>
            <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>◀ ZONE ▶</span>
            <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.3)' }}>OVERCHARGE</span>
          </div>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.label + feedback.color}
              initial={{ opacity: 1, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.3 }}
              transition={{ duration: 0.55 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: feedback.color, textShadow: `0 0 20px ${feedback.color}` }}
            >
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hold button */}
        <motion.button
          onPointerDown={startCharge}
          onPointerUp={release}
          onPointerLeave={release}
          whileTap={{ scale: 0.93 }}
          style={{
            width: 160, height: 160, borderRadius: '50%', cursor: 'pointer',
            background: isCharging
              ? `radial-gradient(circle at 40% 38%, ${barColor}55, ${barColor}22)`
              : 'radial-gradient(circle at 40% 38%, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
            border: `3px solid ${isCharging ? barColor : 'rgba(255,255,255,0.1)'}`,
            boxShadow: isCharging ? `0 0 40px ${barColor}66, 0 0 80px ${barColor}22` : '0 0 8px rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 4,
            transition: 'background 0.08s, border-color 0.08s, box-shadow 0.08s',
          }}
        >
          <span style={{ fontSize: 42 }}>🔋</span>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 10, color: isCharging ? barColor : 'rgba(255,255,255,0.4)', letterSpacing: '0.12em' }}>
            {isCharging ? 'CHARGING…' : 'HOLD'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
