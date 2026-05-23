import { motion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import ResultOverlay from './ResultOverlay';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'Keep the glowing orb balanced on the moving platform! Tap anywhere to nudge the platform toward the ball. Survive 20 seconds to win!';
const DEFAULT_DURATION = 20;
const W = 390;
const H = 280;
const PLAT_W_PX = 90;
const PLAT_H    = 10;
const PLAT_Y    = H - 44;
const BALL_R    = 14;
const BALL_Y_START = PLAT_Y - BALL_R - PLAT_H;

export default function AeroBalance({ phase, setPhase, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const canvasRef    = useRef();
  const stateRef     = useRef(null);
  const rafRef       = useRef();
  const timerRef     = useRef();
  const phaseTimeRef = useRef(null);

  const [uiTime,    setUiTime]    = useState(DURATION);
  const [earnings,  setEarnings]  = useState(0);
  const [xpEarned,  setXpEarned]  = useState(0);

  const initState = () => ({
    ballX:  W / 2,
    ballVX: (Math.random() > 0.5 ? 1 : -1) * 0.8,
    platX:  W / 2 - PLAT_W_PX / 2,
    wind:   (Math.random() - 0.5) * 1.2,
    windTimer: 0,
    particles: [],
    trailBall: [],
    alive: true,
    timeLeft: DURATION,
    frame: 0,
  });

  // ── Canvas draw loop ────────────────────────────────────────────────────────
  const startDraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const draw = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(draw); return; }
      _skzLastT = now;
      const st = stateRef.current;
      if (!st) return;

      // Wind change every ~3s
      st.windTimer++;
      if (st.windTimer > 180) {
        st.wind      = (Math.random() - 0.5) * 1.6;
        st.windTimer = 0;
      }

      // Ball physics
      if (st.alive) {
        st.ballVX = Math.max(-4.5, Math.min(st.ballVX + st.wind * 0.02, 4.5));
        st.ballX  = Math.max(BALL_R, Math.min(st.ballX + st.ballVX, W - BALL_R));

        // Platform tracking: gentle auto-drift toward ball so game is winnable
        const platCX = st.platX + PLAT_W_PX / 2;
        const drift  = (st.ballX - platCX) * 0.018;
        st.platX = Math.max(0, Math.min(st.platX + drift, W - PLAT_W_PX));

        // On-platform check
        const onPlat = st.ballX > st.platX - 4 && st.ballX < st.platX + PLAT_W_PX + 4;
        if (!onPlat) {
          if (st.ballX <= BALL_R || st.ballX >= W - BALL_R) {
            st.alive = false;
            triggerHaptic('error');
          }
        }
      }

      // Trail
      st.trailBall.push({ x: st.ballX, y: BALL_Y_START, alpha: 0.5 });
      if (st.trailBall.length > 16) st.trailBall.shift();
      st.trailBall.forEach((p, i) => { p.alpha = (i / st.trailBall.length) * 0.45; });

      // Particles — wind wisps
      if (st.alive && st.frame % 8 === 0) {
        st.particles.push({
          x: Math.random() * W, y: 20 + Math.random() * (H - 60),
          vx: st.wind * 1.2 + (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.3,
          alpha: 0.25 + Math.random() * 0.2,
          size: 1 + Math.random() * 2,
          color: st.wind > 0 ? '#38bdf8' : '#f97316',
        });
      }
      st.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.alpha -= 0.007; });
      st.particles = st.particles.filter(p => p.alpha > 0.01 && p.x > -10 && p.x < W + 10);

      // ── DRAW ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#030d1a'); bg.addColorStop(1, '#020810');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Wind arrow indicator
      const windStr = Math.abs(st.wind);
      const windAlpha = 0.12 + windStr * 0.1;
      ctx.save();
      ctx.globalAlpha = windAlpha;
      ctx.fillStyle   = st.wind > 0 ? '#38bdf8' : '#f97316';
      const aw = windStr * 20 + 20;
      const ay = H / 2;
      const dir = st.wind > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(W / 2, ay);
      ctx.lineTo(W / 2 + dir * aw, ay);
      ctx.lineTo(W / 2 + dir * aw - dir * 10, ay - 6);
      ctx.moveTo(W / 2 + dir * aw, ay);
      ctx.lineTo(W / 2 + dir * aw - dir * 10, ay + 6);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = st.wind > 0 ? '#38bdf8' : '#f97316';
      ctx.stroke();
      ctx.restore();

      // Wind particles
      st.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Platform
      const platGrad = ctx.createLinearGradient(st.platX, PLAT_Y, st.platX + PLAT_W_PX, PLAT_Y);
      platGrad.addColorStop(0, '#00d4ff'); platGrad.addColorStop(1, '#0ea5e9');
      ctx.save();
      ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 18;
      ctx.fillStyle   = platGrad;
      ctx.beginPath();
      ctx.roundRect(st.platX, PLAT_Y, PLAT_W_PX, PLAT_H, 5);
      ctx.fill();
      ctx.restore();

      // Ball trail
      st.trailBall.forEach((p, i) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * 0.55 * (i / st.trailBall.length), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Ball
      ctx.save();
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = st.alive ? 28 : 8;
      const bg2 = ctx.createRadialGradient(st.ballX - 4, BALL_Y_START - 4, 0, st.ballX, BALL_Y_START, BALL_R);
      bg2.addColorStop(0, '#fff8b0'); bg2.addColorStop(0.5, '#ffd700'); bg2.addColorStop(1, 'rgba(255,165,0,0.2)');
      ctx.fillStyle = bg2;
      ctx.beginPath(); ctx.arc(st.ballX, BALL_Y_START, BALL_R, 0, Math.PI * 2); ctx.fill();
      // inner shine
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(st.ballX - 5, BALL_Y_START - 5, BALL_R * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Danger zones
      const dangerW = 30;
      const dzAlpha = 0.07 + Math.sin(st.frame * 0.08) * 0.03;
      ctx.fillStyle = `rgba(239,68,68,${dzAlpha})`;
      ctx.fillRect(0, 0, dangerW, H);
      ctx.fillRect(W - dangerW, 0, dangerW, H);

      st.frame++;
      if (!st.alive && st.particles.length === 0) {
        cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
      return;
    }
    stateRef.current = initState();
    setUiTime(DURATION);
    startDraw();

    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--;
      setUiTime(t);
      if (stateRef.current) stateRef.current.timeLeft = t;
      if (t <= 0) {
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        const earn = 25;
        const xp   = 120;
        setEarnings(earn); setXpEarned(xp);
        triggerHaptic('success');
        clearTimeout(phaseTimeRef.current);
        phaseTimeRef.current = setTimeout(() => setPhase('won'), 200);
      }
    }, 1000);

    return () => { cancelAnimationFrame(rafRef.current); clearInterval(timerRef.current); clearTimeout(phaseTimeRef.current); };
  }, [phase, startDraw]);

  // Watch for death
  useEffect(() => {
    if (phase !== 'playing') return;
    const check = setInterval(() => {
      const st = stateRef.current;
      if (st && !st.alive) {
        clearInterval(check);
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => setPhase('lost'), 300);
      }
    }, 100);
    return () => clearInterval(check);
  }, [phase]);

  const handleTap = useCallback((e) => {
    const st = stateRef.current;
    if (!st || !st.alive) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const px     = (e.clientX - rect.left) / rect.width * W;
    const platCX = st.platX + PLAT_W_PX / 2;
    const dir    = px > platCX ? 1 : -1;
    st.platX = Math.max(0, Math.min(st.platX + dir * 28, W - PLAT_W_PX));
    triggerHaptic('light');
  }, []);

  if (phase === 'rules') return (
    <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>
  );

  const timePct  = uiTime / DURATION;
  const timeColor = timePct > 0.5 ? '#10b981' : timePct > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(phase === 'won' || phase === 'lost') && (
        <ResultOverlay won={phase === 'won'} earnings={earnings} xpEarned={xpEarned} setPhase={setPhase} />
      )}

      {/* HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div style={{ background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: 'rgba(255,215,0,0.6)', textTransform: 'uppercase', margin: 0 }}>Prize</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#ffd700', fontFamily: 'Orbitron, sans-serif', margin: 0 }}>25 SKZ</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 900, color: timeColor, fontFamily: 'Orbitron, sans-serif', margin: 0 }}>{uiTime}s</p>
        </div>
        <div style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase', margin: 0 }}>Tap</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,212,255,0.7)', margin: 0 }}>to nudge</p>
        </div>
      </div>

      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div style={{ height: '100%', background: timeColor, borderRadius: 99 }}
          animate={{ width: `${timePct * 100}%` }} transition={{ duration: 0.8 }} />
      </div>

      <div style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
        <canvas
          ref={canvasRef} width={W} height={H}
          style={{ width: '100%', display: 'block', touchAction: 'none' }}
          onClick={handleTap}
          onTouchStart={e => { e.preventDefault(); handleTap(e.touches[0]); }}
        />
      </div>

      <motion.p
        style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.08em' }}
        animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity }}
      >
        TAP LEFT / RIGHT TO PUSH PLATFORM
      </motion.p>
    </div>
  );
}
