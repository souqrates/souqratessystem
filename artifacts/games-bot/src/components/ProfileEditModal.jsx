import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, User as UserIcon, Image as ImageIcon, Sparkles, Camera } from 'lucide-react';
import useAppStore from '../store/appStore';
import { updateProfile, displayNameOf, avatarUrlOf, initialOf, AVATAR_PRESETS } from '../lib/profile';
import { triggerHaptic } from '../lib/telegram';

export default function ProfileEditModal({ open, onClose }) {
  const { user, setUser, addNotification } = useAppStore();
  const [name, setName] = useState(displayNameOf(user));
  const [avatar, setAvatar] = useState(avatarUrlOf(user));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  async function save() {
    if (busy) return;
    setErr('');
    const trimmed = (name || '').trim();
    if (trimmed.length < 2)  { setErr('Name must be at least 2 characters'); return; }
    if (trimmed.length > 24) { setErr('Name must be 24 characters or fewer'); return; }
    const trimmedAvatar = (avatar || '').trim();
    if (trimmedAvatar && !/^(https?:\/\/|data:image\/)/i.test(trimmedAvatar)) {
      setErr('Avatar URL must start with http(s)://'); return;
    }
    setBusy(true);
    try {
      const updated = await updateProfile(user?.telegram_id, {
        displayName: trimmed,
        avatarUrl:   trimmedAvatar || null,
      });
      setUser({ ...user, ...updated });
      triggerHaptic('success');
      addNotification?.({ type: 'success', message: 'Profile updated' });
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Could not update profile');
    } finally {
      setBusy(false);
    }
  }

  const showAvatar = avatar || avatarUrlOf(user);
  const showInitial = (name || displayNameOf(user))[0]?.toUpperCase() || 'P';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{
          background: 'rgba(2,6,23,0.78)',
          backdropFilter: 'blur(8px)',
          overscrollBehavior: 'contain',
          touchAction: 'none',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 relative"
          style={{
            background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(2,6,23,0.99))',
            border: '1px solid rgba(34,211,238,0.25)',
            boxShadow: '0 30px 80px -20px rgba(34,211,238,0.4)',
            maxHeight: '90vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="absolute -top-20 -right-12 w-56 h-56 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(34,211,238,0.18)' }} />
          <div className="absolute -bottom-16 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(16,185,129,0.12)' }} />

          <div className="relative z-10 flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: '#22d3ee' }} />
              <p className="font-orbitron text-sm font-black tracking-widest text-white">EDIT PROFILE</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <X size={16} color="#94a3b8" />
            </button>
          </div>

          {/* Live preview */}
          <div className="relative z-10 rounded-2xl p-4 mb-4 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg,#0ea5e9,#22d3ee)',
                boxShadow: '0 0 20px rgba(34,211,238,0.4)',
              }}>
              {showAvatar
                ? <img src={showAvatar} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                : <span className="font-orbitron text-xl font-black text-white">{showInitial}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>Preview</p>
              <p className="font-orbitron text-base font-black text-white truncate">{name || 'Your Name'}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>@{user?.username || 'player'}</p>
            </div>
          </div>

          {/* Display Name */}
          <div className="relative z-10 mb-4">
            <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"
              style={{ color: 'rgba(148,163,184,0.78)' }}>
              <UserIcon size={11} /> Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Your shown name"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(34,211,238,0.18)',
                outline: 'none',
              }}
            />
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(148,163,184,0.55)' }}>
              Shown in matches, leaderboards, lobbies. 2–24 characters.
            </p>
          </div>

          {/* Avatar URL */}
          <div className="relative z-10 mb-4">
            <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"
              style={{ color: 'rgba(148,163,184,0.78)' }}>
              <ImageIcon size={11} /> Avatar URL <span style={{ color: 'rgba(148,163,184,0.45)' }}>(optional)</span>
            </label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(34,211,238,0.18)',
                outline: 'none',
              }}
            />
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(148,163,184,0.55)' }}>
              Paste a direct image link. Leave blank to use your Telegram photo.
            </p>
          </div>

          {/* Presets */}
          <div className="relative z-10 mb-5">
            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"
              style={{ color: 'rgba(148,163,184,0.78)' }}>
              <Camera size={11} /> Quick Picks
            </p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAvatar(p.url)}
                  className="aspect-square rounded-xl overflow-hidden transition-all"
                  style={{
                    border: avatar === p.url ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: avatar === p.url ? `0 0 14px ${p.c1}88` : 'none',
                  }}>
                  <img src={p.url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                </button>
              ))}
            </div>
          </div>

          {err && (
            <p className="relative z-10 text-[11px] mb-3 font-bold" style={{ color: '#fb7185' }}>
              {err}
            </p>
          )}

          <div className="relative z-10 flex gap-2">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(226,232,240,0.8)' }}>
              Cancel
            </button>
            <button onClick={save} disabled={busy}
              className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg,#0891b2,#22d3ee)',
                color: '#fff',
                boxShadow: '0 10px 24px -10px rgba(34,211,238,0.6)',
                opacity: busy ? 0.6 : 1,
              }}>
              <Check size={13} /> {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
