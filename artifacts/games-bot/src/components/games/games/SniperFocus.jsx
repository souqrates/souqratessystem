import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'A crosshair drifts across the screen. A target appears briefly. Hold perfectly still when the crosshair is ON the target, then tap. Perfect = +100. Miss = -150. Targets shrink after 400 pts. Reach 1000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;

const W = 280;
const H = 200;
const CROSSHAIR_R = 16;

export default function SniperFocus({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [crosshair, setCrosshair] = useState({ x: W / 2, y: H / 2 });
  const [target, setTarget] = useState(null);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const chRef = useRef({ x: W / 2, y: H / 2 });
  const velRef = useRef({ x: 40, y: 30 });
  const targetRef = useRef(null);
  const targetTimerRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getTargetR = () => Math.max(16, 32 - Math.floor(scoreRef.current / 400) * 4);
  const getTargetLife = () => Math.max(1200, 2500 - Math.floor(scoreRef.current / 200) * 150);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearTimeout(targetTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const spawnTarget = useCallback(() => {
    if (!activeRef.current) return;
    const r = getTargetR();
    const t = {
      x: r + Math.random() * (W - 2 * r),
      y: r + Math.random() * (H - 2 * r),
      r,
    };
    targetRef.current = t;
    setTarget(t);
    beep({ freq: 600, dur: 0.08, vol: 0.06 });

    targetTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      targetRef.current = null;
      setTarget(null);
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(spawnTarget, 600);
    }, getTargetLife());
  }, []);

  const tap = useCallback(() => {
    if (!activeRef.current) return;
    if (!targetRef.current) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.08, vol: 0.08 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      return;
    }
    const t = targetRef.current;
    const ch = chRef.current;
    const dist = Math.sqrt((ch.x - t.x) ** 2 + (ch.y - t.y) ** 2);
    if (dist < t.r + CROSSHAIR_R) {
      clearTimeout(targetTimerRef.current);
      targetRef.current = null;
      setTarget(null);
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(spawnTarget, 400);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.08, vol: 0.07 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
    }
  }, [endGame, onScoreUpdate, TARGET_SCORE, spawnTarget]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    chRef.current = { x: W / 2, y: H / 2 };
    velRef.current = { x: 40, y: 30 };
    setScore(0); setTimeLeft(GAME_TIME); setCrosshair({ x: W / 2, y: H / 2 }); setTarget(null);
    activeRef.current = true;
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      chRef.current.x += velRef.current.x * dt;
      chRef.current.y += velRef.current.y * dt;

      if (chRef.current.x < CROSSHAIR_R) { chRef.current.x = CROSSHAIR_R; velRef.current.x *= -1; }
      if (chRef.current.x > W - CROSSHAIR_R) { chRef.current.x = W - CROSSHAIR_R; velRef.current.x *= -1; }
      if (chRef.current.y < CROSSHAIR_R) { chRef.current.y = CROSSHAIR_R; velRef.current.y *= -1; }
      if (chRef.current.y > H - CROSSHAIR_R) { chRef.current.y = H - CROSSHAIR_R; velRef.current.y *= -1; }

      // Slightly randomize
      velRef.current.x += (Math.random() - 0.5) * 2;
      velRef.current.y += (Math.random() - 0.5) * 2;
      const speed = Math.sqrt(velRef.current.x ** 2 + velRef.current.y ** 2);
      const maxSpeed = 70 + Math.floor(scoreRef.current / 200) * 10;
      if (speed > maxSpeed) { velRef.current.x = velRef.current.x / speed * maxSpeed; velRef.current.y = velRef.current.y / speed * maxSpeed; }
      if (speed < 20) { velRef.current.x *= 1.5; velRef.current.y *= 1.5; }

      setCrosshair({ ...chRef.current });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    setTimeout(spawnTarget, 800);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current); clearTimeout(targetTimerRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const onTarget = target && Math.sqrt((crosshair.x - target.x) ** 2 + (crosshair.y - target.y) ** 2) < target.r + CROSSHAIR_R;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="SIZE" v={target ? getTargetR() : '-'} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8, cursor: 'crosshair' }}
        onPointerDown={tap}
      >
        <MomentumFlash msg={flash?.type === 'good' ? 'HEADSHOT!' : 'MISS!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {target && (
            <g>
              <circle cx={target.x} cy={target.y} r={target.r} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth={2} />
              <circle cx={target.x} cy={target.y} r={4} fill="#ef4444" />
            </g>
          )}
          {/* Crosshair */}
          <g transform={`translate(${crosshair.x},${crosshair.y})`}>
            <circle r={CROSSHAIR_R} fill="none" stroke={onTarget ? '#10b981' : '#3b82f6'} strokeWidth={1.5} />
            <line x1={-CROSSHAIR_R - 4} y1={0} x2={-4} y2={0} stroke={onTarget ? '#10b981' : '#3b82f6'} strokeWidth={1.5} />
            <line x1={4} y1={0} x2={CROSSHAIR_R + 4} y2={0} stroke={onTarget ? '#10b981' : '#3b82f6'} strokeWidth={1.5} />
            <line x1={0} y1={-CROSSHAIR_R - 4} x2={0} y2={-4} stroke={onTarget ? '#10b981' : '#3b82f6'} strokeWidth={1.5} />
            <line x1={0} y1={4} x2={0} y2={CROSSHAIR_R + 4} stroke={onTarget ? '#10b981' : '#3b82f6'} strokeWidth={1.5} />
            <circle r={2} fill={onTarget ? '#10b981' : '#3b82f6'} />
          </g>
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP WHEN ON TARGET</p>
      </div>
    </div>
  );
}
