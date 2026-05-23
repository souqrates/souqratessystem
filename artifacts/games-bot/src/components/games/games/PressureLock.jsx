import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A needle spins around the dial. HOLD to slow it down, RELEASE to lock it. Score points based on how close you land to the center green zone. 10 rounds — highest total wins!';
const ROUNDS = 10;
const BASE_SPEED = 3.2;
const HOLD_FACTOR = 0.12;

export default function PressureLock({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [angle, setAngle] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [locked, setLocked] = useState(false);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const angleRef = useRef(0);
  const holdingRef = useRef(false);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const roundRef = useRef(1);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || 80) ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextRound = useCallback(() => {
    if (roundRef.current >= ROUNDS) { endGame(); return; }
    roundRef.current++;
    setRound(roundRef.current);
    speedRef.current = BASE_SPEED + roundRef.current * 0.2;
    setLocked(false);
    setTimeout(() => setFeedback(null), 500);
  }, [endGame]);

  const doLock = useCallback(() => {
    if (!activeRef.current || locked) return;
    holdingRef.current = false;
    setIsHolding(false);
    setLocked(true);
    const a = ((angleRef.current % 360) + 360) % 360;
    const dist = Math.min(Math.abs(a - 180), 360 - Math.abs(a - 180));
    let pts, label, color;
    if (dist < 8) { pts = 12; label = '💎 BULLSEYE'; color = '#10b981'; chord([880, 1320, 1760], 0.08, 0.15, 'triangle'); triggerHaptic('success'); }
    else if (dist < 18) { pts = 9; label = '✓ PERFECT'; color = '#22d3ee'; beep({ freq: 660, dur: 0.08, vol: 0.1 }); triggerHaptic('success'); }
    else if (dist < 35) { pts = 6; label = 'GREAT'; color = '#fbbf24'; beep({ freq: 480, dur: 0.07, vol: 0.08 }); triggerHaptic('light'); }
    else if (dist < 60) { pts = 3; label = 'GOOD'; color = '#94a3b8'; beep({ freq: 360, dur: 0.06, vol: 0.07 }); triggerHaptic('light'); }
    else { pts = 0; label = 'MISS'; color = '#ef4444'; beep({ freq: 200, dur: 0.15, type: 'sawtooth', vol: 0.12 }); triggerHaptic('error'); }
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setFeedback({ label: `${label} +${pts}`, color });
    setTimeout(nextRound, 900);
  }, [locked, nextRound]);

  const animateNeedle = useCallback((ts) => {
    if (!activeRef.current) return;
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = (ts - lastTimeRef.current) / 1000;
    lastTimeRef.current = ts;
    const speed = holdingRef.current ? speedRef.current * HOLD_FACTOR : speedRef.current;
    angleRef.current = (angleRef.current + speed * dt * 180) % 360;
    setAngle(angleRef.current);
    rafRef.current = requestAnimationFrame(animateNeedle);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; roundRef.current = 1; angleRef.current = 0; speedRef.current = BASE_SPEED;
    holdingRef.current = false;
    setScore(0); setRound(1); setAngle(0); setFeedback(null); setLocked(false); setIsHolding(false);
    activeRef.current = true;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animateNeedle);
    return () => { cancelAnimationFrame(rafRef.current); activeRef.current = false; holdingRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current} setPhase={setPhase} />;
  }

  const cx = 140, cy = 140, r = 110;
  const needleAngleRad = ((angle - 90) * Math.PI) / 180;
  const nx = cx + r * Math.cos(needleAngleRad);
  const ny = cy + r * Math.sin(needleAngleRad);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f43f5e" />
        <Hud label="ROUND" v={`${round}/${ROUNDS}`} c="#94a3b8" />
        <Hud label="LIVES" v={'♥'.repeat(3)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || 80} label="TARGET TO WIN" />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, borderRadius: 16, background: 'radial-gradient(ellipse at 50% 30%, #1a0010 0%, #060308 100%)',
        border: '1px solid rgba(244,63,94,0.15)', padding: 16,
      }}>
        {/* Dial SVG */}
        <div style={{ position: 'relative' }}>
          <svg width={280} height={280} style={{ overflow: 'visible' }}>
            {/* Dial rings */}
            <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            {/* Score arcs */}
            {[[8, '#10b981', 60], [18, '#22d3ee', 54], [35, '#fbbf24', 50], [60, '#94a3b8', 46]].map(([deg, color, r2], i) => (
              <circle key={i} cx={cx} cy={cy} r={r2 + 60} fill="none" stroke={color}
                strokeWidth={3} strokeDasharray={`${(deg * 2 / 360) * 2 * Math.PI * (r2 + 60)} 1000`}
                strokeDashoffset={`${(0.5 - (deg / 360)) * 2 * Math.PI * (r2 + 60)}`}
                strokeLinecap="round" opacity={0.5}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))}
            {/* Zone arc at top (180°) */}
            <path d={`M${cx - 16},${cy - r} A${r},${r} 0 0,1 ${cx + 16},${cy - r}`} fill="none" stroke="#10b981" strokeWidth={8} strokeLinecap="round" opacity={0.7} />
            <path d={`M${cx - 40},${cy - r + 5} A${r},${r} 0 0,1 ${cx + 40},${cy - r + 5}`} fill="none" stroke="#22d3ee" strokeWidth={4} strokeLinecap="round" opacity={0.4} />
            {/* Tick marks */}
            {Array.from({ length: 36 }).map((_, i) => {
              const a = (i * 10 - 90) * Math.PI / 180;
              const ir = r - 8, or2 = r - 1;
              return <line key={i} x1={cx + ir * Math.cos(a)} y1={cy + ir * Math.sin(a)} x2={cx + or2 * Math.cos(a)} y2={cy + or2 * Math.sin(a)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />;
            })}
            {/* Needle */}
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={isHolding ? '#fbbf24' : '#f43f5e'} strokeWidth={3} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={8} fill={isHolding ? '#fbbf24' : '#f43f5e'} />
            {/* Needle tip glow */}
            <circle cx={nx} cy={ny} r={5} fill={isHolding ? '#fbbf2488' : '#f43f5e88'} />
          </svg>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.label} initial={{ opacity: 1, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color: feedback.color, textShadow: `0 0 18px ${feedback.color}`, minHeight: 28 }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hold button */}
        <motion.button
          onPointerDown={() => { if (!activeRef.current || locked) return; holdingRef.current = true; setIsHolding(true); triggerHaptic('light'); }}
          onPointerUp={doLock}
          onPointerLeave={() => { if (holdingRef.current) doLock(); }}
          whileTap={{ scale: 0.93 }}
          disabled={locked}
          style={{
            width: 150, height: 60, borderRadius: 16, cursor: locked ? 'default' : 'pointer',
            background: isHolding ? 'rgba(251,191,36,0.15)' : 'rgba(244,63,94,0.1)',
            border: `2px solid ${isHolding ? '#fbbf24' : '#f43f5e'}44`,
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.12em',
            color: isHolding ? '#fbbf24' : '#f43f5e',
            boxShadow: isHolding ? '0 0 24px rgba(251,191,36,0.3)' : 'none',
          }}
        >
          {locked ? '⏸ LOCKED' : isHolding ? '— HOLD —' : '⊙ HOLD + RELEASE'}
        </motion.button>
      </div>
    </div>
  );
}
