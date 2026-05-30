import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, BarChart3, ChevronRight } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import type { Page } from '../App';
import { CARDS } from '../components/ScratchReveal';

interface Props {
  lang: Lang;
  balance: number;
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

const diamond = CARDS[3];

export default function Home({ balance, onNavigate }: Props) {
  const [countdown] = useState({ d: 0, h: 18, m: 42, s: 17 });

  return (
    <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Balance hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'linear-gradient(135deg, #071a0a 0%, #0a2210 60%, #071a0a 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 16,
          padding: '18px 18px 16px',
          textAlign: 'center',
        }}
        className="ring-green-glow"
      >
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, letterSpacing: '0.05em' }}>
          {t('balance')}
        </div>
        <div style={{
          fontFamily: '"Orbitron", sans-serif',
          fontSize: 32, fontWeight: 900,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          marginBottom: 2,
        }} className="text-grad-green">
          {balance.toLocaleString('en', { maximumFractionDigits: 1 })}
        </div>
        <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>SKZ</div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('cards')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: '"Tajawal", sans-serif',
              boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
            }}
          >
            {t('scratchNow')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('lotto')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#f59e0b', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: '"Tajawal", sans-serif',
            }}
          >
            {t('lotto')}
          </motion.button>
        </div>
      </motion.div>

      {/* Lotto countdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => onNavigate('lotto')}
        style={{ cursor: 'pointer' }}
        className="scrch-card scrch-card-hover ring-gold-glow"
      >
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 1 }}>{t('todayPool')}</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: '"Orbitron", sans-serif' }}
                className="text-grad-gold">
                5,000 SKZ
              </div>
            </div>
            <ChevronRight size={18} style={{ color: '#f59e0b', opacity: .6 }} />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { v: countdown.h,  k: 'h' },
              { v: countdown.m,  k: 'm' },
              { v: countdown.s,  k: 's' },
            ].map(({ v, k }) => (
              <div key={k} style={{
                flex: 1, textAlign: 'center',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 8, padding: '6px 0',
              }}>
                <div style={{
                  fontSize: 20, fontWeight: 900,
                  fontFamily: '"Orbitron", sans-serif',
                  color: '#fbbf24',
                  lineHeight: 1,
                }}>
                  {String(v).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 9, color: '#78716c', marginTop: 2, fontWeight: 600 }}>
                  {t(k as 'h'|'m'|'s')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {STATS.map(({ key, value, icon: Icon, color }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="scrch-card"
            style={{ padding: '12px 14px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
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

      {/* Featured diamond card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        onClick={() => onNavigate('cards')}
        style={{ cursor: 'pointer' }}
        className="ring-indigo-glow"
      >
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1535 50%, #0f0e1f 100%)',
          border: '1px solid rgba(129,140,248,0.22)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginBottom: 2, letterSpacing: '0.06em' }}>
              {t('featuredCard').toUpperCase()}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800,
              fontFamily: '"Orbitron", sans-serif',
              color: '#c7d2fe',
            }}>
              {t('diamond').toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              {t('upToWin')} <span style={{ color: '#818cf8', fontWeight: 700 }}>1,000 SKZ</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#6366f1', marginBottom: 4, letterSpacing: '0.05em' }}>
              {t('entryFee')}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              fontFamily: '"Orbitron", sans-serif',
              color: '#818cf8',
              lineHeight: 1,
            }}>
              100
            </div>
            <div style={{ fontSize: 10, color: '#6366f1', marginTop: 1 }}>SKZ</div>
          </div>
        </div>
      </motion.div>

      {/* Live winners ticker */}
      <div className="scrch-card" style={{ padding: '10px 0' }}>
        <div style={{
          fontSize: 11, color: '#22c55e', fontWeight: 700,
          letterSpacing: '0.05em', padding: '0 14px 6px',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            display: 'inline-block',
            boxShadow: '0 0 6px #22c55e',
            animation: 'pulse-green 1.5s infinite',
          }} />
          {t('liveWinners').toUpperCase()}
        </div>
        <div className="marquee-wrap">
          <div className="marquee-track">
            {[...WINNERS, ...WINNERS].map((w, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 16px 2px 0',
                fontSize: 12,
                color: '#94a3b8',
              }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{w.name}</span>
                <span style={{ color: '#22c55e', fontWeight: 800 }}>+{w.amount} SKZ</span>
                <span style={{ color: '#334155', marginLeft: 4 }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
