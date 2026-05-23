import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep } from './_gameKit';
import ResultOverlay from './ResultOverlay';
import { loadGameConfig } from '../../../lib/gameConfig';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'ORBIT SLINGSHOT — Drag the probe, release to fire. Planets bend your path with gravity. Collect golden stardust. 5 shots. Score 500+ to win.';

const W = 360, H = 480;
const G = 1200;

export default function OrbitSlingshot({ phase, setPhase, game, onScoreUpdate }) {
  const canvasRef = useRef(null);
  const [shotsLeft, setShotsLeft] = useState(5);
  const [score, setScore] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const stateRef = useRef({
    probe: { x: 30, y: H - 40, vx: 0, vy: 0, flying: false },
    drag: null,
    planets: [],
    stars: [],
    shots: 5,
    score: 0,
    target: 500,
  });

  const reset = useCallback(() => {
    const planets = [
      { x: 130, y: 200, r: 22, m: 1.6 },
      { x: 220, y: 320, r: 28, m: 2.2 },
      { x: 280, y: 140, r: 18, m: 1.2 },
      { x: 90, y: 360, r: 20, m: 1.4 },
      { x: 200, y: 80,  r: 16, m: 1.0 },
    ];
    const stars = [];
    for (let i = 0; i < 12; i++) {
      stars.push({ x: 50 + Math.random() * 280, y: 50 + Math.random() * 400, collected: false });
    }
    stateRef.current.planets = planets;
    stateRef.current.stars = stars;
    stateRef.current.probe = { x: 30, y: H - 40, vx: 0, vy: 0, flying: false };
  }, []);

  const endGame = useCallback(() => {
    const s = stateRef.current.score;
    const won = s >= stateRef.current.target;
    setEarnings(won ? Number(game?.prize || 0) : 0);
    if (onScoreUpdate) onScoreUpdate(s);
    triggerHaptic('heavy');
    setTimeout(() => setPhase(won ? 'won' : 'lost'), 400);
  }, [setPhase, onScoreUpdate, game]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let mounted = true;
    loadGameConfig(117).then(cfg => {
      if (!mounted) return;
      stateRef.current.target = cfg.target_score ?? 500;
      stateRef.current.shots  = cfg.params?.shot_count ?? 5;
      setShotsLeft(stateRef.current.shots);
    });
    reset();
    setShotsLeft(5); setScore(0);
    stateRef.current.score = 0;
    stateRef.current.shots = 5;

    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    let raf;
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const draw = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(draw); return; }
      _skzLastT = now;
      ctx.fillStyle = '#02041a';
      ctx.fillRect(0, 0, W, H);
      // Stars background
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 73) % W, sy = (i * 137) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }
      // Stardust
      const t = Date.now() / 400;
      stateRef.current.stars.forEach(s => {
        if (s.collected) return;
        const pulse = 1 + Math.sin(t + s.x) * 0.3;
        ctx.fillStyle = '#ffd86b';
        ctx.shadowBlur = 12; ctx.shadowColor = '#ffd86b';
        ctx.beginPath(); ctx.arc(s.x, s.y, 3 * pulse, 0, Math.PI * 2); ctx.fill();
      });
      ctx.shadowBlur = 0;
      // Planets
      stateRef.current.planets.forEach(p => {
        const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.2, p.x, p.y, p.r);
        g.addColorStop(0, '#5eead4'); g.addColorStop(1, '#0f766e');
        ctx.fillStyle = g;
        ctx.shadowBlur = 18; ctx.shadowColor = '#5eead4';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        // Orbit ring
        ctx.strokeStyle = 'rgba(94,234,212,0.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 14, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.shadowBlur = 0;
      // Probe
      const pr = stateRef.current.probe;
      ctx.fillStyle = '#fff'; ctx.shadowBlur = 14; ctx.shadowColor = '#00d4ff';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Drag aim line
      if (stateRef.current.drag && !pr.flying) {
        const d = stateRef.current.drag;
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(d.x, d.y); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Update physics
      if (pr.flying) {
        let ax = 0, ay = 0;
        stateRef.current.planets.forEach(p => {
          const dx = p.x - pr.x, dy = p.y - pr.y;
          const r2 = dx * dx + dy * dy;
          const r = Math.sqrt(r2);
          if (r < p.r + 6) {
            // crash
            pr.flying = false;
            beep({ freq: 120, dur: 0.25, type: 'sawtooth', sweepTo: 40 });
            triggerHaptic('heavy');
            stateRef.current.shots -= 1;
            setShotsLeft(stateRef.current.shots);
            stateRef.current.probe = { x: 30, y: H - 40, vx: 0, vy: 0, flying: false };
            if (stateRef.current.shots <= 0) endGame();
            return;
          }
          const f = (G * p.m) / r2;
          ax += (dx / r) * f;
          ay += (dy / r) * f;
        });
        const dt = 1 / 60;
        pr.vx += ax * dt; pr.vy += ay * dt;
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        // Collect stars
        stateRef.current.stars.forEach(s => {
          if (s.collected) return;
          const dx = s.x - pr.x, dy = s.y - pr.y;
          if (dx * dx + dy * dy < 144) {
            s.collected = true;
            stateRef.current.score += 100;
            setScore(stateRef.current.score);
            if (onScoreUpdate) onScoreUpdate(stateRef.current.score);
            beep({ freq: 880, dur: 0.1, type: 'triangle' });
            triggerHaptic('light');
          }
        });
        // Off-screen
        if (pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) {
          pr.flying = false;
          stateRef.current.shots -= 1;
          setShotsLeft(stateRef.current.shots);
          stateRef.current.probe = { x: 30, y: H - 40, vx: 0, vy: 0, flying: false };
          if (stateRef.current.shots <= 0 || stateRef.current.stars.every(s => s.collected)) endGame();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onDown = (e) => {
      if (stateRef.current.probe.flying) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
      const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
      const sx = x * (W / rect.width), sy = y * (H / rect.height);
      stateRef.current.drag = { x: sx, y: sy };
    };
    const onMove = (e) => {
      if (!stateRef.current.drag) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
      const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
      stateRef.current.drag = { x: x * (W / rect.width), y: y * (H / rect.height) };
    };
    const onUp = () => {
      if (!stateRef.current.drag) return;
      const pr = stateRef.current.probe;
      const dx = stateRef.current.drag.x - pr.x;
      const dy = stateRef.current.drag.y - pr.y;
      pr.vx = dx * 2.5; pr.vy = dy * 2.5;
      pr.flying = true;
      stateRef.current.drag = null;
      beep({ freq: 600, dur: 0.1, type: 'triangle' });
      triggerHaptic('medium');
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [phase, reset, endGame, onScoreUpdate]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={earnings} setPhase={setPhase} />;

  return (
    <div style={{ position: 'relative', minHeight: 480, padding: 6, borderRadius: 18, overflow: 'hidden',
      background: 'radial-gradient(ellipse at top, #0a0530 0%, #02010a 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="STARDUST" val={score} color="#ffd86b" />
        <Tile label="SHOTS" val={shotsLeft} color="#00d4ff" />
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 14, border: '1px solid #00d4ff33', touchAction: 'none', background: '#02041a' }} />
    </div>
  );
}

function Tile({ label, val, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
      borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${color}55` }}>{val}</p>
    </div>
  );
}
