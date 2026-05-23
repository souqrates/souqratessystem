import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Flip two cards. If they match = +100 pts! Wrong pair = -150 pts. After 600 pts, deck grows from 12 to 20 cards. Clear all pairs before time runs out. Reach the target score in 180 seconds!';
const DEFAULT_GAME_TIME = 180;
const TARGET = 1200;
const EMOJIS = ['🎯','⚡','🔥','💎','🌟','🎮','🚀','🎪','💥','🎸'];

function buildDeck(pairs) {
  const em = EMOJIS.slice(0, pairs);
  const cards = [...em, ...em].map((v, i) => ({ id: i, value: v, flipped: false, matched: false }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export default function CardFlipPro({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [flash, setFlash] = useState(null);
  const [locked, setLocked] = useState(false);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);

  const TARGET_SCORE = game.targetScore || TARGET;
  const getPairs = () => scoreRef.current >= 600 ? 10 : 6;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newRound = useCallback(() => {
    const deck = buildDeck(getPairs());
    setCards(deck);
    setFlipped([]);
    setLocked(false);
  }, []);

  const flip = useCallback((cardId) => {
    if (!activeRef.current || locked) return;
    setCards(prev => {
      const c = prev.find(x => x.id === cardId);
      if (!c || c.flipped || c.matched) return prev;
      const newCards = prev.map(x => x.id === cardId ? { ...x, flipped: true } : x);
      setFlipped(fl => {
        const nf = [...fl, cardId];
        if (nf.length === 2) {
          setLocked(true);
          const [a, b] = nf.map(id => newCards.find(x => x.id === id));
          if (a.value === b.value) {
            triggerHaptic('light');
            chord([660, 880], 0.06, 0.1, 'triangle');
            scoreRef.current = Math.max(0, scoreRef.current + 100);
            setScore(scoreRef.current);
            setFlash({ type: 'good', id: Date.now() });
            onScoreUpdate?.(scoreRef.current);
            const updated = newCards.map(x => (x.id === a.id || x.id === b.id) ? { ...x, matched: true } : x);
            setCards(updated);
            setFlipped([]);
            setLocked(false);
            if (updated.every(x => x.matched)) setTimeout(newRound, 400);
          } else {
            triggerHaptic('error');
            noise({ dur: 0.1, vol: 0.1 });
            scoreRef.current = Math.max(0, scoreRef.current - 150);
            setScore(scoreRef.current);
            setFlash({ type: 'bad', id: Date.now() });
            onScoreUpdate?.(scoreRef.current);
            setTimeout(() => {
              setCards(prev2 => prev2.map(x => (x.id === a.id || x.id === b.id) ? { ...x, flipped: false } : x));
              setFlipped([]);
              setLocked(false);
            }, 900);
          }
        }
        return nf;
      });
      return newCards;
    });
  }, [locked, endGame, onScoreUpdate, newRound, TARGET_SCORE]);

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

  const cols = cards.length <= 12 ? 4 : 5;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#a855f7" />
        <Hud label="CARDS" v={cards.length} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 4 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'MATCH!' : 'WRONG!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, width: '100%' }}>
          {cards.map(card => (
            <motion.button
              key={card.id}
              whileTap={!card.flipped && !card.matched ? { scale: 0.9 } : {}}
              onPointerDown={() => flip(card.id)}
              style={{
                aspectRatio: '0.7', borderRadius: 10,
                background: card.matched
                  ? 'rgba(16,185,129,0.15)'
                  : card.flipped
                    ? 'rgba(168,85,247,0.2)'
                    : 'rgba(255,255,255,0.06)',
                border: `2px solid ${card.matched ? '#10b981' : card.flipped ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
                cursor: card.flipped || card.matched ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: card.flipped || card.matched ? 20 : 14,
                transition: 'all 0.2s',
              }}
            >
              {card.flipped || card.matched ? card.value : '?'}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
