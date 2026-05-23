import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'TUG OF LIGHT — Tap the GLOWING button as fast as possible. Each tap shifts the marker toward your side. Higher tap rate = bigger pull. 30 seconds — outscore your opponent!';
const GAME_TIME = 30;

// Bot taps every BOT_TAP_MS — averages ~1500 pts over 30s
const BOT_TAP_MIN = 280;
const BOT_TAP_MAX = 420;

export default function TugOfLight({ phase, setPhase, onScoreUpdate, game }) {
  const DURATION = game?.durationSeconds || GAME_TIME;
  const [pos, setPos] = useState(50);
  const [score, setScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pulse, setPulse] = useState(false);
  const [botPulse, setBotPulse] = useState(false);

  const scoreRef = useRef(0);
  const botRef = useRef(0);
  const tapsRef = useRef(0);
  const tapTimesRef = useRef([]);
  const tickRef = useRef(null);
  const botTimerRef = useRef(null);
  const activeRef = useRef(false);
  const lastTapRef = useRef(0);
  const botLastTapRef = useRef(0);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    clearTimeout(botTimerRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    const playerWon = scoreRef.current >= botRef.current;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate]);

  const scheduleBotTap = useCallback(() => {
    if (!activeRef.current) return;
    const delay = BOT_TAP_MIN + Math.random() * (BOT_TAP_MAX - BOT_TAP_MIN);
    botTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      const now = Date.now();
      const dt = botLastTapRef.current ? now - botLastTapRef.current : 350;
      botLastTapRef.current = now;
      const pts = Math.max(5, Math.floor(10 + Math.min(20, 250 / Math.max(80, dt))));
      botRef.current += pts;
      setBotScore(botRef.current);
      setBotPulse(true);
      setTimeout(() => setBotPulse(false), 80);
      setPos(p => Math.min(95, p + 1.4));
      scheduleBotTap();
    }, delay);
  }, []);

  const handleTap = useCallback(() => {
    if (!activeRef.current) return;
    const now = Date.now();
    const dt = lastTapRef.current ? now - lastTapRef.current : 250;
    lastTapRef.current = now;
    tapTimesRef.current = tapTimesRef.current.filter(t => now - t < 1000);
    tapTimesRef.current.push(now);
    const rate = tapTimesRef.current.length;
    tapsRef.current += 1;
    setTaps(tapsRef.current);
    const pts = Math.max(5, Math.floor(10 + Math.min(20, 250 / Math.max(80, dt))));
    scoreRef.current += pts;
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    setPos(p => Math.max(5, p - 1.4));
    setPulse(true);
    setTimeout(() => setPulse(false), 80);
    beep({ freq: 500 + rate * 6, dur: 0.04, type: 'square', vol: 0.1 });
    triggerHaptic('light');
  }, [onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; botRef.current = 0; tapsRef.current = 0; tapTimesRef.current = []; lastTapRef.current = 0; botLastTapRef.current = 0;
    setScore(0); setBotScore(0); setTaps(0); setPos(50); setTimeLeft(DURATION);
    activeRef.current = true;
    scheduleBotTap();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { activeRef.current = false; clearInterval(tickRef.current); clearTimeout(botTimerRef.current); };
  }, [phase, endGame, scheduleBotTap]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, #2a1f00 0%, #04020a 100%)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Scores YOU vs OPPONENT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="YOU" val={score} color="#ffcc00" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 5 ? '#ff3355' : '#fff'} />
        <Tile label="OPP" val={botScore} color={botPulse ? '#ff6b6b' : '#f97316'} />
      </div>
      <Tile label="TAPS" val={taps} color="#00f5a0" />

      {/* Tug bar */}
      <div style={{ position: 'relative', height: 18, borderRadius: 10, overflow: 'hidden',
        background: 'linear-gradient(90deg, rgba(255,204,0,0.25), rgba(255,77,109,0.25))',
        border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pos}%`,
          background: 'linear-gradient(90deg, #ffcc00, #ffa800)', boxShadow: 'inset 0 0 12px rgba(0,0,0,0.4)' }} />
        <div style={{ position: 'absolute', top: -3, bottom: -3, left: `${pos}%`, marginLeft: -3, width: 6,
          background: '#fff', boxShadow: '0 0 18px #fff' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', marginLeft: -1, width: 2,
          background: 'rgba(255,255,255,0.4)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px', fontSize: 9, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em' }}>
        <span>YOU</span><span>OPPONENT</span>
      </div>
      <TimeBar totalTime={DURATION} timeLeft={timeLeft} />

      <motion.button
        whileTap={{ scale: 0.93 }}
        animate={{ scale: pulse ? 1.04 : 1 }}
        onPointerDown={handleTap}
        style={{
          flex: 1, marginTop: 10, borderRadius: 26, cursor: 'pointer', border: '3px solid #ffcc00',
          background: 'radial-gradient(circle at center, #ffe06640, #ffcc0010)',
          boxShadow: '0 0 60px #ffcc00aa, inset 0 0 60px #ffcc0066',
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 42,
          color: '#fff', textShadow: '0 0 24px #ffcc00', letterSpacing: '0.1em',
        }}>
        TAP
      </motion.button>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
    }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
