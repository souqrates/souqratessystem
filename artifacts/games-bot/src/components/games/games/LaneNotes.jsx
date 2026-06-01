import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Notes fall from the top in 3 lanes. TAP the lane button when a note crosses the orange hit line! Miss 5 = game over. Reach 30 hits to win!';
const DEFAULT_GAME_TIME = 40;
const TARGET = 30;
const MISS_LIMIT = 3;
const FALL_DURATION_MS = 1000;
const HIT_WINDOW_MS = 180;
const SPAWN_INTERVAL_MS = 600;

const LANE_COLORS = ['#f43f5e', '#22d3ee', '#a3e635'];
const LANE_FREQS = [330, 440, 550];

let _nid = 0;

export default function LaneNotes({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [notes, setNotes] = useState([]);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [laneFlash, setLaneFlash] = useState(null);

  const scoreRef = useRef(0);
  const missesRef = useRef(0);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const spawnRef = useRef(null);
  const hitNotes = useRef(new Set());

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(spawnRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || TARGET) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const tapLane = useCallback((lane) => {
    if (!activeRef.current) return;
    const now = performance.now();
    setLaneFlash(lane);
    setTimeout(() => setLaneFlash(null), 120);

    setNotes(ns => {
      const hit = ns.find(n => {
        if (n.lane !== lane || hitNotes.current.has(n.id)) return false;
        const elapsed = now - n.spawnTime;
        const progress = elapsed / FALL_DURATION_MS;
        return progress >= (1 - HIT_WINDOW_MS / FALL_DURATION_MS) && progress <= 1.05;
      });

      if (!hit) {
        comboRef.current = 0;
        setCombo(0);
        setFeedback({ label: 'EMPTY!', color: '#ef4444', id: Date.now() });
        beep({ freq: 180, dur: 0.1, type: 'sawtooth', vol: 0.1 });
        triggerHaptic('error');
        return ns;
      }

      hitNotes.current.add(hit.id);
      const elapsed = now - hit.spawnTime;
      const progress = elapsed / FALL_DURATION_MS;
      const distFromLine = Math.abs(progress - 1) * FALL_DURATION_MS;

      let label, color;
      if (distFromLine < 60) {
        label = '◆ PERFECT';
        color = '#10b981';
        chord([LANE_FREQS[lane] * 2, LANE_FREQS[lane] * 3], 0.06, 0.12, 'triangle');
        triggerHaptic('success');
      } else {
        label = '✓ GOOD';  // game-symbol
        color = '#fbbf24';
        beep({ freq: LANE_FREQS[lane], dur: 0.07, vol: 0.1 });
        triggerHaptic('light');
      }

      comboRef.current++;
      const bonusPts = comboRef.current >= 5 ? 1 : 0;
      scoreRef.current += 1 + bonusPts;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setFeedback({ label: comboRef.current >= 5 ? `${label} ×${comboRef.current}` : label, color, id: Date.now() });
      if (scoreRef.current >= (game.targetScore || TARGET)) endGame();
      return ns.filter(n => n.id !== hit.id);
    });
  }, [endGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; missesRef.current = 0; comboRef.current = 0; _nid = 0;
    hitNotes.current.clear();
    setScore(0); setMisses(0); setCombo(0); setTimeLeft(GAME_TIME); setNotes([]); setFeedback(null);
    activeRef.current = true;

    const spawnNote = () => {
      if (!activeRef.current) return;
      const lane = Math.floor(Math.random() * 3);
      const id = ++_nid;
      const spawnTime = performance.now();
      setNotes(n => [...n, { id, lane, spawnTime }]);
      setTimeout(() => {
        setNotes(n => {
          const still = n.find(x => x.id === id);
          if (still && !hitNotes.current.has(id)) {
            missesRef.current++;
            setMisses(missesRef.current);
            comboRef.current = 0;
            setCombo(0);
            beep({ freq: 160, dur: 0.15, type: 'sawtooth', vol: 0.12 });
            triggerHaptic('error');
            setFeedback({ label: 'MISSED!', color: '#ef4444', id: Date.now() });
            if (missesRef.current >= MISS_LIMIT) endGame();
          }
          return n.filter(x => x.id !== id);
        });
      }, FALL_DURATION_MS + 120);
    };

    spawnRef.current = setInterval(spawnNote, SPAWN_INTERVAL_MS);
    const iv = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { clearInterval(iv); endGame(); return 0; }
      return t - 1;
    }), 1000);
    return () => { clearInterval(spawnRef.current); clearInterval(iv); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 3} setPhase={setPhase} />;
  }

  const now = performance.now();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="HITS" v={score} c="#22d3ee" />
        <Hud label="COMBO" v={combo >= 3 ? `${combo}x` : combo} c={combo >= 3 ? '#f97316' : '#94a3b8'} />
        <Hud label="MISSES" v={`${missesRef.current}/${MISS_LIMIT}`} c={missesRef.current >= 3 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color="#22d3ee" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
        {/* Note field */}
        <div style={{
          flex: 1, position: 'relative', borderRadius: '16px 16px 0 0', overflow: 'hidden',
          background: 'linear-gradient(180deg, #060a12 0%, #0a0f1a 100%)',
          border: '1px solid rgba(34,211,238,0.1)',
          borderBottom: 'none', minHeight: 200,
        }}>
          {/* Lane dividers */}
          {[1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(i / 3) * 100}%`, width: 1,
              background: 'rgba(255,255,255,0.06)',
            }} />
          ))}

          {/* Hit line */}
          <div style={{
            position: 'absolute', bottom: '10%', left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.9) 15%, rgba(251,146,60,0.9) 85%, transparent 100%)',
            boxShadow: '0 0 14px rgba(251,146,60,0.6)',
          }} />

          {/* Notes */}
          {notes.map(n => {
            const elapsed = now - n.spawnTime;
            const progress = Math.min(1.05, elapsed / FALL_DURATION_MS);
            const top = progress * 90;
            const col = LANE_COLORS[n.lane];
            const laneW = 100 / 3;
            return (
              <div key={n.id} style={{
                position: 'absolute',
                left: `${n.lane * laneW + laneW * 0.12}%`,
                width: `${laneW * 0.76}%`,
                top: `${top}%`,
                height: 32,
                borderRadius: 10,
                background: `linear-gradient(180deg, ${col}55, ${col}22)`,
                border: `2px solid ${col}`,
                boxShadow: `0 0 14px ${col}77`,
                willChange: 'top',
              }} />
            );
          })}

          <AnimatePresence>
            {feedback && (
              <motion.div
                key={feedback.id}
                initial={{ opacity: 1, y: 0, scale: 0.9 }}
                animate={{ opacity: 0, y: -40, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15,
                  color: feedback.color, textShadow: `0 0 14px ${feedback.color}`,
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                }}
              >
                {feedback.label}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Lane buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {LANE_COLORS.map((col, i) => (
            <motion.button
              key={i}
              onPointerDown={() => tapLane(i)}
              whileTap={{ scale: 0.93 }}
              style={{
                height: 64, cursor: 'pointer',
                background: laneFlash === i
                  ? `linear-gradient(180deg, ${col}44, ${col}22)`
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${laneFlash === i ? col : 'rgba(255,255,255,0.07)'}`,
                borderTop: `2px solid ${col}`,
                borderRadius: i === 0 ? '0 0 0 16px' : i === 2 ? '0 0 16px 0' : 0,
                boxShadow: laneFlash === i ? `0 0 24px ${col}44, inset 0 0 20px ${col}22` : 'none',
                transition: 'background 0.06s, box-shadow 0.06s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: laneFlash === i ? col : `${col}44`,
                border: `2px solid ${col}`,
                boxShadow: laneFlash === i ? `0 0 16px ${col}` : 'none',
                transition: 'background 0.06s, box-shadow 0.06s',
              }} />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
