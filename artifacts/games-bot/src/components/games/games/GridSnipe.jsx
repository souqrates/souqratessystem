import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Targets flash on a grid:\nGOLD ★ = +3 points\nCYAN ◆ = +1 point\nRED ✕ = -2 points\nTap targets before they vanish! Each target stays for 600ms. Reach 40 points to win!';
const DEFAULT_GAME_TIME = 45;
const TARGET_SCORE = 55;
const GRID = 16;
const TYPES = [
  { type: 'gold', symbol: '★', pts: 3,  color: '#fbbf24' },
  { type: 'cyan', symbol: '◆', pts: 1,  color: '#06b6d4' },
  { type: 'red',  symbol: '✕', pts: -2, color: '#ef4444' },
];

let _gid = 0;

export default function GridSnipe({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [cells, setCells] = useState([]); // [{id, cellIdx, type}]
  const [pops, setPops] = useState([]);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const spawnRef = useRef(null);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(spawnRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET_SCORE) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const spawnTarget = useCallback(() => {
    if (!activeRef.current) return;
    const idx = Math.floor(Math.random() * GRID);
    const rand = Math.random();
    const t = rand < 0.25 ? TYPES[0] : rand < 0.65 ? TYPES[1] : TYPES[2];
    const id = ++_gid;
    setCells(c => [...c.filter(x => x.cellIdx !== idx), { id, cellIdx: idx, ...t }]);
    setTimeout(() => setCells(c => c.filter(x => x.id !== id)), 650);
  }, []);

  const tap = useCallback((id, pts, color) => {
    if (!activeRef.current) return;
    setCells(c => c.filter(x => x.id !== id));
    const newScore = Math.max(0, scoreRef.current + pts);
    scoreRef.current = newScore;
    setScore(newScore);
    if (pts > 0) { beep({ freq: pts === 3 ? 880 : 500, dur: 0.06, vol: 0.1 }); triggerHaptic('light'); }
    else { beep({ freq: 200, dur: 0.12, type: 'sawtooth', vol: 0.12 }); triggerHaptic('error'); }
    const pid = Date.now();
    setPops(p => [...p, { id: pid, label: `${pts > 0 ? '+' : ''}${pts}`, color }]);
    setTimeout(() => setPops(p => p.filter(x => x.id !== pid)), 600);
    if (newScore >= (game.targetScore || TARGET_SCORE)) endGame();
  }, [endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; _gid = 0;
    setScore(0); setTimeLeft(GAME_TIME); setCells([]); setPops([]);
    activeRef.current = true;
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    spawnRef.current = setInterval(spawnTarget, 280);
    return () => { clearInterval(iv); clearInterval(spawnRef.current); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 2} setPhase={setPhase} />;
  }

  const cellMap = {};
  cells.forEach(c => { cellMap[c.cellIdx] = c; });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#fbbf24" />
        <Hud label="COMBO" v={0} c="rgba(148,163,184,0.4)" />
        <Hud label="TIME" v={`${timeLeft}s`} c={timeLeft <= 8 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence>
          {pops.map(p => (
            <motion.div key={p.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -36 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }}
              style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: p.color, textShadow: `0 0 14px ${p.color}`, pointerEvents: 'none', zIndex: 10 }}>
              {p.label}
            </motion.div>
          ))}
        </AnimatePresence>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flex: 1, padding: 4 }}>
          {Array.from({ length: GRID }).map((_, idx) => {
            const c = cellMap[idx];
            return (
              <motion.div
                key={idx}
                whileTap={{ scale: c ? 0.85 : 0.98 }}
                onPointerDown={() => c && tap(c.id, c.pts, c.color)}
                style={{
                  borderRadius: 14,
                  background: c ? `radial-gradient(circle at 40% 40%, ${c.color}33, ${c.color}11)` : 'rgba(255,255,255,0.025)',
                  border: c ? `2px solid ${c.color}66` : '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: c ? 28 : 0,
                  boxShadow: c ? `0 0 18px ${c.color}55` : 'none',
                  cursor: c ? 'pointer' : 'default',
                  transition: 'background 0.08s, border-color 0.08s',
                  minHeight: 64,
                }}
              >
                <AnimatePresence>
                  {c && (
                    <motion.span key={c.id} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      style={{ color: c.color, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', fontSize: 22, lineHeight: 1 }}>
                      {c.symbol}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
