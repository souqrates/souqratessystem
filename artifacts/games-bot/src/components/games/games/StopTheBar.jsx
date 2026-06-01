import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';
import { Crosshair } from 'lucide-react';

// QUANTUM LOCK — cyberpunk cyan/violet rebrand. Same mechanic: stop the
// indicator inside the lock window. New identity: hex-edged track, energy
// core button, scan-line backdrop, "LOCK" instead of "STOP".
const RULES = 'QUANTUM LOCK — A particle oscillates across the field. Engage the LOCK when it sits inside the violet lock window for +100. Miss = -150. The lock window shrinks and the particle accelerates every 200 pts. Reach 800 pts in 60s!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 800;
const BASE_SPEED = 1.5;
const BASE_GOLD = 0.18;
const MIN_GOLD = 0.06;

export default function StopTheBar({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pos, setPos] = useState(0);
  const [goldWidth, setGoldWidth] = useState(BASE_GOLD);
  const [flash, setFlash] = useState(null);
  const [streak, setStreak] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(BASE_SPEED);
  const goldRef = useRef(BASE_GOLD);
  const streakRef = useRef(0);
  const rafRef = useRef(null);
  const lastRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const goldStart = () => 0.5 - goldRef.current / 2;
  const goldEnd = () => 0.5 + goldRef.current / 2;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    const p = posRef.current;
    const gs = goldStart();
    const ge = goldEnd();
    const inGold = p >= gs && p <= ge;
    if (inGold) {
      streakRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      triggerHaptic('light');
      chord([700, 1000, 1400], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      const lvl = Math.floor(scoreRef.current / 200);
      speedRef.current = BASE_SPEED + lvl * 0.5;
      goldRef.current = Math.max(MIN_GOLD, BASE_GOLD - lvl * 0.018);
      setGoldWidth(goldRef.current);
    } else {
      streakRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setStreak(0);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; posRef.current = 0; dirRef.current = 1;
    speedRef.current = BASE_SPEED; goldRef.current = BASE_GOLD; streakRef.current = 0;
    setScore(0); setStreak(0); setTimeLeft(GAME_TIME); setPos(0); setGoldWidth(BASE_GOLD);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      posRef.current += dirRef.current * speedRef.current * dt;
      if (posRef.current >= 1) { posRef.current = 1; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 8)} setPhase={setPhase} />;

  const gs = goldStart();
  const ge = goldEnd();
  const inGold = pos >= gs && pos <= ge;
  const CYAN = '#22d3ee';
  const VIOLET = '#a855f7';
  const VOID = '#06030d';
  const HEX_CLIP = 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="ENERGY" v={score} c={VIOLET} />
        <Hud label="SYNC" v={streak} c={streak >= 3 ? CYAN : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="LOCK PROGRESS" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={VIOLET} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 18,
        borderRadius: 18,
        background: `
          radial-gradient(ellipse at 50% 20%, ${VIOLET}1f 0%, ${VOID} 65%, #02010a 100%),
          repeating-linear-gradient(0deg, transparent 0, transparent 3px, ${CYAN}06 3px, ${CYAN}06 4px)
        `,
        border: `1px solid ${VIOLET}33`,
        boxShadow: `inset 0 0 50px ${VIOLET}15`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Corner brackets */}
        {[
          { top: 6, left: 6, borderTop: `2px solid ${CYAN}`, borderLeft: `2px solid ${CYAN}` },
          { top: 6, right: 6, borderTop: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` },
          { bottom: 6, left: 6, borderBottom: `2px solid ${CYAN}`, borderLeft: `2px solid ${CYAN}` },
          { bottom: 6, right: 6, borderBottom: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` },
        ].map((b, i) => (
          <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...b, opacity: 0.6 }} />
        ))}

        <MomentumFlash
          msg={flash?.type === 'good' ? (streak >= 3 ? 'CHAIN LOCK!' : 'LOCKED!') : 'BREACH!'}
          color={flash?.type === 'good' ? VIOLET : '#ef4444'}
          trigger={flash?.id}
        />

        {/* Hexagonal track */}
        <div style={{ position: 'relative', width: '100%', padding: '6px 0' }}>
          <div style={{
            position: 'relative', width: '100%', height: 56,
            background: `linear-gradient(90deg, ${VOID} 0%, #100527 50%, ${VOID} 100%)`,
            clipPath: HEX_CLIP,
            border: 'none',
            overflow: 'hidden',
            boxShadow: `inset 0 0 24px ${VIOLET}33`,
          }}>
            {/* Lock window (violet) */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${gs * 100}%`, width: `${goldWidth * 100}%`,
              background: `linear-gradient(180deg, ${VIOLET}33 0%, ${VIOLET}66 50%, ${VIOLET}33 100%)`,
              borderLeft: `2px solid ${VIOLET}`,
              borderRight: `2px solid ${VIOLET}`,
              boxShadow: `0 0 22px ${VIOLET}88, inset 0 0 14px ${VIOLET}66`,
            }} />

            {/* Tick marks (scan-line motif) */}
            {Array.from({ length: 11 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute', top: 6, bottom: 6, left: `${i * 10}%`,
                width: 1, background: `${CYAN}22`,
              }} />
            ))}

            {/* Center indicator (cyan crosshair) */}
            <div style={{
              position: 'absolute', top: 8, bottom: 8, left: '50%',
              width: 1, background: `${CYAN}55`, marginLeft: -0.5,
            }} />

            {/* Particle indicator */}
            <motion.div
              animate={{ left: `${pos * 100}%` }}
              transition={{ duration: 0, ease: 'linear' }}
              style={{
                position: 'absolute', top: 4, bottom: 4, width: 14, marginLeft: -7,
                borderRadius: 2,
                background: inGold
                  ? `linear-gradient(180deg, ${VIOLET} 0%, #fff 50%, ${VIOLET} 100%)`
                  : `linear-gradient(180deg, ${CYAN} 0%, #fff 50%, ${CYAN} 100%)`,
                boxShadow: inGold
                  ? `0 0 26px ${VIOLET}, 0 0 10px #fff`
                  : `0 0 18px ${CYAN}, 0 0 6px #fff`,
              }}
            />
          </div>
        </div>

        {/* Energy-core button (hex-clipped) */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onPointerDown={stop}
          style={{
            width: 140, height: 140,
            clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
            background: inGold
              ? `radial-gradient(circle at 50% 40%, ${VIOLET}aa 0%, ${VIOLET}55 40%, ${VOID} 100%)`
              : `radial-gradient(circle at 50% 40%, ${CYAN}55 0%, ${CYAN}22 40%, ${VOID} 100%)`,
            border: 'none',
            boxShadow: inGold ? `0 0 50px ${VIOLET}aa` : `0 0 22px ${CYAN}55`,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
            color: inGold ? '#fff' : CYAN,
            transition: 'box-shadow 0.1s ease',
          }}
        >
          <Crosshair size={28} />
          <span style={{ fontSize: 14, letterSpacing: '0.22em' }}>LOCK</span>
        </motion.button>

        <p style={{ color: `${CYAN}aa`, fontSize: 11, letterSpacing: '0.22em', fontFamily: 'Orbitron, sans-serif' }}>
          ENGAGE INSIDE THE VIOLET WINDOW
        </p>
      </div>
    </div>
  );
}
