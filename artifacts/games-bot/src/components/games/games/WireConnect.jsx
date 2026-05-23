import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { beep, chord, noise } from './_gameKit';
import { Hud, HudRow, Rules } from './_shell';

const RULES = 'WIRE CONNECT — Pair colored ports across the panel. Boards grow more crowded as you progress. Each board has its own timer. Mistakes drain points and break the streak. 60 seconds.';
const COLORS = ['#ff3355', '#ffcc00', '#00f5a0', '#00f5ff', '#ff66cc', '#ffa040'];

function genPanel(count) {
  const palette = COLORS.slice(0, count);
  const left = [...palette].sort(() => Math.random() - 0.5);
  const right = [...palette].sort(() => Math.random() - 0.5);
  return { left, right };
}

export default function WireConnect({ phase, setPhase, onScoreUpdate }) {
  const [portCount, setPortCount] = useState(5);
  const [panel, setPanel] = useState(genPanel(5));
  const [connected, setConnected] = useState([]);
  const [pending, setPending] = useState(null);
  const [score, setScore] = useState(0); const [time, setTime] = useState(60); const [solves, setSolves] = useState(0);
  const [panelTime, setPanelTime] = useState(12);
  const [shake, setShake] = useState(0);
  const [overlay, setOverlay] = useState(null);
  const scoreRef = useRef(0); const activeRef = useRef(false); const startRef = useRef(0);
  const solvesRef = useRef(0);

  const newPanel = () => {
    const n = Math.min(7, 5 + Math.floor(solvesRef.current / 2));
    setPortCount(n);
    setPanel(genPanel(n));
    setConnected([]); setPending(null);
    const t = Math.max(5, 12 - Math.floor(solvesRef.current * 1.1));
    setPanelTime(t);
    startRef.current = Date.now();
  };

  const flashOverlay = (color, ms = 280) => {
    const id = Math.random();
    setOverlay({ id, color });
    setTimeout(() => setOverlay(o => (o && o.id === id ? null : o)), ms);
  };
  const kick = (n = 6) => {
    setShake(n);
    setTimeout(() => setShake(0), 220);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0; solvesRef.current = 0;
    setScore(0); setTime(60); setSolves(0); activeRef.current = true;
    newPanel();
    const iv = setInterval(() => setTime(t => {
      if (t <= 1) { activeRef.current = false; clearInterval(iv); onScoreUpdate?.(scoreRef.current); setTimeout(() => setPhase('won'), 300); return 0; }
      return t - 1;
    }), 1000);
    const pv = setInterval(() => setPanelTime(t => {
      if (!activeRef.current) return t;
      if (t <= 1) {
        scoreRef.current = Math.max(0, scoreRef.current - 12);
        setScore(scoreRef.current);
        beep({ freq: 160, dur: 0.24, type: 'sawtooth', sweepTo: 50 });
        noise({ dur: 0.18, vol: 0.22 });
        triggerHaptic('error');
        flashOverlay('rgba(255,51,85,0.28)', 380);
        kick(10);
        newPanel();
        return Math.max(5, 12 - Math.floor(solvesRef.current * 1.1));
      }
      return t - 1;
    }), 1000);
    return () => { clearInterval(iv); clearInterval(pv); activeRef.current = false; };
    // eslint-disable-next-line
  }, [phase]);

  const tap = (side, idx) => {
    if (!activeRef.current) return;
    if (connected.some(c => c.side === side && c.idx === idx)) return;
    const color = side === 'L' ? panel.left[idx] : panel.right[idx];
    if (!pending) {
      setPending({ side, idx, color });
      beep({ freq: 400, dur: 0.05 });
      triggerHaptic('light');
      return;
    }
    if (pending.side === side) { setPending({ side, idx, color }); beep({ freq: 400, dur: 0.05 }); return; }
    if (pending.color === color) {
      const newC = [...connected, pending, { side, idx, color }];
      setConnected(newC);
      scoreRef.current += 25; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 700, dur: 0.1, type: 'triangle' }); triggerHaptic('light');
      setPending(null);
      if (newC.length >= portCount * 2) {
        const dt = (Date.now() - startRef.current) / 1000;
        const speed = Math.max(0, Math.floor((panelTime + 4 - dt) * 8));
        scoreRef.current += 40 + speed; setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
        solvesRef.current += 1; setSolves(solvesRef.current);
        chord([784, 1175, 1568, 2093], 0.22, 0.2, 'triangle');
        triggerHaptic('success');
        flashOverlay('rgba(0,245,160,0.22)', 360);
        setTimeout(() => { if (activeRef.current) newPanel(); }, 380);
      }
    } else {
      const penalty = 5 + Math.floor(scoreRef.current / 180);
      scoreRef.current = Math.max(0, scoreRef.current - penalty); setScore(scoreRef.current); onScoreUpdate?.(scoreRef.current);
      beep({ freq: 180, dur: 0.2, type: 'sawtooth', sweepTo: 60 });
      noise({ dur: 0.14, vol: 0.18 });
      triggerHaptic('error');
      flashOverlay('rgba(255,51,85,0.22)', 280);
      kick(8);
      setPending(null);
    }
  };

  if (phase === 'rules') return <Rules text={RULES} />;

  const port = (color, side, idx, active) => {
    const isConnected = connected.some(c => c.side === side && c.idx === idx);
    return (
      <button
        onPointerDown={() => tap(side, idx)}
        disabled={isConnected}
        style={{
          padding: '14px 0', borderRadius: 12,
          border: `2px solid ${active ? '#fff' : color}`,
          background: isConnected
            ? `linear-gradient(135deg, ${color}, ${color}55)`
            : active
              ? `radial-gradient(circle, ${color}, ${color}88)`
              : `radial-gradient(circle at 30% 30%, ${color}55, ${color}10 70%)`,
          color: '#fff', fontWeight: 900, fontFamily: 'Orbitron, sans-serif',
          fontSize: 22, cursor: isConnected ? 'default' : 'pointer',
          boxShadow: active
            ? `0 0 22px ${color}, inset 0 0 14px ${color}aa`
            : isConnected
              ? `0 0 8px ${color}88`
              : `0 0 12px ${color}55, inset 0 0 10px ${color}33`,
          opacity: isConnected ? 0.55 : 1,
          transition: 'all 0.15s',
          position: 'relative',
        }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: `0 0 8px #fff`, opacity: isConnected ? 0.6 : 0.9 }} />
      </button>
    );
  };

  // SVG wires between connected pairs
  const wirePairs = [];
  for (let i = 0; i < connected.length; i += 2) {
    const a = connected[i], b = connected[i + 1];
    if (!a || !b) continue;
    const L = a.side === 'L' ? a : b;
    const R = a.side === 'R' ? a : b;
    wirePairs.push({ L, R, color: a.color });
  }

  // Approximate positions for wires
  const rowH = 56; const baseY = 14;
  const yFor = (i) => baseY + i * rowH + rowH / 2 - 6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#00f5ff" />
        <Hud label="TIME" v={`${time}s`} c={time <= 10 ? '#ff3355' : '#fff'} />
        <Hud label="BOARDS" v={solves} c="#ffcc00" />
      </HudRow>

      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(0,245,255,0.07), rgba(0,0,0,0.4))',
        borderRadius: 18, border: '1px solid rgba(0,245,255,0.22)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.55), inset 0 0 30px rgba(0,245,255,0.06)',
        padding: 12,
        transform: shake ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` : 'none',
        transition: 'transform 0.06s',
        overflow: 'hidden',
      }}>
        <AnimatePresence>
          {overlay && (
            <motion.div
              key={overlay.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ position: 'absolute', inset: 0, background: overlay.color, pointerEvents: 'none', zIndex: 5, borderRadius: 18 }}
            />
          )}
        </AnimatePresence>
        {/* Panel timer bar */}
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', width: `${(panelTime / Math.max(7, 12 - Math.floor(solvesRef.current * 0.8))) * 100}%`,
            background: panelTime <= 3 ? 'linear-gradient(90deg,#ff3355,#ff9900)' : 'linear-gradient(90deg,#00f5ff,#00f5a0)',
            transition: 'width 0.4s linear',
            boxShadow: panelTime <= 3 ? '0 0 10px #ff3355' : '0 0 10px #00f5ff',
          }} />
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {panel.left.map((c, i) => port(c, 'L', i, pending?.side === 'L' && pending.idx === i))}
          </div>
          {/* Wire lane */}
          <svg width="60" height={portCount * rowH} style={{ overflow: 'visible' }}>
            {wirePairs.map((w, i) => {
              const y1 = yFor(w.L.idx);
              const y2 = yFor(w.R.idx);
              return (
                <g key={i}>
                  <path d={`M 0 ${y1} C 30 ${y1}, 30 ${y2}, 60 ${y2}`} stroke={w.color} strokeWidth="3" fill="none" opacity="0.55" style={{ filter: `drop-shadow(0 0 4px ${w.color})` }} />
                  <path d={`M 0 ${y1} C 30 ${y1}, 30 ${y2}, 60 ${y2}`} stroke="#fff" strokeWidth="1" fill="none" opacity="0.4" />
                </g>
              );
            })}
            {/* Pending dotted wire */}
            {pending && (
              <line
                x1={pending.side === 'L' ? 0 : 60}
                y1={yFor(pending.idx)}
                x2={30}
                y2={yFor(pending.idx)}
                stroke={pending.color} strokeWidth="2" strokeDasharray="4 4" opacity="0.7"
              />
            )}
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {panel.right.map((c, i) => port(c, 'R', i, pending?.side === 'R' && pending.idx === i))}
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(0,245,255,0.7)', letterSpacing: '0.28em', margin: 0, fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>MATCH COLORS — LEFT × RIGHT</p>
    </div>
  );
}
