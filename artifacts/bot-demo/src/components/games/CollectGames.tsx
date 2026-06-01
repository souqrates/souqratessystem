import { useState, useRef } from 'react';
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

// ── GAME 10: CASH BAGS (scratch all 5, sum amounts) ──────────────────────────
export function CashBags({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';

  const [[prize, bags]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    if (p === 0) return [p, [0,0,0,0,0]];
    const parts = shuffle([
      Math.round(p * 0.4), Math.round(p * 0.3),
      Math.round(p * 0.15), Math.round(p * 0.1),
      p - Math.round(p*0.4) - Math.round(p*0.3) - Math.round(p*0.15) - Math.round(p*0.1),
    ]);
    const withZeros = Math.random() > 0.5 ? [...parts.slice(0,3), 0, 0].sort(() => Math.random()-0.5) : parts;
    const diff = p - withZeros.reduce((a,b)=>a+b,0);
    withZeros[0] += diff;
    return [p, withZeros.map(v => Math.max(0,v))];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(5).fill(false));
  const [done, setDone] = useState(false);
  const total = bags.reduce((a,b,i) => a + (revealed[i] ? b : 0), 0);

  function scratch(i: number) {
    if (revealed[i] || done) return;
    const n=[...revealed]; n[i]=true; setRevealed(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const BONUS_IDX = prize>0 ? bags.indexOf(Math.max(...bags)) : -1;
  const BAG_LABELS = ['◆','★','◈','✦','◆']; // game-symbol: collect-bag face labels

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(15,25,15,0.5)', border:`1px solid ${game.accent}33`, borderRadius:10, padding:'6px 16px' }}>
        <span style={{ fontSize:11, color:'#64748b' }}>{isRtl ? 'المجموع:' : 'Total:'}</span>
        <span style={{ fontFamily:'"Orbitron",sans-serif', fontSize:16, fontWeight:900, color:game.accent }}>{total.toLocaleString()} SKZ</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
        <div style={{ display:'flex', gap:8 }}>
          {[0,1,2].map(i => (
            <ScratchZone key={i} width={82} height={90} c1={game.color1} c2={game.color2} label={BAG_LABELS[i]} onScratched={() => scratch(i)}>
              <div style={{ width:82, height:90, borderRadius:14, border: revealed[i] ? `1px solid ${bags[i]>0?game.accent+'55':'rgba(255,255,255,0.06)'}` : `1px solid ${game.accent}44`, background: revealed[i] ? (bags[i]>0 ? `${game.color1}66` : '#0a1014') : `${game.color1}44`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, boxShadow: i===BONUS_IDX&&revealed[i] ? `0 0 16px ${game.accent}55` : 'none' }}>
                {revealed[i] && (
                  <motion.div initial={{ scale:0, y:8 }} animate={{ scale:1, y:0 }} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:18, color: bags[i]>0 ? game.accent : '#475569' }}>{bags[i]>0 ? '◆' : '◈'}</div>
                    <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:13, fontWeight:900, color: bags[i]>0 ? game.accent : '#475569' }}>
                      {bags[i]>0 ? `+${bags[i]}` : '—'}
                    </div>
                  </motion.div>
                )}
              </div>
            </ScratchZone>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[3,4].map(i => (
            <ScratchZone key={i} width={82} height={90} c1={game.color1} c2={game.color2} label={BAG_LABELS[i]} onScratched={() => scratch(i)}>
              <div style={{ width:82, height:90, borderRadius:14, border: revealed[i] ? `1px solid ${bags[i]>0?game.accent+'55':'rgba(255,255,255,0.06)'}` : `1px solid ${game.accent}44`, background: revealed[i] ? (bags[i]>0 ? `${game.color1}66` : '#0a1014') : `${game.color1}44`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, boxShadow: i===BONUS_IDX&&revealed[i] ? `0 0 16px ${game.accent}55` : 'none' }}>
                {revealed[i] && (
                  <motion.div initial={{ scale:0, y:8 }} animate={{ scale:1, y:0 }} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:18, color: bags[i]>0 ? game.accent : '#475569' }}>{bags[i]>0 ? '◆' : '◈'}</div>
                    <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:13, fontWeight:900, color: bags[i]>0 ? game.accent : '#475569' }}>
                      {bags[i]>0 ? `+${bags[i]}` : '—'}
                    </div>
                  </motion.div>
                )}
              </div>
            </ScratchZone>
          ))}
        </div>
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 11: LUCKY ENVELOPES (scratch any 3 of 9) ────────────────────────────
export function Envelopes({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const MAX_PICKS = 3;

  const [[prize, amounts]] = useState<[number, number[]]>(() => {
    const p = roll(tier);
    const base = Array(9).fill(0);
    if (p > 0) {
      const picks = shuffle([0,1,2,3,4,5,6,7,8]).slice(0,3);
      picks.forEach((idx,i) => { base[idx] = i===0 ? Math.round(p*0.5) : i===1 ? Math.round(p*0.35) : p-Math.round(p*0.5)-Math.round(p*0.35); });
    }
    return [p, base];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [picksLeft, setPicksLeft] = useState(MAX_PICKS);
  const [runningTotal, setRunningTotal] = useState(0);
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    if (revealed[i] || picksLeft<=0 || done) return;
    const n=[...revealed]; n[i]=true; setRevealed(n);
    const newTotal = runningTotal + amounts[i];
    setRunningTotal(newTotal);
    const newLeft = picksLeft - 1;
    setPicksLeft(newLeft);
    if (newLeft===0 && !called.current) {
      called.current=true;
      onResult(newTotal);
      setDone(true);
    }
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ padding:'5px 12px', borderRadius:8, background:`${game.color1}44`, border:`1px solid ${game.accent}33`, fontSize:11, color:game.accent, fontWeight:700 }}>
          {isRtl ? `اختر ${picksLeft} أكثر` : `${picksLeft} picks left`}
        </div>
        <div style={{ padding:'5px 12px', borderRadius:8, background:'rgba(15,25,15,0.5)', border:`1px solid ${game.accent}33`, fontSize:11, fontFamily:'"Orbitron",sans-serif', fontWeight:900, color:game.accent }}>
          {runningTotal.toLocaleString()} SKZ
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, width:270 }}>
        {amounts.map((amt,i) => (
          <ScratchZone key={i} width={82} height={76} c1={game.color1} c2={game.color2}
            label={picksLeft>0&&!revealed[i] ? (isRtl?'احك':'Scratch') : undefined}
            disabled={revealed[i] || picksLeft<=0}
            onScratched={() => scratch(i)}
          >
            <div style={{ width:82, height:76, borderRadius:14, border: revealed[i] ? `1px solid ${amt>0?game.accent+'55':'rgba(255,255,255,0.06)'}` : `1px solid ${game.accent}44`, background: revealed[i] ? (amt>0 ? `${game.color1}66` : '#0a1014') : `${game.color1}44`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, opacity: !revealed[i]&&picksLeft<=0 ? 0.3 : 1 }}>
              {revealed[i] ? (
                <motion.div initial={{ scale:0, rotate:-10 }} animate={{ scale:1, rotate:0 }} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, color: amt>0 ? game.accent : '#475569' }}>{amt>0 ? '✦' : '◈'}</div>
                  <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:12, fontWeight:900, color: amt>0 ? game.accent : '#475569' }}>
                    {amt>0 ? `+${amt}` : '—'}
                  </div>
                </motion.div>
              ) : (
                <div style={{ fontSize:22, color:`${game.accent}55` }}>✉</div>
              )}
            </div>
          </ScratchZone>
        ))}
      </div>
      {done && <Res prize={runningTotal} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 12: SYMBOL MATCH ────────────────────────────────────────────────────
const ALL_SYMS = ['★','◆','✦','◈','☽','⚡','✿','⭐','♦','▲']; // game-symbol: symbol-match face values

export function SymbolMatch({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';

  const [[prize, yourSyms, winningSyms]] = useState<[number, string[], string[]]>(() => {
    const p = roll(tier);
    const sh = shuffle(ALL_SYMS);
    const yours = sh.slice(0,3);
    if (p > 0) {
      const matchSym = yours[Math.floor(Math.random() * 3)];
      const winning = shuffle([matchSym, ...sh.slice(3, 7)]).slice(0, 5);
      return [p, yours, winning];
    }
    const winning = sh.filter(s => !yours.includes(s)).slice(0, 5);
    return [p, yours, winning];
  });

  const called = useRef(false);
  const [yourRevealed, setYourRevealed] = useState(false);
  const [winRevealed, setWinRevealed] = useState<boolean[]>(Array(5).fill(false));
  const [done, setDone] = useState(false);

  function tapWin(i: number) {
    if (!yourRevealed || winRevealed[i] || done) return;
    const n=[...winRevealed]; n[i]=true; setWinRevealed(n);
    if (n.every(Boolean) && !called.current) {
      const hasMatch = yourSyms.some(s => winningSyms.includes(s));
      called.current=true;
      onResult(hasMatch ? prize : 0);
      setDone(true);
    }
  }

  const matchedSyms = new Set(done ? yourSyms.filter(s => winningSyms.includes(s)) : []);

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ display:'flex', gap:14, width:'100%', justifyContent:'center', alignItems:'flex-start' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <div style={{ fontSize:10, color:game.accent, fontWeight:700, letterSpacing:'0.06em' }}>
            {isRtl ? 'رموزك' : 'YOUR SYMBOLS'}
          </div>
          <ScratchZone width={84} height={94} c1={game.color1} c2={game.color2} label={isRtl?'احك':'Scratch'} onScratched={() => setYourRevealed(true)}>
            <div style={{ width:84, height:94, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, background:'#0a1014', borderRadius:14 }}>
              {yourSyms.map((s,i) => (
                <div key={i} style={{ fontSize:18, fontWeight:900, color: matchedSyms.has(s) ? game.accent : '#64748b' }}>{s}</div>
              ))}
            </div>
          </ScratchZone>
        </div>

        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', paddingTop:28, fontSize:18, color:'#334155', fontWeight:900 }}>vs</div>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <div style={{ fontSize:10, color:'#64748b', fontWeight:700, letterSpacing:'0.06em' }}>
            {isRtl ? 'الرموز الفائزة' : 'WINNING SYMBOLS'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4 }}>
            {winningSyms.map((s,i) => (
              <motion.button key={i} whileTap={{ scale:0.9 }} onClick={() => tapWin(i)} style={{ width:46, height:44, borderRadius:8, border: winRevealed[i] ? `1px solid ${matchedSyms.has(s)?game.accent+'88':'rgba(255,255,255,0.08)'}` : `1px solid ${game.accent}33`, background: winRevealed[i] ? (matchedSyms.has(s) ? `${game.color1}88` : '#0a1014') : `${game.color1}44`, cursor:winRevealed[i]?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, boxShadow: matchedSyms.has(s)&&winRevealed[i] ? `0 0 10px ${game.accent}55` : 'none', opacity: !yourRevealed&&!winRevealed[i] ? 0.4 : 1 }}>
                <AnimatePresence mode="wait">
                  {!winRevealed[i]
                    ? <motion.span key="h" exit={{ scale:0 }} style={{ color:game.accent, fontSize:12, fontWeight:700 }}>?</motion.span>
                    : <motion.span key="v" initial={{ scale:0 }} animate={{ scale:1 }} style={{ color: winRevealed[i] ? (matchedSyms.has(s) ? game.accent : '#475569') : 'transparent' }}>{s}</motion.span>
                  }
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {!yourRevealed && (
        <div style={{ fontSize:11, color:'#475569' }}>{isRtl ? '← احك رموزك أولاً' : '← Scratch your symbols first'}</div>
      )}
      {done && <Res prize={matchedSyms.size>0 ? prize : 0} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
