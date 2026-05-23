import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, Trophy, Zap, Target, Flame, Crown } from 'lucide-react';
import useAppStore from '../store/appStore';
import { rankProgress } from '../lib/ranks';
import { displayNameOf, avatarUrlOf, initialOf } from '../lib/profile';
import { triggerHaptic } from '../lib/telegram';

function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
      <Icon size={12} style={{ color }} />
      <p className="font-orbitron text-sm font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</p>
    </div>
  );
}

export default function ShareProfileCard({ xp, wins, totalGames, winRate, open, onClose }) {
  const { user } = useAppStore();
  const [copied, setCopied] = useState(false);

  const rp = rankProgress(Number(xp || 0));
  const r = rp.rank;
  const name = displayNameOf(user);
  const avatar = avatarUrlOf(user);
  const initial = initialOf(user);

  const shareText = `🎮 ${name} — ${r.name} (Lv ${rp.level})\n⚡ ${Number(xp || 0).toLocaleString()} XP · ${wins} wins · ${winRate}% win rate\n\nJoin me on SkillGames!`;

  async function handleShare() {
    triggerHaptic('medium');
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch { /* user cancelled */ }
    }
    handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    triggerHaptic('success');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed z-50 bottom-0 left-0 right-0 px-4 pb-6 max-w-xl mx-auto"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #0d0b16 0%, #120f1f 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 -24px 80px rgba(0,0,0,0.7)',
              }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-orbitron text-sm font-black text-white tracking-wider">Share Profile</p>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <X size={14} color="rgba(148,163,184,0.8)" />
                </button>
              </div>

              {/* Profile card preview */}
              <div className="mx-5 my-5 rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${r.hex}18, rgba(6,182,212,0.06))`,
                  border: `1px solid ${r.hex}30`,
                  boxShadow: `0 8px 32px ${r.glow.replace('0.45', '0.2')}`,
                }}>
                {/* Decorative orb */}
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none"
                  style={{ background: `${r.hex}15` }} />

                {/* Top: avatar + name + rank */}
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                    style={{ background: r.grad, boxShadow: `0 0 18px ${r.glow}` }}>
                    {avatar
                      ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                      : <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, fontWeight: 900, color: '#0b1220' }}>{initial}</span>
                    }
                  </div>
                  <div>
                    <p className="font-orbitron text-base font-black text-white leading-tight">{name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-4 h-4 rounded-sm" style={{ background: r.grad }} />
                      <p className="text-[11px] font-black" style={{ color: r.hex }}>{r.name}</p>
                      <span className="text-[10px] font-bold" style={{ color: 'rgba(148,163,184,0.6)' }}>· Lv {rp.level}</span>
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-orbitron text-xl font-black shimmer-gold">{Number(xp || 0).toLocaleString()}</p>
                    <p className="text-[9px] font-black uppercase tracking-wider mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>XP</p>
                  </div>
                </div>

                {/* XP progress bar */}
                <div className="mt-4 h-1.5 rounded-full overflow-hidden relative z-10"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{
                    height: '100%', width: `${rp.pct}%`,
                    background: r.grad, boxShadow: `0 0 8px ${r.glow}`,
                    borderRadius: 9999,
                  }} />
                </div>
                <p className="text-[9px] font-semibold mt-1 relative z-10" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  {rp.inLevel}/{rp.span} XP to next level
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mt-4 relative z-10">
                  <StatChip icon={Trophy}  label="Wins"   value={wins || 0}             color="#f59e0b" />
                  <StatChip icon={Target}  label="Played" value={totalGames || 0}        color="#22d3ee" />
                  <StatChip icon={Flame}   label="Rate"   value={`${winRate || 0}%`}     color="#f97316" />
                  <StatChip icon={Zap}     label="Level"  value={`L${rp.level}`}         color={r.hex}   />
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl btn-primary btn-sweep"
                >
                  <Share2 size={15} />
                  <span className="text-[11px] tracking-[0.1em]">Share</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{
                    background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {copied
                    ? <Check size={15} color="#10b981" />
                    : <Copy size={15} color="rgba(148,163,184,0.8)" />
                  }
                  <span className="text-[11px] font-black tracking-wider"
                    style={{ color: copied ? '#10b981' : 'rgba(148,163,184,0.8)' }}>
                    {copied ? 'Copied!' : 'Copy Text'}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
