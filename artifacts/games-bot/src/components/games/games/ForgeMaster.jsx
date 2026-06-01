import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, noise } from './_gameKit';
import { TimeBar, TargetBar } from './_shell';

// FORGE MASTER — blacksmith theme. Same memory-and-reproduce mechanic as
// GlyphForge (memorize a 4x4 cell pattern then retap it) but a fully
// distinct visual identity: glowing anvil grid, ember sparks on every tap,
// hammer-strike flash on perfect rounds. Lives in its own file so
// STAR FORGE (id=7) and FORGE MASTER (id=116) render distinct UIs.
const RULES = 'FORGE MASTER — Memorize the rune pattern stamped on the anvil, then strike the same cells. Perfect strike = +110 pts. 90 seconds at the forge.';
const DEFAULT_GAME_TIME = 90;
const GRID = 4;

const EMBER = '#ff7a18';
const FORGE = '#ff3b00';
const STEEL = '#9aa3b3';
const ASH = '#1a0d08';

function makePattern() {
  const all = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) all.push({ r, c });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 5 + Math.floor(Math.random() * 3));
}

const key = (r, c) => `${r}-${c}`;

export default function ForgeMaster({ phase, setPhase, onScoreUpdate, game }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [pattern, setPattern] = useState(makePattern());
  const [input, setInput] = useState([]);
  const [stage, setStage] = useState('show');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [flash, setFlash] = useState(null);
  const [sparks, setSparks] = useState([]);

  const patternRef = useRef(pattern);
  const inputRef = useRef([]);
  const stageRef = useRef('show');
  const scoreRef = useRef(0);
  const tickRef = useRef(null);
  const showTimerRef = useRef(null);
  const activeRef = useRef(false);
  const sparkIdRef = useRef(0);

  const TARGET_SCORE = game?.targetScore || 400;

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(showTimerRef.current);
    clearInterval(tickRef.current);
    onScoreUpdate?.(scoreRef.current);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const p = makePattern();
    patternRef.current = p; inputRef.current = [];
    setPattern(p); setInput([]); setStage('show'); stageRef.current = 'show';
    setRound(r => r + 1);
    showTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      setStage('input'); stageRef.current = 'input';
    }, 1400);
  }, []);

  const spawnSparks = useCallback(() => {
    const id = sparkIdRef.current++;
    const burst = Array.from({ length: 8 }).map((_, i) => ({
      id: `${id}-${i}`,
      dx: (Math.random() - 0.5) * 200,
      dy: -40 - Math.random() * 80,
    }));
    setSparks(prev => [...prev, ...burst]);
    setTimeout(() => {
      setSparks(prev => prev.filter(s => !s.id.startsWith(`${id}-`)));
    }, 700);
  }, []);

  const finish = useCallback(() => {
    const g = patternRef.current;
    const inp = inputRef.current;
    const gSet = new Set(g.map(p => key(p.r, p.c)));
    const inSet = new Set(inp.map(p => key(p.r, p.c)));
    let correct = 0;
    inSet.forEach(k => { if (gSet.has(k)) correct += 1; });
    const wrong = inSet.size - correct;
    const total = gSet.size;
    const acc = Math.max(0, (correct - wrong) / total);
    const perfect = acc === 1 && wrong === 0;
    const pts = Math.floor(acc * 80 + (perfect ? 30 : 0));
    scoreRef.current += pts;
    setScore(scoreRef.current);
    onScoreUpdate?.(scoreRef.current);
    setFlash({ pts, acc: Math.floor(acc * 100), perfect });
    if (perfect) {
      beep({ freq: 220, dur: 0.22, type: 'square' });
      triggerHaptic('heavy');
      spawnSparks();
    } else if (pts > 0) {
      beep({ freq: 340, dur: 0.14, type: 'triangle' });
      triggerHaptic('medium');
    } else {
      noise({ dur: 0.2, vol: 0.18 });
      triggerHaptic('error');
    }
    setStage('result'); stageRef.current = 'result';
    setTimeout(() => setFlash(null), 700);
    setTimeout(startRound, 900);
  }, [startRound, onScoreUpdate, spawnSparks]);

  const onCell = (r, c) => {
    if (stageRef.current !== 'input') return;
    const k = key(r, c);
    if (inputRef.current.find(p => key(p.r, p.c) === k)) return;
    inputRef.current = [...inputRef.current, { r, c }];
    setInput([...inputRef.current]);
    beep({ freq: 180 + inputRef.current.length * 24, dur: 0.06, type: 'square', vol: 0.12 });
    triggerHaptic('light');
    if (inputRef.current.length >= patternRef.current.length) {
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
  }, [phase, startRound, endGame, GAME_TIME]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;

  const patternSet = new Set(pattern.map(p => key(p.r, p.c)));
  const inputSet = new Set(input.map(p => key(p.r, p.c)));

  return (
    <div style={{
      position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: `
        radial-gradient(ellipse at 50% 110%, ${FORGE}44 0%, ${ASH} 50%, #050201 100%),
        radial-gradient(circle at 20% 80%, ${EMBER}22 0%, transparent 40%),
        radial-gradient(circle at 80% 85%, ${EMBER}22 0%, transparent 40%)
      `,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Tile label="HEAT" val={score} color={EMBER} />
        <Tile label="TIME" val={`${timeLeft}s`} color={timeLeft <= 10 ? FORGE : STEEL} />
        <Tile label="ROUND" val={round} color={FORGE} />
      </div>
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={EMBER} />
      <TargetBar score={score} target={TARGET_SCORE} label="MASTERY" />

      <div style={{ textAlign: 'center', position: 'relative' }}>
        <p style={{ fontSize: 10, color: `${EMBER}aa`, letterSpacing: '0.25em', margin: 0, fontFamily: 'Orbitron, sans-serif' }}>
          {stage === 'show' ? 'STUDY THE RUNE' : stage === 'input' ? 'STRIKE THE ANVIL' : 'FORGE'}
        </p>
      </div>

      {/* Anvil grid */}
      <div style={{
        flex: 1, position: 'relative',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)',
        gap: 8, padding: 12, borderRadius: 14,
        background: `
          linear-gradient(180deg, #1a0f08 0%, #0d0604 60%, #050201 100%),
          radial-gradient(ellipse at 50% 100%, ${FORGE}44 0%, transparent 60%)
        `,
        border: `2px solid ${EMBER}66`,
        boxShadow: `inset 0 0 30px ${FORGE}33, 0 0 24px ${EMBER}33`,
        minHeight: 320,
      }}>
        {Array.from({ length: GRID * GRID }).map((_, i) => {
          const r = Math.floor(i / GRID), c = i % GRID;
          const k = key(r, c);
          const showRune = stage === 'show' && patternSet.has(k);
          const userPicked = inputSet.has(k);
          const wasRune = stage === 'result' && patternSet.has(k);
          let bg = `linear-gradient(180deg, #2a1c14, #150c08)`;
          let bd = `${STEEL}44`;
          let glow = 'none';
          if (showRune) {
            bg = `radial-gradient(circle at 50% 40%, #ffea00 0%, ${EMBER} 60%, ${FORGE} 100%)`;
            bd = '#ffea00';
            glow = `0 0 18px ${EMBER}, inset 0 0 10px ${FORGE}88`;
          } else if (userPicked) {
            if (stage === 'result') {
              if (patternSet.has(k)) {
                bg = `radial-gradient(circle at 50% 40%, #fff5b0 0%, ${EMBER} 60%, ${FORGE} 100%)`;
                bd = '#fff5b0'; glow = `0 0 22px ${EMBER}`;
              } else {
                bg = `radial-gradient(circle at 50% 40%, #ff7676 0%, #6a0014 100%)`;
                bd = '#ff3355'; glow = `0 0 12px #ff3355`;
              }
            } else {
              bg = `radial-gradient(circle at 50% 40%, ${EMBER}aa 0%, ${FORGE}66 100%)`;
              bd = EMBER; glow = `0 0 14px ${EMBER}99`;
            }
          } else if (wasRune) {
            bg = `linear-gradient(180deg, ${EMBER}44, ${FORGE}22)`;
            bd = `${EMBER}66`;
          }
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.88 }}
              animate={showRune ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={showRune ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.1 }}
              onPointerDown={() => onCell(r, c)}
              style={{
                borderRadius: 6, cursor: stage === 'input' ? 'pointer' : 'default',
                border: `2px solid ${bd}`,
                background: bg,
                boxShadow: glow,
                transition: 'background 0.12s, border 0.12s',
                willChange: 'transform',
              }} />
          );
        })}
      </div>

      {/* Ember spark burst on perfect strike */}
      <AnimatePresence>
        {sparks.map(s => (
          <motion.div
            key={s.id}
            initial={{ left: '50%', bottom: 60, opacity: 1, scale: 1 }}
            animate={{
              left: `calc(50% + ${s.dx}px)`,
              bottom: 60 - s.dy,
              opacity: 0, scale: 0.3,
            }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute', width: 5, height: 5, marginLeft: -2.5,
              borderRadius: '50%',
              background: '#ffea00',
              boxShadow: `0 0 10px ${EMBER}, 0 0 4px #fff`,
              pointerEvents: 'none', zIndex: 10,
            }}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 30, pointerEvents: 'none', textAlign: 'center',
              color: flash.perfect ? '#ffea00' : flash.pts > 0 ? EMBER : '#ff3355',
              textShadow: `0 0 26px currentColor, 0 0 8px #fff8`,
              letterSpacing: '0.1em',
            }}>
            {flash.perfect ? <>◆ MASTERWORK ◆<br /><span style={{ fontSize: 18 }}>+{flash.pts}</span></> : <>+{flash.pts}<br /><span style={{ fontSize: 12 }}>HEAT {flash.acc}%</span></>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{
      background: 'rgba(20,10,5,0.6)', border: `1px solid ${color}55`,
      borderRadius: 10, padding: '6px 0', textAlign: 'center',
      boxShadow: `inset 0 0 8px ${color}22`,
    }}>
      <p style={{ fontSize: 8, color: 'rgba(154,163,179,0.7)', letterSpacing: '0.18em', margin: 0, fontFamily: 'Orbitron, sans-serif' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}88` }}>{val}</p>
    </div>
  );
}
