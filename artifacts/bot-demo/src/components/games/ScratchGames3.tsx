import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { GameDef, TierDef } from '../../lib/games-data';
import type { Lang } from '../../lib/i18n';
import ScratchZone from '../ScratchZone';

interface GProps { game: GameDef; tier: TierDef; lang: Lang; onResult: (p: number) => void; onPlayAgain: () => void; }
function roll(t: TierDef) { let r=Math.random(),c=0; for(let i=0;i<t.weights.length;i++){c+=t.weights[i];if(r<c)return t.prizes[i];} return 0; }
function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random()-0.5); }

function Res({ prize, accent, onPlayAgain, lang }: { prize: number; accent: string; onPlayAgain: () => void; lang: Lang }) {
  return (
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} style={{ textAlign:'center', paddingTop:4, width:'100%', padding:'8px 0' }}>
      {prize > 0
        ? <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:24, fontWeight:900, background:`linear-gradient(90deg,${accent},#22c55e)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:2 }}>+{prize.toLocaleString()} SKZ</div>
        : <div style={{ fontSize:13, color:'#475569', fontWeight:600 }}>{lang==='ar' ? 'حظاً أوفر المرة القادمة' : 'Better luck next time'}</div>
      }
      <button onClick={onPlayAgain} style={{ marginTop:10, padding:'12px 0', borderRadius:12, border:`1px solid ${accent}44`, background:'rgba(15,25,15,0.6)', color:accent, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Tajawal",sans-serif', width:'100%', maxWidth:280 }}>
        {lang==='ar' ? 'العب مرة أخرى' : 'Play Again'}
      </button>
    </motion.div>
  );
}

// ── RUNE COMBO (4 rune stones, find pair) ────────────────────────────────────
const RUNES = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ'];

export function RuneCombo({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, stones]] = useState<[number, string[]]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const r = RUNES[Math.floor(Math.random()*RUNES.length)];
      const others = shuffle(RUNES.filter(x=>x!==r));
      return [p, shuffle([r, r, others[0], others[1]])];
    }
    for (let t=0; t<200; t++) {
      const s = shuffle([...RUNES]).slice(0,4);
      if (new Set(s).size===4) return [p,s];
    }
    return [p, RUNES.slice(0,4)];
  });
  const called = useRef(false);
  const [rev, setRev] = useState([false,false,false,false]);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const revStones = stones.filter((_,i)=>rev[i]);
  const pairFound = done && revStones.length>=2 && stones.some((s,i)=>rev[i]&&stones.some((s2,j)=>j!==i&&rev[j]&&s2===s));

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        {stones.map((rune, i) => {
          const hasPair = done && stones.filter((s,j)=>j!==i&&stones[j]===rune&&rev[j]).length>0 && rev[i];
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
              <ScratchZone width={66} height={84} c1={game.color1} c2={game.color2} label="ᚠ" onScratched={() => scratch(i)}>
                <div style={{ width:66, height:84, display:'flex', alignItems:'center', justifyContent:'center', background:'#040c05', borderRadius:12, border: hasPair ? `2px solid ${game.accent}` : '1px solid rgba(255,255,255,0.06)', boxShadow: hasPair ? `0 0 14px ${game.accent}55` : 'none' }}>
                  <div style={{ fontSize:34, color: rev[i] ? (hasPair ? game.accent : '#94a3b8') : '#0f1a10', fontFamily:'serif', transition:'color 0.3s' }}>{rune}</div>
                </div>
              </ScratchZone>
              {hasPair && <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ width:6, height:6, borderRadius:99, background:game.accent }} />}
            </div>
          );
        })}
      </div>
      {done && pairFound && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:11, color:game.accent, fontWeight:800 }}>
          {isRtl ? 'زوج روني!' : 'Rune Pair Found!'}
        </motion.div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── PIRATE MAP (9 zones, find X) ─────────────────────────────────────────────
export function PirateMap({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, xIdx]] = useState<[number, number]>(() => {
    const p = roll(tier);
    return [p, Math.floor(Math.random()*9)];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(9).fill(false));
  const [done, setDone] = useState(false);
  const [foundX, setFoundX] = useState(false);

  function scratch(i: number) {
    if (rev[i]||done) return;
    const n=[...rev]; n[i]=true; setRev(n);
    const isX = i===xIdx;
    if (isX && prize>0 && !called.current) {
      called.current=true; setFoundX(true); onResult(prize); setDone(true);
    } else if (n.every(Boolean) && !called.current) {
      called.current=true; onResult(0); setDone(true);
    }
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ background:'linear-gradient(135deg,#0c1a0e,#071508)', border:`1px solid ${game.accent}33`, borderRadius:14, padding:8, position:'relative' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
          {Array(9).fill(0).map((_,i) => {
            const isX = i===xIdx;
            const isFoundX = rev[i]&&isX&&prize>0;
            return (
              <ScratchZone key={i} width={80} height={74} c1='#0c2340' c2='#1e3a5f' label="?" onScratched={() => scratch(i)}>
                <div style={{ width:80, height:74, display:'flex', alignItems:'center', justifyContent:'center', background: isFoundX?'#0a1a0a':'#060d14', borderRadius:10, border: isFoundX?`2px solid ${game.accent}`:'1px solid rgba(255,255,255,0.04)', boxShadow: isFoundX?`0 0 16px ${game.accent}66`:'none' }}>
                  {rev[i]
                    ? (isX&&prize>0
                      ? <div style={{ fontSize:26, fontWeight:900, color:game.accent }}>✕</div>
                      : <div style={{ fontSize:14, color:'#1e3a5f' }}>~</div>)
                    : <div style={{ fontSize:11, color:'#0f2030', fontWeight:700 }}>?</div>
                  }
                </div>
              </ScratchZone>
            );
          })}
        </div>
      </div>
      {done && foundX && (
        <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} style={{ fontSize:12, color:game.accent, fontWeight:800 }}>
          {isRtl ? 'وجدت الكنز!' : 'X Marks the Spot!'}
        </motion.div>
      )}
      {done && <Res prize={foundX ? prize : 0} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GEM LADDER (5 rungs, climb upward) ───────────────────────────────────────
export function GemLadder({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const VALS = [1,2,3,4,5].map((l,_,arr) => {
    const top = tier.prizes[tier.prizes.length-1];
    return Math.round(top * l / arr.length / arr.length * 1.5);
  });

  const [[prize, failAt]] = useState<[number, number]>(() => {
    const p = roll(tier);
    if (p === 0) return [p, 0];
    if (p >= tier.prizes[3]) return [p, 5];
    if (p >= tier.prizes[2]) return [p, 4];
    if (p >= tier.prizes[1]) return [p, 3];
    return [p, 2];
  });
  const called = useRef(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [collected, setCollected] = useState(0);

  function scratch() {
    if (done) return;
    const next = step + 1;
    const reachedFail = next > failAt && prize > 0;
    if (reachedFail || prize === 0) {
      if (!called.current) { called.current=true; onResult(VALS[step-1] ?? 0); setCollected(VALS[step-1]??0); }
      setDone(true);
    } else if (next === 5) {
      setStep(5);
      if (!called.current) { called.current=true; onResult(prize); setCollected(prize); }
      setDone(true);
    } else {
      setStep(next);
    }
  }

  const rungs = [4,3,2,1,0]; // top to bottom visually

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:5, width:'100%', maxWidth:280 }}>
        {rungs.map(rungIdx => {
          const reached = step > rungIdx;
          const isNext = step === rungIdx && !done;
          const isFail = done && step <= rungIdx && prize>0;
          return (
            <div key={rungIdx} style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ fontSize:9, color:'#334155', fontWeight:700, width:20, textAlign:'center' }}>{rungIdx+1}</div>
              <ScratchZone width={220} height={56} c1={game.color1} c2={game.color2} label={isNext?(isRtl?'احك':'SCRATCH'):undefined} disabled={!isNext} onScratched={scratch} style={{ flex:1 }}>
                <div style={{ width:'100%', height:56, display:'flex', alignItems:'center', justifyContent:'center', background: reached ? '#061a0e' : '#050d06', borderRadius:10, border: reached ? `1.5px solid ${game.accent}88` : isFail ? '1px solid #7f1d1d' : '1px solid rgba(255,255,255,0.04)' }}>
                  {reached
                    ? <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:16, fontWeight:900, color:game.accent }}>{VALS[rungIdx]} <span style={{fontSize:9,color:'#64748b'}}>SKZ</span></div>
                    : <div style={{ fontSize:10, color:'#0f2010', fontWeight:700 }}>{isNext?'◈':'?'}</div>
                  }
                </div>
              </ScratchZone>
              <div style={{ width:20, textAlign:'center' }}>
                {reached && <div style={{ fontSize:12, color:game.accent }}>✓</div>}
                {isFail && <div style={{ fontSize:12, color:'#7f1d1d' }}>✕</div>}
              </div>
            </div>
          );
        })}
      </div>
      {done && <Res prize={collected} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── NEON JACKPOT (5 panels, 3+ match) ────────────────────────────────────────
const JPOT_SYMS = ['7','★','◆','BAR','◈'];
const JPOT_COLORS: Record<string, string> = {'7':'#f87171','★':'#fde047','◆':'#60a5fa','BAR':'#4ade80','◈':'#a78bfa'};

export function NeonJackpot({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, panels]] = useState<[number, string[]]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const win = JPOT_SYMS[Math.floor(Math.random()*5)];
      const count = p >= tier.prizes[3] ? 5 : p >= tier.prizes[2] ? 4 : 3;
      const rest = shuffle(JPOT_SYMS.filter(s=>s!==win));
      return [p, shuffle([...Array(count).fill(win), ...rest].slice(0,5))];
    }
    for (let t=0; t<200; t++) {
      const s = Array(5).fill(0).map(()=>JPOT_SYMS[Math.floor(Math.random()*5)]);
      const counts = JPOT_SYMS.map(sym=>s.filter(x=>x===sym).length);
      if (!counts.some(c=>c>=3)) return [p,s];
    }
    return [p,['7','★','◆','BAR','◈']];
  });
  const called = useRef(false);
  const [rev, setRev] = useState([false,false,false,false,false]);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const symCounts = done ? JPOT_SYMS.map(s=>panels.filter(x=>x===s).length) : [];
  const jackSym = done ? JPOT_SYMS.find((_,i)=>symCounts[i]>=3) : undefined;

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ background:'linear-gradient(180deg,#120820,#1a0830)', border:`1px solid ${game.accent}33`, borderRadius:16, padding:'12px 10px', width:'100%', maxWidth:300 }}>
        <div style={{ fontSize:9, color:game.accent, letterSpacing:'0.12em', textAlign:'center', marginBottom:10, fontFamily:'"Orbitron",sans-serif' }}>NEON JACKPOT</div>
        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
          {panels.map((sym,i) => {
            const clr = JPOT_COLORS[sym]??game.accent;
            const isJack = jackSym===sym && rev[i];
            return (
              <ScratchZone key={i} width={52} height={84} c1={game.color1} c2={game.color2} label="?" onScratched={() => scratch(i)}>
                <div style={{ width:52, height:84, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#060312', borderRadius:10, border: isJack ? `2px solid ${clr}` : '1px solid rgba(255,255,255,0.05)', boxShadow: isJack ? `0 0 14px ${clr}66` : 'none', gap:3 }}>
                  <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:sym==='BAR'?10:sym==='7'?28:18, fontWeight:900, color: rev[i] ? clr : '#1e293b', textShadow: isJack ? `0 0 10px ${clr}` : 'none' }}>{sym}</div>
                </div>
              </ScratchZone>
            );
          })}
        </div>
        {done && jackSym && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:'center', marginTop:10, fontSize:11, fontWeight:800, color:JPOT_COLORS[jackSym], fontFamily:'"Orbitron",sans-serif' }}>
            {isRtl ? `${symCounts[JPOT_SYMS.indexOf(jackSym)]}× ${jackSym}` : `${symCounts[JPOT_SYMS.indexOf(jackSym)]}× ${jackSym} — JACKPOT!`}
          </motion.div>
        )}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── SHADOW REVEAL (4 sequential portals) ─────────────────────────────────────
export function ShadowReveal({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const PORTAL_LABELS_AR = ['بوابة الصباح','بوابة النهار','بوابة الغروب','بوابة الليل'];
  const PORTAL_LABELS_EN = ['Dawn Gate','Day Gate','Dusk Gate','Night Gate'];
  const [[prize, portals]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    if (p===0) return [p,[0,0,0,0]];
    const split = [0.15,0.25,0.30,0.30];
    return [p, split.map(s=>Math.round(p*s))];
  });
  const called = useRef(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  function scratch() {
    if (done||step>=4) return;
    const ns = step+1;
    setStep(ns);
    if (ns===4 && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const total = portals.slice(0,step).reduce((a,b)=>a+b,0);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      {step>0 && <div style={{ fontSize:11, color:game.accent, fontWeight:700, fontFamily:'"Orbitron",sans-serif' }}>{isRtl?`المجموع: ${total} SKZ`:`Total: ${total} SKZ`}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%', maxWidth:280 }}>
        {[0,1,2,3].map(i => {
          const revealed = step > i;
          const isNext = step === i && !done;
          return (
            <ScratchZone key={i} width={280} height={64} c1={game.color1} c2='#0f172a' label={isNext?(isRtl?`احك البوابة ${i+1}`:`Scratch Gate ${i+1}`):undefined} disabled={!isNext} onScratched={scratch}>
              <div style={{ width:'100%', height:64, display:'flex', alignItems:'center', padding:'0 14px', background: revealed?'#0a0515':'#050208', borderRadius:12, border: revealed?`1.5px solid ${game.accent}44`:'1px solid rgba(255,255,255,0.04)', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:99, background: revealed?`${game.accent}22`:'rgba(255,255,255,0.03)', border: revealed?`1px solid ${game.accent}55`:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color: revealed?game.accent:'#1e293b', flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:'#475569', fontWeight:700 }}>{isRtl?PORTAL_LABELS_AR[i]:PORTAL_LABELS_EN[i]}</div>
                  {revealed && <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:16, fontWeight:900, color:game.accent, marginTop:2 }}>+{portals[i]} SKZ</div>}
                  {!revealed && <div style={{ fontSize:10, color:'#1e293b' }}>????</div>}
                </div>
                {revealed && <div style={{ color:game.accent, fontSize:16 }}>✓</div>}
              </div>
            </ScratchZone>
          );
        })}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── TIME SCRATCH (6 clock sectors, sum = multiplier) ─────────────────────────
export function TimeScratch({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const HOURS = [1,2,3,6,9,12];
  const [[prize, luckyHours]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    if (p===0) return [p, Array(6).fill(0)];
    const base = Math.round(p/HOURS.reduce((a,b)=>a+b,0) * 12);
    return [p, HOURS.map(h => Math.round(h*base))];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(6).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const runningTotal = luckyHours.reduce((s,v,i)=>s+(rev[i]?v:0),0);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ fontSize:11, color:game.accent, fontWeight:700, fontFamily:'"Orbitron",sans-serif' }}>
        {isRtl?`المجموع: ${runningTotal} SKZ`:`Total: ${runningTotal} SKZ`}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:'100%', maxWidth:280 }}>
        {HOURS.map((h,i) => (
          <ScratchZone key={i} width={82} height={80} c1={game.color1} c2={game.color2} label={`${h}:00`} onScratched={() => scratch(i)}>
            <div style={{ width:82, height:80, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a0603', borderRadius:12, border: rev[i]&&luckyHours[i]>0 ? `1.5px solid ${game.accent}88` : '1px solid rgba(255,255,255,0.04)', gap:2 }}>
              <div style={{ fontSize:9, color:'#475569', fontWeight:700 }}>{h}:00</div>
              <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:18, fontWeight:900, color: rev[i] ? game.accent : '#1e293b' }}>{rev[i]?luckyHours[i]:'?'}</div>
              {rev[i] && <div style={{ fontSize:8, color:'#475569' }}>SKZ</div>}
            </div>
          </ScratchZone>
        ))}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── VOLCANO RUSH (6 lava cracks, chain multiply) ─────────────────────────────
export function VolcanoRush({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, cracks]] = useState<[number, ('gold'|'ash')[]]>(() => {
    const p = roll(tier);
    const arr: ('gold'|'ash')[] = Array(6).fill('ash');
    if (p === 0) return [p, arr];
    const goldCount = p >= tier.prizes[3] ? 5 : p >= tier.prizes[2] ? 4 : p >= tier.prizes[1] ? 3 : 2;
    const idxs = shuffle([0,1,2,3,4,5]).slice(0, goldCount);
    idxs.forEach(i => arr[i]='gold');
    return [p, arr];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(6).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    if (rev[i]||done) return;
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const goldFound = cracks.reduce((s,v,i)=>s+(rev[i]&&v==='gold'?1:0),0);
  const chainMult = Math.pow(2, Math.max(0, goldFound-1));

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', gap:8, fontSize:11, fontWeight:700 }}>
        <span style={{ color:game.accent }}>{isRtl?`ذهب: ${goldFound}`:`Gold: ${goldFound}`}</span>
        {goldFound>1 && <span style={{ color:'#f97316' }}>{isRtl?`سلسلة: ×${chainMult}`:`Chain: ×${chainMult}`}</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:'100%', maxWidth:270 }}>
        {cracks.map((type,i) => {
          const isGold = type==='gold';
          const isRev = rev[i];
          return (
            <ScratchZone key={i} width={82} height={82} c1='#450a0a' c2='#771d1d' label="◈" onScratched={() => scratch(i)}>
              <div style={{ width:82, height:82, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: isGold&&isRev?'#1a0600':'#0a0200', borderRadius:12, border: isGold&&isRev?`2px solid ${game.accent}88`:'1px solid rgba(255,255,255,0.04)', boxShadow: isGold&&isRev?`0 0 14px ${game.accent}55`:'none' }}>
                {isRev
                  ? (isGold
                    ? <>
                        <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:11, fontWeight:900, color:game.accent }}>GOLD</div>
                        <div style={{ fontSize:10, color:game.accent, opacity:0.7 }}>◆</div>
                      </>
                    : <div style={{ fontSize:20, color:'#334155' }}>◈</div>)
                  : <div style={{ fontSize:12, color:'#2d1010', fontWeight:700 }}>?</div>
                }
              </div>
            </ScratchZone>
          );
        })}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
