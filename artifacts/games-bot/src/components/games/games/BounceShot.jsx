import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TargetBar } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Swipe to aim and launch a ball. It bounces off walls. Land the ball in a glowing target! 10 targets per game. Perfect shots combo for bonus points. Hit all 10 to win!';
const TOTAL_TARGETS = 14;
const W = 300, H = 360;
const BALL_R = 10;
const TARGET_R = 16;

export default function BounceShot({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(TOTAL_TARGETS);
  const [ballPos, setBallPos] = useState({ x: W / 2, y: H - 40 });
  const [ballVel, setBallVel] = useState(null);
  const [target, setTarget] = useState(null);
  const [trail, setTrail] = useState([]);
  const [aiming, setAiming] = useState(false);
  const [aimLine, setAimLine] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [combo, setCombo] = useState(0);

  const scoreRef = useRef(0);
  const remainingRef = useRef(TOTAL_TARGETS);
  const comboRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const posRef = useRef({ x: W / 2, y: H - 40 });
  const velRef = useRef(null);
  const targetRef = useRef(null);
  const touchStart = useRef(null);

  const newTarget = useCallback(() => {
    const t = { x: 30 + Math.random() * (W - 60), y: 40 + Math.random() * (H / 2 - 40) };
    targetRef.current = t;
    setTarget(t);
  }, []);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= (game.targetScore || 10) ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, game.targetScore]);

  const animateBall = useCallback(() => {
    if (!activeRef.current || !velRef.current) return;
    let { x, y } = posRef.current;
    let { vx, vy } = velRef.current;
    x += vx; y += vy;
    if (x - BALL_R < 0) { x = BALL_R; vx = Math.abs(vx); beep({ freq: 300, dur: 0.04, vol: 0.06 }); }
    if (x + BALL_R > W) { x = W - BALL_R; vx = -Math.abs(vx); beep({ freq: 300, dur: 0.04, vol: 0.06 }); }
    if (y - BALL_R < 0) { y = BALL_R; vy = Math.abs(vy); beep({ freq: 300, dur: 0.04, vol: 0.06 }); }
    const speed = Math.hypot(vx, vy);
    const friction = 0.995;
    vx *= friction; vy *= friction;
    posRef.current = { x, y };
    velRef.current = { vx, vy };
    setBallPos({ x, y });
    setTrail(t => [...t.slice(-12), { x, y }]);
    const t = targetRef.current;
    if (t && Math.hypot(x - t.x, y - t.y) < BALL_R + TARGET_R) {
      velRef.current = null; setTrail([]);
      comboRef.current++;
      const pts = comboRef.current >= 3 ? 3 : comboRef.current >= 2 ? 2 : 1;
      scoreRef.current += pts;
      remainingRef.current--;
      setScore(scoreRef.current); setRemaining(remainingRef.current); setCombo(comboRef.current);
      chord([660, 990, 1320], 0.06, 0.12, 'triangle');
      triggerHaptic('success');
      setFeedback({ label: comboRef.current >= 3 ? '🔥 COMBO ×3' : comboRef.current >= 2 ? '×2 GREAT' : '✓ HIT', color: '#10b981', id: Date.now() });
      posRef.current = { x: W / 2, y: H - 40 };
      setBallPos({ x: W / 2, y: H - 40 });
      if (remainingRef.current <= 0) { targetRef.current = null; setTarget(null); endGame(); return; }
      setTimeout(newTarget, 400);
    } else if (speed < 0.5) {
      velRef.current = null; setTrail([]); comboRef.current = 0; setCombo(0);
      posRef.current = { x: W / 2, y: H - 40 };
      setBallPos({ x: W / 2, y: H - 40 });
      setFeedback({ label: 'MISS', color: '#ef4444', id: Date.now() });
      triggerHaptic('error');
    }
    if (velRef.current) rafRef.current = requestAnimationFrame(animateBall);
  }, [endGame, newTarget]);

  const launch = useCallback((tx, ty) => {
    if (!activeRef.current || velRef.current) return;
    const dx = posRef.current.x - tx;
    const dy = posRef.current.y - ty;
    const speed = Math.min(12, Math.hypot(dx, dy) * 0.12);
    const angle = Math.atan2(dy, dx) + Math.PI;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    velRef.current = { vx, vy };
    setAiming(false); setAimLine(null);
    beep({ freq: 440, dur: 0.06, vol: 0.1 });
    triggerHaptic('medium');
    rafRef.current = requestAnimationFrame(animateBall);
  }, [animateBall]);

  const onTouchStart = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    touchStart.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    setAiming(true);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!touchStart.current || velRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const tx = e.clientX - r.left;
    const ty = e.clientY - r.top;
    setAimLine({ x1: posRef.current.x, y1: posRef.current.y, x2: tx, y2: ty });
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!touchStart.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const tx = e.changedTouches ? e.changedTouches[0].clientX - r.left : e.clientX - r.left;
    const ty = e.changedTouches ? e.changedTouches[0].clientY - r.top : e.clientY - r.top;
    touchStart.current = null;
    launch(tx, ty);
  }, [launch]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; remainingRef.current = TOTAL_TARGETS; comboRef.current = 0;
    posRef.current = { x: W / 2, y: H - 40 }; velRef.current = null;
    setScore(0); setRemaining(TOTAL_TARGETS); setCombo(0); setBallPos({ x: W / 2, y: H - 40 }); setBallVel(null); setTrail([]); setFeedback(null); setAiming(false);
    activeRef.current = true;
    newTarget();
    return () => { cancelAnimationFrame(rafRef.current); activeRef.current = false; velRef.current = null; };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') {
    return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={15 + scoreRef.current * 5} setPhase={setPhase} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#3b82f6" />
        <Hud label="LEFT" v={remaining} c="#94a3b8" />
        <Hud label="COMBO" v={combo >= 2 ? `×${combo}🔥` : combo} c={combo >= 2 ? '#f97316' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={TOTAL_TARGETS - remaining} target={game.targetScore || TOTAL_TARGETS} label="TARGET TO WIN" />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          width={W} height={H}
          onPointerDown={onTouchStart}
          onPointerMove={onTouchMove}
          onPointerUp={onTouchEnd}
          style={{
            borderRadius: 16, background: 'radial-gradient(ellipse at 50% 80%, #00080f, #030508)',
            border: '1px solid rgba(59,130,246,0.15)', cursor: 'crosshair', touchAction: 'none',
            display: 'block',
          }}
        >
          {/* Trail */}
          {trail.length > 2 && (
            <polyline points={trail.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth={3} strokeLinecap="round" />
          )}

          {/* Target */}
          {target && (
            <>
              <circle cx={target.x} cy={target.y} r={TARGET_R + 6} fill="none" stroke="#3b82f644" strokeWidth={2} />
              <circle cx={target.x} cy={target.y} r={TARGET_R} fill="rgba(59,130,246,0.18)" stroke="#3b82f6" strokeWidth={2.5} />
              <circle cx={target.x} cy={target.y} r={8} fill="#3b82f644" />
              <text x={target.x} y={target.y + 5} textAnchor="middle" fill="#3b82f6" fontSize={14} fontFamily="Orbitron">⊕</text>
            </>
          )}

          {/* Aim line */}
          {aimLine && (
            <line x1={aimLine.x1} y1={aimLine.y1} x2={aimLine.x2} y2={aimLine.y2}
              stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeDasharray="6,4" />
          )}

          {/* Ball */}
          <circle cx={ballPos.x} cy={ballPos.y} r={BALL_R} fill="#60a5fa" filter="url(#glow)" />
          <defs>
            <filter id="glow"><feGaussianBlur in="SourceGraphic" stdDeviation={3} result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          <text x={W / 2} y={H - 10} textAnchor="middle" fill="rgba(148,163,184,0.2)" fontSize={10} fontFamily="Orbitron" letterSpacing="3">SWIPE TO AIM</text>
        </svg>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div key={feedback.id} initial={{ opacity: 1, scale: 0.8 }} animate={{ opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            style={{ textAlign: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: feedback.color, textShadow: `0 0 14px ${feedback.color}` }}>
            {feedback.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
