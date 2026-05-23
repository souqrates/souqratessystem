import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A drum loop plays. Tap the pads that match the beat pattern shown. Correct beat = +100. Wrong pad = -150. Pattern gets longer every 200 pts. Reach 1200 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1200;

const PADS = [
  { id: 0, label: 'KICK', color: '#ef4444', freq: 80 },
  { id: 1, label: 'SNARE', color: '#f59e0b', freq: 200 },
  { id: 2, label: 'HI-HAT', color: '#3b82f6', freq: 600 },
  { id: 3, label: 'CLAP', color: '#10b981', freq: 400 },
];

const BPM = 90;
const BEAT_MS = 60000 / BPM;

function genPattern(len) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 4));
}

export default function DrumLoop({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [pattern, setPattern] = useState([]);
  const [patternIdx, setPatternIdx] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [flash, setFlash] = useState(null);
  const [lit, setLit] = useState(-1);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const patternRef = useRef([]);
  const idxRef = useRef(0);
  const beatTimerRef = useRef(null);
  const showingRef = useRef(true);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getPatternLen = () => 3 + Math.floor(scoreRef.current / 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(beatTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newPattern = useCallback(() => {
    if (!activeRef.current) return;
    const len = getPatternLen();
    const p = genPattern(len);
    patternRef.current = p;
    idxRef.current = 0;
    setPattern(p);
    setPatternIdx(0);
    showingRef.current = true;

    // Show each beat in sequence
    let step = 0;
    const showNext = () => {
      if (!activeRef.current) return;
      if (step >= p.length) {
        showingRef.current = false;
        setCurrentBeat(-1);
        setLit(-1);
        idxRef.current = 0;
        setPatternIdx(0);
        return;
      }
      setCurrentBeat(p[step]);
      setLit(p[step]);
      beep({ freq: PADS[p[step]].freq, dur: 0.12, vol: 0.1 });
      setTimeout(() => { setLit(-1); }, BEAT_MS * 0.4);
      step++;
      beatTimerRef.current = setTimeout(showNext, BEAT_MS);
    };
    beatTimerRef.current = setTimeout(showNext, 400);
  }, []);

  const tapPad = useCallback((padId) => {
    if (!activeRef.current || showingRef.current) return;
    const expected = patternRef.current[idxRef.current];
    if (padId === expected) {
      beep({ freq: PADS[padId].freq, dur: 0.1, vol: 0.12 });
      setLit(padId);
      setTimeout(() => setLit(-1), 150);
      idxRef.current++;
      setPatternIdx(idxRef.current);
      if (idxRef.current >= patternRef.current.length) {
        scoreRef.current = Math.max(0, scoreRef.current + 100);
        setScore(scoreRef.current);
        triggerHaptic('medium');
        chord([660, 880], 0.05, 0.09, 'triangle');
        setFlash({ type: 'good', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setTimeout(newPattern, 600);
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.1 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      idxRef.current = 0;
      setPatternIdx(0);
    }
  }, [endGame, onScoreUpdate, newPattern, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setPattern([]); setPatternIdx(0); setCurrentBeat(-1);
    activeRef.current = true;
    newPattern();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearTimeout(beatTimerRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="STEP" v={`${patternIdx}/${pattern.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'PERFECT!' : 'WRONG BEAT!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Pattern indicator */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {pattern.map((p, i) => (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: 6,
              background: i < patternIdx ? PADS[p].color : i === patternIdx && !showingRef.current ? `${PADS[p].color}66` : 'rgba(255,255,255,0.05)',
              border: `2px solid ${i === patternIdx ? PADS[p].color : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s',
            }} />
          ))}
          {showingRef.current && <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, marginLeft: 4 }}>WATCH</span>}
        </div>

        {/* Drum pads */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 280 }}>
          {PADS.map(pad => (
            <motion.button
              key={pad.id}
              whileTap={{ scale: 0.88 }}
              onPointerDown={() => tapPad(pad.id)}
              style={{
                height: 72, borderRadius: 16,
                background: lit === pad.id ? `${pad.color}44` : `${pad.color}11`,
                border: `3px solid ${lit === pad.id ? pad.color : `${pad.color}33`}`,
                color: pad.color,
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 11,
                letterSpacing: '0.1em', cursor: 'pointer',
                boxShadow: lit === pad.id ? `0 0 24px ${pad.color}66` : 'none',
                transition: 'background 0.08s, box-shadow 0.08s',
              }}
            >
              {pad.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
