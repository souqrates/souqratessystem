import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Listen to the sequence of tones. Then tap the buttons to reproduce it exactly! Correct note = +10 pts per note. One wrong = -150 and restart the sequence. Every 200 pts adds a new note. Reach 1000 pts!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 1000;
const NOTES = [
  { freq: 261, label: 'C', color: '#ef4444' },
  { freq: 329, label: 'E', color: '#f59e0b' },
  { freq: 392, label: 'G', color: '#10b981' },
  { freq: 523, label: 'C2', color: '#3b82f6' },
  { freq: 659, label: 'E2', color: '#a855f7' },
  { freq: 784, label: 'G2', color: '#06b6d4' },
];

export default function SoundMemory({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [state, setState] = useState('idle');
  const [sequence, setSequence] = useState([]);
  const [inputSeq, setInputSeq] = useState([]);
  const [activeNote, setActiveNote] = useState(-1);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const stateRef = useRef('idle');
  const seqRef = useRef([]);
  const inputRef = useRef([]);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getLen = () => 3 + Math.floor(scoreRef.current / 200);
  const getNoteCount = () => Math.min(6, 3 + Math.floor(scoreRef.current / 200));

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const playSequence = useCallback((seq) => {
    stateRef.current = 'showing';
    setState('showing');
    let i = 0;
    const playNext = () => {
      if (!activeRef.current || i >= seq.length) {
        setActiveNote(-1);
        stateRef.current = 'input';
        setState('input');
        return;
      }
      const n = seq[i];
      setActiveNote(n);
      beep({ freq: NOTES[n].freq, dur: 0.35, vol: 0.15 });
      setTimeout(() => {
        setActiveNote(-1);
        i++;
        setTimeout(playNext, 150);
      }, 450);
    };
    setTimeout(playNext, 500);
  }, []);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const len = getLen();
    const nc = getNoteCount();
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * nc));
    seqRef.current = seq;
    inputRef.current = [];
    setSequence(seq);
    setInputSeq([]);
    playSequence(seq);
  }, [playSequence]);

  const tapNote = useCallback((noteIdx) => {
    if (!activeRef.current || stateRef.current !== 'input') return;
    beep({ freq: NOTES[noteIdx].freq, dur: 0.2, vol: 0.1 });
    const newInput = [...inputRef.current, noteIdx];
    inputRef.current = newInput;
    setInputSeq([...newInput]);

    const expected = seqRef.current[newInput.length - 1];
    if (noteIdx !== expected) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.12, vol: 0.12 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      stateRef.current = 'idle';
      setState('idle');
      setTimeout(startRound, 900);
    } else {
      triggerHaptic('light');
      if (newInput.length === seqRef.current.length) {
        const pts = 10 * seqRef.current.length;
        scoreRef.current = Math.max(0, scoreRef.current + pts);
        setScore(scoreRef.current);
        setFlash({ type: 'good', id: Date.now(), pts });
        chord([660, 880, 1100], 0.05, 0.09, 'triangle');
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
    setScore(0); setTimeLeft(GAME_TIME); setState('idle');
    activeRef.current = true;
    setTimeout(startRound, 600);

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

  const nc = getNoteCount();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#a855f7" />
        <Hud label="NOTES" v={`${inputSeq.length}/${sequence.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? `+${flash.pts}!` : 'WRONG NOTE!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <p style={{ color: state === 'showing' ? '#f59e0b' : state === 'input' ? '#10b981' : 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.18em', fontFamily: 'Orbitron, sans-serif', fontWeight: 800 }}>
          {state === 'showing' ? 'LISTEN...' : state === 'input' ? 'REPEAT THE SEQUENCE' : 'GET READY...'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
          {NOTES.slice(0, nc).map((note, i) => {
            const isPlaying = activeNote === i;
            return (
              <motion.button
                key={i}
                whileTap={state === 'input' ? { scale: 0.88 } : {}}
                onPointerDown={() => tapNote(i)}
                disabled={state !== 'input'}
                style={{
                  padding: '22px 8px', borderRadius: 14,
                  background: isPlaying ? `${note.color}44` : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${isPlaying ? note.color : `${note.color}44`}`,
                  color: note.color, fontFamily: 'Orbitron, sans-serif',
                  fontWeight: 900, fontSize: 16, cursor: state === 'input' ? 'pointer' : 'default',
                  boxShadow: isPlaying ? `0 0 24px ${note.color}66` : 'none',
                  transition: 'all 0.1s',
                }}
              >
                {note.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
