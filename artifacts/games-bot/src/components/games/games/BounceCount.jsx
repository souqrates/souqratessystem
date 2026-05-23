import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Watch the ball bounce. Count the bounces, then tap the correct number. Right count = +100. Wrong = -150. Ball bounces faster and count range increases after 400 pts. Reach 1000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

const W = 240;
const H = 180;
const BALL_R = 14;

export default function BounceCount({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [ballY, setBallY] = useState(H / 2);
  const [phase2, setPhase2] = useState('bouncing'); // 'bouncing' | 'guess'
  const [options, setOptions] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const yRef = useRef(BALL_R);
  const velRef = useRef(200);
  const bounceCountRef = useRef(0);
  const targetCountRef = useRef(0);
  const phase2Ref = useRef('bouncing');

  const TARGET_SCORE = game.targetScore || TARGET;
  const getMaxBounces = () => 3 + Math.floor(scoreRef.current / 400) * 2;
  const getBallSpeed = () => 200 + Math.floor(scoreRef.current / 200) * 40;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const startRound = useCallback(() => {
    if (!activeRef.current) return;
    const maxB = getMaxBounces();
    const target = 2 + Math.floor(Math.random() * (maxB - 1));
    targetCountRef.current = target;
    bounceCountRef.current = 0;
    phase2Ref.current = 'bouncing';
    setPhase2('bouncing');
    yRef.current = BALL_R;
    velRef.current = getBallSpeed();
  }, []);

  const showGuess = useCallback(() => {
    phase2Ref.current = 'guess';
    setPhase2('guess');
    const correct = targetCountRef.current;
    setCorrectCount(correct);
    const opts = new Set([correct]);
    while (opts.size < 4) opts.add(1 + Math.floor(Math.random() * (getMaxBounces() + 1)));
    setOptions([...opts].sort(() => Math.random() - 0.5));
  }, []);

  const guess = useCallback((n) => {
    if (!activeRef.current || phase2Ref.current !== 'guess') return;
    if (n === correctCount) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(startRound, 500);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(startRound, 500);
    }
  }, [correctCount, endGame, onScoreUpdate, startRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME); setPhase2('bouncing');
    activeRef.current = true;
    lastRef.current = performance.now();
    startRound();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      if (phase2Ref.current === 'bouncing') {
        yRef.current += velRef.current * dt;
        if (yRef.current >= H - BALL_R) {
          yRef.current = H - BALL_R;
          velRef.current = -Math.abs(velRef.current) * 0.98;
          bounceCountRef.current++;
          beep({ freq: 300, dur: 0.05, vol: 0.07 });
          if (bounceCountRef.current >= targetCountRef.current) {
            setTimeout(showGuess, 400);
          }
        } else if (yRef.current <= BALL_R) {
          yRef.current = BALL_R;
          velRef.current = Math.abs(velRef.current) * 0.98;
        } else {
          velRef.current += 600 * dt; // gravity
        }
        setBallY(yRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="MAX" v={getMaxBounces()} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'CORRECT!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {phase2 === 'bouncing' ? (
          <>
            <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>COUNT THE BOUNCES</p>
            <div style={{ position: 'relative', width: W, height: H, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(59,130,246,0.3)', borderTop: '1px solid rgba(59,130,246,0.5)' }} />
              <div style={{
                position: 'absolute',
                left: W / 2 - BALL_R,
                top: ballY - BALL_R,
                width: BALL_R * 2, height: BALL_R * 2,
                borderRadius: '50%',
                background: '#3b82f6',
                boxShadow: '0 0 12px rgba(59,130,246,0.6)',
              }} />
            </div>
          </>
        ) : (
          <>
            <p style={{ color: '#f59e0b', fontSize: 13, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, letterSpacing: '0.1em' }}>HOW MANY BOUNCES?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 240 }}>
              {options.map(opt => (
                <motion.button
                  key={opt}
                  whileTap={{ scale: 0.88 }}
                  onPointerDown={() => guess(opt)}
                  style={{
                    height: 60, borderRadius: 14,
                    background: 'rgba(59,130,246,0.1)',
                    border: '2px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd',
                    fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 28,
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
