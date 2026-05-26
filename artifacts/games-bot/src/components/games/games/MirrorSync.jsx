import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord } from './_gameKit';
import { Hud, HudRow, Rules, TimeBar, TargetBar } from './_shell';

const RULES = 'MIRROR SYNC — Two targets appear on LEFT and RIGHT halves simultaneously. Tap BOTH within 250ms using two fingers. Solo tap = miss. Sync window shrinks as you progress. 70 seconds.';
const T = 70;

export default function MirrorSync({ phase, setPhase, game, onScoreUpdate }) {
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(T);
  const [combo, setCombo] = useState(0);
  const [targets, setTargets] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const stateRef = useRef({ score: 0, combo: 0, window: 250, leftHit: 0, rightHit: 0, spawnAt: 0 });
  const runningRef = useRef(false);
  const timersRef = useRef(new Set());
  const target = game?.targetScore || 1200;

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
    s.score = 0; s.combo = 0; s.window = 250; s.leftHit = 0; s.rightHit = 0;
    setScore(0); setCombo(0); setTime(T); setTargets(null); setFeedback(null);
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
      const ly = 15 + Math.random() * 70;
      const ry = 15 + Math.random() * 70;
      s.leftHit = 0; s.rightHit = 0;
      s.spawnAt = performance.now();
      setTargets({ ly, ry, id: Date.now() });
      schedule(() => {
        if (s.leftHit && s.rightHit) {
          const dt = Math.abs(s.leftHit - s.rightHit);
          if (dt <= s.window) {
            s.combo += 1;
            const precision = 1 - dt / s.window;
            const pts = 80 + Math.floor(precision * 70) + s.combo * 6;
            s.score += pts; setScore(s.score); setCombo(s.combo); onScoreUpdate?.(s.score);
            s.window = Math.max(120, s.window - 6);
            chord([700, 1050], 0.06, 0.14, 'triangle'); triggerHaptic('medium');
            setFeedback({ ok: true, pts }); schedule(() => setFeedback(null), 350);
          } else {
            s.combo = 0; setCombo(0); s.score = Math.max(0, s.score - 100); setScore(s.score); onScoreUpdate?.(s.score);
            beep({ freq: 180, dur: 0.15, type: 'sawtooth' }); triggerHaptic('error');
            setFeedback({ ok: false, pts: -100 }); schedule(() => setFeedback(null), 350);
          }
        } else {
          s.combo = 0; setCombo(0); s.score = Math.max(0, s.score - 80); setScore(s.score); onScoreUpdate?.(s.score);
          beep({ freq: 130, dur: 0.18, type: 'sawtooth' }); triggerHaptic('error');
          setFeedback({ ok: false, pts: -80 }); schedule(() => setFeedback(null), 350);
        }
        setTargets(null);
        schedule(spawn, 400 + Math.random() * 350);
      }, 950);
    };
    schedule(spawn, 600);
    return () => {
      runningRef.current = false;
      clearInterval(iv);
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, [phase, setPhase, onScoreUpdate, target]);

  const hit = (side) => {
    if (!runningRef.current || !targets) return;
    const s = stateRef.current;
    const now = performance.now();
    if (side === 'L' && !s.leftHit) s.leftHit = now;
    if (side === 'R' && !s.rightHit) s.rightHit = now;
    beep({ freq: side === 'L' ? 500 : 700, dur: 0.04, vol: 0.1 });
  };

  if (phase === 'rules') return <Rules text={RULES} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5a0" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="COMBO" v={`x${combo}`} c="#ffcc00" />
      </HudRow>
      <TargetBar score={score} target={target} label="SYNC TARGET" />
      <TimeBar totalTime={T} timeLeft={time} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, height: 380, background: '#03020a', borderRadius: 14, border: '1px solid rgba(0,245,160,0.2)', overflow: 'hidden' }}>
        <div onPointerDown={() => hit('L')} style={{ position: 'relative', borderRight: '1px dashed rgba(255,255,255,0.08)', touchAction: 'none' }}>
          {targets && <div style={{ position: 'absolute', left: '50%', top: `${targets.ly}%`, transform: 'translate(-50%,-50%)', width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle,#00f5a0,#007a4f)', boxShadow: '0 0 24px #00f5a0', animation: 'pulse 0.6s ease-out infinite alternate' }} />}
          <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, letterSpacing: '0.3em', color: 'rgba(0,245,160,0.4)' }}>LEFT</p>
        </div>
        <div onPointerDown={() => hit('R')} style={{ position: 'relative', touchAction: 'none' }}>
          {targets && <div style={{ position: 'absolute', left: '50%', top: `${targets.ry}%`, transform: 'translate(-50%,-50%)', width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle,#ffcc00,#7a5f00)', boxShadow: '0 0 24px #ffcc00', animation: 'pulse 0.6s ease-out infinite alternate' }} />}
          <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,204,0,0.4)' }}>RIGHT</p>
        </div>
        {feedback && <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 32, fontWeight: 900, color: feedback.ok ? '#00f5a0' : '#ff3355', textShadow: `0 0 18px ${feedback.ok ? '#00f5a0' : '#ff3355'}`, pointerEvents: 'none', fontFamily: 'Orbitron, sans-serif' }}>{feedback.pts > 0 ? '+' : ''}{feedback.pts}</div>}
        <style>{`@keyframes pulse{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.12)}}`}</style>
      </div>
    </div>
  );
}
