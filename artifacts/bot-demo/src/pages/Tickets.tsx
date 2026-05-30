import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Dices } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import type { Page } from '../App';

interface Props { lang: Lang; onNavigate: (p: Page) => void; }

const SCRATCH_TICKETS = [
  { id: 1, tier: 'diamond', entry: 100, prize: 400,  status: 'won',     date: '2026-05-30', symbols: ['◆','◆','◆'] },
  { id: 2, tier: 'gold',    entry: 20,  prize: 0,    status: 'lost',    date: '2026-05-29', symbols: ['★','○','✕'] },
  { id: 3, tier: 'silver',  entry: 5,   prize: 0,    status: 'lost',    date: '2026-05-28', symbols: ['—','◈','✕'] },
  { id: 4, tier: 'bronze',  entry: 1,   prize: 5,    status: 'won',     date: '2026-05-27', symbols: ['●','●','●'] },
  { id: 5, tier: 'gold',    entry: 20,  prize: 80,   status: 'won',     date: '2026-05-26', symbols: ['★','★','★'] },
];

const LOTTO_TICKETS = [
  { id: 1, numbers: [4,12,19,27,33,48], status: 'pending', date: '2026-05-30', draw: '2026-05-31', prize: 0 },
  { id: 2, numbers: [7,15,22,31,38,44], status: 'lost',    date: '2026-05-22', draw: '2026-05-22', prize: 0 },
  { id: 3, numbers: [2,9,14,30,36,49],  status: 'won',     date: '2026-05-15', draw: '2026-05-15', prize: 250 },
];

type Tab = 'scratch' | 'lotto';

function tierColor(tier: string) {
  return tier === 'diamond' ? '#818cf8' : tier === 'gold' ? '#f59e0b' : tier === 'silver' ? '#94a3b8' : '#cd7f32';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; style: object }> = {
    won:     { label: t('won'),     style: { background: 'rgba(34,197,94,0.1)',   border: '1px solid rgba(34,197,94,0.25)',   color: '#4ade80' } },
    lost:    { label: t('lost'),    style: { background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', color: '#64748b' } },
    pending: { label: t('pending'), style: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' } },
  };
  const info = map[status] || map.pending;
  return (
    <span style={{
      ...info.style,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 700,
    }}>
      {info.label}
    </span>
  );
}

export default function Tickets({ onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('scratch');

  return (
    <div style={{ padding: '14px 14px 0' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>
        {t('myTickets')}
      </h2>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0,
        background: '#071209',
        borderRadius: 12, padding: 4,
        marginBottom: 14,
        border: '1px solid rgba(34,197,94,0.1)',
      }}>
        {[
          { id: 'scratch' as Tab, Icon: Layers,      label: t('scratchTab') },
          { id: 'lotto'   as Tab, Icon: Dices,       label: t('lottoTab') },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px 0', borderRadius: 9, border: 'none',
              background: tab === id ? '#0c1d10' : 'transparent',
              color: tab === id ? '#22c55e' : '#475569',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all .15s ease',
              boxShadow: tab === id ? '0 0 0 1px rgba(34,197,94,0.2)' : 'none',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'scratch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SCRATCH_TICKETS.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="scrch-card"
              style={{ padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${tierColor(ticket.tier)}18`,
                    border: `1px solid ${tierColor(ticket.tier)}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    <Layers size={16} style={{ color: tierColor(ticket.tier) }} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: tierColor(ticket.tier),
                      fontFamily: '"Orbitron", sans-serif',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {t(ticket.tier as 'bronze')}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155' }}>{ticket.date}</div>
                  </div>
                </div>
                <StatusBadge status={ticket.status} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {ticket.symbols.map((sym, j) => (
                    <div key={j} style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: ticket.status === 'won' ? 'rgba(34,197,94,0.08)' : 'rgba(100,116,139,0.06)',
                      border: ticket.status === 'won' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(100,116,139,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800,
                      color: ticket.status === 'won' ? '#4ade80' : '#334155',
                    }}>{sym}</div>
                  ))}
                </div>
                {ticket.status === 'won' && (
                  <div style={{ textAlign: 'end' }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{t('winMsg').split('!')[0]}</div>
                    <div style={{
                      fontSize: 16, fontWeight: 900,
                      fontFamily: '"Orbitron", sans-serif',
                    }} className="text-grad-green">
                      +{ticket.prize}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {tab === 'lotto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LOTTO_TICKETS.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="scrch-card"
              style={{ padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Dices size={16} style={{ color: '#f59e0b' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                      {t('lotto')} #{ticket.id}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155' }}>{ticket.date}</div>
                  </div>
                </div>
                <StatusBadge status={ticket.status} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ticket.numbers.map(n => (
                  <span key={n} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: ticket.status === 'won' ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
                    border: ticket.status === 'won' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,197,94,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: ticket.status === 'won' ? '#4ade80' : '#334155',
                  }}>{n}</span>
                ))}
              </div>

              {ticket.status === 'pending' && (
                <div style={{
                  marginTop: 10, fontSize: 11, color: '#64748b',
                  padding: '6px 10px', background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.12)',
                  borderRadius: 8,
                }}>
                  {t('nextDraw')}: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{ticket.draw}</span>
                </div>
              )}

              {ticket.status === 'won' && ticket.prize > 0 && (
                <div style={{
                  marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{t('winMsg')}</span>
                  <span style={{
                    fontSize: 16, fontWeight: 900,
                    fontFamily: '"Orbitron", sans-serif',
                  }} className="text-grad-green">
                    +{ticket.prize} SKZ
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* CTA if empty */}
      {SCRATCH_TICKETS.length === 0 && tab === 'scratch' && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>{t('noTickets')}</div>
          <button
            onClick={() => onNavigate('cards')}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t('goPlay')}
          </button>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}
