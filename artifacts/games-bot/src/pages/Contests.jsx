import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';

const container = { animate: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
const item = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

export default function Contests() {
  const { language } = useAppStore();
  return (
    <motion.div className="px-4 pt-5 pb-6 space-y-4 relative z-10" variants={container} initial="initial" animate="animate">
      <motion.div variants={item} className="flex items-center gap-2.5">
        <Trophy size={17} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }} />
        <h1 className="font-orbitron text-base font-black text-white tracking-widest">Contests</h1>
      </motion.div>
      <motion.div variants={item} className="glass-card rounded-2xl p-10 text-center space-y-3">
        <Trophy size={40} color="rgba(251,191,36,0.85)" strokeWidth={1.5} />
        <p className="font-orbitron text-sm font-black text-white">Coming Soon</p>
        <p className="text-xs" style={{ color: 'rgba(148,163,184,0.55)', lineHeight: 1.6 }}>
          Competitive contests with big prize pools are coming. Stay tuned!
        </p>
      </motion.div>
    </motion.div>
  );
}
