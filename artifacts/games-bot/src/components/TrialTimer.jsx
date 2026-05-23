import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Flame, Sparkles, ChevronRight } from 'lucide-react';
import useAppStore from '../store/appStore';

const TRIAL_TOTAL_SECONDS = 8 * 3600;

function pad(n) { return String(n).padStart(2, '0'); }

function fmtHMS(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return { h, m, s, label: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

export default function TrialTimer({ compact = false, onEndTrial }) {
  const { wallet } = useAppStore();
  const [, tick] = useState(0);

  const active = !!wallet?.trial_active;
  const isPaid = !!wallet?.is_paid;
  const exp = wallet?.trial_expires_at ? new Date(wallet.trial_expires_at).getTime() : 0;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) {
    if (compact) return null;
    return (
      <div className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.15)' }}>
        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(148,163,184,0.6)' }}>
          Free Trial
        </p>
        <p className="font-orbitron text-base font-black text-white">
          {isPaid ? 'Paid Account' : 'Trial Ended'}
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'rgba(148,163,184,0.55)' }}>
          {isPaid ? 'Real entry fees apply' : 'Top up to keep playing for real prizes'}
        </p>
      </div>
    );
  }

  const secsLeft = Math.max(0, Math.floor((exp - Date.now()) / 1000));
  const { h, m, s, label } = fmtHMS(secsLeft);
  const progress = Math.min(1, Math.max(0, secsLeft / TRIAL_TOTAL_SECONDS));

  const accent = secsLeft < 3600
    ? { hex: '#ef4444', glow: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.32)' }
    : secsLeft < 4 * 3600
      ? { hex: '#f97316', glow: 'rgba(249,115,22,0.45)', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.32)' }
      : { hex: '#fbbf24', glow: 'rgba(251,191,36,0.45)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.32)' };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: accent.bg, border: `1px solid ${accent.border}` }}>
        <Clock size={10} color={accent.hex} />
        <span className="font-orbitron text-[10px] font-black" style={{ color: accent.hex, letterSpacing: '0.04em' }}>
          {label}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl p-5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accent.bg}, rgba(0,0,0,0.0))`,
        border: `1px solid ${accent.border}`,
        boxShadow: `0 0 40px ${accent.glow}1f`,
      }}>
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: accent.glow }} />

      <div className="flex items-center justify-between relative z-10 mb-4">
        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: [0, 15, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <Sparkles size={14} color={accent.hex} style={{ filter: `drop-shadow(0 0 6px ${accent.glow})` }} />
          </motion.div>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent.hex, letterSpacing: '0.18em' }}>
            Free Trial — Play Everything Free
          </p>
        </div>
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Flame size={9} color={accent.hex} />
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: accent.hex }}>
            LIVE
          </span>
        </div>
      </div>

      <div className="flex items-end gap-3 relative z-10 mb-3">
        <TimeSegment value={h} label="HRS" color={accent.hex} />
        <TimeSep color={accent.hex} />
        <TimeSegment value={m} label="MIN" color={accent.hex} />
        <TimeSep color={accent.hex} />
        <TimeSegment value={s} label="SEC" color={accent.hex} pulse />
      </div>

      <div className="relative z-10">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accent.hex}, ${accent.hex}aa)`,
              boxShadow: `0 0 14px ${accent.glow}`,
            }} />
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'rgba(226,232,240,0.65)' }}>
          Solo, 2-Player, 4-Player & Tournaments — all free until your trial ends.
        </p>
      </div>

      {onEndTrial && (
        <button
          onClick={onEndTrial}
          className="mt-4 w-full relative z-10 flex items-center justify-center gap-2 py-2.5 rounded-xl font-orbitron font-black text-[11px] uppercase tracking-wider transition-all"
          style={{
            background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.32)',
            color: '#10b981',
            cursor: 'pointer',
          }}>
          End Trial · Play for Real Prizes <ChevronRight size={13} />
        </button>
      )}
    </motion.div>
  );
}

function TimeSegment({ value, label, color, pulse }) {
  return (
    <div className="flex-1 text-center rounded-xl py-2"
      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <motion.p
        key={value}
        initial={pulse ? { scale: 1.12, opacity: 0.6 } : false}
        animate={pulse ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.25 }}
        className="font-orbitron font-black text-2xl leading-none"
        style={{ color, textShadow: `0 0 18px ${color}55` }}>
        {pad(value)}
      </motion.p>
      <p className="text-[9px] font-black mt-1" style={{ color: 'rgba(148,163,184,0.55)', letterSpacing: '0.18em' }}>
        {label}
      </p>
    </div>
  );
}

function TimeSep({ color }) {
  return (
    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}
      className="font-orbitron font-black text-xl pb-3"
      style={{ color }}>:</motion.span>
  );
}
