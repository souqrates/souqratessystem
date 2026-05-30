import { Home, Layers, Dices, Ticket } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import type { Page } from '../App';

interface Props {
  current: Page;
  lang: Lang;
  onChange: (p: Page) => void;
}

const TABS: { id: Page; Icon: typeof Home; labelKey: 'home'|'cards'|'lotto'|'myTickets' }[] = [
  { id: 'home',    Icon: Home,        labelKey: 'home' },
  { id: 'cards',   Icon: Layers,      labelKey: 'cards' },
  { id: 'lotto',   Icon: Dices,       labelKey: 'lotto' },
  { id: 'tickets', Icon: Ticket,      labelKey: 'myTickets' },
];

export default function BottomNav({ current, onChange }: Props) {
  return (
    <nav
      className="scrch-nav"
      style={{
        flexShrink: 0,
        background: '#030a05',
        borderTop: '1px solid rgba(34,197,94,0.1)',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {TABS.map(({ id, Icon, labelKey }) => {
        const active = current === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '8px 4px 6px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all .14s ease',
            }}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.2 : 1.8}
              style={{ color: active ? '#22c55e' : '#334155', transition: 'color .14s' }}
            />
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.02em',
              color: active ? '#22c55e' : '#334155',
              transition: 'color .14s',
            }}>
              {t(labelKey)}
            </span>
            {active && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                width: 24,
                height: 2,
                background: '#22c55e',
                borderRadius: 2,
                boxShadow: '0 0 6px rgba(34,197,94,0.8)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
