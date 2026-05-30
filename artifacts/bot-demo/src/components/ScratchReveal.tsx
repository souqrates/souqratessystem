import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Gem, Trophy, Coins } from 'lucide-react';
import { t } from '../lib/i18n';

export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface CardDef {
  tier: Tier;
  entry: number;
  prizes: number[];
  weights: number[];
  color: string;
  coverClass: string;
  Icon: typeof Star;
}

export const CARDS: CardDef[] = [
  {
    tier: 'bronze', entry: 1,
    prizes: [0, 2, 3, 5, 10],
    weights: [0.62, 0.20, 0.10, 0.06, 0.02],
    color: '#cd7f32', coverClass: 'cover-bronze',
    Icon: Coins,
  },
  {
    tier: 'silver', entry: 5,
    prizes: [0, 8, 15, 30, 50],
    weights: [0.60, 0.22, 0.11, 0.05, 0.02],
    color: '#94a3b8', coverClass: 'cover-silver',
    Icon: Star,
  },
  {
    tier: 'gold', entry: 20,
    prizes: [0, 40, 80, 150, 200],
    weights: [0.58, 0.23, 0.12, 0.05, 0.02],
    color: '#f59e0b', coverClass: 'cover-gold',
    Icon: Trophy,
  },
  {
    tier: 'diamond', entry: 100,
    prizes: [0, 200, 400, 750, 1000],
    weights: [0.56, 0.24, 0.12, 0.06, 0.02],
    color: '#818cf8', coverClass: 'cover-diamond',
    Icon: Gem,
  },
];

function rollPrize(card: CardDef): number {
  let r = Math.random(), cum = 0;
  for (let i = 0; i < card.weights.length; i++) {
    cum += card.weights[i];
    if (r < cum) return card.prizes[i];
  }
  return 0;
}

function getSymbols(prize: number, card: CardDef): [string, string, string] {
  if (prize === 0) {
    const mis = ['✕', '○', '—'];
    return [mis[0], mis[1], mis[2]];
  }
  const s = card.tier === 'diamond' ? '◆' : card.tier === 'gold' ? '★' : card.tier === 'silver' ? '◈' : '●';
  return [s, s, s];
}

interface Props {
  card: CardDef;
  onResult: (prize: number) => void;
  onClose: () => void;
}

export default function ScratchReveal({ card, onResult, onClose }: Props) {
  const [phase, setPhase] = useState<'cover' | 'scratching' | 'revealed'>('cover');
  const [prize, setPrize] = useState<number | null>(null);
  const [symbols, setSymbols] = useState<[string,string,string]>(['?','?','?']);
  const { Icon } = card;

  function handleScratch() {
    setPhase('scratching');
    const p = rollPrize(card);
    const syms = getSymbols(p, card);
    setTimeout(() => {
      setPrize(p);
      setSymbols(syms);
      setPhase('revealed');
      onResult(p);
    }, 900);
  }

  const tierName = t(card.tier);
  const won = prize !== null && prize > 0;

  return (
    <div style={{
      background: '#030a05',
      borderRadius: 20,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      width: '100%',
    }}>
      {/* Card body */}
      <div style={{
        width: '100%', maxWidth: 300,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 180,
      }}>
        {/* Reveal layer */}
        <div style={{
          background: '#0c1d10',
          border: `1px solid ${won ? 'rgba(34,197,94,0.4)' : 'rgba(100,116,139,0.2)'}`,
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          minHeight: 180,
          justifyContent: 'center',
        }}>
          <Icon size={32} style={{ color: card.color }} strokeWidth={1.8} />

          {phase !== 'cover' && (
            <div style={{ display: 'flex', gap: 10 }}>
              {symbols.map((sym, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.12 + 0.1, type: 'spring', stiffness: 300 }}
                  style={{
                    width: 64, height: 64,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 800,
                  }}
                  className={won ? 'prize-win' : 'prize-lose'}
                >
                  <span style={{ color: won ? '#4ade80' : '#475569' }}>{sym}</span>
                </motion.div>
              ))}
            </div>
          )}

          {phase === 'cover' && (
            <div style={{ display: 'flex', gap: 10 }}>
              {['?','?','?'].map((sym, i) => (
                <div key={i} style={{
                  width: 64, height: 64,
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, color: '#334155',
                  background: '#0a1a0e', border: '1px solid rgba(34,197,94,0.1)',
                }}>{sym}</div>
              ))}
            </div>
          )}

          {phase === 'revealed' && prize !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'center' }}
            >
              {won ? (
                <>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{t('winMsg')}</div>
                  <div style={{
                    fontSize: 28, fontWeight: 900,
                    fontFamily: '"Orbitron", sans-serif',
                  }}
                    className="text-grad-green"
                  >
                    +{prize} SKZ
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>{t('loseMsg')}</div>
              )}
            </motion.div>
          )}
        </div>

        {/* Metallic cover overlay */}
        <AnimatePresence>
          {phase === 'cover' && (
            <motion.div
              key="cover"
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: 16,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8, overflow: 'hidden',
                transformOrigin: 'top center',
              }}
              className={card.coverClass}
            >
              <div className="shimmer-anim" style={{ position: 'absolute', inset: 0 }} />
              <Icon size={36} color="rgba(255,255,255,0.9)" strokeWidth={2} />
              <div style={{
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 12, fontWeight: 800,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: '0.08em',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}>
                {tierName.toUpperCase()}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600,
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: '0.06em',
              }}>
                SCRATCH ME
              </div>
            </motion.div>
          )}
          {phase === 'scratching' && (
            <motion.div
              key="scratching"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', inset: 0, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              className={card.coverClass}
            >
              <div className="shimmer-anim" style={{ position: 'absolute', inset: 0 }} />
              <div style={{
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 11, fontWeight: 800,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.06em',
                animation: 'pulse-green 1s infinite',
              }}>
                {t('scratching')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Entry fee label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#475569' }}>{t('entryFee')}:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: card.color }}>{card.entry} SKZ</span>
        <span style={{ fontSize: 11, color: '#334155', marginLeft: 8 }}>{t('maxPrize')}:</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
          {card.prizes[card.prizes.length - 1]} SKZ
        </span>
      </div>

      {/* Action button */}
      {phase === 'cover' && (
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleScratch}
          style={{
            width: '100%', maxWidth: 300,
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: `linear-gradient(135deg, ${card.color}cc, ${card.color})`,
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: '"Tajawal", sans-serif',
            boxShadow: `0 4px 20px ${card.color}44`,
            letterSpacing: '0.02em',
          }}
        >
          {t('scratchNow')} — {card.entry} SKZ
        </motion.button>
      )}

      {phase === 'revealed' && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.96 }}
          onClick={onClose}
          style={{
            width: '100%', maxWidth: 300,
            padding: '14px 0',
            borderRadius: 14,
            border: '1px solid rgba(34,197,94,0.25)',
            background: 'rgba(34,197,94,0.08)',
            color: '#22c55e',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: '"Tajawal", sans-serif',
          }}
        >
          {t('scratchAnother')}
        </motion.button>
      )}
    </div>
  );
}
