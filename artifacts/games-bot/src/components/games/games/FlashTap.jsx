import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Circles flash on screen for a split second. Tap them before they vanish! Each miss costs you points. Each hit makes the next one faster. Chain combos for bonus points — reach the target before time runs out!';
const DEFAULT_GAME_TIME = 35;
const BASE_WINDOW = 250;
const MIN_WINDOW = 80;

function useTrackedTimers() {
  const timers = useRef([]);
  const track = (id) => { timers.current.push(id); return id; };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  return { track, clear };
}

export default function FlashTap({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [circles, setCircles] = useState([]);
  const [combo, setCombo] = useState(0);
  const [popups, setPopups] = useState([]);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const spawnTimerRef = useRef(null);
  const circleIdRef = useRef(0);
  const windowRef = useRef(BASE_WINDOW);
  const { track, clear: clearTimers } = useTrackedTimers();

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(spawnTimerRef.current);
    clearTimers();
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || 60) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const spawnCircle = useCallback(() => {
    if (!activeRef.current) return;
    const id = ++circleIdRef.current;
    const x = 8 + Math.random() * 84;
    const y = 15 + Math.random() * 70;
    const size = 44 + Math.random() * 28;
    const window_ = windowRef.current;
    setCircles(c => [...c, { id, x, y, size }]);
    spawnTimerRef.current = setTimeout(() => {
      setCircles(c => {
        if (c.find(ci => ci.id === id)) {
          scoreRef.current = Math.max(0, scoreRef.current - 2);
          setScore(scoreRef.current);
          comboRef.current = 0;
          setCombo(0);
          beep({ freq: 180, dur: 0.2, type: 'sawtooth', vol: 0.18 });
          triggerHaptic('error');
        }
        return c.filter(ci => ci.id !== id);
      });
      if (activeRef.current) {
        spawnTimerRef.current = setTimeout(spawnCircle, 180 + Math.random() * 200);
      }
    }, window_);
  }, [endGame]);

  const tapCircle = useCallback((id) => {
    if (!activeRef.current) return;
    setCircles(c => c.filter(ci => ci.id !== id));
    comboRef.current++;
    const pts = comboRef.current >= 5 ? 3 : comboRef.current >= 3 ? 2 : 1;
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    windowRef.current = Math.max(MIN_WINDOW, windowRef.current - 4);
    triggerHaptic('light');
    if (comboRef.current >= 5) {
      chord([880, 1320, 1760], 0.07, 0.12, 'triangle');
    } else {
      beep({ freq: 600 + comboRef.current * 60, dur: 0.05, vol: 0.1 });
    }
    const pid = Date.now();
    const label = comboRef.current >= 5 ? '★ ×3' : comboRef.current >= 3 ? '×2' : '+1';
    setPopups(p => [...p, { id: pid, label }]);
    track(setTimeout(() => setPopups(p => p.filter(x => x.id !== pid)), 600));
  }, [track]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0;
    windowRef.current = BASE_WINDOW;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setCircles([]);
    activeRef.current = true;
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    spawnTimerRef.current = setTimeout(spawnCircle, 400);
    return () => { clearInterval(iv); clearTimeout(spawnTimerRef.current); activeRef.current = false; clearTimers(); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 2} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#fbbf24" />
        <Hud label="TIME" v={timeLeft} c="#f97316" />
        <Hud label="COMBO" v={combo >= 3 ? `×${combo >= 5 ? 3 : 2}` : `${combo}`} c={combo >= 3 ? '#f97316' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || 60} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{
          flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 0%, #1a0a00 0%, #080408 100%)',
          border: '1px solid rgba(251,191,36,0.15)',
          minHeight: 340,
        }}
      >
        {/* Ambient top glow */}
        <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)', opacity: 0.5 }} />

        <AnimatePresence>
          {circles.map(c => (
            <motion.div
              key={c.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24, duration: 0.12 }}
              onPointerDown={(e) => { e.stopPropagation(); tapCircle(c.id); }}
              style={{
                position: 'absolute',
                left: `${c.x}%`, top: `${c.y}%`,
                width: c.size, height: c.size,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle at 35% 35%, #fff5d0, #fbbf24 50%, #f97316)`,
                boxShadow: '0 0 24px #fbbf2488, 0 0 8px #f9731666',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: c.size * 0.4,
              }}
            >
              ✦
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Combo popups */}
        <AnimatePresence>
          {popups.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -48, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55 }}
              style={{
                position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20,
                color: '#fbbf24', textShadow: '0 0 16px #fbbf24',
                pointerEvents: 'none', zIndex: 10,
              }}
            >
              {p.label}
            </motion.div>
          ))}
        </AnimatePresence>

        {circles.length === 0 && activeRef.current && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#fbbf24', letterSpacing: '0.2em' }}>WAIT…</span>
          </div>
        )}
      </div>
    </div>
  );
}
