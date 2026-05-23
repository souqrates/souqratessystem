import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Guide the thread through needle holes in sequence. Tap each hole in order. Correct = +100. Skip/wrong hole = -150. More holes after 400 pts. Reach 1000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;

const W = 280;
const H = 200;

function genHoles(count) {
  const holes = [];
  for (let i = 0; i < count; i++) {
    holes.push({
      id: i,
      x: 20 + Math.random() * (W - 40),
      y: 20 + Math.random() * (H - 40),
      r: 14,
    });
  }
  return holes;
}

export default function ThreadNeedle({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [holes, setHoles] = useState([]);
  const [nextHole, setNextHole] = useState(0);
  const [thread, setThread] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getCount = () => 4 + Math.floor(scoreRef.current / 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const h = genHoles(getCount());
    setHoles(h);
    setNextHole(0);
    setThread([{ x: h[0].x, y: h[0].y }]);
  }, []);

  const tapHole = useCallback((id) => {
    if (!activeRef.current) return;
    if (id !== nextHole) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.08, vol: 0.08 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      return;
    }
    beep({ freq: 400 + id * 40, dur: 0.06, vol: 0.07 });
    const hole = holes[id];
    setThread(prev => [...prev, { x: hole.x, y: hole.y }]);
    const next = id + 1;
    setNextHole(next);
    if (next >= holes.length) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newRound, 600);
    }
  }, [nextHole, holes, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newRound();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const threadPath = thread.length > 1 ? `M ${thread.map(p => `${p.x},${p.y}`).join(' L ')}` : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#ec4899" />
        <Hud label="HOLE" v={`${nextHole}/${holes.length}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'THREADED!' : 'WRONG HOLE!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
        >
          {/* Thread */}
          {threadPath && <path d={threadPath} stroke="#ec4899" strokeWidth={2} fill="none" strokeLinecap="round" />}

          {/* Holes */}
          {holes.map((h, i) => {
            const done = i < nextHole;
            const isNext = i === nextHole;
            return (
              <g key={h.id} style={{ cursor: isNext ? 'pointer' : 'default' }} onPointerDown={() => tapHole(h.id)}>
                <circle cx={h.x} cy={h.y} r={h.r} fill={done ? 'rgba(16,185,129,0.2)' : isNext ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.03)'} stroke={done ? '#10b981' : isNext ? '#ec4899' : 'rgba(255,255,255,0.15)'} strokeWidth={2} />
                <text x={h.x} y={h.y + 4} textAnchor="middle" fill={done ? '#10b981' : isNext ? '#ec4899' : 'rgba(148,163,184,0.4)'} fontSize={10} fontWeight="bold">{i + 1}</text>
              </g>
            );
          })}
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>TAP HOLES IN ORDER</p>
      </div>
    </div>
  );
}
