import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameDef, TierDef } from '../../lib/games-data';
import type { Lang } from '../../lib/i18n';
import ScratchZone from '../ScratchZone';

interface GProps { game: GameDef; tier: TierDef; lang: Lang; onResult: (p: number) => void; onPlayAgain: () => void; }
function roll(t: TierDef) { let r=Math.random(),c=0; for(let i=0;i<t.weights.length;i++){c+=t.weights[i];if(r<c)return t.prizes[i];} return 0; }

function Res({ prize, accent, onPlayAgain, lang }: { prize: number; accent: string; onPlayAgain: () => void; lang: Lang }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', paddingTop: 4 }}>
      {prize > 0
        ? <div style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 26, fontWeight: 900, background: `linear-gradient(90deg,${accent},#22c55e)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>+{prize.toLocaleString()} SKZ 🎉</div>
        : <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{lang==='ar' ? 'حظاً أوفر المرة القادمة 🍀' : 'Better luck next time 🍀'}</div>
      }
      <button onClick={onPlayAgain} style={{ marginTop: 10, padding: '12px 0', borderRadius: 12, border: `1px solid ${accent}44`, background: 'rgba(15,25,15,0.6)', color: accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: '"Tajawal",sans-serif', width: '100%' }}>
        {lang==='ar' ? 'العب مرة أخرى' : 'Play Again'}
      </button>
    </motion.div>
  );
}

const SYMS = ['★','◆','✦','◈','☽','⚡','✿','⭐'];

// ── GAME 1: CLASSIC MATCH ────────────────────────────────────────────────────
export function ClassicMatch({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, zones]] = useState<[number, string[]]>(() => {
    const p = roll(tier);
    if (p > 0) { const s = SYMS[Math.floor(Math.random()*SYMS.length)]; return [p, [s,s,s]]; }
    const sh = [...SYMS].sort(() => Math.random()-0.5); return [p, [sh[0],sh[1],sh[2]]];
  });
  const called = useRef(false);
  const [revealed, setRevealed] = useState([false,false,false]);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...revealed]; n[i]=true; setRevealed(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }
  const allMatch = zones[0]===zones[1] && zones[1]===zones[2];

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', gap:10 }}>
        {zones.map((sym,i) => (
          <ScratchZone key={i} width={90} height={90} c1={game.color1} c2={game.color2} emoji="?" label={isRtl?'احك':'Scratch'} onScratched={() => scratch(i)}>
            <div style={{ width:90, height:90, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color: allMatch&&revealed[i] ? game.accent : '#475569', background:'#0a1014', border: allMatch&&revealed[i] ? `2px solid ${game.accent}88` : '1px solid rgba(100,116,139,0.1)', borderRadius:14 }}>{sym}</div>
          </ScratchZone>
        ))}
      </div>
      {done && (
        <>
          <div style={{ display:'flex', gap:10 }}>
            {[0,1,2].map(i => <div key={i} style={{ width:90, height:3, borderRadius:99, background: allMatch ? `linear-gradient(90deg,${game.accent},#22c55e)` : 'rgba(100,116,139,0.12)' }} />)}
          </div>
          <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />
        </>
      )}
    </div>
  );
}

// ── GAME 2: LUCKY LINES (3×3 GRID) ──────────────────────────────────────────
export function LuckyLines({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  const [[prize, grid]] = useState<[number, string[]]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const g = Array(9).fill('').map(() => SYMS[Math.floor(Math.random()*SYMS.length)]);
      const row = Math.floor(Math.random()*3);
      const s = SYMS[Math.floor(Math.random()*SYMS.length)];
      g[row*3]=g[row*3+1]=g[row*3+2]=s;
      return [p, g];
    }
    for (let t=0; t<200; t++) {
      const g = Array(9).fill('').map(()=>SYMS[Math.floor(Math.random()*SYMS.length)]);
      if (!LINES.some(l=>g[l[0]]===g[l[1]]&&g[l[1]]===g[l[2]])) return [p,g];
    }
    return [p,['★','◆','✦','◈','☽','⚡','✿','⭐','★']];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [winLines, setWinLines] = useState<number[][]>([]);
  const [done, setDone] = useState(false);

  function tap(i: number) {
    if (revealed[i] || done) return;
    const n=[...revealed]; n[i]=true; setRevealed(n);
    if (n.every(Boolean)) {
      const wl = LINES.filter(l=>grid[l[0]]===grid[l[1]]&&grid[l[1]]===grid[l[2]]);
      setWinLines(wl);
      if (!called.current) { called.current=true; onResult(prize); }
      setDone(true);
    }
  }
  const winCells = new Set(winLines.flat());

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, width:270 }}>
        {grid.map((sym,i) => (
          <motion.button key={i} whileTap={{ scale:0.91 }} onClick={() => tap(i)} style={{ height:80, borderRadius:12, border: winCells.has(i) ? `2px solid ${game.accent}` : revealed[i] ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${game.accent}33`, background: winCells.has(i) ? `${game.color1}88` : revealed[i] ? '#0a1014' : `${game.color1}44`, cursor: revealed[i]?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow: winCells.has(i) ? `0 0 14px ${game.accent}44` : 'none' }}>
            <AnimatePresence mode="wait">
              {!revealed[i]
                ? <motion.span key="h" exit={{ scale:0, opacity:0 }} style={{ color:game.accent, fontWeight:700, fontSize:16 }}>?</motion.span>
                : <motion.span key="v" initial={{ scale:0, rotate:-15 }} animate={{ scale:1, rotate:0 }} style={{ fontWeight:900, color: winCells.has(i) ? game.accent : '#64748b' }}>{sym}</motion.span>
              }
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
      {done && winLines.length > 0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:11, fontWeight:800, color:game.accent, letterSpacing:'0.06em' }}>
          {isRtl ? `🎉 خط فائز!` : '🎉 Winning Line!'}
        </motion.div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 3: SLOT SCRATCH (3 REELS) ──────────────────────────────────────────
const SLOT_SYMS = ['🍒','⭐','7','◆','BAR','🔔'];

export function SlotScratch({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';

  const [[prize, reels, payName]] = useState<[number, string[], string]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const top = tier.prizes[tier.prizes.length-1];
      const ratio = p / top;
      if (ratio >= 0.9) return [p, ['7','7','7'], isRtl ? 'ثلاثة 7 — جاكبوت!' : 'Triple 7 — JACKPOT!'];
      if (ratio >= 0.6) return [p, ['⭐','⭐','⭐'], isRtl ? 'ثلاثة نجوم!' : 'Triple Stars!'];
      if (ratio >= 0.35) return [p, ['🔔','🔔','🔔'], isRtl ? 'ثلاثة أجراس!' : 'Triple Bells!'];
      return [p, ['🍒','🍒','🍒'], isRtl ? 'ثلاث كرز!' : 'Triple Cherries!'];
    }
    const sh = [...SLOT_SYMS].sort(() => Math.random()-0.5);
    while (sh[0]===sh[1] || sh[1]===sh[2] || sh[0]===sh[2]) sh.sort(() => Math.random()-0.5);
    return [p, [sh[0],sh[1],sh[2]], ''];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState([false,false,false]);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...revealed]; n[i]=true; setRevealed(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }
  const allDone = revealed.every(Boolean);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ background:'linear-gradient(135deg,#1a1a2e,#16213e)', border:`1px solid ${game.accent}44`, borderRadius:18, padding:'12px', width:'100%', maxWidth:290 }}>
        <div style={{ fontSize:9, color:game.accent, textAlign:'center', letterSpacing:'0.1em', marginBottom:10, fontFamily:'"Orbitron",sans-serif' }}>SOUQRATES SLOTS</div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          {reels.map((sym,i) => (
            <ScratchZone key={i} width={76} height={104} c1={game.color1} c2={game.color2} emoji="🎰" onScratched={() => scratch(i)}>
              <div style={{ width:76, height:104, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#050810', border:`1px solid ${allDone&&prize>0?game.accent+'66':'rgba(255,255,255,0.06)'}`, borderRadius:10, gap:2 }}>
                <div style={{ fontSize: sym==='BAR'?14:sym==='7'?34:22, fontWeight:900, color: allDone&&prize>0 ? game.accent : '#cbd5e1', fontFamily: sym==='BAR'?'"Orbitron",sans-serif':undefined }}>{sym}</div>
                <div style={{ width:36, height:1, background:'rgba(255,255,255,0.08)' }} />
              </div>
            </ScratchZone>
          ))}
        </div>
        {done && payName && (
          <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} style={{ textAlign:'center', marginTop:8, fontSize:11, fontWeight:800, color:game.accent }}>
            {payName}
          </motion.div>
        )}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
