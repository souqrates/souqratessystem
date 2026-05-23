import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getDeviceTier } from '../lib/deviceProfile';

const LOGO_SRC = '/WhatsApp_Image_2026-05-20_at_4.16.36_AM.jpeg';
const tier = getDeviceTier();

export default function SplashScreen({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const total = tier === 'high' ? 1800 : tier === 'mid' ? 2200 : 2600;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / total) * 100));
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 200);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{ background: '#04030a' }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35, ease: 'easeIn' }}
    >
      {/* Deep background radial — midnight blue matching logo */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #0a0d2e 0%, #04030a 70%)',
      }} />

      {/* Subtle star-field particles */}
      {tier === 'high' && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.45 }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: i % 3 === 0 ? 2 : 1,
              height: i % 3 === 0 ? 2 : 1,
              borderRadius: '50%',
              background: i % 4 === 0 ? '#c9a227' : '#7ba7ff',
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              animation: `twinkle ${1.8 + (i % 5) * 0.4}s ease-in-out ${(i * 0.17) % 1.5}s infinite alternate`,
            }} />
          ))}
        </div>
      )}

      {/* Logo image — circular, centered, prominent */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 160,
      }}>
        {/* Gold ring glow behind image */}
        <div style={{
          position: 'relative',
          width: 'min(72vw, 300px)',
          height: 'min(72vw, 300px)',
        }}>
          {/* Outer glow ring */}
          <div style={{
            position: 'absolute',
            inset: -10,
            borderRadius: '50%',
            background: 'transparent',
            boxShadow: '0 0 40px 12px rgba(201,162,39,0.35), 0 0 80px 20px rgba(59,99,255,0.18)',
            animation: tier === 'high' ? 'pulseRing 2.6s ease-in-out infinite' : 'none',
          }} />

          {/* Gold border ring */}
          <div style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #c9a227 0%, #ffd86b 30%, #8b6914 55%, #ffd86b 75%, #c9a227 100%)',
            padding: 3,
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#04030a',
            }} />
          </div>

          {/* The logo image */}
          <img
            src={LOGO_SRC}
            alt="Skill Games"
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              objectPosition: 'center',
              userSelect: 'none',
              display: 'block',
            }}
          />

          {/* Inner vignette on logo */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: 'inset 0 0 28px rgba(4,3,10,0.5)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* App name below logo */}
        <div style={{
          marginTop: 24,
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(20px, 6vw, 26px)',
            letterSpacing: '0.12em',
            background: 'linear-gradient(180deg, #fff8d6 0%, #ffd86b 45%, #a06c10 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
            lineHeight: 1.1,
          }}>
            SOUQRATES SKILLZ
          </div>
          <div style={{
            marginTop: 6,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: '0.35em',
            color: 'rgba(123,167,255,0.75)',
            textTransform: 'uppercase',
          }}>
            Compete &amp; Earn
          </div>
        </div>
      </div>

      {/* Bottom gradient for bar legibility */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        height: '28%',
        background: 'linear-gradient(180deg, rgba(4,3,10,0) 0%, rgba(4,3,10,0.85) 60%, rgba(4,3,10,1) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Counter + progress bar section */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        bottom: 'calc(env(safe-area-inset-bottom) + 28px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        paddingLeft: 32,
        paddingRight: 32,
      }}>
        {/* Numeric counter */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 3,
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          lineHeight: 1,
        }}>
          <span style={{
            fontSize: 'clamp(44px, 12vw, 58px)',
            background: 'linear-gradient(180deg, #fff8d6 0%, #ffd86b 45%, #b8800b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 18px rgba(255,191,73,0.5))',
            letterSpacing: '0.02em',
            minWidth: '2.2ch',
            textAlign: 'right',
            display: 'inline-block',
          }}>
            {progress}
          </span>
          <span style={{
            fontSize: 18,
            color: 'rgba(255,216,107,0.8)',
            filter: 'drop-shadow(0 0 8px rgba(255,191,73,0.55))',
            letterSpacing: '0.08em',
          }}>
            %
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(201,162,39,0.2)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <motion.div
            style={{
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #1a3a9e 0%, #3b63ff 25%, #c9a227 55%, #ffd700 75%, #fff3a3 88%, #ffd700 100%)',
              boxShadow: '0 0 12px rgba(255,215,0,0.6), 0 0 4px rgba(59,99,255,0.6)',
              width: `${progress}%`,
            }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
          {tier === 'high' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 35%, rgba(255,255,255,0.3) 50%, transparent 65%)',
              animation: 'splashSheen 1.6s ease-in-out infinite',
              borderRadius: 999,
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Loading label */}
        <div style={{
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: '0.45em',
          color: 'rgba(123,167,255,0.6)',
          textTransform: 'uppercase',
        }}>
          {progress < 40 ? 'INITIALIZING' : progress < 75 ? 'LOADING ARENA' : progress < 95 ? 'ALMOST READY' : 'ENTERING ARENA'}
        </div>
      </div>

      <style>{`
        @keyframes splashSheen {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(150%); }
        }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.03); }
        }
        @keyframes twinkle {
          0%   { opacity: 0.2; transform: scale(0.8); }
          100% { opacity: 1;   transform: scale(1.4); }
        }
      `}</style>
    </motion.div>
  );
}
