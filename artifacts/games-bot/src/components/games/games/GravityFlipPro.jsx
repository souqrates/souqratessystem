import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap to flip gravity and avoid obstacles. Collect stars = +100. Hit obstacle = -150. Obstacle speed increases every 200 pts. Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;

const W = 280;
const H = 260;
const PLAYER_SIZE = 22;
const OBS_W = 22;
const TOP_H = 28;
const BOT_H = 28;

export default function GravityFlipPro({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [playerY, setPlayerY] = useState(H / 2);
  const [obstacles, setObstacles] = useState([]);
  const [gravDown, setGravDown] = useState(true);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const playerYRef = useRef(H / 2);
  const velRef = useRef(0);
  const gravRef = useRef(1);
  const obsRef = useRef([]);
  const nextIdRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSpeed = () => 100 + Math.floor(scoreRef.current / 200) * 18;
  const getInterval = () => Math.max(0.7, 1.3 - Math.floor(scoreRef.current / 200) * 0.05);
  const GRAV = 400;
  const FLIP_VEL = -180;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const flip = useCallback(() => {
    if (!activeRef.current) return;
    gravRef.current *= -1;
    velRef.current = FLIP_VEL * gravRef.current;
    setGravDown(gravRef.current > 0);
    beep({ freq: 400, dur: 0.05, vol: 0.07 });
    triggerHaptic('light');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    playerYRef.current = H / 2; velRef.current = 0; gravRef.current = 1;
    setScore(0); setPlayerY(H / 2); setGravDown(true); setObstacles([]); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    obsRef.current = [];
    nextIdRef.current = 0;
    lastRef.current = performance.now();
    let spawnTimer = 0;

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      const speed = getSpeed();

      // Physics
      velRef.current += gravRef.current * GRAV * dt;
      playerYRef.current += velRef.current * dt;

      // Clamp to walls
      if (playerYRef.current <= TOP_H + PLAYER_SIZE / 2) {
        playerYRef.current = TOP_H + PLAYER_SIZE / 2;
        velRef.current = Math.abs(velRef.current) * 0.3 * (gravRef.current > 0 ? 1 : -1);
      }
      if (playerYRef.current >= H - BOT_H - PLAYER_SIZE / 2) {
        playerYRef.current = H - BOT_H - PLAYER_SIZE / 2;
        velRef.current = -Math.abs(velRef.current) * 0.3 * (gravRef.current > 0 ? 1 : -1);
      }
      setPlayerY(playerYRef.current);

      // Spawn
      spawnTimer += dt;
      if (spawnTimer >= getInterval()) {
        spawnTimer = 0;
        const gapY = TOP_H + 10 + Math.random() * (H - TOP_H - BOT_H - 80);
        const gapH = 60 + Math.random() * 20;
        const isStar = Math.random() > 0.6;
        obsRef.current = [...obsRef.current, { id: nextIdRef.current++, x: W + 10, gapY, gapH, isStar }];
      }

      // Move + collide
      const px = 50;
      const py = playerYRef.current;
      obsRef.current = obsRef.current
        .map(o => ({ ...o, x: o.x - speed * dt }))
        .filter(o => {
          if (o.x < -OBS_W) return false;
          if (o.x < px + PLAYER_SIZE / 2 && o.x + OBS_W > px - PLAYER_SIZE / 2) {
            const inGap = py > o.gapY && py < o.gapY + o.gapH;
            if (inGap && o.isStar) {
              scoreRef.current = Math.max(0, scoreRef.current + 100);
              setScore(scoreRef.current);
              triggerHaptic('light');
              beep({ freq: 600, dur: 0.06, vol: 0.08 });
              setFlash({ type: 'good', id: Date.now() });
              onScoreUpdate?.(scoreRef.current);
              return false;
            } else if (!inGap) {
              scoreRef.current = Math.max(0, scoreRef.current - 150);
              setScore(scoreRef.current);
              triggerHaptic('error');
              noise({ dur: 0.09, vol: 0.09 });
              setFlash({ type: 'bad', id: Date.now() });
              onScoreUpdate?.(scoreRef.current);
              return false;
            } else {
              // Passed gap but not star - small score
              return false;
            }
          }
          return true;
        });

      setObstacles([...obsRef.current]);
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
        <Hud label="SCORE" v={score} c="#8b5cf6" />
        <Hud label="SPEED" v={getSpeed()} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, cursor: 'pointer' }}
        onPointerDown={flip}
      >
        <MomentumFlash msg={flash?.type === 'good' ? '+100!' : 'HIT!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {/* Top and bottom walls */}
          <rect x={0} y={0} width={W} height={TOP_H} fill="rgba(239,68,68,0.15)" />
          <rect x={0} y={H - BOT_H} width={W} height={BOT_H} fill="rgba(239,68,68,0.15)" />

          {/* Obstacles */}
          {obstacles.map(o => (
            <g key={o.id}>
              <rect x={o.x} y={TOP_H} width={OBS_W} height={o.gapY - TOP_H} fill={o.isStar ? 'rgba(139,92,246,0.25)' : 'rgba(239,68,68,0.25)'} stroke={o.isStar ? '#8b5cf6' : '#ef4444'} strokeWidth={1} />
              {o.isStar && <text x={o.x + OBS_W / 2} y={o.gapY + o.gapH / 2 + 5} textAnchor="middle" fontSize={16}>⭐</text>}
              <rect x={o.x} y={o.gapY + o.gapH} width={OBS_W} height={H - BOT_H - o.gapY - o.gapH} fill={o.isStar ? 'rgba(139,92,246,0.25)' : 'rgba(239,68,68,0.25)'} stroke={o.isStar ? '#8b5cf6' : '#ef4444'} strokeWidth={1} />
            </g>
          ))}

          {/* Player */}
          <rect
            x={50 - PLAYER_SIZE / 2} y={playerY - PLAYER_SIZE / 2}
            width={PLAYER_SIZE} height={PLAYER_SIZE}
            rx={4}
            fill={gravDown ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.5)'}
            stroke="#8b5cf6"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 0 6px #8b5cf688)' }}
          />
          <text x={50} y={playerY + 6} textAnchor="middle" fontSize={14}>{gravDown ? '⬇' : '⬆'}</text>
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP TO FLIP GRAVITY</p>
      </div>
    </div>
  );
}
