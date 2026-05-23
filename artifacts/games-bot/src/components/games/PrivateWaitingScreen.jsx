import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Lock, Share2 } from 'lucide-react';
import { loopCount } from '../../lib/motionConfig';
import { formatRoomCode } from '../../lib/privateRoom';

export default function PrivateWaitingScreen({ room, copied, onCopy, onShare, dots, children }) {
  if (!room) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(245,158,11,0.28)',
        borderRadius: 16,
        padding: '18px 22px',
        marginTop: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
        <Lock size={11} color="rgba(245,158,11,0.6)" />
        <p style={{ fontSize: 10, color: 'rgba(245,158,11,0.6)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0, fontWeight: 700 }}>
          Private Room Code
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22,
          color: '#f59e0b', letterSpacing: '0.18em',
          textShadow: '0 0 20px rgba(245,158,11,0.4)', wordBreak: 'break-all',
        }}>
          {formatRoomCode(room.id)}
        </span>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onCopy}
          style={{
            width: 42, height: 42, borderRadius: 12, cursor: 'pointer',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.3)'}`,
            background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'all 0.2s',
          }}>
          <AnimatePresence mode="wait">
            {copied
              ? <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={17} color="#10b981" /></motion.span>
              : <motion.span key="cp" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy size={17} color="#f59e0b" /></motion.span>
            }
          </AnimatePresence>
        </motion.button>
      </div>

      <motion.button whileTap={{ scale: 0.96 }} onClick={onShare}
        style={{
          width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))',
          border: '1px solid rgba(0,212,255,0.35)', color: '#00d4ff',
          fontSize: 13, fontWeight: 800, fontFamily: 'Orbitron, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          letterSpacing: '0.06em',
        }}>
        <Share2 size={15} /> SHARE VIA TELEGRAM
      </motion.button>

      {children}

      <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: '12px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
        No bots -- only friends with this code can join
      </p>

      <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 14 }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={{ scale: [1, 1.6, 1], opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.1, delay: i * 0.18, repeat: loopCount() }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }}
          />
        ))}
      </div>
    </motion.div>
  );
}
