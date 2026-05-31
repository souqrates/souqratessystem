import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Lang } from '../lib/i18n';
import { playTicket } from '../lib/useSound';

interface FlyNum { id: number; x: number; amount: number }
interface Toast  { name: string; amt: number }

const DEMO_NAMES = [
  'أحمد م.','Sarah K.','خالد ر.','Omar B.','نورة س.',
  'Fatima A.','محمد ع.','Ali H.','سارة ع.','Yousef K.',
];

interface Props {
  jackpot: number; coinTrigger: number;
  lang: Lang; participants: number; onClick: () => void;
}

export default function JackpotCounter({ jackpot, coinTrigger, lang, participants, onClick }: Props) {
  const [display, setDisplay]   = useState(jackpot);
  const [toast,   setToast]     = useState<Toast | null>(null);
  const [flyNums, setFlyNums]   = useState<FlyNum[]>([]);
  const [burst,   setBurst]     = useState(false);
  const [pulse,   setPulse]     = useState(false);
  const isRtl = lang === 'ar';
  const nextId  = useRef(0);
  const animRef = useRef<number | undefined>(undefined);
  const prevJackpot = useRef(jackpot);

  useEffect(() => {
    const start = prevJackpot.current;
    const end   = jackpot;
    prevJackpot.current = jackpot;
    if (start === end) return;
    const duration  = 900;
    const startTime = performance.now();
    const step = (now: number) => {
      const p      = Math.min(1, (now - startTime) / duration);
      const eased  = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [jackpot]);

  function spawnFlyNum(amt: number) {
    const id = ++nextId.current;
    const x  = 15 + Math.random() * 70;
    setFlyNums(f => [...f, { id, x, amount: amt }]);
    setTimeout(() => setFlyNums(f => f.filter(n => n.id !== id)), 1500);
  }

  useEffect(() => {
    if (coinTrigger <= 0) return;
    playTicket();
    setBurst(true); setPulse(true);
    setTimeout(() => setBurst(false), 700);
    setTimeout(() => setPulse(false), 400);
    spawnFlyNum([5,10,15,20][Math.floor(Math.random() * 4)]);
  }, [coinTrigger]);

  useEffect(() => {
    const iv = setInterval(() => {
      const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
      const amt  = [5, 10, 15, 20][Math.floor(Math.random() * 4)];
      setToast({ name, amt });
      spawnFlyNum(amt);
      setTimeout(() => setToast(null), 2800);
    }, 3800 + Math.random() * 2200);
    return () => clearInterval(iv);
  }, []);

  const formatted = display.toLocaleString();
  const digits    = formatted.split('');

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '20px 16px 16px',
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <motion.div
        animate={{ opacity: [0.12, 0.38, 0.12], scale: [1, 1.1, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '130%', height: '130%', borderRadius: '50%',
          background: 'radial-gradient(ellipse, #f59e0b22 0%, #f59e0b06 50%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      {/* Burst ring */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key="burst"
            initial={{ scale: 0.5, opacity: 0.9 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 100, height: 100, borderRadius: '50%',
              border: '2.5px solid #fbbf24',
              pointerEvents: 'none', zIndex: 5,
            }}
          />
        )}
      </AnimatePresence>

      {/* Flying +N */}
      <AnimatePresence>
        {flyNums.map(fn => (
          <motion.div
            key={fn.id}
            initial={{ opacity: 1, y: 20 }}
            animate={{ opacity: 0, y: -55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: '55%', left: `${fn.x}%`,
              fontFamily: '"Orbitron",sans-serif', fontSize: 17, fontWeight: 900,
              color: '#22c55e', textShadow: '0 0 10px #22c55e88',
              pointerEvents: 'none', zIndex: 10,
            }}
          >
            +{fn.amount}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={`${toast.name}-${toast.amt}`}
            initial={{ opacity: 0, y: 10, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.92 }}
            style={{
              position: 'absolute', top: 6, zIndex: 30,
              background: 'rgba(4,10,4,0.96)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 22, padding: '4px 14px',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 20px rgba(34,197,94,0.14)',
              backdropFilter: 'blur(10px)',
              whiteSpace: 'nowrap', color: '#4ade80',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e', display: 'inline-block' }} />
            <span style={{ color: '#e2e8f0' }}>{toast.name}</span>
            <span>{isRtl ? `اشترى · +${toast.amt}` : `bought · +${toast.amt}`} SKZ</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JACKPOT label */}
      <motion.div
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          fontSize: 11, letterSpacing: '0.22em', color: '#f59e0b',
          fontFamily: '"Orbitron",sans-serif', fontWeight: 700,
          textShadow: '0 0 16px #f59e0bbb', marginBottom: 10,
          textAlign: 'center',
        }}
      >
        🏆 {isRtl ? 'الجائزة الكبرى' : 'JACKPOT PRIZE'}
      </motion.div>

      {/* Giant rolling counter */}
      <motion.div
        animate={pulse
          ? { scale: [1, 1.09, 1], filter: ['drop-shadow(0 0 20px #f59e0baa)', 'drop-shadow(0 0 44px #fbbf24cc)', 'drop-shadow(0 0 20px #f59e0baa)'] }
          : { scale: [1, 1.014, 1], filter: ['drop-shadow(0 0 20px #f59e0b88)', 'drop-shadow(0 0 28px #f59e0baa)', 'drop-shadow(0 0 20px #f59e0b88)'] }
        }
        transition={pulse ? { duration: 0.4 } : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}
      >
        {/* Digit-by-digit for slot-machine feel */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
          {digits.map((ch, i) => (
            <AnimatePresence key={`${i}-${ch}`} mode="popLayout">
              <motion.span
                key={`${i}-${ch}`}
                initial={{ y: ch !== ',' ? -28 : 0, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 28, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{
                  fontFamily: '"Orbitron",sans-serif',
                  fontSize: ch === ',' ? 40 : 68,
                  fontWeight: 900,
                  background: 'linear-gradient(180deg,#fef9c3 0%,#fbbf24 38%,#f59e0b 70%,#d97706 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  lineHeight: 1, display: 'inline-block',
                  letterSpacing: ch === ',' ? '0.02em' : '-0.02em',
                }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          ))}
        </div>

        {/* SKZ label */}
        <div style={{
          fontSize: 13, color: '#fbbf24',
          fontFamily: '"Orbitron",sans-serif', fontWeight: 700,
          letterSpacing: '0.14em', marginTop: 2, opacity: 0.88,
        }}>
          SKZ
        </div>
      </motion.div>

      {/* Progress bar (visual fill indicator) */}
      <div style={{ width: '80%', marginTop: 14, position: 'relative' }}>
        <div style={{
          height: 4, borderRadius: 4,
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.15)',
          overflow: 'hidden',
        }}>
          <motion.div
            animate={{ width: `${Math.min(100, 40 + (jackpot / 25000) * 60)}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg,#f59e0b,#fbbf24,#fef9c3)',
              boxShadow: '0 0 8px #f59e0b88',
            }}
          />
        </div>
      </div>

      {/* Participants */}
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center',
        gap: 6, fontSize: 11, color: '#78716c',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e', boxShadow: '0 0 5px #22c55e',
          display: 'inline-block',
        }} />
        <span>{participants.toLocaleString()} {isRtl ? 'مشارك' : 'participants'}</span>
        <span style={{ color: '#334155' }}>·</span>
        <span style={{ color: '#f59e0b80' }}>
          {isRtl ? 'اضغط للانضمام ↓' : 'Tap to join ↓'}
        </span>
      </div>

      {/* Bottom divider glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: '5%', right: '5%',
        height: 1,
        background: 'linear-gradient(90deg,transparent,#f59e0b44,transparent)',
      }} />
    </div>
  );
}
