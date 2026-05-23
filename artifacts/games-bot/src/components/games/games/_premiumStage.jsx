import { useMemo, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getDeviceTier } from '../../../lib/deviceProfile';

const tier = getDeviceTier();
const isLow = tier === 'low';
const isMid = tier === 'mid';
const isReduced = isLow || isMid;

// Cinematic backdrop + ambient particles + glow ring.
// Drop it as the outermost element of a game's render tree; children sit on top.
export default function PremiumStage({
  accent = '#00d4ff',
  accent2 = '#a855f7',
  particles = 18,
  vignette = true,
  ring = true,
  children,
}) {
  // Reduce or eliminate particles based on device tier
  const particleCount = isLow ? 0 : isMid ? 4 : particles;

  const dots = useMemo(
    () => Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.4,
      delay: Math.random() * 6,
      dur: 8 + Math.random() * 10,
      color: i % 2 ? accent : accent2,
      opacity: 0.18 + Math.random() * 0.35,
    })),
    [particleCount, accent, accent2],
  );

  return (
    <div style={{ position: 'relative', isolation: 'isolate' }}>
      {/* Backdrop gradient + aurora sweep */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: -12, zIndex: 0, borderRadius: 20, overflow: 'hidden',
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at 20% 0%, ${accent}1f, transparent 55%),
                       radial-gradient(ellipse at 85% 100%, ${accent2}1c, transparent 55%),
                       linear-gradient(160deg, #050912 0%, #02050b 60%, #01020a 100%)`,
        }}
      >
        {/* Aurora sweep — disabled on low/mid devices (blur(38px) + infinite is too expensive) */}
        {!isReduced && (
          <motion.div
            aria-hidden
            animate={{ x: ['-30%', '110%'] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', top: '-20%', left: 0, width: '40%', height: '140%',
              background: `linear-gradient(110deg, transparent 0%, ${accent}10 45%, ${accent2}14 55%, transparent 100%)`,
              filter: 'blur(38px)', mixBlendMode: 'screen',
              willChange: 'transform',
            }}
          />
        )}
        {/* Soft conic spotlight — disabled on low/mid (blur(60px) + rotate Infinity is very heavy) */}
        {!isReduced && (
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', inset: '-30%',
              background: `conic-gradient(from 0deg, ${accent}05, transparent 25%, ${accent2}06, transparent 75%, ${accent}05)`,
              filter: 'blur(60px)', opacity: 0.7, mixBlendMode: 'screen',
              willChange: 'transform',
            }}
          />
        )}
        {/* Lightweight static tint for low/mid devices */}
        {isReduced && (
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(160deg, ${accent}0a 0%, transparent 50%, ${accent2}08 100%)`,
            }}
          />
        )}
      </div>

      {/* Ambient particles — count reduced/zero on weaker devices */}
      {particleCount > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
            borderRadius: 18,
          }}
        >
          {dots.map(d => (
            <motion.span
              key={d.id}
              animate={{ y: [0, -22, 0], opacity: [d.opacity, d.opacity * 1.6, d.opacity] }}
              transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                left: `${d.x}%`, top: `${d.y}%`,
                width: d.size, height: d.size, borderRadius: '50%',
                background: d.color,
                boxShadow: `0 0 ${6 + d.size * 2}px ${d.color}`,
                opacity: d.opacity,
                willChange: 'transform, opacity',
              }}
            />
          ))}
        </div>
      )}

      {/* Vignette frame */}
      {vignette && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', borderRadius: 18,
            boxShadow: `inset 0 0 80px rgba(0,0,0,0.55), inset 0 0 24px ${accent}14`,
          }}
        />
      )}

      {/* Glow ring — opacity pulse disabled on low devices */}
      {ring && (
        isLow ? (
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: -1, zIndex: 0, pointerEvents: 'none', borderRadius: 19,
              border: `1px solid ${accent}40`,
            }}
          />
        ) : (
          <motion.div
            aria-hidden
            animate={{ opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: -1, zIndex: 0, pointerEvents: 'none', borderRadius: 19,
              border: `1px solid ${accent}40`,
              boxShadow: `0 0 0 1px ${accent2}18, 0 30px 80px -20px ${accent}30, 0 0 60px -20px ${accent2}40`,
              willChange: 'opacity',
            }}
          />
        )
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

// Reusable premium HUD card — looks polished and consistent across games.
export function PremiumHud({ label, value, color = '#00d4ff', pulse = false, big = false }) {
  const prevRef = useRef(value);
  const [anim, setAnim] = useState({ scale: 1, opacity: 1 });

  useEffect(() => {
    if (!pulse || value === prevRef.current) { prevRef.current = value; return; }
    prevRef.current = value;
    setAnim({ scale: 1.18, opacity: 0.75 });
    const t = requestAnimationFrame(() => setAnim({ scale: 1, opacity: 1 }));
    return () => cancelAnimationFrame(t);
  }, [value, pulse]);

  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${color}0e, ${color}03)`,
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: big ? '10px 0' : '7px 0',
      textAlign: 'center',
      overflow: 'hidden',
      backdropFilter: isLow ? 'none' : 'blur(6px)',
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at top, ${color}18, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <p style={{ position: 'relative', fontSize: 8, color: `${color}90`, margin: 0, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 800 }}>{label}</p>
      <motion.p
        animate={pulse ? anim : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{ position: 'relative', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: big ? 26 : 22, color, margin: 0, textShadow: `0 0 12px ${color}66` }}>
        {value}
      </motion.p>
    </div>
  );
}
