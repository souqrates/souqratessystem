import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import ScratchReveal, { CARDS, type CardDef } from '../components/ScratchReveal';

interface Props {
  lang: Lang;
  balance: number;
  onDeduct: (n: number) => void;
  onCredit: (n: number) => void;
}

export default function Cards({ balance, onDeduct, onCredit }: Props) {
  const [active, setActive] = useState<CardDef | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notEnough, setNotEnough] = useState(false);

  function openCard(card: CardDef) {
    if (balance < card.entry) { setNotEnough(true); setTimeout(() => setNotEnough(false), 2200); return; }
    onDeduct(card.entry);
    setActive(card);
  }

  function handleResult(prize: number) {
    if (prize > 0) {
      onCredit(prize);
      setToast(`${t('winMsg')} ${prize} SKZ`);
    } else {
      setToast(t('loseMsg'));
    }
    setTimeout(() => setToast(null), 3000);
  }

  function closeReveal() { setActive(null); }

  const tierColor = (tier: string) =>
    tier === 'diamond' ? '#818cf8' : tier === 'gold' ? '#f59e0b' : tier === 'silver' ? '#94a3b8' : '#cd7f32';

  const tierBg = (tier: string) =>
    tier === 'diamond' ? 'rgba(129,140,248,0.06)'
    : tier === 'gold'    ? 'rgba(245,158,11,0.06)'
    : tier === 'silver'  ? 'rgba(148,163,184,0.06)'
    : 'rgba(205,127,50,0.06)';

  return (
    <div style={{ padding: '14px 14px 0' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{t('allCards')}</h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>{t('tagline')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CARDS.map((card, i) => {
          const { Icon } = card;
          const color = tierColor(card.tier);
          const bg = tierBg(card.tier);
          return (
            <motion.div
              key={card.tier}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="scrch-card scrch-card-hover"
              style={{ border: `1px solid ${color}22`, background: bg }}
            >
              <div style={{
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: `${color}18`,
                    border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div className="shimmer-anim" style={{ position: 'absolute', inset: 0 }} />
                    <Icon size={22} style={{ color }} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{
                      fontFamily: '"Orbitron", sans-serif',
                      fontSize: 13, fontWeight: 800,
                      color,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {t(card.tier)}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                      {t('upToWin')}{' '}
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>
                        {card.prizes[card.prizes.length - 1]} SKZ
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, letterSpacing: '0.05em' }}>
                    {t('entryFee').toUpperCase()}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => openCard(card)}
                    style={{
                      padding: '8px 18px', borderRadius: 10, border: 'none',
                      background: `linear-gradient(135deg, ${color}cc, ${color})`,
                      color: '#fff', fontSize: 13, fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: '"Tajawal", sans-serif',
                      boxShadow: `0 3px 12px ${color}44`,
                    }}
                  >
                    {card.entry} SKZ
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal overlay */}
      <AnimatePresence>
        {active && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'flex-end',
              zIndex: 100,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) closeReveal(); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                width: '100%',
                background: '#030a05',
                borderTop: '1px solid rgba(34,197,94,0.15)',
                borderRadius: '20px 20px 0 0',
                padding: '6px 0 20px',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px 0' }}>
                <button
                  onClick={closeReveal}
                  style={{
                    background: 'rgba(100,116,139,0.12)',
                    border: '1px solid rgba(100,116,139,0.2)',
                    borderRadius: 8, padding: '6px 10px',
                    color: '#64748b', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <ScratchReveal card={active} onResult={handleResult} onClose={closeReveal} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30 }}
            style={{
              position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              background: '#0c1d10',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 12, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, color: '#4ade80',
              zIndex: 200, whiteSpace: 'nowrap',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {toast}
          </motion.div>
        )}
        {notEnough && (
          <motion.div
            key="notenough"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            style={{
              position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              background: '#1a0505',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, color: '#f87171',
              zIndex: 200, whiteSpace: 'nowrap',
            }}
          >
            رصيد غير كافٍ
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ height: 8 }} />
    </div>
  );
}
