import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A neon ring closes inward. Each ring has a GAP. Tap when the gap lines up at the top to pass through! Miss the gap and you lose a life. Survive 30 rings to win!';
const TARGET = 30;
const RING_ANIM_MS = 850;

export default function RingDodge({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [ringState, setRingState] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [speed, setSpeed] = useState(RING_ANIM_MS);

  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const activeRef = useRef(false);
  const ringRef = useRef(null);
  const speedRef = useRef(RING_ANIM_MS);
  const spawnRef = useRef(null);
  const resolvedRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(spawnRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const spawnRing = useCallback(() => {
    if (!activeRef.current) return;
    resolvedRef.current = false;
    const gapAngle = Math.random() * 360;
    const r = { gapAngle, id: Date.now() };
    ringRef.current = r;
    setRingState(r);
    spawnRef.current = setTimeout(() => {
      if (!resolvedRef.current && ringRef.current?.id === r.id) {
        // ring closed without tap in gap
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        setFeedback({ label: 'BLOCKED!', color: '#ef4444' });
        beep({ freq: 200, dur: 0.18, type: 'sawtooth', vol: 0.15 });
        triggerHaptic('error');
        ringRef.current = null;
        setRingState(null);
        if (livesRef.current <= 0) { endGame(); return; }
        setTimeout(spawnRing, 500);
      }
    }, speedRef.current + 200);
  }, [endGame]);

  const handleTap = useCallback(() => {
    if (!activeRef.current || resolvedRef.current || !ringRef.current) return;
    const { gapAngle } = ringRef.current;
    const dist = Math.min(Math.abs(gapAngle - 90), 360 - Math.abs(gapAngle - 90));
    resolvedRef.current = true;
    clearTimeout(spawnRef.current);
    ringRef.current = null;
    setRingState(null);
    if (dist < 22) {
      scoreRef.current++;
      setScore(scoreRef.current);
      if (scoreRef.current % 5 === 0) {
        speedRef.current = Math.max(700, speedRef.current - 80);
        setSpeed(speedRef.current);
      }
      const label = dist < 8 ? '◆ PERFECT' : dist < 14 ? '✓ GREAT' : 'GOOD';  // game-symbol
      const color = dist < 8 ? '#10b981' : dist < 14 ? '#22d3ee' : '#fbbf24';
      setFeedback({ label, color });
      chord([550, 820], 0.05, 0.1, 'sine');
      triggerHaptic('success');
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      setFeedback({ label: 'MISSED GAP!', color: '#ef4444' });
      beep({ freq: 200, dur: 0.15, type: 'sawtooth', vol: 0.15 });
      triggerHaptic('error');
      if (livesRef.current <= 0) { endGame(); return; }
    }
    setTimeout(() => setFeedback(null), 500);
    setTimeout(spawnRing, 400);
  }, [endGame, spawnRing]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3; speedRef.current = RING_ANIM_MS;
    setScore(0); setLives(3); setRingState(null); setFeedback(null); setSpeed(RING_ANIM_MS);
    activeRef.current = true; resolvedRef.current = false;
    spawnRef.current = setTimeout(spawnRing, 600);
    return () => { clearTimeout(spawnRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 2} setPhase={setPhase} />;
  }

  const GAP_DEG = 44;
  const r = 110;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="PASSED" v={score} c="#f43f5e" />
        <Hud label="SPEED" v={`${Math.round(1800 / speed * 10) / 10}x`} c="#94a3b8" />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />

      <div
        onPointerDown={handleTap}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
          borderRadius: 16, background: 'radial-gradient(ellipse at 50% 50%, #1a0010 0%, #050408 100%)',
          border: '1px solid rgba(244,63,94,0.15)', minHeight: 340, cursor: 'pointer', touchAction: 'none',
        }}
      >
        <div style={{ position: 'relative', width: 280, height: 280 }}>
          {/* Gap target marker at top */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: '#f43f5e', boxShadow: '0 0 12px #f43f5e',
          }} />

          {ringState && (
            <motion.svg
              key={ringState.id}
              width={280} height={280}
              style={{ position: 'absolute', top: 0, left: 0 }}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: speedRef.current / 1000, ease: 'easeIn' }}
            >
              {/* Ring with gap — draw as arc */}
              {(() => {
                const cx = 140, cy = 140;
                const startAngle = ((ringState.gapAngle + GAP_DEG / 2) * Math.PI) / 180;
                const endAngle = ((ringState.gapAngle - GAP_DEG / 2) * Math.PI) / 180;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const largeArc = (360 - GAP_DEG) > 180 ? 1 : 0;
                return (
                  <path
                    d={`M${x1},${y1} A${r},${r} 0 ${largeArc},0 ${x2},${y2}`}
                    fill="none" stroke="#f43f5e" strokeWidth={8}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.8))' }}
                  />
                );
              })()}
              {/* Center dot */}
              <circle cx={140} cy={140} r={6} fill="#f43f5e" opacity={0.6} />
            </motion.svg>
          )}
          {!ringState && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: 'rgba(148,163,184,0.2)', letterSpacing: '0.2em' }}>READY…</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.label + feedback.color} initial={{ opacity: 1, scale: 0.8 }} animate={{ opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: feedback.color, textShadow: `0 0 16px ${feedback.color}` }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.25)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.14em' }}>
          TAP WHEN GAP REACHES THE DOT
        </div>
      </div>
    </div>
  );
}
