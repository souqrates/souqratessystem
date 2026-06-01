import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { getFrameInterval, applyShadow, clearShadow, scaleParticles } from '../../../lib/canvasQuality';
import { playTone, playNoise } from '../../../lib/audioPool';
import { ArrowUp } from 'lucide-react';

const RULES = 'ASTEROID FIELD — Pilot your ship through the asteroid belt! Rotate and shoot to destroy asteroids. Large=10, Medium=15, Small=30 pts. Asteroids split when shot! 3 lives — score as high as possible in 90 seconds. The universe is watching!';

const DEFAULT_GAME_TIME = 90;
const W = 340;
const H = 400;

function playShot() {
  playTone({ type: 'sawtooth', freq: 880, freqEnd: 220, gain: 0.18, duration: 0.12 });
}

function playExplosion(size) {
  const gain = size === 'large' ? 0.25 : size === 'medium' ? 0.18 : 0.12;
  playNoise({ gain, duration: 0.3 });
}

function playThrust() {
  playTone({ type: 'sawtooth', freq: 80 + Math.random() * 40, gain: 0.06, duration: 0.08 });
}

let asteroidId = 0;
let bulletId = 0;

function makeAsteroid(size, x, y, vx, vy) {
  const radii = { large: 38, medium: 22, small: 11 };
  const r = radii[size];
  const pts = size === 'large' ? 10 : size === 'medium' ? 15 : 30;
  const speed = size === 'large' ? 0.6 : size === 'medium' ? 1.0 : 1.6;
  const angle = Math.random() * Math.PI * 2;
  const vxFinal = vx !== undefined ? vx : Math.cos(angle) * speed;
  const vyFinal = vy !== undefined ? vy : Math.sin(angle) * speed;
  const vertices = Array.from({ length: 10 + Math.floor(Math.random() * 5) }, (_, i) => {
    const a = (i / (10 + Math.floor(Math.random() * 5))) * Math.PI * 2;
    const rv = r * (0.7 + Math.random() * 0.45);
    return { a, rv };
  });
  return {
    id: asteroidId++, size, x, y, vx: vxFinal, vy: vyFinal,
    r, pts, rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04, vertices,
  };
}

function spawnAsteroidsInitial() {
  const asteroids = [];
  for (let i = 0; i < 4; i++) {
    let x, y;
    if (Math.random() < 0.5) {
      x = Math.random() < 0.5 ? -50 : W + 50;
      y = Math.random() * H;
    } else {
      x = Math.random() * W;
      y = Math.random() < 0.5 ? -50 : H + 50;
    }
    asteroids.push(makeAsteroid('large', x, y));
  }
  return asteroids;
}

export default function AsteroidField({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const canvasRef = useRef();
  const stateRef = useRef(null);
  const rafRef = useRef();
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiTimeLeft, setUiTimeLeft] = useState(GAME_TIME);
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef();
  const timeRef = useRef(GAME_TIME);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const thrustIntervalRef = useRef();
  const isThrustingRef = useRef(false);
  const phaseTimeRef = useRef(null);

  const initState = () => ({
    ship: {
      x: W / 2, y: H / 2,
      angle: -Math.PI / 2,
      vx: 0, vy: 0,
      invincible: 0,
      trail: [],
    },
    bullets: [],
    asteroids: spawnAsteroidsInitial(),
    particles: [],
    lives: 3,
    score: 0,
    frame: 0,
    spawnTimer: 0,
    alive: true,
  });

  const spawnParticles = (st, x, y, count, color) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 1;
      st.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        alpha: 1, size: Math.random() * 3 + 1, color,
      });
    }
  };

  const shoot = useCallback(() => {
    const st = stateRef.current;
    if (!st || !st.alive || gameOverRef.current) return;
    const ship = st.ship;
    st.bullets.push({
      id: bulletId++,
      x: ship.x + Math.cos(ship.angle) * 16,
      y: ship.y + Math.sin(ship.angle) * 16,
      vx: Math.cos(ship.angle) * 8 + ship.vx * 0.5,
      vy: Math.sin(ship.angle) * 8 + ship.vy * 0.5,
      life: 55,
    });
    playShot();
  }, []);

  const rotateLeft = useCallback(() => {
    const st = stateRef.current;
    if (!st) return;
    st.ship.angle -= 0.18;
  }, []);

  const rotateRight = useCallback(() => {
    const st = stateRef.current;
    if (!st) return;
    st.ship.angle += 0.18;
  }, []);

  const thrust = useCallback(() => {
    const st = stateRef.current;
    if (!st || !st.alive || gameOverRef.current) return;
    st.ship.vx += Math.cos(st.ship.angle) * 0.32;
    st.ship.vy += Math.sin(st.ship.angle) * 0.32;
    const spd = Math.sqrt(st.ship.vx ** 2 + st.ship.vy ** 2);
    const maxSpd = 5.5;
    if (spd > maxSpd) {
      st.ship.vx = (st.ship.vx / spd) * maxSpd;
      st.ship.vy = (st.ship.vy / spd) * maxSpd;
    }
    // Exhaust particles
    const a = st.ship.angle + Math.PI;
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 2;
      st.particles.push({
        x: st.ship.x + Math.cos(a + spread) * 14,
        y: st.ship.y + Math.sin(a + spread) * 14,
        vx: Math.cos(a + spread) * speed,
        vy: Math.sin(a + spread) * speed,
        alpha: 0.8, size: 2 + Math.random() * 2, color: '#f97316',
      });
    }
    playThrust();
  }, []);

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
      rafRef.current = requestAnimationFrame(draw);
      if (!st.alive) return;

      // Continuous thrust
      if (isThrustingRef.current) thrust();

      // Update ship
      const ship = st.ship;
      ship.x = ((ship.x + ship.vx) + W) % W;
      ship.y = ((ship.y + ship.vy) + H) % H;
      ship.vx *= 0.985;
      ship.vy *= 0.985;
      if (ship.invincible > 0) ship.invincible--;
      ship.trail.push({ x: ship.x, y: ship.y });
      if (ship.trail.length > 14) ship.trail.shift();

      // Update bullets
      st.bullets = st.bullets.filter(b => b.life > 0);
      st.bullets.forEach(b => {
        b.x = ((b.x + b.vx) + W) % W;
        b.y = ((b.y + b.vy) + H) % H;
        b.life--;
      });

      // Spawn more asteroids if needed
      st.spawnTimer++;
      if (st.spawnTimer > 180 && st.asteroids.length < 8) {
        st.spawnTimer = 0;
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = -50; y = Math.random() * H; }
        else if (side === 1) { x = W + 50; y = Math.random() * H; }
        else if (side === 2) { x = Math.random() * W; y = -50; }
        else { x = Math.random() * W; y = H + 50; }
        st.asteroids.push(makeAsteroid('large', x, y));
      }

      // Update asteroids
      st.asteroids.forEach(a => {
        a.x = ((a.x + a.vx) + W) % W;
        a.y = ((a.y + a.vy) + H) % H;
        a.rot += a.rotSpeed;
      });

      // Bullet–asteroid collisions
      const bulletsToRemove = new Set();
      const asteroidsToRemove = new Set();
      const newAsteroids = [];

      for (const b of st.bullets) {
        for (const a of st.asteroids) {
          if (asteroidsToRemove.has(a.id)) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          if (dx * dx + dy * dy < a.r * a.r) {
            bulletsToRemove.add(b.id);
            asteroidsToRemove.add(a.id);
            scoreRef.current += a.pts;
            setUiScore(scoreRef.current);
            if (onScoreUpdate) onScoreUpdate(scoreRef.current);
            playExplosion(a.size);
            spawnParticles(st, a.x, a.y,
              a.size === 'large' ? 20 : a.size === 'medium' ? 14 : 8,
              a.size === 'large' ? '#f97316' : a.size === 'medium' ? '#f59e0b' : '#ffd700');
            const fb = `+${a.pts}`;
            setFeedback({ text: fb, x: a.x, y: a.y, id: Date.now() });
            setTimeout(() => setFeedback(null), 600);
            triggerHaptic('light');
            if (a.size === 'large') {
              for (let i = 0; i < 2; i++) {
                const ang = Math.random() * Math.PI * 2;
                const sp = 1.2 + Math.random() * 0.6;
                newAsteroids.push(makeAsteroid('medium', a.x + Math.cos(ang) * 15, a.y + Math.sin(ang) * 15, Math.cos(ang) * sp, Math.sin(ang) * sp));
              }
            } else if (a.size === 'medium') {
              for (let i = 0; i < 2; i++) {
                const ang = Math.random() * Math.PI * 2;
                const sp = 1.8 + Math.random() * 0.8;
                newAsteroids.push(makeAsteroid('small', a.x + Math.cos(ang) * 8, a.y + Math.sin(ang) * 8, Math.cos(ang) * sp, Math.sin(ang) * sp));
              }
            }
          }
        }
      }
      st.bullets = st.bullets.filter(b => !bulletsToRemove.has(b.id));
      st.asteroids = st.asteroids.filter(a => !asteroidsToRemove.has(a.id));
      st.asteroids.push(...newAsteroids);

      // Ship–asteroid collision
      if (ship.invincible <= 0) {
        for (const a of st.asteroids) {
          const dx = ship.x - a.x, dy = ship.y - a.y;
          if (dx * dx + dy * dy < (a.r + 10) ** 2) {
            st.lives--;
            setUiLives(st.lives);
            triggerHaptic('error');
            spawnParticles(st, ship.x, ship.y, 24, '#00d4ff');
            ship.x = W / 2; ship.y = H / 2;
            ship.vx = 0; ship.vy = 0;
            ship.invincible = 150;
            ship.trail = [];
            if (st.lives <= 0) {
              // No early end — keep score, let timer finish
              st.lives = 3;
              setUiLives(3);
              scoreRef.current = Math.max(0, scoreRef.current - 50);
              setUiScore(scoreRef.current);
              if (onScoreUpdate) onScoreUpdate(scoreRef.current);
            }
            break;
          }
        }
      }

      // Particles
      st.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.alpha -= 0.028; p.size *= 0.96; });
      st.particles = st.particles.filter(p => p.alpha > 0.01);

      // ── DRAW ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
      bg.addColorStop(0, '#060818'); bg.addColorStop(1, '#020408');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 41) % W);
        const sy = ((i * 97 + 13) % H);
        const r = i % 5 === 0 ? 1.2 : 0.6;
        ctx.globalAlpha = 0.3 + (Math.sin(st.frame * 0.03 + i) * 0.2);
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Asteroids
      for (const a of st.asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        const col = a.size === 'large' ? '#94a3b8' : a.size === 'medium' ? '#cbd5e1' : '#e2e8f0';
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = a.size === 'large' ? 12 : a.size === 'medium' ? 8 : 5;
        ctx.lineWidth = a.size === 'large' ? 2 : 1.5;
        ctx.beginPath();
        a.vertices.forEach((v, i) => {
          const px = Math.cos(v.a) * v.rv;
          const py = Math.sin(v.a) * v.rv;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath(); ctx.stroke();
        // Inner glow
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
      }

      // Bullets
      for (const b of st.bullets) {
        ctx.save();
        ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 12;
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2;
        ctx.globalAlpha = b.life / 55;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Ship trail
      for (let i = 0; i < ship.trail.length; i++) {
        const t = ship.trail[i];
        const alpha = (i / ship.trail.length) * 0.3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00d4ff';
        ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(t.x, t.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Ship
      if (!(ship.invincible > 0 && Math.floor(ship.invincible / 8) % 2 === 0)) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle + Math.PI / 2);
        ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 20;
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(-9, 10);
        ctx.lineTo(0, 6);
        ctx.lineTo(9, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#00d4ff';
        ctx.fill();
        // Cockpit
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#7dd3fc';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particles
      for (const p of st.particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      st.frame++;
    };
    rafRef.current = requestAnimationFrame(draw);
  }, [thrust, onScoreUpdate]);

  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
      if (thrustIntervalRef.current) clearInterval(thrustIntervalRef.current);
      return;
    }
    gameOverRef.current = false;
    scoreRef.current = 0;
    timeRef.current = GAME_TIME;
    isThrustingRef.current = false;
    stateRef.current = initState();
    setUiScore(0); setUiLives(3); setUiTimeLeft(GAME_TIME); setFeedback(null);
    startDraw();

    let t = GAME_TIME;
    timerRef.current = setInterval(() => {
      t--;
      setUiTimeLeft(t);
      timeRef.current = t;
      if (t <= 0) {
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        gameOverRef.current = true;
        if (onScoreUpdate) onScoreUpdate(scoreRef.current);
        triggerHaptic('medium');
        clearTimeout(phaseTimeRef.current);
        phaseTimeRef.current = setTimeout(() => setPhase('won'), 400);
      }
    }, 1000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
      if (thrustIntervalRef.current) clearInterval(thrustIntervalRef.current);
      clearTimeout(phaseTimeRef.current);
    };
  }, [phase]);

  if (phase === 'rules') return (
    <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>
  );

  const tp = uiTimeLeft / GAME_TIME;
  const tc = tp > 0.33 ? '#10b981' : tp > 0.17 ? '#f59e0b' : '#ef4444';

  const startThrust = () => {
    isThrustingRef.current = true;
  };
  const stopThrust = () => {
    isThrustingRef.current = false;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, userSelect: 'none' }}>
      {/* HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HudCard label="Score" value={uiScore} color="#00d4ff" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <motion.p
            animate={uiTimeLeft <= 15 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: tc, margin: 0 }}>
            {uiTimeLeft}
          </motion.p>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 8, color: 'rgba(239,68,68,0.5)', margin: 0, textTransform: 'uppercase' }}>Lives</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: '#ef4444', margin: 0 }}>
            {'♥'.repeat(Math.max(0, uiLives))}
          </p>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${tp * 100}%` }}
          transition={{ duration: 0.9 }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${tc}, ${tc}88)`, borderRadius: 99 }} />
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.12)' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -40, scale: 1.3 }}
              transition={{ duration: 0.6 }}
              style={{
                position: 'absolute',
                left: `${(feedback.x / W) * 100}%`,
                top: `${(feedback.y / H) * 100}%`,
                transform: 'translate(-50%,-50%)',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 900,
                fontSize: 16,
                color: '#ffd700',
                textShadow: '0 0 12px rgba(255,215,0,0.9)',
                pointerEvents: 'none',
                zIndex: 10,
              }}>
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend overlay */}
        <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[['L', '10'], ['M', '15'], ['S', '30']].map(([s, p]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.5)', fontFamily: 'Orbitron, sans-serif' }}>{s}</span>
              <span style={{ fontSize: 8, color: 'rgba(255,215,0,0.5)', fontFamily: 'Orbitron, sans-serif' }}>+{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        {/* Rotate Left */}
        <motion.button
          onPointerDown={() => { clearInterval(thrustIntervalRef.current); thrustIntervalRef.current = setInterval(rotateLeft, 50); }}
          onPointerUp={() => clearInterval(thrustIntervalRef.current)}
          onPointerLeave={() => clearInterval(thrustIntervalRef.current)}
          whileTap={{ scale: 0.88 }}
          style={ctrlBtnStyle('#a855f7')}>
          <span style={{ fontSize: 20 }}>↺</span>
          <span style={{ fontSize: 9, color: 'rgba(168,85,247,0.7)' }}>ROTATE</span>
        </motion.button>

        {/* Thrust */}
        <motion.button
          onPointerDown={startThrust}
          onPointerUp={stopThrust}
          onPointerLeave={stopThrust}
          whileTap={{ scale: 0.88 }}
          style={ctrlBtnStyle('#10b981')}>
          <ArrowUp size={20} />
          <span style={{ fontSize: 9, color: 'rgba(16,185,129,0.7)' }}>THRUST</span>
        </motion.button>

        {/* Shoot */}
        <motion.button
          onPointerDown={() => {
            shoot();
            clearInterval(thrustIntervalRef.current);
            thrustIntervalRef.current = setInterval(shoot, 250);
          }}
          onPointerUp={() => clearInterval(thrustIntervalRef.current)}
          onPointerLeave={() => clearInterval(thrustIntervalRef.current)}
          whileTap={{ scale: 0.88 }}
          style={ctrlBtnStyle('#f43f5e')}>
          <span style={{ fontSize: 20 }}>★</span>
          <span style={{ fontSize: 9, color: 'rgba(244,63,94,0.7)' }}>FIRE</span>
        </motion.button>

        {/* Rotate Right */}
        <motion.button
          onPointerDown={() => { clearInterval(thrustIntervalRef.current); thrustIntervalRef.current = setInterval(rotateRight, 50); }}
          onPointerUp={() => clearInterval(thrustIntervalRef.current)}
          onPointerLeave={() => clearInterval(thrustIntervalRef.current)}
          whileTap={{ scale: 0.88 }}
          style={ctrlBtnStyle('#a855f7')}>
          <span style={{ fontSize: 20 }}>↻</span>
          <span style={{ fontSize: 9, color: 'rgba(168,85,247,0.7)' }}>ROTATE</span>
        </motion.button>
      </div>

      <motion.p
        style={{ textAlign: 'center', fontSize: 9, color: 'rgba(148,163,184,0.3)', letterSpacing: '0.08em', margin: 0 }}
        animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }}>
        HOLD THRUST • TAP FIRE • ROTATE TO AIM
      </motion.p>
    </div>
  );
}

function ctrlBtnStyle(color) {
  return {
    padding: '12px 0',
    borderRadius: 14,
    cursor: 'pointer',
    background: `${color}0a`,
    border: `1px solid ${color}30`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };
}

function HudCard({ label, value, color }) {
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 12, padding: '8px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}66`, margin: 0, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</p>
      <motion.p
        key={String(value)}
        initial={{ scale: 1.25, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color, margin: 0, lineHeight: 1.1 }}>
        {value}
      </motion.p>
    </div>
  );
}
