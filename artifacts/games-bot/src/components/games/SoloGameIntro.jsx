import { Zap, Trophy, Shield, Info, Coins } from 'lucide-react';
import { motion } from 'framer-motion';

const container = { animate: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } } };
const item = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
};

const DIFF_COLOR = {
  Easy:   { text: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  Medium: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  Hard:   { text: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'  },
};

export default function SoloGameIntro({ game, color, wallet, tiers, selectedTier, onTierSelect }) {
  const dc = DIFF_COLOR[game.difficulty] || DIFF_COLOR.Medium;
  const balance = Number(wallet?.sc_balance || 0);
  const fee  = selectedTier ? Number(selectedTier.entryFee) : Number(game.entryFee || 0);
  const prize = selectedTier
    ? Math.round(selectedTier.entryFee * selectedTier.multiplier)
    : Number(game.prize || 0);
  const canAfford = balance >= fee;

  return (
    <motion.div variants={container} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Hero */}
      <motion.div variants={item} style={{ textAlign: 'center', paddingTop: 10, paddingBottom: 6 }}>
        <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 10, filter: `drop-shadow(0 0 20px ${color}66)` }}>
          {game.emoji}
        </div>
        <h2 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          fontSize: 18,
          color: '#fff',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}>
          {game.name}
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>
          {game.desc}
        </p>
      </motion.div>

      {/* Difficulty + balance row */}
      <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span style={{
          padding: '5px 12px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: dc.bg,
          border: `1px solid ${dc.border}`,
          color: dc.text,
        }}>
          {game.difficulty}
        </span>
        <span style={{
          padding: '5px 12px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 700,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(148,163,184,0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          <Coins size={10} />
          Balance: <span style={{ color: canAfford ? '#10b981' : '#ef4444', fontWeight: 900 }}>{balance.toLocaleString()} SKZ</span>
        </span>
      </motion.div>

      {/* Tiers — shown if multiple tiers available */}
      {tiers.length > 1 && (
        <motion.div variants={item}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Select Stake
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
            {tiers.map((tier, i) => {
              const tierPrize = Math.round(tier.entryFee * tier.multiplier);
              const isSelected = selectedTier?.entryFee === tier.entryFee;
              return (
                <button
                  key={i}
                  onClick={() => onTierSelect(tier)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 12,
                    border: isSelected ? `1.5px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
                    background: isSelected ? `${color}15` : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? `0 0 12px ${color}30` : 'none',
                  }}
                >
                  <div style={{ fontSize: 10, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: isSelected ? color : '#fff' }}>
                    {tier.entryFee} SKZ
                  </div>
                  <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700, marginTop: 2 }}>
                    ×{tier.multiplier}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Fee / Prize summary */}
      <motion.div variants={item} style={{
        display: 'flex',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
            <Zap size={10} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entry</span>
          </div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: fee > 0 ? '#f59e0b' : '#10b981' }}>
            {fee > 0 ? `${fee} SKZ` : 'Free'}
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
            <Trophy size={10} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prize</span>
          </div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: '#10b981' }}>
            {prize > 0 ? `${prize} SKZ` : '—'}
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
            <Shield size={10} style={{ color: '#94a3b8' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mode</span>
          </div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 12, color: '#94a3b8' }}>
            Solo
          </div>
        </div>
      </motion.div>

      {!canAfford && fee > 0 && (
        <motion.div variants={item} style={{
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Info size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, lineHeight: 1.4 }}>
            Not enough SKZ. Top up your wallet to play this game.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
