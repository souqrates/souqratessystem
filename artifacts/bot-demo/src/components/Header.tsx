import { Ticket, RefreshCw } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import type { Page } from '../App';

interface Props {
  balance: number;
  balanceLoading?: boolean;
  lang: Lang;
  onToggleLang: () => void;
  onNavigate: (p: Page) => void;
  onTopUp: () => void;
}

export default function Header({ balance, balanceLoading, lang, onToggleLang, onTopUp }: Props) {
  return (
    <header
      style={{
        height: 52,
        background: '#030a05',
        borderBottom: '1px solid rgba(34,197,94,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg,#16a34a,#22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(34,197,94,0.4)',
        }}>
          <Ticket size={16} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{
          fontFamily: '"Orbitron", sans-serif',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: '#4ade80',
          lineHeight: 1.1,
        }}>
          SCRATCHY
        </span>
      </div>

      {/* Balance — tap to refresh */}
      <button
        onClick={onTopUp}
        title="refresh balance"
        style={{
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 20,
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          cursor: 'pointer',
        }}
      >
        {balanceLoading ? (
          <RefreshCw size={13} color="#4ade80" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
            {balance.toLocaleString('en', { maximumFractionDigits: 1 })}
          </span>
        )}
        <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', opacity: .8 }}>
          {t('skz')}
        </span>
      </button>

      {/* Lang toggle */}
      <button
        onClick={onToggleLang}
        style={{
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: 8,
          padding: '4px 9px',
          color: '#64748b',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: '"Tajawal", sans-serif',
          letterSpacing: '.03em',
        }}
      >
        {lang === 'ar' ? 'EN' : 'عر'}
      </button>
    </header>
  );
}
