import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Orbs float across the screen — swipe through them to slash! Green orbs = +2pts, Cyan orbs = +1pt. RED bombs = lose a life! Chain 3+ slashes for a combo bonus. Reach 60 to win!';
const DEFAULT_GAME_TIME = 35;
const TARGET = 60;

let _oid = 0;

export default function SlashBlitz({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [orbs, setOrbs] = useState([]);
  const [slashTrail, setSlashTrail] = useState([]);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const livesRef = useRef(4);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const spawnRef = useRef(null);
  const trailRef = useRef([]);
  const trailTimerRef = useRef(null);
  const slicedRef = useRef(new Set());

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(spawnRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const spawnOrb = useCallback(() => {
    if (!activeRef.current) return;
    const type = Math.random() < 0.18 ? 'bomb' : Math.random() < 0.4 ? 'green' : 'cyan';
    const id = ++_oid;
    const x = 5 + Math.random() * 90;
    const y = 10 + Math.random() * 80;
    const size = type === 'bomb' ? 38 : 32 + Math.random() * 14;
    setOrbs(o => [...o, { id, type, x, y, size }]);
    setTimeout(() => setOrbs(o => o.filter(ob => ob.id !== id)), 2200);
  }, []);

  const checkSlash = useCallback((x, y) => {
    if (!activeRef.current) return;
    setOrbs(orbs => {
      const hit = orbs.find(o => {
        if (slicedRef.current.has(o.id)) return false;
        const ox = (o.x / 100) * 300;
        const oy = (o.y / 100) * 380;
        return Math.hypot(x - ox, y - oy) < o.size / 1.6;
      });
      if (!hit) return orbs;
      slicedRef.current.add(hit.id);
      setTimeout(() => slicedRef.current.delete(hit.id), 100);
      if (hit.type === 'bomb') {
        noise({ dur: 0.15, vol: 0.2 });
        triggerHaptic('error');
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        comboRef.current = 0;
        setCombo(0);
        if (livesRef.current <= 0) { endGame(); }
        return orbs.filter(o => o.id !== hit.id);
      }
      const pts = hit.type === 'green' ? 2 : 1;
      comboRef.current++;
      const bonus = comboRef.current >= 3 ? 1 : 0;
      scoreRef.current += pts + bonus;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      if (comboRef.current >= 3) chord([660, 990], 0.05, 0.1, 'triangle');
      else beep({ freq: 440 + pts * 100, dur: 0.05, vol: 0.08 });
      triggerHaptic('light');
      if (scoreRef.current >= (game.targetScore || TARGET)) endGame();
      return orbs.filter(o => o.id !== hit.id);
    });
  }, [endGame]);

  const onPointerMove = useCallback((e) => {
    if (!activeRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    trailRef.current = [...trailRef.current.slice(-8), { x, y, id: Date.now() }];
    setSlashTrail([...trailRef.current]);
    clearTimeout(trailTimerRef.current);
    trailTimerRef.current = setTimeout(() => { trailRef.current = []; setSlashTrail([]); }, 120);
    checkSlash(x, y);
  }, [checkSlash]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; livesRef.current = 3; comboRef.current = 0;
    _oid = 0; slicedRef.current.clear();
    setScore(0); setLives(3); setCombo(0); setTimeLeft(GAME_TIME); setOrbs([]);
    activeRef.current = true;
    const iv = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; });
    }, 1000);
    spawnRef.current = setInterval(spawnOrb, 600);
    return () => { clearInterval(iv); clearInterval(spawnRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f43f5e" />
        <Hud label="COMBO" v={combo >= 3 ? `${combo}🔥` : combo} c={combo >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="LIVES" v={'♥'.repeat(lives)} c="#ef4444" />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div
        onPointerMove={onPointerMove}
        style={{
          flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 0%, #1a0500 0%, #060204 100%)',
          border: '1px solid rgba(244,63,94,0.12)', minHeight: 340, touchAction: 'none',
          cursor: 'crosshair',
        }}
      >
        {/* Slash trail */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {slashTrail.length > 1 && (
            <polyline
              points={slashTrail.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="rgba(244,63,94,0.7)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            />
          )}
        </svg>

        <AnimatePresence>
          {orbs.map(o => (
            <motion.div
              key={o.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                position: 'absolute',
                left: `${o.x}%`, top: `${o.y}%`,
                width: o.size, height: o.size,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                background: o.type === 'bomb'
                  ? 'radial-gradient(circle at 35% 35%, #ff6060, #cc0000)'
                  : o.type === 'green'
                  ? 'radial-gradient(circle at 35% 35%, #a0ffa0, #10b981)'
                  : 'radial-gradient(circle at 35% 35%, #a0eeff, #06b6d4)',
                boxShadow: o.type === 'bomb' ? '0 0 20px rgba(239,68,68,0.8)' : o.type === 'green' ? '0 0 18px rgba(16,185,129,0.7)' : '0 0 18px rgba(6,182,212,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: o.size * 0.5, pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {o.type === 'bomb' ? '💣' : o.type === 'green' ? '💚' : '💠'}
            </motion.div>
          ))}
        </AnimatePresence>

        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.18em' }}>
          SWIPE ACROSS ORBS
        </div>
      </div>
    </div>
  );
}
