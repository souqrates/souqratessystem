import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Coins, Zap, CheckCircle2, RefreshCw, AlertTriangle, Trophy, X } from 'lucide-react';
import { triggerHaptic } from '../../../lib/telegram';

export default function ResultOverlay({
  won,
  earnings,
  score,
  xpEarned,
  setPhase,
  winLabel,
  loseLabel,
  settling,
  settleStatus = 'idle',  // 'idle' | 'settling' | 'credited' | 'refunded' | 'failed'
  creditedAmount = 0,
}) {
  const handlePlay = () => {
    if (settling) { triggerHaptic('warning'); return; }
    triggerHaptic('medium');
    setPhase('playing');
  };

  // For a winning round, the +SKZ chip is shown in two cases ONLY:
  //   (1) before settlement completes → show the advertised gross prize
  //       as the "expected" amount (clearly labelled while settling).
  //   (2) after a confirmed credit with a server-returned net amount.
  // On an idempotent-success (409) path the exact net is unknown, so
  // we hide the numeric chip rather than overstate the credit — the
  // SettlementPill still confirms the deposit verbally.
  const showNumericChip =
    settleStatus === 'settling' ||
    settleStatus === 'idle'     ||
    (settleStatus === 'credited' && creditedAmount > 0);
  const displayedAmount = (settleStatus === 'credited' && creditedAmount > 0)
    ? creditedAmount
    : earnings;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      gap: 18,
      textAlign: 'center',
      minHeight: 260,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Confetti burst when credit succeeds */}
      <AnimatePresence>
        {won && settleStatus === 'credited' && <ConfettiBurst />}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
        style={{ lineHeight: 1, zIndex: 1 }}
      >
        {won
          ? <Trophy size={72} color="#f59e0b" strokeWidth={1.4} style={{ filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.6))' }} />
          : <X size={72} color="#ef4444" strokeWidth={1.4} style={{ filter: 'drop-shadow(0 0 20px rgba(239,68,68,0.5))' }} />
        }
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ zIndex: 1 }}
      >
        <p style={{
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          fontSize: 22,
          color: won ? '#10b981' : '#ef4444',
          letterSpacing: '0.06em',
          textShadow: won ? '0 0 24px rgba(16,185,129,0.6)' : '0 0 24px rgba(239,68,68,0.6)',
        }}>
          {won ? (winLabel || 'You Won!') : (loseLabel || 'Game Over')}
        </p>

        {score > 0 && (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', marginTop: 6, fontWeight: 700 }}>
            Score: <span style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif' }}>{Number(score).toLocaleString()}</span>
          </p>
        )}
      </motion.div>

      {won && showNumericChip && displayedAmount > 0 && (
        <motion.div
          key={settleStatus}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={
            settleStatus === 'credited'
              ? { opacity: 1, scale: [0.8, 1.15, 1] }
              : { opacity: 1, scale: 1 }
          }
          transition={{ delay: 0.2, duration: settleStatus === 'credited' ? 0.6 : 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 14,
            background: settleStatus === 'credited'
              ? 'rgba(16,185,129,0.18)'
              : 'rgba(16,185,129,0.1)',
            border: settleStatus === 'credited'
              ? '1px solid rgba(16,185,129,0.6)'
              : '1px solid rgba(16,185,129,0.3)',
            boxShadow: settleStatus === 'credited'
              ? '0 0 24px rgba(16,185,129,0.4)'
              : 'none',
            zIndex: 1,
          }}
        >
          <Coins size={15} style={{ color: '#10b981' }} />
          <span style={{ fontSize: 15, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#10b981' }}>
            +{Number(displayedAmount).toLocaleString()} SKZ
          </span>
        </motion.div>
      )}

      {/* Settlement status pill — replaces the cryptic "settling…" with
          a clear outcome the user can act on. */}
      {won && settleStatus !== 'idle' && <SettlementPill status={settleStatus} />}

      {xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}
        >
          <Zap size={11} fill="#f59e0b" style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: 11, color: 'rgba(245,158,11,0.8)', fontWeight: 700 }}>+{xpEarned} XP</span>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        whileTap={settling ? undefined : { scale: 0.94 }}
        onClick={handlePlay}
        disabled={settling}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '14px 32px',
          opacity: settling ? 0.55 : 1,
          pointerEvents: settling ? 'none' : 'auto',
          borderRadius: 16,
          background: won
            ? 'linear-gradient(135deg, #047857, #10b981)'
            : 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          color: '#fff',
          fontWeight: 900,
          fontSize: 14,
          fontFamily: 'Orbitron, sans-serif',
          letterSpacing: '0.04em',
          border: 'none',
          cursor: 'pointer',
          boxShadow: won
            ? '0 4px 20px rgba(16,185,129,0.3)'
            : '0 4px 20px rgba(139,92,246,0.3)',
          marginTop: 8,
          zIndex: 1,
        }}
      >
        <RotateCcw size={14} />
        {settling ? 'Settling…' : 'Play Again'}
      </motion.button>
    </div>
  );
}

// ── Settlement status pill ─────────────────────────────────────────────────
function SettlementPill({ status }) {
  const conf = {
    settling: {
      bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.35)',
      color: '#cbd5e1', icon: <RefreshCw size={11} className="spin" />,
      text: 'Crediting your prize…',
    },
    credited: {
      bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.55)',
      color: '#34d399', icon: <CheckCircle2 size={12} />,
      text: '✅ Prize added to your wallet',
    },
    refunded: {
      bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.45)',
      color: '#fbbf24', icon: <RefreshCw size={11} />,
      text: '↩︎ Entry fee refunded to your wallet',
    },
    failed: {
      bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.45)',
      color: '#f87171', icon: <AlertTriangle size={11} />,
      text: 'Contact support — settlement did not complete',
    },
  }[status];

  if (!conf) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 999,
        background: conf.bg, border: `1px solid ${conf.border}`,
        color: conf.color, fontSize: 11, fontWeight: 700,
        zIndex: 1,
      }}
    >
      <span style={status === 'settling' ? { animation: 'spin 0.9s linear infinite', display: 'inline-flex' } : { display: 'inline-flex' }}>
        {conf.icon}
      </span>
      <span>{conf.text}</span>
    </motion.div>
  );
}

// ── Confetti burst (lightweight, no extra deps) ────────────────────────────
function ConfettiBurst() {
  const pieces = Array.from({ length: 18 });
  const colors = ['#10b981', '#34d399', '#fbbf24', '#f59e0b', '#60a5fa', '#a78bfa'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const distance = 90 + Math.random() * 70;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6, rotate: 0 }}
            animate={{
              x: dx,
              y: dy,
              opacity: 0,
              scale: 1.2,
              rotate: 180 + Math.random() * 360,
            }}
            transition={{ duration: 0.9 + Math.random() * 0.4, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 7, height: 10,
              borderRadius: 2,
              background: colors[i % colors.length],
              boxShadow: '0 0 6px rgba(0,0,0,0.2)',
            }}
          />
        );
      })}
    </div>
  );
}
