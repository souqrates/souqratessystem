import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap to jump and wall-jump between platforms. Collect coins = +100. Fall into spikes = -150. Platforms appear faster after 400 pts. Reach 1500 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1500;

const W = 240;
const H = 320;
const PLAYER_W = 20;
const PLAYER_H = 24;
const GRAVITY = 600;
const JUMP_VEL = -260;

export default function WallJump({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [playerPos, setPlayerPos] = useState({ x: 60, y: 200 });
  const [platforms, setPlatforms] = useState([]);
  const [coins, setCoins] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const posRef = useRef({ x: 60, y: 200 });
  const velRef = useRef({ x: 0, y: 0 });
  const onGroundRef = useRef(false);
  const platformsRef = useRef([]);
  const coinsRef = useRef([]);
  const nextIdRef = useRef(0);
  const scrollRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const SCROLL_SPEED = 60 + Math.floor((scoreRef.current || 0) / 200) * 8;

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const jump = useCallback(() => {
    if (!activeRef.current) return;
    if (onGroundRef.current || Math.abs(velRef.current.x) > 10) {
      velRef.current = { x: velRef.current.x, y: JUMP_VEL };
      onGroundRef.current = false;
      beep({ freq: 380, dur: 0.06, vol: 0.08 });
      triggerHaptic('light');
    }
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    posRef.current = { x: 60, y: 200 };
    velRef.current = { x: 40, y: 0 };
    onGroundRef.current = false;
    scrollRef.current = 0;
    nextIdRef.current = 0;
    setScore(0); setPlayerPos({ x: 60, y: 200 }); setTimeLeft(GAME_TIME);
    activeRef.current = true;

    // Initial platforms
    platformsRef.current = [
      { id: 0, x: 20, y: 250, w: 200, h: 12 },
      { id: 1, x: 30, y: 180, w: 80, h: 10 },
      { id: 2, x: 150, y: 140, w: 70, h: 10 },
    ];
    coinsRef.current = [
      { id: 0, x: 70, y: 155, collected: false },
      { id: 1, x: 185, y: 115, collected: false },
    ];
    setPlatforms([...platformsRef.current]);
    setCoins([...coinsRef.current]);
    lastRef.current = performance.now();

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      const scrollSpd = 60 + Math.floor(scoreRef.current / 200) * 8;

      // Scroll platforms left
      platformsRef.current = platformsRef.current.map(p => ({ ...p, x: p.x - scrollSpd * dt }));
      coinsRef.current = coinsRef.current.map(c => ({ ...c, x: c.x - scrollSpd * dt }));

      // Remove off-screen, spawn new
      platformsRef.current = platformsRef.current.filter(p => p.x + p.w > -20);
      coinsRef.current = coinsRef.current.filter(c => c.x > -20);

      const rightMost = platformsRef.current.reduce((m, p) => Math.max(m, p.x + p.w), 0);
      while (rightMost < W + 100) {
        const newX = rightMost + 20 + Math.random() * 40;
        const newY = 100 + Math.random() * 160;
        const newW = 50 + Math.random() * 60;
        platformsRef.current.push({ id: nextIdRef.current++, x: newX, y: newY, w: newW, h: 10 });
        if (Math.random() > 0.4) {
          coinsRef.current.push({ id: nextIdRef.current++, x: newX + newW / 2, y: newY - 22, collected: false });
        }
      }

      // Physics
      velRef.current.y += GRAVITY * dt;
      posRef.current.x += velRef.current.x * dt;
      posRef.current.y += velRef.current.y * dt;

      // Wall bounce
      if (posRef.current.x < PLAYER_W / 2) { posRef.current.x = PLAYER_W / 2; velRef.current.x = Math.abs(velRef.current.x); }
      if (posRef.current.x > W - PLAYER_W / 2) { posRef.current.x = W - PLAYER_W / 2; velRef.current.x = -Math.abs(velRef.current.x); }

      // Platform collision
      onGroundRef.current = false;
      for (const p of platformsRef.current) {
        if (posRef.current.x + PLAYER_W / 2 > p.x &&
            posRef.current.x - PLAYER_W / 2 < p.x + p.w &&
            posRef.current.y + PLAYER_H / 2 > p.y &&
            posRef.current.y + PLAYER_H / 2 < p.y + p.h + 10 &&
            velRef.current.y > 0) {
          posRef.current.y = p.y - PLAYER_H / 2;
          velRef.current.y = 0;
          onGroundRef.current = true;
          break;
        }
      }

      // Fell off
      if (posRef.current.y > H + 50) {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.1, vol: 0.09 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        posRef.current = { x: 60, y: 150 };
        velRef.current = { x: 40, y: 0 };
      }

      // Coin collect
      coinsRef.current = coinsRef.current.map(c => {
        if (!c.collected && Math.abs(c.x - posRef.current.x) < 20 && Math.abs(c.y - posRef.current.y) < 20) {
          scoreRef.current = Math.max(0, scoreRef.current + 100);
          setScore(scoreRef.current);
          triggerHaptic('light');
          beep({ freq: 600, dur: 0.07, vol: 0.08 });
          setFlash({ type: 'good', id: Date.now() });
          onScoreUpdate?.(scoreRef.current);
          return { ...c, collected: true };
        }
        return c;
      }).filter(c => !c.collected);

      setPlayerPos({ ...posRef.current });
      setPlatforms([...platformsRef.current]);
      setCoins([...coinsRef.current]);
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
        <Hud label="SCORE" v={score} c="#22c55e" />
        <Hud label="COINS" v={Math.floor(score / 100)} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, cursor: 'pointer' }}
        onPointerDown={jump}
      >
        <MomentumFlash msg={flash?.type === 'good' ? '+100!' : 'FELL!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {platforms.map(p => (
            <rect key={p.id} x={p.x} y={p.y} width={p.w} height={p.h} rx={3} fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth={1.5} />
          ))}
          {coins.map(c => (
            <text key={c.id} x={c.x} y={c.y + 6} textAnchor="middle" fontSize={16} fill="#fbbf24">★</text>
          ))}
          <rect
            x={playerPos.x - PLAYER_W / 2}
            y={playerPos.y - PLAYER_H / 2}
            width={PLAYER_W}
            height={PLAYER_H}
            rx={4}
            fill="rgba(34,197,94,0.5)"
            stroke="#22c55e"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 0 6px #22c55e88)' }}
          />
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP TO JUMP</p>
      </div>
    </div>
  );
}
