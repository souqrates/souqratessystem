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

// ── SAFE CRACKER ─────────────────────────────────────────────────────────────
export function SafeCracker({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const DIGITS = [0,1,2,3,4,5,6,7,8,9];
  const [[prize, code, winCode]] = useState<[number, number[], number[]]>(() => {
    const p = roll(tier);
    const c = [0,1,2,3].map(() => Math.floor(Math.random()*10));
    if (p > 0) return [p, c, c];
    const w = [0,1,2,3].map(() => DIGITS[Math.floor(Math.random()*10)]);
    while (w.join('')===c.join('')) w[0] = (w[0]+1)%10;
    return [p, c, w];
  });
  const called = useRef(false);
  const [rev, setRev] = useState([false,false,false,false]);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ background:'linear-gradient(135deg,#111827,#1f2937)', border:`1px solid ${game.accent}33`, borderRadius:16, padding:'14px 12px', width:'100%', maxWidth:300 }}>
        <div style={{ fontSize:9, color:game.accent, letterSpacing:'0.12em', textAlign:'center', marginBottom:10, fontFamily:'"Orbitron",sans-serif' }}>
          {isRtl ? 'الرمز السري' : 'SECRET CODE'}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          {code.map((digit, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ fontSize:9, color:'#475569', fontWeight:700 }}>
                {isRtl ? `قرص ${i+1}` : `DIAL ${i+1}`}
              </div>
              <ScratchZone width={62} height={72} c1={game.color1} c2={game.color2} label={isRtl?'احك':'SCRATCH'} onScratched={() => scratch(i)}>
                <div style={{ width:62, height:72, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#050810', borderRadius:10, gap:1, border: rev[i]&&prize>0 ? `2px solid ${game.accent}88` : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:30, fontWeight:900, color: rev[i]&&prize>0 ? game.accent : '#cbd5e1' }}>{digit}</div>
                  <div style={{ width:24, height:1, background:'rgba(255,255,255,0.08)' }} />
                </div>
              </ScratchZone>
            </div>
          ))}
        </div>
        {done && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:'center', marginTop:10, fontSize:11 }}>
            {prize > 0
              ? <span style={{ color:game.accent, fontWeight:800, fontFamily:'"Orbitron",sans-serif' }}>✓ {isRtl?'الخزنة مكسورة!':'VAULT CRACKED!'}</span>
              : <span style={{ color:'#475569' }}>{isRtl?`الرمز الصحيح: ${winCode.join('')}`:`Correct code: ${winCode.join('')}`}</span>
            }
          </motion.div>
        )}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GOLD RUSH (4×4 MINE) ─────────────────────────────────────────────────────
export function GoldRush({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const N = 16;
  const [[prize, tiles]] = useState<[number, ('gold'|'coal')[] ]>(() => {
    const p = roll(tier);
    const needed = p > 0 ? (p >= tier.prizes[3] ? 6 : p >= tier.prizes[2] ? 5 : 4) : 1;
    const arr: ('gold'|'coal')[] = Array(N).fill('coal');
    const idxs = shuffle([...Array(N).keys()]).slice(0, needed);
    idxs.forEach(i => arr[i] = 'gold');
    return [p, arr];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(N).fill(false));
  const [done, setDone] = useState(false);
  const goldFound = useRef(0);

  function scratch(i: number) {
    if (rev[i] || done) return;
    const n=[...rev]; n[i]=true; setRev(n);
    if (tiles[i]==='gold') goldFound.current++;
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const goldCount = rev.reduce((s,v,i) => s+(v&&tiles[i]==='gold'?1:0), 0);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', gap:6, fontSize:11, color:game.accent, fontWeight:700 }}>
        <span>{isRtl?'الذهب:':'Gold:'}</span>
        <span style={{ fontFamily:'"Orbitron",sans-serif' }}>{goldCount}/{prize>0?4:1}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, width:'100%', maxWidth:280 }}>
        {tiles.map((tile,i) => (
          <ScratchZone key={i} width={60} height={58} c1={game.color1} c2={game.color2} label="◈" onScratched={() => scratch(i)}>
            <div style={{ width:60, height:58, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: tile==='gold'&&rev[i] ? `${game.color1}cc` : '#0a0806', borderRadius:8, border: tile==='gold'&&rev[i] ? `1.5px solid ${game.accent}88` : '1px solid rgba(255,255,255,0.04)' }}>
              {tile==='gold'
                ? <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:10, fontWeight:900, color:game.accent }}>GOLD</div>
                : <div style={{ fontSize:10, color:'#1e293b', fontWeight:700 }}>◆</div>
              }
            </div>
          </ScratchZone>
        ))}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── FORTUNE WHEEL (8 sectors) ────────────────────────────────────────────────
export function FortuneWheel({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const VALS = [0, 0, 0, 1, 2, 3, 5, 10];
  const [[prize, sectors, winIdx]] = useState<[number, number[], number]>(() => {
    const p = roll(tier);
    const s = shuffle([...VALS]);
    if (p > 0) {
      const top = tier.prizes[tier.prizes.length-1];
      const ratio = p / top;
      const target = ratio >= 0.8 ? 10 : ratio >= 0.55 ? 5 : ratio >= 0.3 ? 3 : 2;
      const idx = s.indexOf(target) !== -1 ? s.indexOf(target) : s.indexOf(1);
      return [p, s, idx];
    }
    return [p, s.map(v => v===0?0:0), -1];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(8).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const LABELS = ['0×','0×','0×','1×','2×','3×','5×','10×'];

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, width:'100%', maxWidth:290 }}>
        {sectors.map((val,i) => {
          const isWin = val > 0 && rev[i] && prize > 0;
          const lbl = rev[i] ? (val===0?'0×':`${val}×`) : '?';
          return (
            <ScratchZone key={i} width={64} height={64} c1={game.color1} c2={game.color2} label="?" onScratched={() => scratch(i)}>
              <div style={{ width:64, height:64, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: isWin ? `${game.color1}cc` : '#08060f', borderRadius:10, border: isWin ? `2px solid ${game.accent}` : '1px solid rgba(255,255,255,0.05)', boxShadow: isWin ? `0 0 12px ${game.accent}55` : 'none' }}>
                <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize: val===10?18:15, fontWeight:900, color: isWin ? game.accent : '#334155' }}>{lbl}</div>
              </div>
            </ScratchZone>
          );
        })}
      </div>
      {done && prize>0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:12, color:game.accent, fontWeight:800 }}>
          {isRtl ? `أعلى مضاعف: ${LABELS[winIdx]}` : `Best multiplier: ${LABELS[winIdx]}`}
        </motion.div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── CRYSTAL MATCH (6 crystals) ───────────────────────────────────────────────
const COLORS = ['#f87171','#60a5fa','#4ade80','#a78bfa'];
const CNAMES_AR = ['أحمر','أزرق','أخضر','بنفسجي'];
const CNAMES_EN = ['RED','BLUE','GREEN','PURPLE'];

export function CrystalMatch({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, crystals]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const win = Math.floor(Math.random()*4);
      const arr = [win, win, win, ...shuffle([0,1,2,3].filter(x=>x!==win))].slice(0,6);
      return [p, shuffle(arr)];
    }
    // No 3-match guaranteed
    for (let t=0; t<300; t++) {
      const arr = Array(6).fill(0).map(()=>Math.floor(Math.random()*4));
      const counts = [0,1,2,3].map(c=>arr.filter(x=>x===c).length);
      if (!counts.some(c=>c>=3)) return [p, arr];
    }
    return [p, [0,1,2,3,0,1]];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(6).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const counts = [0,1,2,3].map(c => crystals.reduce((s,v,i) => s+(rev[i]&&v===c?1:0),0));
  const matchColor = done ? [0,1,2,3].find(c=>counts[c]>=3) : undefined;

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:'100%', maxWidth:270 }}>
        {crystals.map((col,i) => {
          const clr = COLORS[col];
          const isMatch = matchColor===col && rev[i];
          return (
            <ScratchZone key={i} width={82} height={82} c1={game.color1} c2={game.color2} label="◈" onScratched={() => scratch(i)}>
              <div style={{ width:82, height:82, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#050d0a', borderRadius:12, border: isMatch ? `2px solid ${clr}` : '1px solid rgba(255,255,255,0.05)', boxShadow: isMatch ? `0 0 14px ${clr}55` : 'none', gap:3 }}>
                <div style={{ fontSize:26, color: rev[i] ? clr : '#1e293b', transition:'color 0.3s' }}>◆</div>
                {rev[i] && <div style={{ fontSize:8, fontWeight:700, color: clr, letterSpacing:'0.08em' }}>{isRtl?CNAMES_AR[col]:CNAMES_EN[col]}</div>}
              </div>
            </ScratchZone>
          );
        })}
      </div>
      {done && matchColor !== undefined && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:11, color:COLORS[matchColor], fontWeight:800 }}>
          {isRtl ? '3 تطابقات!' : '3 Matches!'}
        </motion.div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── NEON VAULT (3 reels, enhanced) ───────────────────────────────────────────
const NEON_SYMS = ['7','★','◆','BAR','◈']; // game-symbol: slot reel face values
const NEON_COLORS: Record<string, string> = { '7':'#f87171','★':'#fde047','◆':'#60a5fa','BAR':'#4ade80','◈':'#a78bfa' }; // game-symbol

export function NeonVault({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, reels, payName]] = useState<[number, string[], string]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const top = tier.prizes[tier.prizes.length-1];
      const ratio = p/top;
      if (ratio>=0.88) return [p,['7','7','7'], isRtl?'ثلاثة 7 — جاكبوت!':'Triple 7 — JACKPOT!'];
      if (ratio>=0.6)  return [p,['★','★','★'], isRtl?'ثلاثة نجوم!':'Triple Stars!'];
      if (ratio>=0.35) return [p,['◆','◆','◆'], isRtl?'ثلاثة ماس!':'Triple Diamonds!'];
      return [p,['BAR','BAR','BAR'], isRtl?'ثلاثة BAR!':'Triple BAR!'];
    }
    let s:[string,string,string];
    do { s=[NEON_SYMS[Math.floor(Math.random()*5)],NEON_SYMS[Math.floor(Math.random()*5)],NEON_SYMS[Math.floor(Math.random()*5)]]; }
    while (s[0]===s[1]||s[1]===s[2]||s[0]===s[2]);
    return [p,s,''];
  });
  const called = useRef(false);
  const [rev, setRev] = useState([false,false,false]);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ background:'linear-gradient(180deg,#0a0a1a,#12122a)', border:`1px solid ${game.accent}33`, borderRadius:18, padding:'14px 10px', width:'100%', maxWidth:300 }}>
        <div style={{ fontSize:9, color:game.accent, letterSpacing:'0.12em', textAlign:'center', marginBottom:12, fontFamily:'"Orbitron",sans-serif' }}>NEON VAULT</div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          {reels.map((sym,i) => {
            const clr = NEON_COLORS[sym] ?? game.accent;
            return (
              <ScratchZone key={i} width={80} height={110} c1={game.color1} c2={game.color2} label={isRtl?'احك':'SCRATCH'} onScratched={() => scratch(i)}>
                <div style={{ width:80, height:110, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#050512', border: rev[i]&&prize>0 ? `2px solid ${clr}66` : '1px solid rgba(255,255,255,0.06)', borderRadius:12, gap:4 }}>
                  <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:sym==='BAR'?14:sym==='7'?36:26, fontWeight:900, color: rev[i] ? clr : '#1e293b', textShadow: rev[i]&&prize>0 ? `0 0 12px ${clr}88` : 'none' }}>{sym}</div>
                  <div style={{ width:40, height:1, background:'rgba(255,255,255,0.06)' }} />
                </div>
              </ScratchZone>
            );
          })}
        </div>
        {done && payName && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:'center', marginTop:10, fontSize:11, fontWeight:800, color:game.accent, fontFamily:'"Orbitron",sans-serif' }}>
            {payName}
          </motion.div>
        )}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── DRAGON COINS (6 coins, sum) ──────────────────────────────────────────────
export function DragonCoins({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, coins]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    if (p === 0) return [p, Array(6).fill(0)];
    const base = Math.round(p/6);
    const vals = Array(6).fill(0).map((_,i) => {
      if (i<2) return Math.round(base*1.5);
      if (i<4) return base;
      return Math.round(base*0.5);
    });
    const diff = p - vals.reduce((a,b)=>a+b,0);
    vals[0] += diff;
    return [p, shuffle(vals)];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(6).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const runningTotal = coins.reduce((s,v,i) => s+(rev[i]?v:0), 0);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', gap:4, fontSize:12, fontWeight:700, color:game.accent }}>
        <span>{isRtl?'المجموع:':'Total:'}</span>
        <span style={{ fontFamily:'"Orbitron",sans-serif' }}>{runningTotal}</span>
        <span style={{ color:'#475569', fontSize:10 }}>SKZ</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:'100%', maxWidth:270 }}>
        {coins.map((val,i) => (
          <ScratchZone key={i} width={82} height={76} c1={game.color1} c2={game.color2} label="◈" onScratched={() => scratch(i)}>
            <div style={{ width:82, height:76, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#080404', borderRadius:12, border: rev[i]&&val>0 ? `1.5px solid ${game.accent}88` : '1px solid rgba(255,255,255,0.05)', gap:1 }}>
              <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:16, fontWeight:900, color: rev[i] ? game.accent : '#1e293b' }}>{rev[i]?val:0}</div>
              <div style={{ fontSize:9, color:'#475569', fontWeight:600 }}>SKZ</div>
            </div>
          </ScratchZone>
        ))}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── STORM STRIKE (3×3 grid, lightning lines) ─────────────────────────────────
export function StormStrike({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  const [[prize, grid]] = useState<[number, ('bolt'|'cloud')[]]>(() => {
    const p = roll(tier);
    if (p > 0) {
      const g: ('bolt'|'cloud')[] = Array(9).fill('cloud');
      const line = LINES[Math.floor(Math.random()*LINES.length)];
      line.forEach(i => g[i]='bolt');
      return [p, g];
    }
    for (let t=0; t<200; t++) {
      const g: ('bolt'|'cloud')[] = Array(9).fill(0).map(()=>Math.random()<0.4?'bolt':'cloud');
      if (!LINES.some(l=>g[l[0]]==='bolt'&&g[l[1]]==='bolt'&&g[l[2]]==='bolt')) return [p,g];
    }
    return [p, ['cloud','bolt','cloud','bolt','cloud','bolt','cloud','cloud','bolt']];
  });
  const called = useRef(false);
  const [rev, setRev] = useState<boolean[]>(Array(9).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...rev]; n[i]=true; setRev(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const winLines = done ? LINES.filter(l=>grid[l[0]]==='bolt'&&grid[l[1]]==='bolt'&&grid[l[2]]==='bolt') : [];
  const winCells = new Set(winLines.flat());

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, width:'100%', maxWidth:270 }}>
        {grid.map((cell,i) => {
          const isWin = winCells.has(i);
          return (
            <ScratchZone key={i} width={82} height={78} c1={game.color1} c2={game.color2} label="◈" onScratched={() => scratch(i)}>
              <div style={{ width:82, height:78, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: isWin ? '#0a1520' : '#050810', borderRadius:10, border: isWin ? `2px solid ${game.accent}` : '1px solid rgba(255,255,255,0.04)', boxShadow: isWin ? `0 0 14px ${game.accent}55` : 'none' }}>
                {rev[i]
                  ? <div style={{ fontSize:28, color: cell==='bolt' ? game.accent : '#334155', textShadow: cell==='bolt'&&isWin ? `0 0 10px ${game.accent}` : 'none' }}>{cell==='bolt'?'⚡':'☁'}</div>
                  : <div style={{ fontSize:12, color:'#1e293b', fontWeight:700 }}>◈</div>
                }
              </div>
            </ScratchZone>
          );
        })}
      </div>
      {done && winLines.length>0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:11, color:game.accent, fontWeight:800 }}>
          {isRtl?'خط صاعقة!':'Lightning line!'}
        </motion.div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── KATANA CHAIN (3 sequential targets, stop anytime) ────────────────────────
export function KatanaChain({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const MULTS = [1, 2, 3, 5, 10];
  const [[prize, targets]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    if (p === 0) return [p, [0,0,0]];
    const m = MULTS[Math.floor(Math.random()*MULTS.length)];
    const base = Math.round(p/m);
    return [p, [base, base*2, base*m].map(v=>Math.min(v, tier.maxPrize))];
  });
  const called = useRef(false);
  const [rev, setRev] = useState([false,false,false]);
  const [stopped, setStopped] = useState(false);
  const [collected, setCollected] = useState(0);

  function scratch(i: number) {
    if (rev[i] || stopped) return;
    const n=[...rev]; n[i]=true; setRev(n);
    setCollected(targets[i]);
    if (i===2 && !called.current) { called.current=true; onResult(prize); setStopped(true); }
  }

  function stop() {
    if (stopped) return;
    setStopped(true);
    if (!called.current) { called.current=true; onResult(collected); }
  }

  const canStop = rev[0] && !stopped;

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      {['I','II','III'].map((roman,i) => {
        const isActive = !rev[i] && (i===0 || rev[i-1]) && !stopped;
        const isRev = rev[i];
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:280 }}>
            <div style={{ width:22, height:22, borderRadius:99, background: isRev ? game.accent : 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900, color: isRev ? '#000' : '#475569', flexShrink:0 }}>{roman}</div>
            <ScratchZone width={200} height={70} c1={game.color1} c2={game.color2} label={isActive ? (isRtl?'احك':'SCRATCH') : undefined} disabled={!isActive} onScratched={() => scratch(i)} style={{ flex:1 }}>
              <div style={{ width:'100%', height:70, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a0a14', borderRadius:12, border: isRev ? `2px solid ${game.accent}66` : '1px solid rgba(255,255,255,0.04)' }}>
                {isRev
                  ? <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:22, fontWeight:900, color:game.accent }}>{targets[i]} <span style={{fontSize:10}}>SKZ</span></div>
                  : <div style={{ fontSize:11, color:'#1e293b' }}>{isActive?(isRtl?'احك للكشف':'Scratch to reveal'):'—'}</div>
                }
              </div>
            </ScratchZone>
          </div>
        );
      })}
      {canStop && (
        <motion.button whileTap={{ scale:0.95 }} onClick={stop} style={{ padding:'10px 28px', borderRadius:12, border:`1px solid ${game.accent}55`, background:`${game.color1}cc`, color:game.accent, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'"Tajawal",sans-serif' }}>
          {isRtl ? `توقف وخذ ${collected} SKZ` : `Stop & Take ${collected} SKZ`}
        </motion.button>
      )}
      {stopped && <Res prize={collected} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
