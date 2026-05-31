import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Check } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  balance: number;
  jackpot: number;
  participants: number;
  onBuyTicket: (ticketPrice: number, picks: number[]) => void;
}

const TICKET_PRICE = 5;
const POOL_SIZE    = 49;
const PICK_COUNT   = 6;

const RECENT_DRAWS = [
  { date: '2026-05-29', numbers: [4, 12, 19, 27, 33, 48], bonus: 7 },
  { date: '2026-05-22', numbers: [2,  9, 14, 31, 39, 45], bonus: 22 },
  { date: '2026-05-15', numbers: [6, 18, 24, 30, 37, 42], bonus: 11 },
];

function quickPick(): number[] {
  const pool = Array.from({ length: POOL_SIZE }, (_, i) => i + 1);
  const picked: number[] = [];
  while (picked.length < PICK_COUNT) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

export default function Lotto({ lang, balance, jackpot, participants, onBuyTicket }: Props) {
  const [picks, setPicks]       = useState<Set<number>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);
  const isRtl = lang === 'ar';

  const toggle = useCallback((n: number) => {
    setPicks(prev => {
      const s = new Set(prev);
      if (s.has(n)) { s.delete(n); return s; }
      if (s.size >= PICK_COUNT) return s;
      s.add(n);
      return s;
    });
    setConfirmed(false);
  }, []);

  const doQuickPick = useCallback(() => {
    setPicks(new Set(quickPick()));
    setConfirmed(false);
  }, []);

  const clearAll = useCallback(() => { setPicks(new Set()); setConfirmed(false); }, []);

  const buyTicket = useCallback(() => {
    if (picks.size !== PICK_COUNT) return;
    if (balance < TICKET_PRICE) {
      setToast(isRtl ? 'رصيد غير كافٍ' : 'Insufficient balance');
      setTimeout(() => setToast(null), 2200);
      return;
    }
    const picksArr = Array.from(picks).sort((a, b) => a - b);
    onBuyTicket(TICKET_PRICE, picksArr);
    setConfirmed(true);
    setToast(t('confirmTicket'));
    setTimeout(() => setToast(null), 3000);
  }, [picks, balance, onBuyTicket, isRtl]);

  const full = picks.size === PICK_COUNT;

  return (
    <div style={{ padding: '14px 14px 0' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{t('lotto')}</h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>{t('tagline')}</p>
      </div>

      {/* Prize pool — real live jackpot */}
      <div className="scrch-card ring-gold-glow" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#78716c', marginBottom: 2, letterSpacing: '0.05em' }}>
              {t('todayPool').toUpperCase()}
            </div>
            <motion.div
              key={jackpot}
              initial={{ scale: 1.06, color: '#fef9c3' }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{ fontSize: 24, fontWeight: 900, fontFamily: '"Orbitron", sans-serif' }}
              className="text-grad-gold"
            >
              {jackpot.toLocaleString()} SKZ
            </motion.div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              <motion.span key={participants} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {participants.toLocaleString()}
              </motion.span>
              {' '}{t('participants')}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#78716c', marginBottom: 6, letterSpacing: '0.05em' }}>
              {t('drawIn').toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 18, k: 'h' }, { v: 42, k: 'm' }, { v: 17, k: 's' }].map(({ v, k }) => (
                <div key={k} style={{ width: 36, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6, padding: '4px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', fontFamily: '"Orbitron", sans-serif', lineHeight: 1 }}>
                    {String(v).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 8, color: '#78716c', fontWeight: 600 }}>{t(k as 'h')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Number picker */}
      <div className="scrch-card" style={{ padding: '14px 14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>{t('pickNumbers')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={doQuickPick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Shuffle size={12} /> {t('quickPick')}
            </button>
            {picks.size > 0 && (
              <button onClick={clearAll} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(100,116,139,0.1)', color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {t('clearAll')}
              </button>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#334155', marginBottom: 10 }}>
          <span style={{ color: picks.size === PICK_COUNT ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
            {picks.size}
          </span>
          {' '}/{PICK_COUNT} {t('selected')} · {t('of49')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {Array.from({ length: POOL_SIZE }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => toggle(n)} className={`lotto-ball ${picks.has(n) ? 'lb-pick' : 'lb-idle'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Selected numbers */}
      <AnimatePresence>
        {picks.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="scrch-card"
            style={{ padding: '12px 14px', marginBottom: 12, overflow: 'hidden' }}
          >
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: 600 }}>{t('yourNumbers')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Array.from(picks).sort((a, b) => a - b).map(n => (
                <motion.span key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(34,197,94,0.4)' }}>
                  {n}
                </motion.span>
              ))}
              {Array.from({ length: PICK_COUNT - picks.size }, (_, i) => (
                <span key={`e-${i}`} style={{ width: 34, height: 34, borderRadius: '50%', background: '#0c1d10', border: '1px dashed rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#1e3a22' }}>?</span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buy button */}
      <motion.button
        whileTap={{ scale: full ? 0.97 : 1 }}
        onClick={buyTicket}
        disabled={!full || confirmed}
        style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: full && !confirmed ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'rgba(100,116,139,0.1)', color: full && !confirmed ? '#1a0a00' : '#334155', fontSize: 16, fontWeight: 800, cursor: full && !confirmed ? 'pointer' : 'default', fontFamily: '"Tajawal", sans-serif', boxShadow: full && !confirmed ? '0 4px 20px rgba(245,158,11,0.35)' : 'none', transition: 'all .2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}
      >
        {confirmed ? <><Check size={18} /> {t('confirmTicket')}</> : <>{t('buyTicket')} — {TICKET_PRICE} SKZ</>}
      </motion.button>

      {/* Recent draws */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: '0.03em' }}>
          {isRtl ? 'نتائج السحوبات الأخيرة' : 'Recent Draws'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RECENT_DRAWS.map((draw, i) => (
            <motion.div key={draw.date} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="scrch-card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#475569' }}>{draw.date}</span>
                <span style={{ fontSize: 10, color: '#334155', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.12)' }}>+{draw.bonus}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {draw.numbers.map(n => (
                  <span key={n} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#4ade80' }}>{n}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#0c1d10', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#4ade80', zIndex: 200, whiteSpace: 'nowrap' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ height: 8 }} />
    </div>
  );
}
