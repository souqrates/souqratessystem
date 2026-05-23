import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Build an equation that equals the target number. Tap numbers and operators to form the equation. Correct = +100. Wrong = -150. Target difficulty increases every 200 pts. Reach 1500 in 120 seconds!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 1500;

const OPS = ['+', '-', '×', '÷'];

function genEquation(level) {
  const ops = level < 2 ? ['+', '-'] : level < 4 ? ['+', '-', '×'] : OPS;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, result;
  if (op === '+') { a = Math.floor(Math.random() * (5 + level * 3)) + 1; b = Math.floor(Math.random() * (5 + level * 3)) + 1; result = a + b; }
  else if (op === '-') { a = Math.floor(Math.random() * (10 + level * 3)) + 5; b = Math.floor(Math.random() * a) + 1; result = a - b; }
  else if (op === '×') { a = Math.floor(Math.random() * (3 + level)) + 2; b = Math.floor(Math.random() * (3 + level)) + 2; result = a * b; }
  else { b = Math.floor(Math.random() * 5) + 2; a = b * (Math.floor(Math.random() * 6) + 1); result = a / b; }

  // Generate number tiles including correct ones + distractors
  const needed = [a, b];
  const extras = new Set();
  while (extras.size < 3) extras.add(Math.floor(Math.random() * (result + 5)) + 1);
  const numbers = [...new Set([...needed, ...extras])].sort(() => Math.random() - 0.5).slice(0, 6);
  if (!numbers.includes(a)) numbers[Math.floor(Math.random() * numbers.length)] = a;
  if (!numbers.includes(b)) numbers[Math.floor(Math.random() * numbers.length)] = b;

  return { a, b, op, result, numbers: numbers.map((n, i) => ({ id: i, value: n })) };
}

function evalEquation(parts) {
  if (parts.length !== 3) return null;
  const [n1, op, n2] = parts;
  if (typeof n1 !== 'number' || typeof n2 !== 'number' || typeof op !== 'string') return null;
  if (op === '+') return n1 + n2;
  if (op === '-') return n1 - n2;
  if (op === '×') return n1 * n2;
  if (op === '÷') return n2 !== 0 ? n1 / n2 : null;
  return null;
}

export default function EquationBuild({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [eq, setEq] = useState(null);
  const [parts, setParts] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    setEq(genEquation(Math.floor(scoreRef.current / 200)));
    setParts([]);
  }, []);

  const addPart = useCallback((val) => {
    if (!activeRef.current || !eq) return;
    setParts(prev => {
      const next = [...prev, val];
      if (next.length === 3) {
        const result = evalEquation(next);
        if (result !== null && Math.abs(result - eq.result) < 0.001) {
          scoreRef.current = Math.max(0, scoreRef.current + 100);
          setScore(scoreRef.current);
          triggerHaptic('medium');
          chord([660, 880, 1100], 0.06, 0.1, 'triangle');
          setFlash({ type: 'good', id: Date.now() });
          onScoreUpdate?.(scoreRef.current);
          setTimeout(newRound, 500);
        } else {
          scoreRef.current = Math.max(0, scoreRef.current - 150);
          setScore(scoreRef.current);
          triggerHaptic('error');
          noise({ dur: 0.1, vol: 0.1 });
          setFlash({ type: 'bad', id: Date.now() });
          onScoreUpdate?.(scoreRef.current);
          setTimeout(() => setParts([]), 500);
        }
        return next;
      }
      beep({ freq: 350 + next.length * 60, dur: 0.05, vol: 0.07 });
      return next;
    });
  }, [eq, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newRound();

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
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="TARGET" v={eq?.result ?? '?'} c="#f59e0b" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'CORRECT!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {eq && (
          <>
            {/* Target */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, letterSpacing: '0.12em', marginBottom: 4 }}>BUILD EQUATION EQUAL TO</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 40, color: '#f59e0b', textShadow: '0 0 20px rgba(245,158,11,0.5)' }}>{eq.result}</div>
            </div>

            {/* Equation builder display */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 52 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: parts[i] !== undefined ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${parts[i] !== undefined ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: '#93c5fd',
                }}>
                  {parts[i] !== undefined ? parts[i] : '?'}
                </div>
              ))}
            </div>

            <motion.button whileTap={{ scale: 0.9 }} onPointerDown={() => setParts([])} style={{ padding: '6px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.6)', fontSize: 10, cursor: 'pointer' }}>CLEAR</motion.button>

            {/* Numbers */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {eq.numbers.map(n => (
                <motion.button
                  key={n.id}
                  whileTap={{ scale: 0.88 }}
                  onPointerDown={() => parts.length === 1 ? null : addPart(n.value)}
                  disabled={parts.length === 1}
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'rgba(59,130,246,0.1)',
                    border: '2px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18,
                    cursor: parts.length === 1 ? 'default' : 'pointer',
                    opacity: parts.length === 1 ? 0.4 : 1,
                  }}
                >
                  {n.value}
                </motion.button>
              ))}
            </div>

            {/* Operators (shown when first number picked) */}
            {parts.length === 1 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {OPS.map(op => (
                  <motion.button
                    key={op}
                    whileTap={{ scale: 0.88 }}
                    onPointerDown={() => addPart(op)}
                    style={{
                      width: 52, height: 52, borderRadius: 12,
                      background: 'rgba(245,158,11,0.1)',
                      border: '2px solid rgba(245,158,11,0.3)',
                      color: '#fcd34d', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20,
                      cursor: 'pointer',
                    }}
                  >
                    {op}
                  </motion.button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
