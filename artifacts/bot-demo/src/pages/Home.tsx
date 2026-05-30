import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, BarChart3 } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import type { Page } from '../App';
import JackpotCup from '../components/JackpotCup';

interface Props {
  lang: Lang;
  balance: number;
  jackpot: number;
  lottoTrigger: number;
  participants: number;
  onNavigate: (p: Page) => void;
}

const WINNERS = [
  { name: 'أحمد م.', amount: 200, tier: 'gold' },
  { name: 'Sarah K.', amount: 50, tier: 'silver' },
  { name: 'خالد ر.', amount: 1000, tier: 'diamond' },
  { name: 'Fatima A.', amount: 10, tier: 'bronze' },
  { name: 'محمد ع.', amount: 400, tier: 'diamond' },
  { name: 'Omar B.', amount: 80, tier: 'gold' },
  { name: 'نورة س.', amount: 30, tier: 'silver' },
];

const STATS = [
  { key: 'totalScratched' as const, value: '1,284', icon: BarChart3, color: '#22c55e' },
  { key: 'totalWins'     as const, value: '316',   icon: TrendingUp, color: '#f59e0b' },
  { key: 'winRate'       as const, value: '24.6%', icon: Zap,        color: '#818cf8' },
  { key: 'biggestWin'    as const, value: '1000',  icon: Users,      color: '#06b6d4' },
];

export default function Home({ lang, balance, jackpot, lottoTrigger, participants, onNavigate }: Props) {
  const [countdown] = useState({ h: 18, m: 42, s: 17 });
  const isRtl = lang === 'ar';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── JACKPOT CUP (hero, full width) ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'linear-gradient(180deg, #030a02 0%, #061205 40%, #040d03 100%)',
          borderBottom: '1px solid rgba(245,158,11,0.12)',
          paddingTop: 10,
          paddingBottom: 4,
        }}
      >
        <JackpotCup
          jackpot={jackpot}
          coinTrigger={lottoTrigger}
          lang={lang}
          participants={participants}
          onClick={() => onNavigate('lotto')}
        />
      </motion.div>

      {/* ── BALANCE + CTA ── */}
      <div style={{ padding: '10px 14px 0' }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{
            background: 'linear-gradient(135deg, #071a0a 0%, #0a2210 60%, #071a0a 100%)',
            border: '1px solid rgba(34,197,94,0.18)',
            borderRadius: 16,
            padding: '14px 18px',
          }}
          className="ring-green-glow"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em', marginBottom: 2 }}>
                {t('balance')}
              </div>
              <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 26, fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1 }} className="text-grad-green">
                {balance.toLocaleString('en', { maximumFractionDigits: 1 })}
              </div>
              <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 1 }}>SKZ</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => onNavigate('cards')}
                style={{ padding: '9px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#22c55e)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: '"Tajawal", sans-serif', boxShadow: '0 4px 14px rgba(34,197,94,0.3)', whiteSpace: 'nowrap' }}
              >
                {t('scratchNow')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => onNavigate('lotto')}
                style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: '"Tajawal", sans-serif', whiteSpace: 'nowrap' }}
              >
                {t('lotto')}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── COUNTDOWN MINI BAR ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          onClick={() => onNavigate('lotto')}
          style={{ cursor: 'pointer', marginTop: 10 }}
        >
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)', borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#78716c' }}>
              {isRtl ? 'القرعة القادمة خلال' : 'Next draw in'}
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {[{ v: countdown.h, k: 'h' }, { v: countdown.m, k: 'm' }, { v: countdown.s, k: 's' }].map(({ v, k }, i) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {i > 0 && <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 900, opacity: 0.5 }}>:</span>}
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 6, padding: '3px 6px', minWidth: 30, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', fontFamily: '"Orbitron", sans-serif', lineHeight: 1 }}>{String(v).padStart(2, '0')}</div>
                    <div style={{ fontSize: 8, color: '#78716c', fontWeight: 600 }}>{t(k as 'h' | 'm' | 's')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          {STATS.map(({ key, value, icon: Icon, color }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 + i * 0.05 }}
              className="scrch-card"
              style={{ padding: '11px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} style={{ color }} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.1 }}>
                    {key === 'biggestWin' ? `${value} SKZ` : value}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>{t(key)}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── FEATURED CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          onClick={() => onNavigate('cards')}
          style={{ cursor: 'pointer', marginTop: 10 }}
          className="ring-indigo-glow"
        >
          <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1535 50%, #0f0e1f 100%)', border: '1px solid rgba(129,140,248,0.22)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginBottom: 2, letterSpacing: '0.06em' }}>{t('featuredCard').toUpperCase()}</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: '"Orbitron", sans-serif', color: '#c7d2fe' }}>{t('diamond').toUpperCase()}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                {t('upToWin')} <span style={{ color: '#818cf8', fontWeight: 700 }}>1,000 SKZ</span>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6366f1', marginBottom: 4, letterSpacing: '0.05em' }}>{t('entryFee')}</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: '"Orbitron", sans-serif', color: '#818cf8', lineHeight: 1 }}>100</div>
              <div style={{ fontSize: 10, color: '#6366f1', marginTop: 1 }}>SKZ</div>
            </div>
          </div>
        </motion.div>

        {/* ── LIVE WINNERS TICKER ── */}
        <div className="scrch-card" style={{ padding: '10px 0', marginTop: 10, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, letterSpacing: '0.05em', padding: '0 14px 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e', animation: 'pulse-green 1.5s infinite' }} />
            {t('liveWinners').toUpperCase()}
          </div>
          <div className="marquee-wrap">
            <div className="marquee-track">
              {[...WINNERS, ...WINNERS].map((w, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 16px 2px 0', fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{w.name}</span>
                  <span style={{ color: '#22c55e', fontWeight: 800 }}>+{w.amount} SKZ</span>
                  <span style={{ color: '#334155', marginLeft: 4 }}>·</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}
