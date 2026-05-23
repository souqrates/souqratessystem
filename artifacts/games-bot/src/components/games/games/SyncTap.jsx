import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import ResultOverlay from './ResultOverlay';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';

const RULES = 'Tap glowing targets before they vanish! Beat the AI by scoring more hits in 15 seconds. Bigger targets = more points. Build streaks for bonus multipliers!';
const DEFAULT_DURATION = 15;
const W = 390;
const H = 260;

const AI_CFG = { baseDelay: 480, jitter: 360, missChance: 0.12 };

function makeTarget(id) {
  const size = 28 + Math.random() * 26; // 28–54px radius
  const pts  = size > 46 ? 1 : size > 36 ? 2 : 3;
  return {
    id, pts,
    x: size + Math.random() * (W - size * 2),
    y: size + Math.random() * (H - size * 2),
    r: size,
    born: Date.now(),
    life: 1100 + Math.random() * 400,
  };
}

export default function SyncTap({ phase, setPhase, game}) {
  const DURATION = game?.durationSeconds || DEFAULT_DURATION;
  const canvasRef     = useRef();
  const stateRef      = useRef(null);
  const rafRef        = useRef();
  const timersRef     = useRef([]);

  const [uiPlayer, setUiPlayer] = useState(0);
  const [uiAI,     setUiAI]     = useState(0);
  const [uiTime,   setUiTime]   = useState(DURATION);
  const [uiStreak, setUiStreak] = useState(0);
  const [flash,    setFlash]    = useState(null); // 'hit' | 'miss'
  const [earnings, setEarnings] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  const clearAll = () => {
    timersRef.current.forEach(id => { clearInterval(id); clearTimeout(id); });
    timersRef.current = [];
  };

  const initState = () => ({
    targets: [],
    playerScore: 0,
    aiScore: 0,
    streak: 0,
    earnings: 0,
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
      const now = Date.now();

      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#04030f');
      bg.addColorStop(1, '#0a0518');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 44) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Targets
      st.targets.forEach(tg => {
        const age     = now - tg.born;
        const progress = Math.min(age / tg.life, 1);
        const alpha   = 1 - progress * 0.5;
        const shrink  = 1 - progress * 0.35;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Outer pulse ring
        const ringR = tg.r * shrink * 1.55;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = tg.pts === 3 ? 'rgba(255,215,0,0.5)' : tg.pts === 2 ? 'rgba(0,212,255,0.5)' : 'rgba(16,185,129,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glow
        ctx.shadowColor = tg.pts === 3 ? '#ffd700' : tg.pts === 2 ? '#00d4ff' : '#10b981';
        ctx.shadowBlur = 20;

        // Core
        const gr = ctx.createRadialGradient(tg.x, tg.y, 0, tg.x, tg.y, tg.r * shrink);
        if (tg.pts === 3) {
          gr.addColorStop(0, '#fff8b0'); gr.addColorStop(0.4, '#ffd700'); gr.addColorStop(1, 'rgba(255,165,0,0.1)');
        } else if (tg.pts === 2) {
          gr.addColorStop(0, '#e0f7ff'); gr.addColorStop(0.4, '#00d4ff'); gr.addColorStop(1, 'rgba(0,150,255,0.1)');
        } else {
          gr.addColorStop(0, '#d1fae5'); gr.addColorStop(0.4, '#10b981'); gr.addColorStop(1, 'rgba(5,150,105,0.1)');
        }
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, tg.r * shrink, 0, Math.PI * 2);
        ctx.fill();

        // Points label
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = '#000';
        ctx.font = `900 ${Math.round(tg.r * shrink * 0.62)}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${tg.pts}`, tg.x, tg.y);

        ctx.restore();
      });

      st.frame++;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // ── Game setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      clearAll();
      return;
    }

    stateRef.current = initState();
    setUiPlayer(0); setUiAI(0); setUiTime(DURATION); setUiStreak(0);
    startDraw();

    // Spawn targets
    const spawn = setInterval(() => {
      const st = stateRef.current;
      if (!st) return;
      const tg = makeTarget(`t-${Date.now()}-${Math.random()}`);
      st.targets.push(tg);

      // AI auto-taps with delay
      if (Math.random() > AI_CFG.missChance) {
        const delay = AI_CFG.baseDelay + (Math.random() - 0.5) * AI_CFG.jitter * 2;
        const tid = setTimeout(() => {
          if (!stateRef.current) return;
          const still = stateRef.current.targets.find(t => t.id === tg.id);
          if (still) {
            stateRef.current.targets = stateRef.current.targets.filter(t => t.id !== tg.id);
            stateRef.current.aiScore++;
            setUiAI(stateRef.current.aiScore);
          }
        }, Math.max(100, delay));
        timersRef.current.push(tid);
      }

      // Auto-expire targets
      const exp = setTimeout(() => {
        if (!stateRef.current) return;
        stateRef.current.targets = stateRef.current.targets.filter(t => t.id !== tg.id);
      }, tg.life);
      timersRef.current.push(exp);
    }, 650);
    timersRef.current.push(spawn);

    // Timer
    let t = DURATION;
    const timer = setInterval(() => {
      t--;
      setUiTime(t);
      if (t <= 0) {
        clearAll();
        cancelAnimationFrame(rafRef.current);
        const st = stateRef.current;
        if (!st) return;
        const won    = st.playerScore > st.aiScore;
        const earn   = won ? +(st.earnings).toFixed(2) : 0;
        const xp     = Math.floor(st.playerScore * 12) + (won ? 60 : 0);
        setEarnings(earn);
        setXpEarned(xp);
        setTimeout(() => setPhase(won ? 'won' : 'lost'), 200);
      }
    }, 1000);
    timersRef.current.push(timer);

    return () => { cancelAnimationFrame(rafRef.current); clearAll(); };
  }, [phase, startDraw]);

  const tap = useCallback((e) => {
    if (phase !== 'playing') return;
    const st = stateRef.current;
    if (!st) return;

    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;

    let hit = false;
    for (const tg of [...st.targets].reverse()) {
      const dx = cx - tg.x, dy = cy - tg.y;
      if (dx * dx + dy * dy < tg.r * tg.r * 1.1) {
        st.targets = st.targets.filter(t => t.id !== tg.id);
        st.playerScore++;
        st.streak++;
        const bonus = st.streak >= 5 ? 2 : st.streak >= 3 ? 1.5 : 1;
        st.earnings += tg.pts * bonus;
        setUiPlayer(st.playerScore);
        setUiStreak(st.streak);
        setUiAI(st.aiScore);
        triggerHaptic('light');
        setFlash('hit');
        setTimeout(() => setFlash(null), 140);
        hit = true;
        break;
      }
    }
    if (!hit) {
      st.streak = 0;
      setUiStreak(0);
      setFlash('miss');
      setTimeout(() => setFlash(null), 140);
    }
  }, [phase]);

  if (phase === 'rules') return (
    <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.65 }}>{RULES}</p>
  );

  const timePct = uiTime / DURATION;
  const timerColor = timePct > 0.5 ? '#10b981' : timePct > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(phase === 'won' || phase === 'lost') && (
        <ResultOverlay won={phase === 'won'} earnings={earnings} xpEarned={xpEarned} setPhase={setPhase} />
      )}

      {/* HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div style={{
          background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 12, padding: '8px 0', textAlign: 'center',
        }}>
          <p style={{ fontSize: 9, color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>You</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', margin: 0, lineHeight: 1 }}>{uiPlayer}</p>
          {uiStreak >= 3 && (
            <p style={{ fontSize: 9, color: '#ffd700', margin: 0 }}>x{uiStreak >= 5 ? '2.0' : '1.5'} STREAK</p>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: timerColor, fontFamily: 'Orbitron, sans-serif', margin: 0 }}>{uiTime}s</p>
        </div>
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: '8px 0', textAlign: 'center',
        }}>
          <p style={{ fontSize: 9, color: 'rgba(239,68,68,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>AI</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#ef4444', fontFamily: 'Orbitron, sans-serif', margin: 0, lineHeight: 1 }}>{uiAI}</p>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div style={{ height: '100%', background: timerColor, borderRadius: 99 }}
          animate={{ width: `${timePct * 100}%` }} transition={{ duration: 0.8 }} />
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
        <AnimatePresence>
          {flash && (
            <motion.div
              style={{
                position: 'absolute', inset: 0, zIndex: 5, borderRadius: 14, pointerEvents: 'none',
                background: flash === 'hit' ? 'rgba(0,212,255,0.12)' : 'rgba(239,68,68,0.1)',
              }}
              initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.14 }}
            />
          )}
        </AnimatePresence>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{ width: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
          onClick={tap}
          onTouchStart={e => { e.preventDefault(); tap(e.touches[0]); }}
        />
      </div>
    </div>
  );
}
