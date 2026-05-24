import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

// SAMURAI BLADE — dark katana theme. Same mechanic as before (tap when the
// sweeping marker is inside the strike zone) but a fully new visual identity:
// crimson / gold on near-black, blade-slash flash on hit, hilt button.
const RULES = 'SAMURAI BLADE — A blade tracks across the scroll. Strike when it crosses the crimson focus band. Perfect strike = +100. Missed strike = -150. The blade quickens every 200 pts. Reach the target score in time!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;
const BASE_SPEED = 1.8;
const GREEN_WIDTH = 0.22;

export default function PerfectCut({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState(null);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(BASE_SPEED);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const comboRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const greenStart = 0.5 - GREEN_WIDTH / 2;
  const greenEnd = 0.5 + GREEN_WIDTH / 2;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const tap = useCallback(() => {
    if (!activeRef.current) return;
    const p = posRef.current;
    const inGreen = p >= greenStart && p <= greenEnd;
    if (inGreen) {
      comboRef.current++;
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      triggerHaptic('light');
      chord([660, 880], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      const lvl = Math.floor(scoreRef.current / 200);
      speedRef.current = BASE_SPEED + lvl * 0.4;
    } else {
      comboRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      setCombo(0);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
    }
    onScoreUpdate?.(scoreRef.current);
  }, [endGame, onScoreUpdate, greenStart, greenEnd, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; posRef.current = 0; dirRef.current = 1;
    speedRef.current = BASE_SPEED; comboRef.current = 0;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setPos(0);
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
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const greenPct = GREEN_WIDTH * 100;
  const CRIMSON = '#e63946';
  const GOLD = '#f5c542';
  const INK = '#1a0608';
  const inZone = pos >= greenStart && pos <= greenEnd;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="STRIKES" v={score} c={GOLD} />
        <Hud label="CHAIN" v={combo} c={combo >= 3 ? CRIMSON : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? CRIMSON : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="MASTERY" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={CRIMSON} />

      {/* Scroll canvas: subtle paper-grain dark backdrop with crimson borders */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 18,
        borderRadius: 18,
        background: `radial-gradient(ellipse at 50% 20%, rgba(230,57,70,0.10) 0%, ${INK} 60%, #050203 100%)`,
        border: `1px solid ${CRIMSON}33`,
        boxShadow: `inset 0 1px 0 ${GOLD}22`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Kanji-style decorative slashes in corners */}
        <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 22, color: `${GOLD}40`, fontFamily: 'serif' }}>刃</div>
        <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 22, color: `${GOLD}40`, fontFamily: 'serif' }}>武</div>

        <MomentumFlash
          msg={flash?.type === 'good' ? (combo >= 3 ? '一閃 IAI!' : '斬 STRIKE!') : '外れ MISSED'}
          color={flash?.type === 'good' ? GOLD : CRIMSON}
          trigger={flash?.id}
        />

        {/* Scroll track */}
        <div style={{
          position: 'relative', width: '100%', height: 64, borderRadius: 6,
          background: 'linear-gradient(180deg, #0a0306 0%, #1a0608 50%, #0a0306 100%)',
          border: `1px solid ${CRIMSON}33`,
          boxShadow: `inset 0 0 24px rgba(0,0,0,0.7), 0 0 18px ${CRIMSON}22`,
          overflow: 'hidden',
        }}>
          {/* Top + bottom rails (scroll-edge motif) */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />

          {/* Crimson focus band */}
          <div style={{
            position: 'absolute', top: 4, bottom: 4,
            left: `${greenStart * 100}%`, width: `${greenPct}%`,
            background: `linear-gradient(180deg, ${CRIMSON}22 0%, ${CRIMSON}55 50%, ${CRIMSON}22 100%)`,
            borderLeft: `2px solid ${CRIMSON}`,
            borderRight: `2px solid ${CRIMSON}`,
            boxShadow: `0 0 20px ${CRIMSON}66, inset 0 0 14px ${CRIMSON}44`,
          }} />

          {/* Center thread */}
          <div style={{ position: 'absolute', top: 10, bottom: 10, left: '50%', width: 1, background: `${GOLD}33` }} />

          {/* Blade marker — vertical katana sliver */}
          <motion.div
            animate={{ left: `${pos * 100}%` }}
            transition={{ duration: 0, ease: 'linear' }}
            style={{
              position: 'absolute', top: -2, bottom: -2, width: 4, marginLeft: -2,
              borderRadius: 2,
              background: inZone
                ? `linear-gradient(180deg, ${GOLD} 0%, #fff 50%, ${GOLD} 100%)`
                : `linear-gradient(180deg, #94a3b8 0%, #e2e8f0 50%, #94a3b8 100%)`,
              boxShadow: inZone
                ? `0 0 22px ${GOLD}, 0 0 8px #fff`
                : `0 0 10px rgba(226,232,240,0.6)`,
            }}
          />
        </div>

        {/* Slash flash overlay when hitting a perfect strike */}
        <AnimatePresence>
          {flash?.type === 'good' && (
            <motion.div
              key={flash.id}
              initial={{ opacity: 0.9, scaleX: 0 }}
              animate={{ opacity: 0, scaleX: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{
                position: 'absolute', left: '5%', right: '5%', top: '54%',
                height: 2, transformOrigin: 'left center',
                background: `linear-gradient(90deg, transparent, ${GOLD}, #fff, ${GOLD}, transparent)`,
                boxShadow: `0 0 16px ${GOLD}, 0 0 32px ${GOLD}88`,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* Katana hilt button (oblong, wrapped grip pattern via repeating gradient) */}
        <motion.button
          whileTap={{ scale: 0.92, rotate: -2 }}
          onPointerDown={tap}
          style={{
            width: 180, height: 64, borderRadius: 14,
            background: `repeating-linear-gradient(135deg, ${INK} 0px, ${INK} 6px, #2d0a0e 6px, #2d0a0e 12px)`,
            border: `2px solid ${GOLD}`,
            boxShadow: inZone
              ? `0 0 36px ${CRIMSON}, 0 0 12px ${GOLD}88, inset 0 1px 0 ${GOLD}44`
              : `0 0 12px ${CRIMSON}44, inset 0 1px 0 ${GOLD}22`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 17,
            color: GOLD, letterSpacing: '0.18em',
            transition: 'box-shadow 0.1s ease',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚔</span>
          STRIKE
        </motion.button>

        <p style={{ color: `${GOLD}88`, fontSize: 11, letterSpacing: '0.22em', textAlign: 'center', fontFamily: 'Orbitron, sans-serif' }}>
          一 STRIKE WHEN BLADE CROSSES THE CRIMSON BAND 一
        </p>
      </div>
    </div>
  );
}
