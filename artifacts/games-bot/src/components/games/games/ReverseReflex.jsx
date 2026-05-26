import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'REVERSE REFLEX — Arrows flash on screen. Swipe in the OPPOSITE direction. Your brain says one thing, your finger must do the other. Time window shrinks every 5 correct. 60 seconds.';
const T = 60;
const ARROWS = ['↑', '↓', '←', '→'];
const OPPOSITE = { '↑': 'down', '↓': 'up', '←': 'right', '→': 'left' };

export default function ReverseReflex({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(T);
  const [streak, setStreak] = useState(0);
  const [arrow, setArrow] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const stateRef = useRef({ score: 0, streak: 0, window: 1200, spawnAt: 0, current: null });
  const runningRef = useRef(false);
  const timersRef = useRef(new Set());
  const spawnRef = useRef(() => {});
  const startRef = useRef({ x: 0, y: 0 });
  const target = game?.targetScore || 1500;

  // Controlled scheduler — every timeout is registered so teardown kills it.
  // Returns null if game already stopped (caller is no-op).
  const schedule = (fn, ms) => {
    if (!runningRef.current) return null;
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (runningRef.current) fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current;
    s.score = 0; s.streak = 0; s.window = 1200; s.current = null;
    setScore(0); setStreak(0); setTime(T); setArrow(null); setFeedback(null);
    runningRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();

    const iv = setInterval(() => setTime(t => {
      if (t <= 1) {
        clearInterval(iv);
        runningRef.current = false;
        timersRef.current.forEach(clearTimeout);
        timersRef.current.clear();
        onScoreUpdate?.(s.score);
        setTimeout(() => setPhase(s.score >= target ? 'won' : 'lost'), 250);
        return 0;
      }
      return t - 1;
    }), 1000);

    const spawn = () => {
      if (!runningRef.current) return;
      const a = ARROWS[Math.floor(Math.random() * 4)];
      s.current = a; s.spawnAt = performance.now();
      setArrow(a);
      schedule(() => {
        // window expired without correct swipe
        if (s.current !== a) return;
        s.streak = 0; setStreak(0);
        s.score = Math.max(0, s.score - 100); setScore(s.score); onScoreUpdate?.(s.score);
        beep({ freq: 120, dur: 0.2, type: 'sawtooth' }); triggerHaptic('error');
        setFeedback({ ok: false, pts: -100 });
        schedule(() => setFeedback(null), 280);
        s.current = null; setArrow(null);
        schedule(spawn, 320);
      }, s.window);
    };
    spawnRef.current = spawn;
    schedule(spawn, 600);

    return () => {
      runningRef.current = false;
      clearInterval(iv);
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
      spawnRef.current = () => {};
    };
  }, [phase, setPhase, onScoreUpdate, target]);

  const onStart = (e) => {
    const t = e.touches?.[0] || e;
    startRef.current = { x: t.clientX, y: t.clientY };
  };
  const onEnd = (e) => {
    if (!runningRef.current) return;
    const s = stateRef.current;
    if (!s.current) return;
    const t = e.changedTouches?.[0] || e;
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    if (Math.abs(dx) < 25 && Math.abs(dy) < 25) return;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
    else dir = dy > 0 ? 'down' : 'up';
    const expected = OPPOSITE[s.current];
    if (dir === expected) {
      s.streak += 1;
      const elapsed = performance.now() - s.spawnAt;
      const speed = 1 - elapsed / s.window;
      const pts = 80 + Math.floor(speed * 80) + s.streak * 5;
      s.score += pts; setScore(s.score); setStreak(s.streak); onScoreUpdate?.(s.score);
      if (s.streak % 5 === 0) s.window = Math.max(450, s.window - 100);
      chord([800, 1200, 1600], 0.06, 0.14, 'triangle'); triggerHaptic('medium');
      setFeedback({ ok: true, pts });
      schedule(() => setFeedback(null), 280);
    } else {
      s.streak = 0; setStreak(0);
      s.score = Math.max(0, s.score - 120); setScore(s.score); onScoreUpdate?.(s.score);
      beep({ freq: 140, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
      setFeedback({ ok: false, pts: -120 });
      schedule(() => setFeedback(null), 280);
    }
    s.current = null; setArrow(null);
    schedule(() => { if (runningRef.current) spawnRef.current(); }, 220);
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ff66cc" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="STREAK" v={streak} c="#ffcc00" />
      </HudRow>
      <TargetBar score={score} target={target} label="REVERSE TARGET" />
      <TimeBar totalTime={T} timeLeft={time} />
      <div onPointerDown={onStart} onPointerUp={onEnd} style={{ position: 'relative', height: 380, background: 'radial-gradient(circle,#0a0420 0%,#02010a 100%)', borderRadius: 14, border: '1px solid rgba(255,102,204,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', userSelect: 'none', overflow: 'hidden' }}>
        {arrow ? (
          <div style={{ fontSize: 180, color: '#ff66cc', textShadow: '0 0 32px #ff66cc, 0 0 64px #ff66cc55', fontWeight: 900, lineHeight: 1, animation: 'arrowIn 0.2s ease-out' }}>{arrow}</div>
        ) : (
          <p style={{ color: 'rgba(148,163,184,0.45)', letterSpacing: '0.3em', fontSize: 11 }}>WAIT FOR ARROW…</p>
        )}
        <p style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(255,102,204,0.5)', letterSpacing: '0.25em' }}>SWIPE OPPOSITE</p>
        {feedback && <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontSize: 24, fontWeight: 900, color: feedback.ok ? '#00f5a0' : '#ff3355', textShadow: `0 0 16px ${feedback.ok ? '#00f5a0' : '#ff3355'}`, pointerEvents: 'none', fontFamily: 'Orbitron, sans-serif' }}>{feedback.pts > 0 ? '+' : ''}{feedback.pts}</div>}
        <style>{`@keyframes arrowIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      </div>
    </div>
  );
}
