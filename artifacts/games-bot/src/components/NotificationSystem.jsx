import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, memo } from 'react';
import { Bell, Zap, X } from 'lucide-react';
import useAppStore from '../store/appStore';
import { supabase } from '../lib/supabase';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function NotificationSystem() {
  const { notifications, addNotification, removeNotification } = useAppStore();
  const shownRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    async function fetchNotifs() {
      const { data } = await supabase.rpc('get_active_app_notifications');
      if (cancelled || !data?.ok || !Array.isArray(data.notifications)) return;
      data.notifications.forEach((n) => {
        if (shownRef.current.has(n.id)) return;
        shownRef.current.add(n.id);
        const accent = n.accent_color || '#00d4ff';
        addNotification({
          title: n.title || '',
          sub: n.body || '',
          accent,
          glow: hexToRgba(accent, 0.5),
          bg: hexToRgba(accent, 0.08),
          border: hexToRgba(accent, 0.2),
          icon: Bell,
          _dbId: n.id,
        });
      });
    }
    fetchNotifs();
    const iv = setInterval(fetchNotifs, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [addNotification]);

  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) =>
      setTimeout(() => removeNotification(n.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, removeNotification]);

  return (
    /* Pinned inside the app-shell, above content but below game overlay */
    <div
      className="fixed right-3 z-[90] flex flex-col gap-2"
      style={{
        top: 'calc(env(safe-area-inset-top) + 60px)',
        pointerEvents: 'none',
        width: 270,
      }}
    >
      <AnimatePresence>
        {notifications.slice(-3).map((n) => (
          <Toast key={n.id} n={n} onClose={() => removeNotification(n.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const Toast = memo(function Toast({ n, onClose }) {
  const IconComp = n.icon || Zap;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl"
      style={{
        pointerEvents: 'auto',
        background: `linear-gradient(135deg, rgba(8,12,22,0.97) 0%, rgba(10,15,28,0.95) 100%)`,
        border: `1px solid ${n.border || 'rgba(34,211,238,0.2)'}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), 0 0 20px ${n.glow || 'rgba(34,211,238,0.15)'}`,
        backdropFilter: 'blur(10px)',
      }}
      initial={{ opacity: 0, x: 80, scale: 0.88 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      layout
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ background: `linear-gradient(to bottom, ${n.accent}bb, ${n.accent}44)` }}
      />

      {/* Top shimmer line */}
      <div
        className="absolute top-0 left-6 right-6 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${n.accent}50, transparent)` }}
      />

      {/* Ambient glow spot */}
      <div
        className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl pointer-events-none"
        style={{ background: n.bg }}
      />

      <div className="flex items-center gap-3 px-4 py-3 relative z-10">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: n.bg,
            border: `1px solid ${n.border}`,
            boxShadow: `0 0 14px ${n.glow}`,
          }}
        >
          <IconComp
            size={16}
            style={{
              color: n.accent,
              filter: `drop-shadow(0 0 6px ${n.accent})`,
            }}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-snug truncate">{n.title}</p>
          <p className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>
            {n.sub}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity opacity-50 hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <X size={11} className="text-slate-400" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${n.accent}, ${n.accent}44)` }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 4.5, ease: 'linear' }}
      />
    </motion.div>
  );
}, (prev, next) => prev.n.id === next.n.id && prev.onClose === next.onClose);
