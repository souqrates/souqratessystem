import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Five zones light up randomly. Tap the glowing zone FAST! Each correct tap scores. Miss or tap the wrong zone = lose a life. Gets faster every 5 correct taps. Reach 50 to win!';
const DEFAULT_GAME_TIME = 50;
const TARGET = 50;
const BASE_WINDOW = 420;
const MIN_WINDOW = 150;
const ZONE_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'];
const ZONE_COLORS_ACCENT = ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

export default function TapStorm({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(4);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [activeZone, setActiveZone] = useState(null);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(4);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const windowRef = useRef(BASE_WINDOW);
  const zoneTimerRef = useRef(null);
  const activeZoneRef = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(zoneTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const nextZone = useCallback(() => {
    if (!activeRef.current) return;
    const z = Math.floor(Math.random() * 5);
    activeZoneRef.current = z;
    setActiveZone(z);
    zoneTimerRef.current = setTimeout(() => {
      if (activeZoneRef.current === z) {
        activeZoneRef.current = null;
        setActiveZone(null);
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        comboRef.current = 0;
        setCombo(0);
        beep({ freq: 180, dur: 0.18, type: 'sawtooth', vol: 0.15 });
        triggerHaptic('error');
        if (livesRef.current <= 0) { endGame(); return; }
      }
      if (activeRef.current) zoneTimerRef.current = setTimeout(nextZone, 150 + Math.random() * 200);
    }, windowRef.current);
  }, [endGame]);

  const tapZone = useCallback((z) => {
    if (!activeRef.current) return;
    if (z === activeZoneRef.current) {
      activeZoneRef.current = null;
      clearTimeout(zoneTimerRef.current);
      setActiveZone(null);
      comboRef.current++;
      const pts = comboRef.current >= 5 ? 2 : 1;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      if (comboRef.current % 5 === 0) {
        windowRef.current = Math.max(MIN_WINDOW, windowRef.current - 50);
      }
      triggerHaptic('light');
      if (comboRef.current >= 5) chord([660, 1000, 1320], 0.05, 0.1, 'triangle');
      else beep({ freq: 440 + z * 80, dur: 0.05, vol: 0.08 });
      setFlash({ z, id: Date.now() });
      zoneTimerRef.current = setTimeout(nextZone, 100 + Math.random() * 150);
    } else if (z !== activeZoneRef.current) {
      comboRef.current = 0;
      setCombo(0);
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      beep({ freq: 200, dur: 0.15, type: 'sawtooth', vol: 0.12 });
      triggerHaptic('error');
      if (livesRef.current <= 0) { endGame(); }
    }
  }, [endGame, nextZone]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 4; comboRef.current = 0; windowRef.current = BASE_WINDOW;
    setScore(0); setLives(4); setCombo(0); setTimeLeft(GAME_TIME); setActiveZone(null);
    activeRef.current = true;
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    zoneTimerRef.current = setTimeout(nextZone, 600);
    return () => { clearInterval(iv); clearTimeout(zoneTimerRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 2} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="COMBO" v={combo} c={combo >= 5 ? '#f97316' : '#94a3b8'} />
        <Hud label="LIVES" v={'♥'.repeat(livesRef.current)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gap: 10, padding: 4,
      }}>
        {ZONE_COLORS.map((color, z) => {
          const isActive = activeZone === z;
          return (
            <motion.button
              key={z}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => tapZone(z)}
              style={{
                gridColumn: z === 4 ? '1 / 3' : 'auto',
                borderRadius: 18,
                border: `2px solid ${isActive ? color : 'rgba(255,255,255,0.06)'}`,
                background: isActive
                  ? `radial-gradient(circle at 40% 40%, ${color}55, ${color}22)`
                  : 'rgba(255,255,255,0.025)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isActive ? 44 : 28,
                boxShadow: isActive ? `0 0 32px ${color}88, 0 0 8px ${color}44` : 'none',
                transition: 'background 0.06s, box-shadow 0.06s, border-color 0.06s',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    key="pulse"
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      position: 'absolute', width: 60, height: 60, borderRadius: '50%',
                      background: color, pointerEvents: 'none',
                    }}
                  />
                )}
              </AnimatePresence>
              {isActive ? <span style={{ width: 20, height: 20, borderRadius: '50%', background: ZONE_COLORS_ACCENT[z], display: 'inline-block', boxShadow: `0 0 8px ${ZONE_COLORS_ACCENT[z]}` }} /> : <span style={{ opacity: 0.2, fontSize: 14, fontFamily: 'Orbitron, sans-serif', color }}>{z + 1}</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
