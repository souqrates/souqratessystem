import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const LOGO_SRC = import.meta.env.BASE_URL + 'souqrates-logo.webp';

export default function SplashScreen({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [phase,    setPhase]    = useState('in'); // in | count | out
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Phase: in → count after 500ms
  useEffect(() => {
    const t = setTimeout(() => setPhase('count'), 500);
    return () => clearTimeout(t);
  }, []);

  // Phase: count → progress 0→100 over ~2s (eased)
  useEffect(() => {
    if (phase !== 'count') return;
    const duration = 2000;
    const steps    = 100;
    const interval = duration / steps;
    let current    = 0;
    const timer    = setInterval(() => {
      current += 1;
      const eased = Math.round(100 * (1 - Math.pow(1 - current / steps, 2)));
      setProgress(eased);
      if (current >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setPhase('out');
          setTimeout(() => onDoneRef.current?.(), 500);
        }, 300);
      }
    }, interval);
    // Hard safety valve
    const hard = setTimeout(() => { clearInterval(timer); onDoneRef.current?.(); }, 5000);
    return () => { clearInterval(timer); clearTimeout(hard); };
  }, [phase]);

  const skip = () => onDoneRef.current?.();

  return (
    <AnimatePresence>
      {phase !== 'out' && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 38%, #0d0a1e 0%, #060412 55%, #020208 100%)',
            cursor: 'pointer',
          }}
          onClick={skip}
          onTouchEnd={skip}
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.72, opacity: 0, y: 20 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            transition={{ delay: 0.08, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: 28 }}
          >
            <img
              src={LOGO_SRC}
              alt="SOUQRATES SKILLZ"
              draggable={false}
              style={{
                display: 'block',
                width: 'min(88vw, 380px)',
                height: 'auto',
                objectFit: 'contain',
                userSelect: 'none',
                filter: 'drop-shadow(0 6px 28px rgba(34,211,238,0.3)) drop-shadow(0 2px 8px rgba(201,162,39,0.2))',
              }}
            />
          </motion.div>

          {/* Brand name */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ delay: 0.38, duration: 0.48 }}
            style={{ textAlign: 'center', marginBottom: 36 }}
          >
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(18px, 5.5vw, 24px)',
              letterSpacing: '0.14em',
              background: 'linear-gradient(180deg, #fff8d6 0%, #ffd86b 45%, #a06c10 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}>
              SOUQRATES SKILLZ
            </div>
            <div style={{
              marginTop: 7,
              fontFamily: 'Space Grotesk, Inter, sans-serif',
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: '0.38em',
              color: 'rgba(34,211,238,0.65)',
              textTransform: 'uppercase',
            }}>
              Compete &amp; Earn
            </div>
          </motion.div>

          {/* Counter + progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'count' ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '0 40px',
            }}
          >
            {/* Numeric counter */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(42px, 11vw, 54px)',
                background: 'linear-gradient(180deg, #fff8d6 0%, #ffd86b 45%, #c9a227 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 16px rgba(255,191,73,0.5))',
                minWidth: '2.2ch',
                textAlign: 'right',
                display: 'inline-block',
                lineHeight: 1,
              }}>
                {progress}
              </span>
              <span style={{ fontSize: 18, color: 'rgba(255,216,107,0.75)', fontWeight: 700 }}>%</span>
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 5,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(34,211,238,0.2)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: 999,
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #0891b2, #22d3ee 35%, #c9a227 65%, #fff3a3 85%, #ffd700 100%)',
                boxShadow: '0 0 10px rgba(34,211,238,0.5), 0 0 4px rgba(201,162,39,0.5)',
                transition: 'width 0.05s linear',
              }} />
            </div>

            {/* Loading label */}
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: '0.42em',
              color: 'rgba(34,211,238,0.55)',
              textTransform: 'uppercase',
            }}>
              {progress < 40 ? 'INITIALIZING' : progress < 75 ? 'LOADING ARENA' : progress < 95 ? 'ALMOST READY' : 'ENTERING ARENA'}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
