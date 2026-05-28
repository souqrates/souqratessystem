import { motion } from 'framer-motion';
import { Trophy, Lock } from 'lucide-react';

export default function Achievements() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 relative"
        style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)' }}
      >
        <Trophy size={36} style={{ color: '#eab308' }} />
        <div
          className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(234,179,8,0.3)' }}
        >
          <Lock size={14} style={{ color: '#eab308' }} />
        </div>
      </div>

      <h2
        className="font-orbitron text-xl font-black tracking-wide mb-3"
        style={{ color: '#eab308' }}
      >
        ACHIEVEMENTS
      </h2>
      <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(148,163,184,0.85)' }}>
        Coming Soon
      </p>
      <p className="text-xs max-w-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
        Unlock milestones, earn XP badges, and climb the hall of fame. This feature is on its way.
      </p>

      <div
        className="mt-8 px-5 py-3 rounded-2xl"
        style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.18)' }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(234,179,8,0.7)' }}>
          Your XP &amp; Rank progress is already being tracked ↑
        </p>
      </div>
    </motion.div>
  );
}
