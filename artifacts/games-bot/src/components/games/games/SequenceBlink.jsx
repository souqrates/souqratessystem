import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Watch the grid light up in a sequence. Then tap the tiles in the SAME order! Correct sequence = +100 × length. Wrong tile = -150. Every 200 pts adds one more tile. Reach the target in 120 seconds!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 1000;
const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#06b6d4'];
const BASE_LEN = 3;
const BASE_TILES = 4;

export default function SequenceBlink({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [tiles, setTiles] = useState(BASE_TILES);
  const [state, setState] = useState('idle'); // idle | showing | input
  const [sequence, setSequence] = useState([]);
  const [inputSeq, setInputSeq] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [flash, setFlash] = useState(null);
  const [round, setRound] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const stateRef = useRef('idle');
  const sequenceRef = useRef([]);
  const inputRef = useRef([]);

  const TARGET_SCORE = game.targetScore || TARGET;

  const getLen = () => BASE_LEN + Math.floor(scoreRef.current / 200);
  const getTiles = () => Math.min(9, BASE_TILES + Math.floor(scoreRef.current / 200));

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const len = getLen();
    const t = getTiles();
    setTiles(t);
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * t));
    sequenceRef.current = seq;
    inputRef.current = [];
    setSequence(seq);
    setInputSeq([]);
    stateRef.current = 'showing';
    setState('showing');
    setRound(r => r + 1);

    let i = 0;
    const show = () => {
      if (!activeRef.current) return;
      if (i < seq.length) {
        setActiveIdx(seq[i]);
        beep({ freq: 300 + seq[i] * 80, dur: 0.2, vol: 0.1 });
        setTimeout(() => {
          setActiveIdx(-1);
          setTimeout(() => { i++; show(); }, 200);
        }, 400);
      } else {
        stateRef.current = 'input';
        setState('input');
        setActiveIdx(-1);
      }
    };
    setTimeout(show, 400);
  }, []);

  const tap = useCallback((idx) => {
    if (!activeRef.current || stateRef.current !== 'input') return;
    const newInput = [...inputRef.current, idx];
    inputRef.current = newInput;
    setInputSeq([...newInput]);

    const expected = sequenceRef.current[newInput.length - 1];
    if (idx !== expected) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.15, vol: 0.15 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      stateRef.current = 'idle';
      setState('idle');
      setTimeout(startRound, 800);
    } else {
      beep({ freq: 440 + idx * 60, dur: 0.08, vol: 0.08 });
      triggerHaptic('light');
      if (newInput.length === sequenceRef.current.length) {
        const pts = 100 * sequenceRef.current.length;
        scoreRef.current = Math.max(0, scoreRef.current + pts);
        setScore(scoreRef.current);
        setFlash({ type: 'good', id: Date.now(), pts });
        chord([660, 880, 1100], 0.06, 0.1, 'triangle');
        onScoreUpdate?.(scoreRef.current);
        stateRef.current = 'idle';
        setState('idle');
        setTimeout(startRound, 600);
      }
    }
  }, [endGame, onScoreUpdate, startRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; stateRef.current = 'idle'; inputRef.current = [];
    setScore(0); setTimeLeft(GAME_TIME); setRound(0); setState('idle');
    activeRef.current = true;
    setTimeout(startRound, 500);

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

  const cols = Math.ceil(Math.sqrt(tiles));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="ROUND" v={round} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? `+${flash.pts}!` : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <p style={{ color: state === 'showing' ? '#f59e0b' : state === 'input' ? '#10b981' : 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.18em', fontFamily: 'Orbitron, sans-serif', fontWeight: 800 }}>
          {state === 'showing' ? 'WATCH THE SEQUENCE' : state === 'input' ? `TAP ${inputSeq.length}/${sequence.length}` : 'PREPARING...'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, width: '100%' }}>
          {Array.from({ length: tiles }, (_, i) => {
            const color = COLORS[i % COLORS.length];
            const isActive = activeIdx === i;
            const isInput = state === 'input';
            return (
              <motion.button
                key={i}
                whileTap={isInput ? { scale: 0.88 } : {}}
                onPointerDown={() => tap(i)}
                disabled={!isInput}
                style={{
                  aspectRatio: '1', borderRadius: 12,
                  border: `2px solid ${isActive ? color : `${color}33`}`,
                  background: isActive ? `${color}44` : 'rgba(255,255,255,0.03)',
                  cursor: isInput ? 'pointer' : 'default',
                  boxShadow: isActive ? `0 0 20px ${color}66` : 'none',
                  transition: 'all 0.1s',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
