import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Swing from platform to platform! Tap to release the rope at the right moment and land on the next platform. Perfect landing = +100. Fall = -150. Platforms get smaller after 400 pts. Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;

const W = 280;
const H = 260;
const PIVOT_Y = 40;
const ROPE_LEN = 100;

export default function RopeSwing({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [angle, setAngle] = useState(-Math.PI / 3);
  const [platforms, setPlatforms] = useState([]);
  const [pivotX, setPivotX] = useState(80);
  const [flash, setFlash] = useState(null);
  const [swinging, setSwinging] = useState(false);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const angleRef = useRef(-Math.PI / 3);
  const angVelRef = useRef(0.04);
  const pivotXRef = useRef(80);
  const platformsRef = useRef([]);
  const lastRef = useRef(0);
  const swingingRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getPlatW = () => Math.max(30, 60 - Math.floor(scoreRef.current / 400) * 8);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const genPlatforms = useCallback(() => {
    const pw = getPlatW();
    const platforms = [
      { x: pivotXRef.current - pw / 2, y: H - 50, w: pw, id: 0 },
      { x: pivotXRef.current + 80 - pw / 2, y: H - 50 - Math.random() * 30, w: pw, id: 1 },
    ];
    platformsRef.current = platforms;
    setPlatforms(platforms);
  }, []);

  const release = useCallback(() => {
    if (!activeRef.current || !swingingRef.current) return;
    swingingRef.current = false;
    setSwinging(false);

    const a = angleRef.current;
    const bx = pivotXRef.current + Math.sin(a) * ROPE_LEN;
    const by = PIVOT_Y + Math.cos(a) * ROPE_LEN;

    // Check landing on next platform
    const next = platformsRef.current[1];
    if (!next) return;

    const landX = bx;
    const landY = by;
    const hitPlatform = landX >= next.x && landX <= next.x + next.w && Math.abs(landY - next.y) < 20;

    if (hitPlatform) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);

      // Advance
      const pw = getPlatW();
      const newPivot = next.x + next.w / 2;
      pivotXRef.current = newPivot;
      setPivotX(newPivot);
      const nextPlatform = { x: newPivot + 60 + Math.random() * 40 - pw / 2, y: H - 50 - Math.random() * 30, w: pw, id: Date.now() };
      platformsRef.current = [next, nextPlatform];
      setPlatforms([next, nextPlatform]);

      angleRef.current = -Math.PI / 3;
      angVelRef.current = 0.04;
      setAngle(-Math.PI / 3);

      swingingRef.current = true;
      setSwinging(true);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      // Reset to first platform
      angleRef.current = -Math.PI / 3;
      angVelRef.current = 0.04;
      setAngle(-Math.PI / 3);
      swingingRef.current = true;
      setSwinging(true);
    }
  }, [endGame, onScoreUpdate, TARGET_SCORE, getPlatW]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    pivotXRef.current = 100;
    angleRef.current = -Math.PI / 3;
    angVelRef.current = 0.04;
    setScore(0); setTimeLeft(GAME_TIME); setPivotX(100);
    setAngle(-Math.PI / 3); setSwinging(true);
    swingingRef.current = true;
    activeRef.current = true;
    lastRef.current = performance.now();
    genPlatforms();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      if (swingingRef.current) {
        // Simple pendulum
        const g = 9.8;
        const angAcc = (-g / ROPE_LEN * 60) * Math.sin(angleRef.current) * dt;
        angVelRef.current += angAcc;
        angVelRef.current *= 0.999;
        angleRef.current += angVelRef.current;
        setAngle(angleRef.current);
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

  const ballX = pivotX + Math.sin(angle) * ROPE_LEN;
  const ballY = PIVOT_Y + Math.cos(angle) * ROPE_LEN;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f97316" />
        <Hud label="PLATW" v={getPlatW()} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, cursor: 'pointer' }}
        onPointerDown={release}
      >
        <MomentumFlash msg={flash?.type === 'good' ? 'LANDED!' : 'FELL!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {/* Platforms */}
          {platforms.map(p => (
            <rect key={p.id} x={p.x} y={p.y} width={p.w} height={12} rx={4} fill="rgba(16,185,129,0.5)" stroke="#10b981" strokeWidth={1.5} />
          ))}

          {/* Rope */}
          <line x1={pivotX} y1={PIVOT_Y} x2={ballX} y2={ballY} stroke="rgba(249,115,22,0.6)" strokeWidth={2} />

          {/* Pivot */}
          <circle cx={pivotX} cy={PIVOT_Y} r={5} fill="#f97316" />

          {/* Ball */}
          <circle cx={ballX} cy={ballY} r={10} fill="#f97316" style={{ filter: 'drop-shadow(0 0 6px #f9731688)' }} />
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP TO RELEASE ROPE</p>
      </div>
    </div>
  );
}
