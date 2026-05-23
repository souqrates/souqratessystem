import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar } from './_shell';

const RULES = 'GLYPH FORGE \u2014 Memorize the glyph shape, then redraw it by tapping the grid cells in order. Perfect match = bonus. Round resets after each attempt. 90 seconds.';
const DEFAULT_GAME_TIME = 90;
const GRID = 4;

function makeGlyph() {
  const all = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) all.push({ r, c });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 5 + Math.floor(Math.random() * 3));
}

const key = (r, c) => `${r}-${c}`;

export default function GlyphForge({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [glyph, setGlyph] = useState(makeGlyph());
  const [input, setInput] = useState([]);
  const [stage, setStage] = useState('show'); // show | input | result
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);

  const glyphRef = useRef(glyph);
  const inputRef = useRef([]);
  const stageRef = useRef('show');
  const scoreRef = useRef(0);
  const tickRef = useRef(null);
  const showTimerRef = useRef(null);
  const activeRef = useRef(false);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(showTimerRef.current);
    clearInterval(tickRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase('won'), 400);
  }, [setPhase, onScoreUpdate]);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const g = makeGlyph();
    glyphRef.current = g; inputRef.current = [];
    setGlyph(g); setInput([]); setStage('show'); stageRef.current = 'show';
    setRound(r => r + 1);
    showTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      setStage('input'); stageRef.current = 'input';
    }, 1400);
  }, []);

  const finish = useCallback(() => {
    const g = glyphRef.current;
    const inp = inputRef.current;
    const gSet = new Set(g.map(p => key(p.r, p.c)));
    const inSet = new Set(inp.map(p => key(p.r, p.c)));
    let correct = 0;
    inSet.forEach(k => { if (gSet.has(k)) correct += 1; });
    const wrong = inSet.size - correct;
    const missed = gSet.size - correct;
    const total = gSet.size;
    const acc = Math.max(0, (correct - wrong) / total);
    const pts = Math.floor(acc * 80 + (acc === 1 && wrong === 0 ? 30 : 0));
    scoreRef.current += pts;
    setScore(scoreRef.current);
    if (onScoreUpdate) onScoreUpdate(scoreRef.current);
    setFlash({ pts, acc: Math.floor(acc * 100), perfect: acc === 1 && wrong === 0 });
    if (acc === 1 && wrong === 0) {
      beep({ freq: 800, dur: 0.18, type: 'square' });
      triggerHaptic('medium');
    } else if (pts > 0) {
      beep({ freq: 520, dur: 0.12, type: 'triangle' });
      triggerHaptic('light');
    } else {
      noise({ dur: 0.18, vol: 0.16 });
      triggerHaptic('error');
    }
    setStage('result'); stageRef.current = 'result';
    setTimeout(() => setFlash(null), 600);
    setTimeout(startRound, 800);
  }, [startRound, onScoreUpdate]);

  const onCell = (r, c) => {
    if (stageRef.current !== 'input') return;
    const k = key(r, c);
    if (inputRef.current.find(p => key(p.r, p.c) === k)) return;
    inputRef.current = [...inputRef.current, { r, c }];
    setInput([...inputRef.current]);
    beep({ freq: 420 + inputRef.current.length * 30, dur: 0.05, type: 'square', vol: 0.1 });
    triggerHaptic('light');
    if (inputRef.current.length >= glyphRef.current.length) {
      setTimeout(finish, 200);
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; setScore(0); setRound(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    startRound();
    tickRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
    return () => { activeRef.current = false; clearTimeout(showTimerRef.current); clearInterval(tickRef.current); };
  }, [phase, startRound, endGame]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  const glyphSet = new Set(glyph.map(p => key(p.r, p.c)));
  const inputSet = new Set(input.map(p => key(p.r, p.c)));

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #2a1400 0%, #02060c 100%)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="SCORE" val={score} color="#ffcc00" />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? '#ff3355' : '#fff'} />
        <Tile label="ROUND" val={round} color="#ff66ee" />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.25em', margin: 0 }}>
          {stage === 'show' ? 'MEMORIZE' : stage === 'input' ? 'REPRODUCE' : '\u2014'}
        </p>
      </div>
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)',
        gap: 8, padding: 8, borderRadius: 14,
        background: 'radial-gradient(circle at center, rgba(255,204,0,0.04), rgba(0,0,0,0.5))',
        border: '1px solid rgba(255,204,0,0.2)', minHeight: 320,
      }}>
        {Array.from({ length: GRID * GRID }).map((_, i) => {
          const r = Math.floor(i / GRID), c = i % GRID;
          const k = key(r, c);
          const showGlyph = stage === 'show' && glyphSet.has(k);
          const userPicked = inputSet.has(k);
          const wasGlyph = stage === 'result' && glyphSet.has(k);
          let bg = 'rgba(255,255,255,0.04)';
          let bd = 'rgba(255,255,255,0.08)';
          if (showGlyph) { bg = 'linear-gradient(135deg, #ffcc00, #aa7a00)'; bd = '#ffcc00'; }
          else if (userPicked) {
            if (stage === 'result') {
              if (glyphSet.has(k)) { bg = 'linear-gradient(135deg, #00f5a0, #006a4a)'; bd = '#00f5a0'; }
              else { bg = 'linear-gradient(135deg, #ff3355, #6a0014)'; bd = '#ff3355'; }
            } else { bg = 'linear-gradient(135deg, #00f5ff, #003a5a)'; bd = '#00f5ff'; }
          } else if (wasGlyph) { bg = 'linear-gradient(135deg, rgba(255,204,0,0.5), rgba(170,122,0,0.5))'; bd = 'rgba(255,204,0,0.8)'; }
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => onCell(r, c)}
              style={{
                borderRadius: 10, cursor: stage === 'input' ? 'pointer' : 'default',
                border: `2px solid ${bd}`, background: bg,
                boxShadow: showGlyph || userPicked || wasGlyph ? `0 0 14px ${bd}88, inset 0 0 12px rgba(0,0,0,0.3)` : 'none',
                transition: 'background 0.12s, border 0.12s, box-shadow 0.12s',
              }} />
          );
        })}
      </div>
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 28, pointerEvents: 'none', textAlign: 'center',
              color: flash.perfect ? '#00f5a0' : flash.pts > 0 ? '#ffcc00' : '#ff3355',
              textShadow: `0 0 22px currentColor`,
            }}>
            {flash.perfect ? <>PERFECT<br /><span style={{ fontSize: 18 }}>+{flash.pts}</span></> : <>+{flash.pts}<br /><span style={{ fontSize: 12 }}>ACC {flash.acc}%</span></>}
          </motion.div>
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
