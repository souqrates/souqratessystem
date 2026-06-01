import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

// ARCANE TAROT — mystical midnight blue + gold filigree rebrand. Same
// mechanic: flip two cards and match the pair. New identity: tarot-style
// rune symbols on ornate cards, 3D flip animation, deep cosmic backdrop.
const RULES = 'ARCANE TAROT — Reveal two cards. Matching pair = +100. Wrong pair = -150. After 600 pts the deck expands from 12 to 20 cards. Clear all pairs before the hour-glass empties. Reach the target in 180s!';
const DEFAULT_GAME_TIME = 180;
const TARGET = 1200;
// Mystic rune / tarot glyph set — replaces generic emoji
const EMOJIS = ['○','◈','⬡','⬟','✶','◇','✿','✦','◉','⟁'];

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
  const GOLD = '#d4af37';
  const MATCHED = '#7ee787';
  const ARCANE = '#7c5cff';
  const NIGHT = '#0a0820';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="ESSENCE" v={score} c={ARCANE} />
        <Hud label="ARCANA" v={cards.length} c={GOLD} />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="DESTINY" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} color={ARCANE} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10,
        borderRadius: 18,
        background: `
          radial-gradient(ellipse at 50% 0%, ${ARCANE}25 0%, ${NIGHT} 60%, #050315 100%),
          radial-gradient(circle at 20% 80%, ${GOLD}10 0%, transparent 40%),
          radial-gradient(circle at 80% 30%, ${ARCANE}15 0%, transparent 45%)
        `,
        border: `1px solid ${GOLD}33`,
        boxShadow: `inset 0 0 60px ${ARCANE}10`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ornate corner glyphs */}
        <div style={{ position: 'absolute', top: 6, left: 8, color: `${GOLD}66`, fontSize: 16, fontFamily: 'serif' }}>✦</div>
        <div style={{ position: 'absolute', top: 6, right: 8, color: `${GOLD}66`, fontSize: 16, fontFamily: 'serif' }}>✦</div>
        <div style={{ position: 'absolute', bottom: 6, left: 8, color: `${GOLD}66`, fontSize: 16, fontFamily: 'serif' }}>✦</div>
        <div style={{ position: 'absolute', bottom: 6, right: 8, color: `${GOLD}66`, fontSize: 16, fontFamily: 'serif' }}>✦</div>

        <MomentumFlash
          msg={flash?.type === 'good' ? '✦ ATTUNED ✦' : '⚠ DISCORD ⚠'}
          color={flash?.type === 'good' ? MATCHED : '#ef4444'}
          trigger={flash?.id}
        />

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 7, width: '100%' }}>
          {cards.map(card => {
            const revealed = card.flipped || card.matched;
            const accent = card.matched ? MATCHED : ARCANE;
            const faceBase = {
              position: 'absolute', inset: 0, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'serif', lineHeight: 1,
              WebkitBackfaceVisibility: 'hidden',
              backfaceVisibility: 'hidden',
            };
            return (
              <motion.button
                key={card.id}
                whileTap={!revealed ? { scale: 0.92 } : {}}
                onPointerDown={() => flip(card.id)}
                style={{
                  aspectRatio: '0.68',
                  position: 'relative',
                  perspective: 800,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: revealed ? 'default' : 'pointer',
                  willChange: 'transform',
                }}
              >
                {/* Rotating shell — two faces, no text counter-rotation needed */}
                <motion.div
                  animate={{ rotateY: revealed ? 180 : 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{
                    position: 'relative',
                    width: '100%', height: '100%',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Back of card (shown when NOT revealed) */}
                  <div style={{
                    ...faceBase,
                    background: `
                      repeating-linear-gradient(45deg, ${NIGHT} 0px, ${NIGHT} 4px, #14102e 4px, #14102e 8px),
                      radial-gradient(circle at 50% 50%, ${GOLD}22, transparent 60%)
                    `,
                    border: `2px solid ${GOLD}66`,
                    boxShadow: `0 0 8px ${GOLD}22, inset 0 1px 0 ${GOLD}33, inset 0 -10px 20px ${ARCANE}22`,
                    color: GOLD,
                    fontSize: 22,
                    textShadow: `0 0 8px ${GOLD}66`,
                  }}>
                    ✦
                  </div>
                  {/* Front of card (shown when revealed) — pre-rotated 180° */}
                  <div style={{
                    ...faceBase,
                    transform: 'rotateY(180deg)',
                    background: `radial-gradient(circle at 50% 35%, ${accent}55 0%, ${accent}22 50%, ${NIGHT} 100%)`,
                    border: `2px solid ${accent}`,
                    boxShadow: `0 0 18px ${accent}88, inset 0 1px 0 ${GOLD}33`,
                    color: '#fff',
                    fontSize: 26,
                    textShadow: `0 0 12px ${accent}, 0 0 4px #fff`,
                  }}>
                    {card.value}
                  </div>
                </motion.div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
