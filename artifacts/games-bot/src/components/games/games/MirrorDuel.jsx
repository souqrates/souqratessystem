import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { TargetBar } from './_shell';

const RULES = 'MIRROR DUEL — The system shows a command (e.g. RIGHT). You must tap the OPPOSITE (LEFT). Window shrinks as you play. Earn points by mirroring fast — reach the target before time runs out to win!';

const NEON = '#00f5ff';
const PINK = '#ff00aa';
const COMMANDS = [
  { id: 'UP',    opp: 'DOWN',  arrow: '↑', oppArrow: '↓' },
  { id: 'DOWN',  opp: 'UP',    arrow: '↓', oppArrow: '↑' },
  { id: 'LEFT',  opp: 'RIGHT', arrow: '←', oppArrow: '→' },
  { id: 'RIGHT', opp: 'LEFT',  arrow: '→', oppArrow: '←' },
];

const DEFAULT_GAME_TIME = 40;
const START_WINDOW = 760;
const WINDOW_SHRINK = 8; // shrink per round
const MIN_WINDOW = 260;
const TARGET_SCORE = 1200;

export default function MirrorDuel({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const CFG_TARGET = game?.targetScore || TARGET_SCORE;
  const [round, setRound] = useState(0);
  const [cmd, setCmd] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [windowMs, setWindowMs] = useState(START_WINDOW);
  const [feedback, setFeedback] = useState(null);
  const [progress, setProgress] = useState(100);
  const [earnings, setEarnings] = useState(0);
  const timerRef = useRef(null);
  const progRef = useRef(null);
  const scoreRef = useRef(0);
  const roundRef = useRef(0);
  const startRef = useRef(0);
  const activeRef = useRef(false);
  const lockedRef = useRef(false);
  const windowRef = useRef(START_WINDOW);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(timerRef.current);
    clearInterval(progRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    const won = scoreRef.current >= CFG_TARGET;
    setEarnings(won ? Number(game?.prize || 0) : 0);
    triggerHaptic(won ? 'heavy' : 'error');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game, CFG_TARGET]);

  const nextRound = useCallback(() => {
    if (!activeRef.current) return;
    lockedRef.current = false;
    const c = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    setCmd(c);
    roundRef.current += 1;
    setRound(roundRef.current);
    const w = Math.max(MIN_WINDOW, windowRef.current - WINDOW_SHRINK);
    windowRef.current = w;
    setWindowMs(w);
    setProgress(100);
    startRef.current = Date.now();
    progRef.current = setInterval(() => {
      const e = Date.now() - startRef.current;
      const p = Math.max(0, 100 - (e / w) * 100);
      setProgress(p);
    }, 16);
    timerRef.current = setTimeout(() => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      clearInterval(progRef.current);
      scoreRef.current = Math.max(0, scoreRef.current - 20);
      setScore(scoreRef.current);
      setFeedback({ ok: false, msg: 'TOO SLOW -20' });
      beep({ freq: 160, dur: 0.2, type: 'sawtooth', sweepTo: 60 });
      triggerHaptic('error');
      setTimeout(() => { setFeedback(null); nextRound(); }, 600);
    }, w);
  }, []);

  const tap = useCallback((dir) => {
    if (!activeRef.current || lockedRef.current || !cmd) return;
    lockedRef.current = true;
    clearTimeout(timerRef.current);
    clearInterval(progRef.current);
    if (dir === cmd.opp) {
      const elapsed = Date.now() - startRef.current;
      const speedFrac = Math.max(0, 1 - elapsed / windowMs);
      const pts = Math.round(80 + speedFrac * 70);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current);
      setFeedback({ ok: true, msg: `MIRRORED +${pts}` });
      beep({ freq: 880, dur: 0.15, type: 'triangle' });
      triggerHaptic('medium');
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 40);
      setScore(scoreRef.current);
      setFeedback({ ok: false, msg: dir === cmd.id ? 'NOT THE MIRROR -40' : 'WRONG SIDE -40' });
      beep({ freq: 200, dur: 0.18, type: 'sawtooth', sweepTo: 80 });
      triggerHaptic('error');
    }
    setTimeout(() => { setFeedback(null); nextRound(); }, 600);
  }, [cmd, nextRound, windowMs, onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; roundRef.current = 0;
    windowRef.current = START_WINDOW;
    setScore(0); setRound(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    const iv = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(iv); endGame(); return 0; } return t - 1; }), 1000);
    setTimeout(nextRound, 500);
    return () => {
      activeRef.current = false;
      clearTimeout(timerRef.current);
      clearInterval(progRef.current);
      clearInterval(iv);
    };
  }, [phase, nextRound, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #06121f 0%, #02060a 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="ROUND" val={round} color={NEON} />
        <Tile label="SCORE" val={score} color="#10b981" />
        <Tile label="TIME" val={timeLeft} color="#f97316" />
      </div>
      <TargetBar score={score} target={CFG_TARGET} label="TARGET TO WIN" />

      <div style={{
        position: 'relative', height: 240, borderRadius: 14, overflow: 'hidden', marginTop: 10,
        background: 'radial-gradient(ellipse at center, #001a1e 0%, #000508 100%)',
        border: `1px solid ${NEON}44`,
        backgroundImage: `linear-gradient(${NEON}11 1px, transparent 1px),
                          linear-gradient(90deg, ${NEON}11 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}>
        <p style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
          fontSize: 9, letterSpacing: '0.2em', color: 'rgba(148,163,184,0.55)',
          fontFamily: 'Orbitron, sans-serif', margin: 0 }}>SYSTEM COMMAND</p>
        <AnimatePresence mode="wait">
          {cmd && (
            <motion.div
              key={cmd.id + round}
              initial={{ scale: 0.4, opacity: 0, rotateX: -45 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 1 }}>
                {/* Pulsing halo ring around the command arrow */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.7 }}
                  animate={{ scale: [0.85, 1.25, 0.85], opacity: [0.55, 0.15, 0.55] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: -28, borderRadius: '50%',
                    border: `2px solid ${PINK}`,
                    boxShadow: `0 0 30px ${PINK}88, inset 0 0 20px ${PINK}55`,
                    pointerEvents: 'none',
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    fontSize: 110, fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                    color: PINK, textShadow: `0 0 30px ${PINK}, 0 0 60px ${PINK}88`,
                    lineHeight: 1,
                  }}>{cmd.arrow}</motion.div>
              </div>
              <div style={{
                fontSize: 16, fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                letterSpacing: '0.3em', color: PINK,
              }}>{cmd.id}</div>
              <div style={{
                fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)',
              }}>DO THE OPPOSITE</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4,
          background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${NEON}, ${PINK})`,
              boxShadow: `0 0 10px ${NEON}` }}
          />
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: 14, right: 14,
                padding: '6px 14px', borderRadius: 999,
                background: feedback.ok ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                border: `1px solid ${feedback.ok ? '#10b981' : '#ef4444'}`,
                color: feedback.ok ? '#10b981' : '#ef4444',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 11 }}>
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, justifyItems: 'center' }}>
        <div />
        <DirBtn onClick={() => tap('UP')}>↑</DirBtn>
        <div />
        <DirBtn onClick={() => tap('LEFT')}>←</DirBtn>
        <div />
        <DirBtn onClick={() => tap('RIGHT')}>→</DirBtn>
        <div />
        <DirBtn onClick={() => tap('DOWN')}>↓</DirBtn>
        <div />
      </div>
    </div>
  );
}

function DirBtn({ children, onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onPointerDown={onClick}
      style={{
        width: 64, height: 64, borderRadius: 16, cursor: 'pointer',
        background: `linear-gradient(135deg, ${NEON}22, ${NEON}08)`,
        border: `2px solid ${NEON}55`,
        boxShadow: `0 0 20px ${NEON}22`,
        color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 30,
        textShadow: `0 0 18px ${NEON}`,
      }}>
      {children}
    </motion.button>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
      borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
