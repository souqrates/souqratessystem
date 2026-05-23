import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Drum circles fall from the top. Tap them as they LAND on the red hit line at the bottom! Perfect timing = PERFECT score. Early or late = reduced points. Miss 5 = game over. Reach 40 to win!';
const DEFAULT_GAME_TIME = 40;
const TARGET = 40;
const BPM = 120;
const BEAT_MS = (60 / BPM) * 1000;
const FALL_DURATION_MS = 1100;
const HIT_Y = 82;
const MISS_LIMIT = 3;

let _nid = 0;

const DRUM_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6'];
const FREQS = [200, 300, 220, 180];

export default function BeatForge({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [notes, setNotes] = useState([]);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null);

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

  const tap = useCallback(() => {
    if (!activeRef.current) return;
    const now = performance.now();
    setNotes(ns => {
      const hit = ns.find(n => {
        if (hitNotes.current.has(n.id)) return false;
        const elapsed = now - n.spawnTime;
        const progress = elapsed / FALL_DURATION_MS;
        const yPct = progress * (HIT_Y - 4);
        return Math.abs(yPct - HIT_Y) < 14;
      });
      if (!hit) {
        comboRef.current = 0; setCombo(0);
        setFeedback({ label: 'EMPTY!', color: '#ef4444', id: Date.now() });
        beep({ freq: 200, dur: 0.1, type: 'sawtooth', vol: 0.1 });
        triggerHaptic('error');
        return ns;
      }
      hitNotes.current.add(hit.id);
      const elapsed = now - hit.spawnTime;
      const progress = elapsed / FALL_DURATION_MS;
      const yPct = progress * HIT_Y;
      const dist = Math.abs(yPct - HIT_Y);
      let pts, label, color;
      if (dist < 4) { pts = 3; label = '💎 PERFECT'; color = '#10b981'; chord([440 * 2, 660 * 2], 0.06, 0.12, 'triangle'); triggerHaptic('success'); }
      else if (dist < 8) { pts = 2; label = '✓ GREAT'; color = '#fbbf24'; beep({ freq: 660, dur: 0.07, vol: 0.1 }); triggerHaptic('light'); }
      else { pts = 1; label = 'GOOD'; color = '#94a3b8'; beep({ freq: 440, dur: 0.06, vol: 0.08 }); triggerHaptic('light'); }
      comboRef.current++;
      scoreRef.current += pts + (comboRef.current >= 5 ? 1 : 0);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setFeedback({ label, color, id: Date.now() });
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
      const lane = Math.floor(Math.random() * 4);
      const id = ++_nid;
      const spawnTime = performance.now();
      setNotes(n => [...n, { id, lane, spawnTime }]);
      setTimeout(() => {
        setNotes(n => {
          if (n.find(x => x.id === id) && !hitNotes.current.has(id)) {
            missesRef.current++;
            setMisses(missesRef.current);
            comboRef.current = 0; setCombo(0);
            beep({ freq: 180, dur: 0.15, type: 'sawtooth', vol: 0.12 });
            triggerHaptic('error');
            setFeedback({ label: 'MISSED!', color: '#ef4444', id: Date.now() });
            if (missesRef.current >= MISS_LIMIT) endGame();
          }
          return n.filter(x => x.id !== id);
        });
      }, FALL_DURATION_MS + 100);
    };

    spawnRef.current = setInterval(spawnNote, BEAT_MS * 1.5);
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    return () => { clearInterval(spawnRef.current); clearInterval(iv); activeRef.current = false; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + scoreRef.current * 2} setPhase={setPhase} />;
  }

  const now = performance.now();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="COMBO" v={combo >= 5 ? `${combo}🔥` : combo} c={combo >= 5 ? '#f97316' : '#94a3b8'} />
        <Hud label="MISSES" v={`${missesRef.current}/${MISS_LIMIT}`} c={missesRef.current >= 3 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={game.targetScore || TARGET} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color="#f59e0b" />

      <div
        onPointerDown={tap}
        style={{
          flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 100%, #1a0900 0%, #050408 100%)',
          border: '1px solid rgba(245,158,11,0.15)', minHeight: 300, touchAction: 'none',
          cursor: 'pointer',
        }}
      >
        {/* Lane dividers */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 25}%`, width: 1, background: 'rgba(255,255,255,0.05)' }} />
        ))}

        {/* Hit line */}
        <div style={{
          position: 'absolute', bottom: '12%', left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg, transparent, rgba(245,158,11,0.8), transparent)`,
          boxShadow: '0 0 12px rgba(245,158,11,0.5)',
        }} />

        {/* Notes */}
        {notes.map(n => {
          const elapsed = now - n.spawnTime;
          const progress = Math.min(1, elapsed / FALL_DURATION_MS);
          const top = progress * 88;
          const col = DRUM_COLORS[n.lane];
          return (
            <div key={n.id} style={{
              position: 'absolute',
              left: `${n.lane * 25 + 4}%`, width: '17%',
              top: `${top}%`, height: 36,
              borderRadius: 10,
              background: `linear-gradient(180deg, ${col}44, ${col}22)`,
              border: `2px solid ${col}`,
              boxShadow: `0 0 14px ${col}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              🥁
            </div>
          );
        })}

        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.id} initial={{ opacity: 1, y: -20, scale: 0.8 }} animate={{ opacity: 0, y: -60, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, color: feedback.color, textShadow: `0 0 14px ${feedback.color}`, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {feedback.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.22)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.14em' }}>
          TAP WHEN DRUMS HIT THE LINE
        </div>
      </div>
    </div>
  );
}
