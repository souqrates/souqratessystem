import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';
import { Play } from 'lucide-react';

const RULES = 'Listen to the note played. Then tap the matching note on the keyboard. Correct note = +100. Wrong = -150. Sequence gets longer after 400 pts. Reach 1000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

const NOTES = [
  { name: 'C', freq: 261, color: '#ef4444' },
  { name: 'D', freq: 293, color: '#f97316' },
  { name: 'E', freq: 329, color: '#f59e0b' },
  { name: 'F', freq: 349, color: '#10b981' },
  { name: 'G', freq: 392, color: '#3b82f6' },
  { name: 'A', freq: 440, color: '#8b5cf6' },
  { name: 'B', freq: 493, color: '#ec4899' },
];

function playNote(freq, dur = 0.3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (e) {}
}

export default function VocalPitch({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [targetNote, setTargetNote] = useState(null);
  const [flash, setFlash] = useState(null);
  const [listening, setListening] = useState(false);
  const [seqMode, setSeqMode] = useState(false);
  const [sequence, setSequence] = useState([]);
  const [seqIdx, setSeqIdx] = useState(0);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const targetRef = useRef(null);
  const sequenceRef = useRef([]);
  const seqIdxRef = useRef(0);
  const seqModeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSeqLen = () => scoreRef.current >= 400 ? 3 : 1;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const len = getSeqLen();
    const seq = Array.from({ length: len }, () => NOTES[Math.floor(Math.random() * NOTES.length)]);
    sequenceRef.current = seq;
    seqIdxRef.current = 0;
    seqModeRef.current = len > 1;
    setSequence(seq);
    setSeqIdx(0);
    setSeqMode(len > 1);
    setListening(false);

    // Play the note(s)
    let delay = 300;
    seq.forEach((note, i) => {
      setTimeout(() => {
        if (!activeRef.current) return;
        playNote(note.freq);
        if (i === seq.length - 1) {
          setTimeout(() => {
            if (!activeRef.current) return;
            setListening(true);
            targetRef.current = seq[0];
            setTargetNote(seq[0]);
          }, 400);
        }
      }, delay + i * 500);
    });
  }, []);

  const tapNote = useCallback((note) => {
    if (!activeRef.current || !listening) return;
    const expected = sequenceRef.current[seqIdxRef.current];
    playNote(note.freq, 0.15);

    if (note.name === expected.name) {
      const nextIdx = seqIdxRef.current + 1;
      if (nextIdx >= sequenceRef.current.length) {
        scoreRef.current = Math.max(0, scoreRef.current + 100);
        setScore(scoreRef.current);
        triggerHaptic('medium');
        chord([660, 880], 0.05, 0.09, 'triangle');
        setFlash({ type: 'good', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        setListening(false);
        setTimeout(newRound, 600);
      } else {
        seqIdxRef.current = nextIdx;
        setSeqIdx(nextIdx);
        setTargetNote(sequenceRef.current[nextIdx]);
        targetRef.current = sequenceRef.current[nextIdx];
        beep({ freq: 400, dur: 0.06, vol: 0.07 });
        setFlash({ type: 'good', id: Date.now() });
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      seqIdxRef.current = 0;
      setSeqIdx(0);
      setListening(false);
      setTimeout(newRound, 500);
    }
  }, [listening, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  const replay = useCallback(() => {
    if (!activeRef.current) return;
    setListening(false);
    let delay = 0;
    sequenceRef.current.forEach((note, i) => {
      setTimeout(() => {
        if (!activeRef.current) return;
        playNote(note.freq);
        if (i === sequenceRef.current.length - 1) setTimeout(() => { if (activeRef.current) setListening(true); }, 400);
      }, delay + i * 500);
    });
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setListening(false);
    activeRef.current = true;
    setTimeout(newRound, 600);

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#8b5cf6" />
        <Hud label="SEQ" v={`${seqIdx}/${sequence.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'CORRECT!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {/* Status */}
        <div style={{ textAlign: 'center' }}>
          {!listening ? (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, letterSpacing: '0.14em' }}>LISTEN TO THE NOTE...</p>
          ) : (
            <div>
              <p style={{ color: '#8b5cf6', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.14em' }}>
                {seqMode ? `TAP NOTE ${seqIdx + 1} OF ${sequence.length}` : 'TAP THE MATCHING NOTE'}
              </p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                {sequence.map((note, i) => (
                  <div key={i} style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: i < seqIdx ? `${note.color}44` : i === seqIdx ? `${note.color}22` : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${i <= seqIdx ? note.color : 'rgba(255,255,255,0.06)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: note.color, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 11,
                  }}>
                    {i < seqIdx ? '✓' : '?'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Piano keys */}
        <div style={{ display: 'flex', gap: 4 }}>
          {NOTES.map(note => (
            <motion.button
              key={note.name}
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => tapNote(note)}
              style={{
                width: 36, height: 72, borderRadius: 8,
                background: listening ? `${note.color}22` : 'rgba(255,255,255,0.04)',
                border: `2px solid ${listening ? note.color : 'rgba(255,255,255,0.08)'}`,
                color: note.color,
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 12,
                cursor: listening ? 'pointer' : 'default',
                opacity: listening ? 1 : 0.4,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6,
                boxShadow: listening ? `0 0 10px ${note.color}33` : 'none',
              }}
            >
              {note.name}
            </motion.button>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onPointerDown={replay}
          style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)', fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em' }}
        >
          <Play size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> REPLAY
        </motion.button>
      </div>
    </div>
  );
}
