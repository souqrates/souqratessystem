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

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{
          background: `
            radial-gradient(ellipse at 50% 50%, #1a0a3a 0%, #06031f 60%, #02010a 100%),
            repeating-linear-gradient(90deg, transparent 0, transparent 22px, rgba(139,92,246,0.08) 22px, rgba(139,92,246,0.08) 23px)
          `,
          border: '1px solid rgba(139,92,246,0.35)',
          borderRadius: 12,
          boxShadow: 'inset 0 0 30px rgba(139,92,246,0.18)',
        }}>
          <defs>
            <linearGradient id="gravTopWall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="gravBotWall" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
            <radialGradient id="gravPlayer" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
              <stop offset="100%" stopColor="#5b21b6" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="gravStar" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#a16207" />
            </radialGradient>
            <filter id="gravGlow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Repulsor wall hatching */}
          <rect x={0} y={0} width={W} height={TOP_H} fill="url(#gravTopWall)" />
          <rect x={0} y={H - BOT_H} width={W} height={BOT_H} fill="url(#gravBotWall)" />
          {Array.from({ length: Math.ceil(W / 10) }).map((_, i) => (
            <g key={`hatch-${i}`}>
              <line x1={i * 10} y1={0} x2={i * 10 + TOP_H} y2={TOP_H} stroke="#ef444466" strokeWidth={1} />
              <line x1={i * 10} y1={H} x2={i * 10 + BOT_H} y2={H - BOT_H} stroke="#ef444466" strokeWidth={1} />
            </g>
          ))}
          {/* Hot edges */}
          <line x1={0} y1={TOP_H} x2={W} y2={TOP_H} stroke="#ef4444" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 4px #ef4444)' }} />
          <line x1={0} y1={H - BOT_H} x2={W} y2={H - BOT_H} stroke="#ef4444" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 4px #ef4444)' }} />

          {/* Obstacles — particle gates */}
          {obstacles.map(o => (
            <g key={o.id}>
              <rect x={o.x} y={TOP_H} width={OBS_W} height={o.gapY - TOP_H}
                fill={o.isStar ? 'rgba(139,92,246,0.35)' : 'rgba(244,63,94,0.32)'}
                stroke={o.isStar ? '#a78bfa' : '#f43f5e'} strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 4px ${o.isStar ? '#a78bfa' : '#f43f5e'})` }}
              />
              {o.isStar && <circle cx={o.x + OBS_W / 2} cy={o.gapY + o.gapH / 2} r={9} fill="url(#gravStar)" filter="url(#gravGlow)" />}
              <rect x={o.x} y={o.gapY + o.gapH} width={OBS_W} height={H - BOT_H - o.gapY - o.gapH}
                fill={o.isStar ? 'rgba(139,92,246,0.35)' : 'rgba(244,63,94,0.32)'}
                stroke={o.isStar ? '#a78bfa' : '#f43f5e'} strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 4px ${o.isStar ? '#a78bfa' : '#f43f5e'})` }}
              />
            </g>
          ))}

          {/* Player — magnetic particle */}
          <circle cx={50} cy={playerY} r={PLAYER_SIZE / 2 + 4} fill="none" stroke="#a78bfa" strokeWidth={1} opacity={0.5}>
            <animate attributeName="r" values={`${PLAYER_SIZE / 2 + 2};${PLAYER_SIZE / 2 + 8};${PLAYER_SIZE / 2 + 2}`} dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0.05;0.7" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={50} cy={playerY} r={PLAYER_SIZE / 2} fill="url(#gravPlayer)" filter="url(#gravGlow)" />
          <text x={50} y={playerY + 5} textAnchor="middle" fontSize={14} fill="#fff" style={{ fontWeight: 900 }}>{gravDown ? '⬇' : '⬆'}</text>
        </svg>

        <p style={{ color: 'rgba(167,139,250,0.7)', fontSize: 11, letterSpacing: '0.25em', fontFamily: 'Orbitron, sans-serif' }}>TAP TO REVERSE GRAVITY</p>
      </div>
    </div>
  );
}
