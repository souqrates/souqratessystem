import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A ring appears on screen. Tap JUMP to land inside the ring! Hit it = +100, Miss = -150. Chain 5 perfect jumps for a 500 point bonus! Rings shrink and move after 300 pts. Target in 45 seconds!';
const DEFAULT_GAME_TIME = 45;
const TARGET = 1000;

function randPos(size) {
  const margin = size / 2 + 10;
  return {
    x: margin + Math.random() * (100 - margin * 2 / 3),
    y: margin + Math.random() * (60 - margin * 1.5),
  };
}

export default function RingHop({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [ring, setRing] = useState(null);
  const [playerY, setPlayerY] = useState(80);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const comboRef = useRef(0);
  const ringRef = useRef(null);
  const jumpRef = useRef(false);
  const playerYRef = useRef(80);

  const TARGET_SCORE = game.targetScore || TARGET;

  const getRingSize = () => {
    const lvl = Math.floor(scoreRef.current / 300);
    return Math.max(28, 68 - lvl * 8);
  };

  const spawnRing = useCallback(() => {
    const size = getRingSize();
    const pos = randPos(size);
    const r = { ...pos, size, id: Date.now(), moves: scoreRef.current >= 300 };
    ringRef.current = r;
    setRing(r);
  }, []);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const jump = useCallback(() => {
    if (!activeRef.current || jumpRef.current || !ringRef.current) return;
    jumpRef.current = true;
    const targetY = ringRef.current.y;
    setPlayerY(targetY);
    playerYRef.current = targetY;

    setTimeout(() => {
      if (!activeRef.current) return;
      const r = ringRef.current;
      if (!r) return;
      const dist = Math.abs(playerYRef.current - r.y);
      const hit = dist < r.size / 2 + 8;
      if (hit) {
        comboRef.current++;
        const pts = comboRef.current >= 5 ? 600 : 100;
        scoreRef.current = Math.max(0, scoreRef.current + pts);
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        triggerHaptic('light');
        if (comboRef.current >= 5) { chord([660, 880, 1100, 1320], 0.06, 0.12, 'triangle'); comboRef.current = 0; setCombo(0); }
        else beep({ freq: 520 + comboRef.current * 60, dur: 0.08, vol: 0.1 });
        setFlash({ type: 'good', id: Date.now(), pts });
      } else {
        comboRef.current = 0;
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        setCombo(0);
        triggerHaptic('error');
        noise({ dur: 0.1, vol: 0.1 });
        setFlash({ type: 'bad', id: Date.now() });
      }
      onScoreUpdate?.(scoreRef.current);
      setPlayerY(80);
      playerYRef.current = 80;
      jumpRef.current = false;
      setTimeout(spawnRing, 300);
    }, 350);
  }, [endGame, onScoreUpdate, spawnRing, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; comboRef.current = 0; jumpRef.current = false;
    setScore(0); setCombo(0); setTimeLeft(GAME_TIME); setPlayerY(80);
    activeRef.current = true;
    spawnRing();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#06b6d4" />
        <Hud label="COMBO" v={combo} c={combo >= 3 ? '#f59e0b' : '#94a3b8'} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, position: 'relative', background: 'radial-gradient(ellipse at center, #0a1628 0%, #030810 100%)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(6,182,212,0.15)', cursor: 'pointer' }}
        onPointerDown={jump}
      >
        <MomentumFlash msg={flash?.type === 'good' ? (flash?.pts === 600 ? 'MEGA COMBO!' : 'PERFECT!') : 'MISSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Ring */}
        <AnimatePresence>
          {ring && (
            <motion.div
              key={ring.id}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              style={{
                position: 'absolute',
                left: `${ring.x}%`, top: `${ring.y}%`,
                width: ring.size, height: ring.size,
                marginLeft: -ring.size / 2, marginTop: -ring.size / 2,
                borderRadius: '50%',
                border: '3px solid #06b6d4',
                boxShadow: '0 0 20px #06b6d488',
              }}
            />
          )}
        </AnimatePresence>

        {/* Player */}
        <motion.div
          animate={{ top: `${playerY}%` }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'absolute', left: '12%', marginLeft: -16, marginTop: -16,
            width: 32, height: 32, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #f59e0bcc, #f59e0b)',
            boxShadow: '0 0 18px #f59e0b88',
          }}
        />

        <p style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.12em' }}>TAP TO JUMP</p>
      </div>
    </div>
  );
}
