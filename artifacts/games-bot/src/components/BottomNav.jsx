import { useRef } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Gamepad2, Wallet, Medal } from 'lucide-react';
import useAppStore from '../store/appStore';
import { triggerHaptic } from '../lib/telegram';
import { t } from '../lib/i18n';
import { isIOS } from '../lib/deviceProfile';

// Simplified per user request — the leaderboard lives in the Mother Bot
// (central hub), so we keep just the 4 essentials inside the games bot.
const NAV = [
  { id: 'dashboard',    Icon: LayoutDashboard, labelKey: 'dashboard'    },
  { id: 'games',        Icon: Gamepad2,         labelKey: 'games'        },
  { id: 'achievements', Icon: Medal,            labelKey: 'achievements' },
  { id: 'wallet',       Icon: Wallet,           labelKey: 'wallet'       },
];

const COLOR = {
  dashboard:    { main: '#22d3ee', glow: 'rgba(34,211,238,0.35)',  bg: 'rgba(34,211,238,0.12)'  },
  games:        { main: '#f59e0b', glow: 'rgba(245,158,11,0.35)',  bg: 'rgba(245,158,11,0.12)'  },
  achievements: { main: '#fb7185', glow: 'rgba(251,113,133,0.35)', bg: 'rgba(251,113,133,0.12)' },
  wallet:       { main: '#10b981', glow: 'rgba(16,185,129,0.35)',  bg: 'rgba(16,185,129,0.12)'  },
};

export default function BottomNav() {
  const { currentPage, setCurrentPage, language } = useAppStore();
  const go = (id) => { triggerHaptic('medium'); setCurrentPage(id); };

  return (
    <div
      className="flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, rgba(4,3,10,0) 0%, rgba(6,4,14,0.98) 18%)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* thin separator line */}
      <div style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.18) 30%, rgba(34,211,238,0.28) 50%, rgba(34,211,238,0.18) 70%, transparent 100%)',
        marginBottom: 2,
      }} />

      <div className="flex items-center justify-around max-w-xl mx-auto px-2 py-2 gap-1">
        {NAV.map(({ id, Icon, labelKey }) => {
          const active = currentPage === id;
          const c = COLOR[id];

          return (
            <motion.button
              key={id}
              onClick={() => go(id)}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 600, damping: 28 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 0 6px',
                borderRadius: 16,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'visible',
                background: 'transparent',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Active pill background — slides in, no box on inactive */}
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    background: c.bg,
                    boxShadow: `0 0 20px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              {/* Top micro line on active */}
              {active && (
                <motion.div
                  layoutId="nav-topline"
                  style={{
                    position: 'absolute',
                    top: 0, left: '20%', right: '20%',
                    height: 2,
                    borderRadius: '0 0 4px 4px',
                    background: `linear-gradient(90deg, transparent, ${c.main}, transparent)`,
                    boxShadow: `0 0 8px ${c.main}, 0 0 16px ${c.glow}`,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              {/* Icon — `drop-shadow` on SVG combined with a layout-id
                  animation flickers on iPhone every tab switch, so we
                  drop the glow filter on iOS and keep color only. */}
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                style={{
                  position: 'relative', zIndex: 1,
                  color: active ? c.main : 'rgba(100,116,139,0.6)',
                  filter: active && !isIOS()
                    ? `drop-shadow(0 0 6px ${c.main}) drop-shadow(0 0 14px ${c.glow})`
                    : 'none',
                  transition: 'color 0.2s, filter 0.2s',
                }}
              />

              {/* Label */}
              <span
                style={{
                  position: 'relative', zIndex: 1,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: active ? c.main : 'rgba(100,116,139,0.55)',
                  transition: 'color 0.2s',
                  lineHeight: 1,
                }}
              >
                {t(language, labelKey)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}