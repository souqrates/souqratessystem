import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Sort the colored items by dragging them into the correct bins. Sort all = +100. Wrong bin = -150. More items and bins after 400 pts. Sort faster for combo bonus! Reach 1200 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1200;

const BINS = [
  { id: 'red', label: 'RED', color: '#ef4444' },
  { id: 'blue', label: 'BLUE', color: '#3b82f6' },
  { id: 'green', label: 'GREEN', color: '#10b981' },
  { id: 'gold', label: 'GOLD', color: '#f59e0b' },
];

function genItems(count, binCount) {
  const activeBins = BINS.slice(0, binCount);
  return Array.from({ length: count }, (_, i) => {
    const bin = activeBins[Math.floor(Math.random() * activeBins.length)];
    return { id: i, binId: bin.id, color: bin.color, label: bin.label[0] };
  });
}

export default function QuickSort({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [items, setItems] = useState([]);
  const [flash, setFlash] = useState(null);
  const [selected, setSelected] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getBinCount = () => Math.min(4, 2 + Math.floor(scoreRef.current / 400));
  const getItemCount = () => 4 + Math.floor(scoreRef.current / 300);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    setItems(genItems(getItemCount(), getBinCount()));
    setSelected(null);
  }, []);

  const selectItem = useCallback((id) => {
    if (!activeRef.current) return;
    setSelected(s => s === id ? null : id);
    beep({ freq: 380, dur: 0.05, vol: 0.06 });
  }, []);

  const dropIntoBin = useCallback((binId) => {
    if (!activeRef.current || selected === null) return;
    setItems(prev => {
      const item = prev.find(it => it.id === selected);
      if (!item) return prev;
      if (item.binId === binId) {
        // Correct
        const remaining = prev.filter(it => it.id !== selected);
        setSelected(null);
        triggerHaptic('light');
        beep({ freq: 500, dur: 0.07, vol: 0.08 });
        setFlash({ type: 'good', id: Date.now() });
        if (remaining.length === 0) {
          scoreRef.current = Math.max(0, scoreRef.current + 100);
          setScore(scoreRef.current);
          triggerHaptic('medium');
          chord([660, 880], 0.05, 0.09, 'triangle');
          onScoreUpdate?.(scoreRef.current);
          setTimeout(newRound, 600);
        }
        return remaining;
      } else {
        // Wrong bin
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.09, vol: 0.09 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setSelected(null);
        return prev;
      }
    });
  }, [selected, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newRound();

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

  const binCount = getBinCount();
  const activeBins = BINS.slice(0, binCount);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="LEFT" v={items.length} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'SORTED!' : 'WRONG BIN!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Items */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 260 }}>
          <AnimatePresence>
            {items.map(it => (
              <motion.div
                key={it.id}
                layout
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                onPointerDown={() => selectItem(it.id)}
                style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `${it.color}22`,
                  border: `2px solid ${selected === it.id ? it.color : `${it.color}44`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: it.color, cursor: 'pointer',
                  boxShadow: selected === it.id ? `0 0 14px ${it.color}55` : 'none',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                }}
              >
                {it.label}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {selected !== null && (
          <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 11, letterSpacing: '0.12em' }}>TAP A BIN BELOW</p>
        )}

        {/* Bins */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${binCount}, 1fr)`, gap: 6, width: '100%', maxWidth: 300 }}>
          {activeBins.map(bin => (
            <motion.button
              key={bin.id}
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => dropIntoBin(bin.id)}
              style={{
                height: 52, borderRadius: 12,
                background: `${bin.color}15`,
                border: `2px solid ${bin.color}44`,
                color: bin.color,
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 10,
                letterSpacing: '0.08em', cursor: 'pointer',
              }}
            >
              {bin.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
