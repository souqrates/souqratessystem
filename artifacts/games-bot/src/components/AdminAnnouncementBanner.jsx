import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import useAppStore from '../store/appStore';

const POLL_INTERVAL_MS = 60_000;
const dismissedLocal = () => {
  try { return new Set(JSON.parse(localStorage.getItem('skz_admin_notif_dismissed') || '[]')); }
  catch { return new Set(); }
};
const rememberDismissed = (id) => {
  try {
    const set = dismissedLocal();
    set.add(id);
    localStorage.setItem('skz_admin_notif_dismissed', JSON.stringify([...set].slice(-200)));
  } catch { /* ignore */ }
};

export default function AdminAnnouncementBanner() {
  const { user } = useAppStore();
  const [items, setItems] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const load = useCallback(async () => {
    const tid = Number(user?.telegram_id);
    if (!tid) return;
    const { data } = await supabase.rpc('get_active_app_notifications', { p_telegram_id: tid });
    const seen = dismissedLocal();
    const filtered = (data || []).filter((n) => !seen.has(n.id));
    setItems(prev => {
      const prevIds = prev.map(n => n.id).join(',');
      const newIds = filtered.map(n => n.id).join(',');
      if (prevIds === newIds) return prev;
      setActiveIdx(0);
      return filtered;
    });
  }, [user?.telegram_id]);

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const current = items[activeIdx];

  const handleDismiss = async () => {
    if (!current) return;
    rememberDismissed(current.id);
    const tid = Number(user?.telegram_id);
    if (tid) {
      supabase.rpc('dismiss_app_notification', { p_telegram_id: tid, p_id: current.id }).catch(() => {});
    }
    setItems((cur) => cur.filter((n) => n.id !== current.id));
    setActiveIdx(0);
  };

  if (!current) return null;

  const accent = current.accent_color || '#00d4ff';
  const endsAt = current.ends_at ? new Date(current.ends_at).getTime() : null;
  const remaining = endsAt ? Math.max(0, endsAt - Date.now()) : null;

  return (
    <div
      className="fixed left-3 right-3 z-[120] pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
    >
      <AnimatePresence>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -28, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            pointerEvents: 'auto',
            background: `linear-gradient(135deg, ${accent}22 0%, rgba(10,7,22,0.98) 75%)`,
            border: `1px solid ${accent}55`,
            boxShadow: `0 14px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), 0 0 30px ${accent}30`,
          }}
        >
          <div
            aria-hidden
            className="banner-sheen"
            style={{
              position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
              background: `linear-gradient(90deg, transparent, ${accent}20, transparent)`,
              pointerEvents: 'none',
              animation: 'bannerSheen 3.4s linear infinite',
              willChange: 'transform',
            }}
          />

          <div className="flex gap-3 px-4 py-3 relative z-10">
            {current.image_url ? (
              <img src={current.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                onError={e => { e.target.style.display = 'none'; }}
                style={{ border: `1px solid ${accent}55` }} />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}18`, border: `1px solid ${accent}55`, boxShadow: `0 0 18px ${accent}40` }}>
                <Bell size={18} style={{ color: accent, filter: `drop-shadow(0 0 6px ${accent})` }} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {current.title && (
                <p className="text-sm font-black text-white leading-snug" style={{ textShadow: `0 0 12px ${accent}55` }}>
                  {current.title}
                </p>
              )}
              {current.body && (
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(226,232,240,0.78)' }}>
                  {current.body}
                </p>
              )}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {current.link_url && (
                  <a
                    href={current.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
                    style={{
                      background: accent,
                      color: '#0a0a0f',
                      boxShadow: `0 0 14px ${accent}60`,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {current.link_label || 'OPEN'}
                    <ExternalLink size={10} />
                  </a>
                )}
                {items.length > 1 && (
                  <span className="text-[10px] font-bold" style={{ color: `${accent}aa` }}>
                    {activeIdx + 1}/{items.length}
                  </span>
                )}
                {remaining !== null && remaining > 0 && (
                  <span className="text-[10px] font-semibold" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    ends {fmtDuration(remaining)}
                  </span>
                )}
              </div>
            </div>

            {current.dismissible !== false && (
              <button
                onClick={handleDismiss}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 opacity-60 hover:opacity-100"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                aria-label="Dismiss"
              >
                <X size={13} className="text-slate-300" />
              </button>
            )}
          </div>

          {items.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-2 relative z-10">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: i === activeIdx ? accent : 'rgba(148,163,184,0.35)',
                    boxShadow: i === activeIdx ? `0 0 6px ${accent}` : 'none',
                  }}
                  aria-label={`Notification ${i + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.floor(h / 24);
  return `in ${d}d`;
}
