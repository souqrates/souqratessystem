import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Tap LEFT or RIGHT to dodge incoming spikes. Each spike dodged = +100. Getting hit = -150. Spikes speed up every 200 pts. Reach 2000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 2000;

const W = 240;
const H = 320;
const SPIKE_W = 40;
const PLAYER_W = 36;

export default function DodgeSpikes({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [playerX, setPlayerX] = useState(W / 2);
  const [spikes, setSpikes] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const playerXRef = useRef(W / 2);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const spikesRef = useRef([]);
  const nextIdRef = useRef(0);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getSpeed = () => 140 + Math.floor(scoreRef.current / 200) * 20;
  const getInterval = () => Math.max(0.6, 1.1 - Math.floor(scoreRef.current / 200) * 0.06);

  const endGame = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const move = useCallback((dir) => {
    if (!activeRef.current) return;
    const newX = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, playerXRef.current + dir * 60));
    playerXRef.current = newX;
    setPlayerX(newX);
    beep({ freq: 280, dur: 0.04, vol: 0.05 });
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; playerXRef.current = W / 2; nextIdRef.current = 0;
    setScore(0); setPlayerX(W / 2); setSpikes([]); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    spikesRef.current = [];
    lastRef.current = performance.now();
    let spawnTimer = 0;

    const loop = (now) => {
      if (!activeRef.current) return;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const speed = getSpeed();

      spawnTimer += dt;
      if (spawnTimer >= getInterval()) {
        spawnTimer = 0;
        const x = SPIKE_W / 2 + Math.random() * (W - SPIKE_W);
        spikesRef.current = [...spikesRef.current, { id: nextIdRef.current++, x, y: -30, scored: false }];
      }

      const px = playerXRef.current;
      spikesRef.current = spikesRef.current
        .map(s => ({ ...s, y: s.y + speed * dt }))
        .filter(s => {
          if (s.y > H + 30) return false;
          // Check hit (player zone is at bottom ~H-50)
          if (!s.scored && s.y > H - 70 && s.y < H - 20) {
            const hitX = Math.abs(s.x - px) < (PLAYER_W / 2 + SPIKE_W / 2 - 6);
            if (hitX) {
              scoreRef.current = Math.max(0, scoreRef.current - 150);
              setScore(scoreRef.current);
              triggerHaptic('error');
              noise({ dur: 0.08, vol: 0.08 });
              setFlash({ type: 'bad', id: Date.now() });
              onScoreUpdate?.(scoreRef.current);
              return false;
            } else if (s.y > H - 40) {
              // Dodged
              scoreRef.current = Math.max(0, scoreRef.current + 100);
              setScore(scoreRef.current);
              triggerHaptic('light');
              beep({ freq: 500, dur: 0.06, vol: 0.07 });
              setFlash({ type: 'good', id: Date.now() });
              onScoreUpdate?.(scoreRef.current);
              return false;
            }
          }
          return true;
        });

      setSpikes([...spikesRef.current]);
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
        <Hud label="SCORE" v={score} c="#ef4444" />
        <Hud label="SPEED" v={getSpeed()} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'DODGED!' : 'HIT!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ position: 'relative', width: W, height: H, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          {spikes.map(s => (
            <div key={s.id} style={{
              position: 'absolute',
              left: s.x - SPIKE_W / 2,
              top: s.y,
              width: SPIKE_W,
              height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>
              ▼
            </div>
          ))}
          <div style={{
            position: 'absolute',
            left: playerX - PLAYER_W / 2,
            bottom: 20,
            width: PLAYER_W, height: PLAYER_W,
            borderRadius: '50%',
            background: 'rgba(59,130,246,0.3)',
            border: '2px solid #3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            boxShadow: '0 0 12px rgba(59,130,246,0.4)',
            transition: 'left 0.1s ease-out',
          }}>
            🛡️
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {[['◀', -1], ['▶', 1]].map(([label, dir]) => (
            <motion.button
              key={dir}
              whileTap={{ scale: 0.85 }}
              onPointerDown={() => move(dir)}
              style={{
                width: 80, height: 52, borderRadius: 14,
                background: 'rgba(59,130,246,0.1)',
                border: '2px solid rgba(59,130,246,0.3)',
                color: '#60a5fa', fontSize: 24, cursor: 'pointer',
              }}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
