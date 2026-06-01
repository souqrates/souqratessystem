import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameDef, TierDef } from '../../lib/games-data';
import type { Lang } from '../../lib/i18n';
import ScratchZone from '../ScratchZone';

interface GProps { game: GameDef; tier: TierDef; lang: Lang; onResult: (p: number) => void; onPlayAgain: () => void; }
function roll(t: TierDef) { let r=Math.random(),c=0; for(let i=0;i<t.weights.length;i++){c+=t.weights[i];if(r<c)return t.prizes[i];} return 0; }
function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random()-0.5); }

function Res({ prize, accent, onPlayAgain, lang }: { prize: number; accent: string; onPlayAgain: () => void; lang: Lang }) {
  return (
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} style={{ textAlign:'center', paddingTop:4 }}>
      {prize > 0
        ? <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:26, fontWeight:900, background:`linear-gradient(90deg,${accent},#22c55e)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>+{prize.toLocaleString()} SKZ</div>
        : <div style={{ fontSize:13, color:'#475569', fontWeight:600 }}>{lang==='ar' ? 'حظاً أوفر المرة القادمة' : 'Better luck next time'}</div>
      }
      <button onClick={onPlayAgain} style={{ marginTop:10, padding:'12px 0', borderRadius:12, border:`1px solid ${accent}44`, background:'rgba(15,25,15,0.6)', color:accent, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Tajawal",sans-serif', width:'100%' }}>
        {lang==='ar' ? 'العب مرة أخرى' : 'Play Again'}
      </button>
    </motion.div>
  );
}

// ── GAME 4: YOUR LUCKY NUMBER ────────────────────────────────────────────────
export function YourNumber({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';

  const [[prize, yourNum, pool]] = useState<[number, number, Array<{num:number,prize:number|null}>]>(() => {
    const p = roll(tier);
    const yourN = Math.floor(Math.random()*30)+1;
    const nums: number[] = [];
    while (nums.length < (p>0 ? 7 : 8)) {
      const n = Math.floor(Math.random()*30)+1;
      if (n !== yourN && !nums.includes(n)) nums.push(n);
    }
    if (p > 0) nums.push(yourNum); // insert match
    const shuffled = shuffle(nums);
    const prizes = shuffle([...tier.prizes.slice(1), 0, 0, 0, 0]).slice(0,8);
    return [p, yourN, shuffled.map((n,i) => ({ num:n, prize: n===yourN ? p : prizes[i] ?? 0 }))];
  });

  const called = useRef(false);
  const [yourRevealed, setYourRevealed] = useState(false);
  const [poolRevealed, setPoolRevealed] = useState<boolean[]>(Array(8).fill(false));
  const [matchIdx, setMatchIdx] = useState(-1);
  const [done, setDone] = useState(false);

  function tapPool(i: number) {
    if (!yourRevealed || poolRevealed[i] || done) return;
    const n = [...poolRevealed]; n[i]=true; setPoolRevealed(n);
    if (pool[i].num === yourNum) {
      setMatchIdx(i);
      if (!called.current) { called.current=true; onResult(prize); }
      setDone(true);
    } else if (n.every(Boolean)) {
      if (!called.current) { called.current=true; onResult(0); }
      setDone(true);
    }
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      {/* YOUR NUMBER */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontSize:10, color:game.accent, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
          {isRtl ? 'رقمك المحظوظ' : 'Your Lucky Number'}
        </div>
        <ScratchZone width={90} height={70} c1={game.color1} c2={game.color2} emoji="?" label={isRtl?'احك':'Scratch'} onScratched={() => setYourRevealed(true)}>
          <div style={{ width:90, height:70, display:'flex', alignItems:'center', justifyContent:'center', background:'#0a1014', borderRadius:14 }}>
            <span style={{ fontFamily:'"Orbitron",sans-serif', fontSize:30, fontWeight:900, color:game.accent }}>{yourNum}</span>
          </div>
        </ScratchZone>
      </div>

      {/* PRIZE POOL */}
      <AnimatePresence>
        {yourRevealed && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ width:'100%' }}>
            <div style={{ fontSize:10, color:'#64748b', textAlign:'center', marginBottom:6 }}>
              {isRtl ? 'ابحث عن رقمك في الأرقام الثمانية:' : 'Find your number in the 8 prizes:'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {pool.map((item,i) => (
                <motion.button key={i} whileTap={{ scale:0.9 }} onClick={() => tapPool(i)} style={{ height:56, borderRadius:10, border: matchIdx===i ? `2px solid ${game.accent}` : poolRevealed[i] ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${game.accent}33`, background: matchIdx===i ? `${game.color1}88` : poolRevealed[i] ? '#0a1014' : `${game.color1}44`, cursor: poolRevealed[i]?'default':'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, boxShadow: matchIdx===i ? `0 0 14px ${game.accent}66` : 'none' }}>
                  <AnimatePresence mode="wait">
                    {!poolRevealed[i]
                      ? <motion.span key="h" exit={{ scale:0 }} style={{ fontSize:14, color:game.accent, fontWeight:700 }}>?</motion.span>
                      : <motion.div key="v" initial={{ scale:0 }} animate={{ scale:1 }} style={{ textAlign:'center' }}>
                          <div style={{ fontSize:14, fontWeight:900, color: matchIdx===i ? game.accent : '#64748b', fontFamily:'"Orbitron",sans-serif' }}>{item.num}</div>
                          {matchIdx===i && <div style={{ fontSize:9, color:'#22c55e', fontWeight:700 }}>WIN!</div>}
                        </motion.div>
                    }
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {done && <Res prize={matchIdx>=0 ? prize : 0} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 5: TRIPLE DICE ──────────────────────────────────────────────────────
const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

export function TripleDice({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';

  const [[prize, dice, comboName]] = useState<[number, number[], string]>(() => {
    const p = roll(tier);
    const top = tier.prizes[tier.prizes.length-1];
    const ratio = p / top;
    if (p > 0) {
      if (ratio >= 0.9) return [p, [6,6,6], isRtl ? 'ثلاثة سداسات — جاكبوت!' : 'Triple 6s — JACKPOT!'];
      if (ratio >= 0.6) return [p, [5,5,5], isRtl ? 'ثلاثة أخماس!' : 'Triple 5s!'];
      if (ratio >= 0.35) {
        const d = Math.floor(Math.random()*4)+1;
        return [p, [d,d,d], isRtl ? `ثلاثة ${d}s!` : `Triple ${d}s!`];
      }
      // Pair
      const pair = Math.floor(Math.random()*6)+1;
      let other: number; do { other=Math.floor(Math.random()*6)+1; } while(other===pair);
      const order = shuffle([pair,pair,other]);
      return [p, order, isRtl ? 'زوج — ربح!' : 'Pair — Win!'];
    }
    // No combo
    let d: number[];
    do { d = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]; }
    while (d[0]===d[1] || d[1]===d[2] || d[0]===d[2]);
    return [p, d, ''];
  });

  const [display, setDisplay] = useState([1,1,1]);
  const [settled, setSettled] = useState([false,false,false]);
  const called = useRef(false);

  useEffect(() => {
    const ivs: ReturnType<typeof setInterval>[] = [];
    dice.forEach((finalVal, i) => {
      const iv = setInterval(() => {
        setDisplay(prev => { const n=[...prev]; n[i]=Math.floor(Math.random()*6)+1; return n; });
      }, 70);
      ivs.push(iv);
      setTimeout(() => {
        clearInterval(iv);
        setDisplay(prev => { const n=[...prev]; n[i]=finalVal; return n; });
        setSettled(prev => { const n=[...prev]; n[i]=true; return n; });
        if (i===2) setTimeout(() => { if(!called.current){called.current=true; onResult(prize);} }, 400);
      }, 500 + i*380);
    });
    return () => ivs.forEach(clearInterval);
  }, []);

  const allSettled = settled.every(Boolean);
  const won = prize > 0;

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>
      <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
        {display.map((d,i) => (
          <motion.div key={i} animate={{ rotate: !settled[i] ? [0,5,-5,5,-5,0] : 0 }} transition={{ repeat: !settled[i] ? Infinity : 0, duration:0.2 }} style={{ width:80, height:80, borderRadius:16, background: settled[i]&&won ? `linear-gradient(135deg,${game.color1}cc,${game.color2})` : '#0f1520', border: settled[i]&&won ? `2px solid ${game.accent}` : '1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, boxShadow: settled[i]&&won ? `0 0 20px ${game.accent}44` : 'none' }}>
            {DICE_FACES[d-1]}
          </motion.div>
        ))}
      </div>
      {allSettled && comboName && (
        <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} style={{ fontSize:12, fontWeight:800, color: won ? game.accent : '#475569', textAlign:'center' }}>
          {comboName}
        </motion.div>
      )}
      {allSettled && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 6: BINGO (3×3 CARD) ────────────────────────────────────────────────
export function BingoGame({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const BINGO_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  const [[prize, card, drawn]] = useState<[number, number[], number[]]>(() => {
    const p = roll(tier);
    const nums = shuffle(Array.from({length:25},(_,i)=>i+1));
    const myCard = nums.slice(0,9);
    // drawn numbers: if win, ensure at least one complete line on card
    if (p > 0) {
      // Force row 0 on card to be in drawn
      const forced = [myCard[0], myCard[1], myCard[2]];
      const rest = shuffle(nums.slice(9)).slice(0,2);
      return [p, myCard, shuffle([...forced, ...rest])];
    }
    // No complete line: draw numbers not completing any line
    const dr = shuffle(nums.slice(9)).slice(0,5);
    return [p, myCard, dr];
  });

  const called = useRef(false);
  const [drawIdx, setDrawIdx] = useState(0);
  const [marked, setMarked] = useState<boolean[]>(Array(9).fill(false));
  const [winLine, setWinLine] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  function drawNext() {
    if (drawIdx >= drawn.length || done) return;
    const drawnNum = drawn[drawIdx];
    const newMarked = card.map((n,i) => marked[i] || n===drawnNum);
    setMarked(newMarked);
    setDrawIdx(i => i+1);
    // Check for win
    const wl = BINGO_LINES.find(l => l.every(i => newMarked[i]));
    if (wl) {
      setWinLine(wl);
      if (!called.current) { called.current=true; onResult(prize); }
      setDone(true);
    } else if (drawIdx+1 >= drawn.length) {
      if (!called.current) { called.current=true; onResult(0); }
      setDone(true);
    }
  }

  const winCells = new Set(winLine);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      {/* Drawn numbers strip */}
      <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
        {drawn.slice(0, drawIdx).map((n,i) => (
          <motion.div key={i} initial={{ scale:0 }} animate={{ scale:1 }} style={{ width:32, height:32, borderRadius:8, background:`${game.color1}88`, border:`1px solid ${game.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:game.accent, fontFamily:'"Orbitron",sans-serif' }}>{n}</motion.div>
        ))}
        {drawn.slice(drawIdx).map((_,i) => (
          <div key={`h${i}`} style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'rgba(15,25,15,0.4)' }} />
        ))}
      </div>

      {/* Bingo card */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, width:240 }}>
        {card.map((n,i) => (
          <div key={i} style={{ height:68, borderRadius:10, border: winCells.has(i) ? `2px solid ${game.accent}` : marked[i] ? `1px solid ${game.accent}55` : '1px solid rgba(255,255,255,0.06)', background: winCells.has(i) ? `linear-gradient(135deg,${game.color1}cc,${game.color2})` : marked[i] ? `${game.color1}44` : '#0a1014', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.25s', boxShadow: winCells.has(i) ? `0 0 12px ${game.accent}55` : 'none' }}>
            <span style={{ fontFamily:'"Orbitron",sans-serif', fontSize:16, fontWeight:900, color: winCells.has(i) ? game.accent : marked[i] ? '#22c55e' : '#475569' }}>{n}</span>
          </div>
        ))}
      </div>

      {!done && drawIdx < drawn.length && (
        <motion.button whileTap={{ scale:0.96 }} onClick={drawNext} style={{ padding:'12px 32px', borderRadius:12, background:`linear-gradient(135deg,${game.color1}cc,${game.color2})`, color:game.accent, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'"Tajawal",sans-serif', border:`1px solid ${game.accent}44` } as React.CSSProperties}>
          {isRtl ? `سحب الرقم التالي (${drawIdx+1}/5)` : `Draw Next (${drawIdx+1}/5)`}
        </motion.button>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
