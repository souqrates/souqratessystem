import { motion } from 'framer-motion';
import { Trophy, XCircle, RotateCcw, Coins, Zap } from 'lucide-react';
import { triggerHaptic } from '../../../lib/telegram';

export default function ResultOverlay({ won, earnings, score, xpEarned, setPhase, winLabel, loseLabel, settling }) {
  const handlePlay = () => {
    if (settling) { triggerHaptic('warning'); return; }
    triggerHaptic('medium');
    setPhase('playing');
  };

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
    }}>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
        style={{ fontSize: 72, lineHeight: 1 }}
      >
        {won ? '🏆' : '💀'}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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

      {won && earnings > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 14,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <Coins size={15} style={{ color: '#10b981' }} />
          <span style={{ fontSize: 15, fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#10b981' }}>
            +{Number(earnings).toLocaleString()} SKZ
          </span>
          {settling && (
            <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>settling…</span>
          )}
        </motion.div>
      )}

      {xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
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
        }}
      >
        <RotateCcw size={14} />
        {settling ? 'Settling…' : 'Play Again'}
      </motion.button>
    </div>
  );
}
