import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, pick } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'MIRROR MATCH — Watch the color sequence flash, then repeat it by tapping the colored pads. Each correct sequence adds a step. One wrong tap ends your run. 60 seconds — outscore your opponent!';
const DEFAULT_GAME_TIME = 60;
const COLORS = [
  { c: '#ff3355', name: 'red',    freq: 320 },
  { c: '#00f5a0', name: 'green',  freq: 440 },
  { c: '#00f5ff', name: 'cyan',   freq: 520 },
  { c: '#ffcc00', name: 'yellow', freq: 660 },
];

// Bot scores a sequence every BOT_ROUND_MS — averages ~500 pts over 60s
const BOT_ROUND_MS_MIN = 4500;
const BOT_ROUND_MS_MAX = 8000;

export default function MirrorMatch({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [seq, setSeq] = useState([]);
  const [active, setActive] = useState(-1);
  const [stage, setStage] = useState('show');
  const [score, setScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);
  const [botFlash, setBotFlash] = useState(null);

  const seqRef = useRef([]);
  const inputRef = useRef(0);
  const scoreRef = useRef(0);
  const botRef = useRef(0);
  const botRoundRef = useRef(0);
  const tickRef = useRef(null);
  const botTimerRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(tickRef.current);
    clearTimeout(botTimerRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    const playerWon = scoreRef.current >= botRef.current;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate]);

  const scheduleBotRound = useCallback(() => {
    if (!activeRef.current) return;
    const delay = BOT_ROUND_MS_MIN + Math.random() * (BOT_ROUND_MS_MAX - BOT_ROUND_MS_MIN);
    botTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      botRoundRef.current += 1;
      const pts = 20 + botRoundRef.current * 5;
      botRef.current += pts;
      setBotScore(botRef.current);
      setBotFlash(pts);
      setTimeout(() => setBotFlash(null), 600);
      scheduleBotRound();
    }, delay);
  }, []);

  const playSeq = useCallback(async (s) => {
    setStage('show'); setActive(-1);
    for (let i = 0; i < s.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      if (!activeRef.current) return;
      setActive(s[i]);
      beep({ freq: COLORS[s[i]].freq, dur: 0.22, type: 'triangle' });
      await new Promise(r => setTimeout(r, 280));
      setActive(-1);
    }
    setStage('input');
  }, []);

  const nextRound = useCallback(() => {
    const s = [...seqRef.current, Math.floor(Math.random() * 4)];
    seqRef.current = s;
    inputRef.current = 0;
    setSeq(s);
    setRound(s.length);
    playSeq(s);
  }, [playSeq]);

  const onTap = (i) => {
    if (!activeRef.current || stage !== 'input') return;
    setActive(i); setTimeout(() => setActive(-1), 150);
    beep({ freq: COLORS[i].freq, dur: 0.12, type: 'triangle' });
    triggerHaptic('light');
    if (i === seqRef.current[inputRef.current]) {
      inputRef.current += 1;
      if (inputRef.current >= seqRef.current.length) {
        const pts = 20 + seqRef.current.length * 5;
        scoreRef.current += pts;
        setScore(scoreRef.current);
        if (onScoreUpdate) onScoreUpdate(scoreRef.current);
        setFlash({ pts });
        setTimeout(() => setFlash(null), 350);
        triggerHaptic('medium');
        setTimeout(nextRound, 500);
      }
    } else {
      triggerHaptic('error');
      beep({ freq: 140, dur: 0.25, type: 'sawtooth', sweepTo: 60 });
      endGame();
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    seqRef.current = []; inputRef.current = 0; scoreRef.current = 0; botRef.current = 0; botRoundRef.current = 0;
    setScore(0); setBotScore(0); setRound(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    setTimeout(nextRound, 600);
    scheduleBotRound();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { activeRef.current = false; clearInterval(tickRef.current); clearTimeout(botTimerRef.current); };
  }, [phase, nextRound, endGame, scheduleBotRound]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #1a0628 0%, #04020a 100%)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* HUD — YOU vs OPPONENT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="YOU" val={score} color="#ff66ee" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <div style={{ position: 'relative', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 8, color: 'rgba(249,115,22,0.7)', letterSpacing: '0.18em', margin: 0 }}>OPP</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#f97316', margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 12px #f9731655' }}>{botScore}</p>
          <AnimatePresence>
            {botFlash && (
              <motion.span key={botFlash + Math.random()} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -14 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{ position: 'absolute', top: 2, right: 6, fontSize: 9, fontWeight: 900, color: '#f97316', fontFamily: 'Orbitron, sans-serif', pointerEvents: 'none' }}>
                +{botFlash}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.25em', color: 'rgba(148,163,184,0.6)', margin: 0 }}>
          {stage === 'show' ? 'WATCH' : 'REPEAT THE PATTERN'}
        </p>
        {round > 0 && <p style={{ fontSize: 9, color: 'rgba(148,163,184,0.4)', margin: '2px 0 0' }}>Round {round}</p>}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10, padding: 6 }}>
        {COLORS.map((col, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.94 }}
            onPointerDown={() => onTap(i)}
            style={{
              borderRadius: 18, cursor: 'pointer', border: `2px solid ${col.c}`,
              background: active === i
                ? `radial-gradient(circle at center, ${col.c}, ${col.c}55)`
                : `linear-gradient(135deg, ${col.c}22, ${col.c}06)`,
              boxShadow: active === i ? `0 0 40px ${col.c}, inset 0 0 30px ${col.c}88` : `0 0 14px ${col.c}33`,
              transition: 'background 0.08s, box-shadow 0.08s',
            }} />
        ))}
      </div>
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 28,
              color: '#ffcc00', textShadow: '0 0 18px #ffcc00', pointerEvents: 'none',
            }}>+{flash.pts}</motion.div>
        )}
      </AnimatePresence>
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
