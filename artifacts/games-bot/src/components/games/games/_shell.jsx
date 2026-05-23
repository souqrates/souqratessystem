import { useEffect, useRef, useState, useCallback } from 'react';

export function Hud({ label, v, c = '#fff' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '6px 0', textAlign: 'center', flexShrink: 0 }}>
      <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.78)', letterSpacing: '0.18em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color: c, margin: 0, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 12px ${c}55` }}>{v}</p>
    </div>
  );
}

export function HudRow({ children }) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 3;
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 6, flexShrink: 0 }}>{children}</div>;
}

export function Stage({ children, bg = 'radial-gradient(ellipse at center, #0a0420 0%, #02010a 100%)', border = 'rgba(255,255,255,0.08)' }) {
  return (
    <div style={{
      position: 'relative',
      flex: 1,
      minHeight: 0,
      padding: 8,
      borderRadius: 14,
      overflow: 'hidden',
      background: bg,
      border: `1px solid ${border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {children}
    </div>
  );
}

/**
 * useResponsiveCanvas — sizes a canvas to fill its container with a given aspect ratio.
 * Returns [canvasRef, width, height] where width/height are the logical canvas dimensions.
 * aspectRatio: width/height — e.g. 1 for square, 4/3 for landscape, 3/4 for portrait
 * maxH: optional max height cap (px)
 */
export function useResponsiveCanvas(aspectRatio = 1, maxH = 9999) {
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 320, h: 320 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      const container = wrapRef.current;
      if (!container) return;
      const cw = container.clientWidth || 320;
      const w = cw;
      const h = Math.min(Math.round(w / aspectRatio), maxH);
      setDims({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [aspectRatio, maxH]);

  return [wrapRef, dims.w, dims.h];
}

/**
 * GameShell — top-level wrapper for every solo game.
 * Provides flex column layout that fills the play area exactly.
 * stageHeight: passed from GameModal (px). Games use this to derive canvas height.
 */
export function GameShell({ children, stageHeight }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height: stageHeight > 0 ? stageHeight : '100%',
      minHeight: 0,
      overflow: 'hidden',
      padding: '0 2px',
    }}>
      {children}
    </div>
  );
}

export function Rules({ text }) {
  return <p style={{ color: 'rgba(203,213,225,0.92)', fontSize: 14, lineHeight: 1.65 }}>{text}</p>;
}

/**
 * TimeBar — slim visual countdown bar above gameplay.
 * totalTime: full duration in seconds
 * timeLeft: remaining seconds
 * color: optional override (auto-shifts green→amber→red)
 */
export function TimeBar({ totalTime, timeLeft, color }) {
  const pct = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
  const c = color || (pct > 50 ? '#10b981' : pct > 25 ? '#f59e0b' : '#ef4444');
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: `linear-gradient(90deg, ${c}aa, ${c})`,
        boxShadow: `0 0 8px ${c}88`,
        borderRadius: 99,
        transition: 'width 0.9s linear, background 0.5s ease',
      }} />
    </div>
  );
}

/**
 * MomentumFlash — floating text that pops up to reward milestones.
 * Show when score crosses thresholds or combo fires.
 * msg: text to show (e.g. "ON FIRE!", "GREAT!")
 * color: accent color
 * trigger: any changing value that triggers a new flash
 */
export function MomentumFlash({ msg, color = '#ffcc00', trigger }) {
  const [text, setText] = useState('');
  const [key, setKey] = useState(0);
  const prevRef = useRef(trigger);

  useEffect(() => {
    if (trigger !== prevRef.current && msg) {
      prevRef.current = trigger;
      setText(msg);
      setKey(k => k + 1);
    }
  }, [trigger, msg]);

  if (!text) return null;

  return (
    <div key={key} style={{
      position: 'absolute', top: '30%', left: '50%',
      pointerEvents: 'none', zIndex: 100,
      fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20,
      color, textShadow: `0 0 20px ${color}`,
      animation: 'hudFlash 0.7s ease-out forwards',
    }}>
      {text}
      <style>{`
        @keyframes hudFlash {
          0%   { opacity:0; transform:translateX(-50%) translateY(6px) scale(0.8); }
          20%  { opacity:1; transform:translateX(-50%) translateY(0px) scale(1.1); }
          70%  { opacity:1; transform:translateX(-50%) translateY(-4px) scale(1); }
          100% { opacity:0; transform:translateX(-50%) translateY(-14px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}

/**
 * VsBar — shows YOU score vs OPPONENT score in a tug-of-war bar.
 * Useful for any 1v1 game to show who's ahead visually.
 */
export function VsBar({ myScore, oppScore, myColor = '#00f5a0', oppColor = '#ff3355' }) {
  const total = Math.max(1, myScore + oppScore);
  const myPct = (myScore / total) * 100;
  const ahead = myScore > oppScore;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${myPct}%`,
          background: `linear-gradient(90deg, ${myColor}aa, ${myColor})`,
          boxShadow: `0 0 10px ${myColor}88`,
          borderRadius: 99,
          transition: 'width 0.4s ease',
        }} />
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: '50%', marginLeft: -1, width: 2, background: 'rgba(255,255,255,0.2)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em' }}>
        <span style={{ color: ahead ? myColor : 'rgba(148,163,184,0.4)' }}>YOU{ahead ? ' ▲' : ''}</span>
        <span style={{ color: !ahead ? oppColor : 'rgba(148,163,184,0.4)' }}>{!ahead ? '▲ ' : ''}OPP</span>
      </div>
    </div>
  );
}

/**
 * TargetBar — premium target/score progress bar.
 * Shows current score vs target (win threshold = 2/3 of max possible).
 * Pulses gold when reached, red when impossible (time-based games).
 */
export function TargetBar({ score = 0, target = 100, max = 150, label = 'TARGET' }) {
  const pct = Math.min(100, Math.max(0, (score / target) * 100));
  const reached = score >= target;
  const color = reached ? '#10b981' : score >= target * 0.66 ? '#f59e0b' : '#00d4ff';
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(180deg, rgba(15,22,38,0.95) 0%, rgba(6,10,18,0.95) 100%)',
      border: `1px solid ${color}55`,
      borderRadius: 12,
      padding: '8px 12px',
      boxShadow: reached ? `0 0 24px ${color}55, inset 0 1px 0 rgba(255,255,255,0.06)` : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      overflow: 'hidden',
      willChange: 'box-shadow',
      transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.25em', fontWeight: 800, color: `${color}cc`, fontFamily: 'Orbitron, sans-serif' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em' }}>
          <span style={{ color, textShadow: `0 0 8px ${color}` }}>{score}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}> / {target}</span>
          {max && max !== target ? <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9, marginLeft: 4 }}>(max {max})</span> : null}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          width: `${pct}%`,
          background: reached
            ? `linear-gradient(90deg, ${color}, #fff, ${color})`
            : `linear-gradient(90deg, ${color}aa, ${color})`,
          boxShadow: `0 0 12px ${color}`,
          transition: 'width 0.25s ease',
          borderRadius: 99,
        }} />
        <div style={{
          position: 'absolute', top: -2, bottom: -2, left: '100%',
          width: 2, background: '#fff',
          boxShadow: '0 0 6px #fff',
        }} />
      </div>
      {reached && (
        <p style={{ margin: '4px 0 0', fontSize: 8, letterSpacing: '0.25em', fontWeight: 800, color, fontFamily: 'Orbitron, sans-serif', textAlign: 'center' }}>
          TARGET CLEARED · PRIZE LOCKED
        </p>
      )}
    </div>
  );
}
