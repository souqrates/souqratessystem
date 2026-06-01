import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../lib/telegram';
import ResultOverlay from './ResultOverlay';

const COLORS = [
  { id:0, bg:'bg-red-500',    label:'Red'    },
  { id:1, bg:'bg-blue-500',   label:'Blue'   },
  { id:2, bg:'bg-green-500',  label:'Green'  },
  { id:3, bg:'bg-yellow-400', label:'Yellow' },
  { id:4, bg:'bg-purple-500', label:'Purple' },
];

const RULES = 'A 5-color sequence flashes for 0.5 seconds. Memorize it, then tap the colors in the correct order. Beat 3 rounds to win!';

export default function Decryptor({ phase, setPhase, game }) {
  const [seq, setSeq] = useState([]);
  const [userSeq, setUserSeq] = useState([]);
  const [show, setShow] = useState(false);
  const [round, setRound] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const timersRef = useRef([]);

  const nextRound = (r) => {
    const newSeq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 5));
    setSeq(newSeq); setUserSeq([]); setShow(true);
    const id = setTimeout(() => setShow(false), 500 + r * 100);
    timersRef.current.push(id);
  };

  useEffect(() => {
    if (phase === 'playing') nextRound(0);
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, [phase]);

  const tap = (colorId) => {
    if (show || phase !== 'playing') return;
    triggerHaptic('light');
    const next = [...userSeq, colorId];
    setUserSeq(next);
    const idx = next.length - 1;
    if (next[idx] !== seq[idx]) { triggerHaptic('error'); setPhase('lost'); return; }
    if (next.length === seq.length) {
      triggerHaptic('success');
      const e = +(earnings + 10).toFixed(2);
      setEarnings(e);
      const r = round + 1;
      setRound(r);
      if (r >= 3) { setPhase('won'); return; }
      const id = setTimeout(() => nextRound(r), 600);
      timersRef.current.push(id);
      setUserSeq([]);
    }
  };

  if (phase === 'rules') return <p className="text-slate-300 text-sm">{RULES}</p>;

  return (
    <div className="space-y-5 text-center">
      {(phase === 'won' || phase === 'lost') && (
        <ResultOverlay won={phase==='won'} earnings={earnings} setPhase={setPhase} />
      )}

      {show && (
        <motion.div className="bg-[#00d4ff]/20 border border-[#00d4ff]/40 rounded-xl py-3" animate={{ opacity:[1,0.5,1] }} transition={{ duration:0.3, repeat:Infinity }}>
          <p className="text-[#00d4ff] font-black tracking-widest">MEMORIZE</p>
        </motion.div>
      )}

      {!show && phase === 'playing' && (
        <p className="text-slate-400 text-sm">Tap in order: {userSeq.length}/{seq.length}</p>
      )}

      {/* Sequence Display */}
      {show && (
        <div className="flex gap-2 justify-center">
          {seq.map((cIdx, i) => (
            <motion.div key={i} className={`w-10 h-10 rounded-lg ${COLORS[cIdx].bg}`}
              initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay: i * 0.06 }} />
          ))}
        </div>
      )}

      {/* Color Buttons */}
      <div className="grid grid-cols-5 gap-2">
        {COLORS.map(c => (
          <motion.button
            key={c.id}
            onClick={() => tap(c.id)}
            disabled={show || phase !== 'playing'}
            className={`aspect-square rounded-xl ${c.bg} disabled:opacity-40 font-bold text-white text-xs`}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          >
            {c.label[0]}
          </motion.button>
        ))}
      </div>

      {/* Progress */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 rounded-xl p-3">
          <p className="text-xs text-slate-400">Round</p>
          <p className="text-2xl font-black text-[#00d4ff]">{round + 1}/3</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3">
          <p className="text-xs text-slate-400">Earned</p>
          <p className="text-2xl font-black text-[#ffd700]">${earnings}</p>
        </div>
      </div>
    </div>
  );
}
