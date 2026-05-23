import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Find the one item that does NOT belong to the group. Tap it = +100. Wrong = -150. Time window shrinks every 200 pts. Reach 1000 in 60 seconds!';
const DEFAULT_GAME_TIME = 60;
const TARGET = 1000;

const GROUPS = [
  { category: 'FRUITS', items: ['🍎','🍊','🍋','🍇','🍓','🍑','🥭','🍒'], odd: ['🥦','🥕','🌽','🧅'] },
  { category: 'ANIMALS', items: ['🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨'], odd: ['🚗','✈️','🚀','🎸'] },
  { category: 'VEHICLES', items: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑'], odd: ['🍕','🎂','🍦','🥗'] },
  { category: 'SPORTS', items: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏'], odd: ['📚','🎵','🎨','🔬'] },
  { category: 'MUSIC', items: ['🎸','🎹','🎺','🎻','🥁','🎷','🪗','🎵'], odd: ['🌸','🌊','⛰️','🌙'] },
];

function genRound(level) {
  const group = GROUPS[Math.floor(Math.random() * GROUPS.length)];
  const count = Math.min(8, 4 + level);
  const regulars = group.items.sort(() => Math.random() - 0.5).slice(0, count);
  const odd = group.odd[Math.floor(Math.random() * group.odd.length)];
  const oddIdx = Math.floor(Math.random() * (count + 1));
  const all = [...regulars.slice(0, oddIdx), odd, ...regulars.slice(oddIdx)];
  return { items: all.map((em, i) => ({ id: i, emoji: em })), oddId: oddIdx, category: group.category };
}

export default function OddOneOut({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [round, setRound] = useState(null);
  const [flash, setFlash] = useState(null);
  const [windowMs, setWindowMs] = useState(3000);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const roundTimerRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getWindow = () => Math.max(1200, 3000 - Math.floor(scoreRef.current / 200) * 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearTimeout(roundTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    if (!activeRef.current) return;
    const win = getWindow();
    setWindowMs(win);
    const r = genRound(Math.floor(scoreRef.current / 200));
    setRound(r);
    clearTimeout(roundTimerRef.current);
    roundTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newRound, 400);
    }, win);
  }, []);

  const tap = useCallback((id) => {
    if (!activeRef.current || !round) return;
    clearTimeout(roundTimerRef.current);
    if (id === round.oddId) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newRound, 400);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newRound, 400);
    }
  }, [round, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    setTimeout(newRound, 400);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearTimeout(roundTimerRef.current); clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#f59e0b" />
        <Hud label="WINDOW" v={`${(windowMs / 1000).toFixed(1)}s`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 10 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 12 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'FOUND IT!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        {round && (
          <>
            <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>
              FIND THE ONE NOT IN: <span style={{ color: '#f59e0b' }}>{round.category}</span>
            </p>

            {/* Timer bar */}
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div
                key={round.oddId}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: windowMs / 1000, ease: 'linear' }}
                style={{ height: '100%', background: '#f59e0b', borderRadius: 99 }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 280 }}>
              {round.items.map(it => (
                <motion.button
                  key={it.id}
                  whileTap={{ scale: 0.85 }}
                  onPointerDown={() => tap(it.id)}
                  style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '2px solid rgba(255,255,255,0.08)',
                    fontSize: 30, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {it.emoji}
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
