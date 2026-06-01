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

// ── GAME 13: MULTIPLIER (base × multiplier) ───────────────────────────────────
export function Multiplier({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const MULTS = [1,2,3,5,10];

  const [[prize, basePrize, mult]] = useState<[number, number, number]>(() => {
    const p = roll(tier);
    if (p === 0) return [p, 0, 1];
    const chosenMult = MULTS[Math.floor(Math.random()*MULTS.length)];
    const base = Math.round(p / chosenMult);
    return [p, base, chosenMult];
  });

  const called = useRef(false);
  const [baseR, setBaseR] = useState(false);
  const [multR, setMultR] = useState(false);

  function check(br: boolean, mr: boolean) {
    if (br && mr && !called.current) { called.current=true; onResult(prize); }
  }

  const bothDone = baseR && multR;

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
        {/* Base prize zone */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
          <div style={{ fontSize:10, color:'#64748b', fontWeight:700 }}>{isRtl ? 'الجائزة الأساسية' : 'BASE PRIZE'}</div>
          <ScratchZone width={100} height={90} c1={game.color1} c2={game.color2} emoji="●" label={isRtl?'احك':'Scratch'} onScratched={() => { setBaseR(true); check(true, multR); }}>
            <div style={{ width:100, height:90, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a1014', borderRadius:14, gap:2 }}>
              {prize > 0 ? (
                <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:20, fontWeight:900, color:game.accent }}>{basePrize}</div>
              ) : (
                <div style={{ fontSize:22, color:'#475569' }}>0</div>
              )}
              <div style={{ fontSize:10, color:'#475569' }}>SKZ</div>
            </div>
          </ScratchZone>
        </div>

        {/* Multiply sign */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:22 }}>
          <div style={{ fontSize:24, fontWeight:900, color:'#475569' }}>×</div>
          {bothDone && prize>0 && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:11, color:'#64748b', marginTop:2 }}>=</motion.div>
          )}
        </div>

        {/* Multiplier zone */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
          <div style={{ fontSize:10, color:'#64748b', fontWeight:700 }}>{isRtl ? 'المضاعف' : 'MULTIPLIER'}</div>
          <ScratchZone width={100} height={90} c1={game.color1} c2={game.color2} emoji="✦" label={isRtl?'احك':'Scratch'} onScratched={() => { setMultR(true); check(baseR, true); }}>
            <div style={{ width:100, height:90, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a1014', borderRadius:14, gap:2 }}>
              <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize:26, fontWeight:900, color: mult>1 ? game.accent : '#475569' }}>{mult}×</div>
              {mult > 1 && <div style={{ fontSize:9, color:game.accent, fontWeight:700 }}>{isRtl ? 'مضاعف!' : 'BOOST!'}</div>}
            </div>
          </ScratchZone>
        </div>
      </div>

      {bothDone && prize > 0 && (
        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(15,25,15,0.5)', border:`1px solid ${game.accent}44`, borderRadius:12, padding:'8px 16px' }}>
          <span style={{ fontSize:12, color:'#64748b' }}>{basePrize} × {mult} =</span>
          <span style={{ fontFamily:'"Orbitron",sans-serif', fontSize:16, fontWeight:900, color:game.accent }}>{prize.toLocaleString()} SKZ</span>
        </motion.div>
      )}
      {bothDone && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 14: TREASURE HUNT (3×3 grid, 5 digs) ────────────────────────────────
const ITEMS = ['X','X','X','X','C','C','G','G','T'] as const;
const ITEM_GLYPHS: Record<string,string> = { 'X':'✗', 'C':'●', 'G':'◆', 'T':'✦' };
const ITEM_VALS: Record<string,number> = { 'X':0, 'C':0.05, 'G':0.2, 'T':1.0 };
const ITEM_NAMES_AR: Record<string,string> = { 'X':'فراغ', 'C':'عملة', 'G':'جوهرة', 'T':'كنز!' };
const ITEM_NAMES_EN: Record<string,string> = { 'X':'Empty', 'C':'Coin', 'G':'Gem', 'T':'Treasure!' };

export function TreasureHunt({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const MAX_DIGS = 5;

  const [[prize, grid]] = useState<[number, string[]]>(() => {
    const p = roll(tier);
    if (p === 0) return [p, shuffle([...ITEMS]) as string[]];
    const top = tier.prizes[tier.prizes.length-1];
    const ratio = p / top;
    if (ratio >= 0.9) return [p, shuffle(['T','G','G','G','C','C','X','X','X']) as string[]];
    if (ratio >= 0.5) return [p, shuffle(['G','G','C','C','C','X','X','X','X']) as string[]];
    return [p, shuffle(['C','C','C','X','X','X','X','X','X']) as string[]];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [digsLeft, setDigsLeft] = useState(MAX_DIGS);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  function dig(i: number) {
    if (revealed[i] || digsLeft<=0 || done) return;
    const n=[...revealed]; n[i]=true; setRevealed(n);
    const val = Math.round(prize * (ITEM_VALS[grid[i]] || 0));
    const newTotal = total + val;
    setTotal(newTotal);
    const newDigs = digsLeft - 1;
    setDigsLeft(newDigs);
    if (newDigs===0 && !called.current) {
      called.current=true;
      onResult(newTotal > 0 ? prize : 0);
      setDone(true);
    }
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      {/* Digs left + total */}
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ padding:'5px 12px', borderRadius:8, background:`${game.color1}44`, border:`1px solid ${game.accent}33`, fontSize:11, color:game.accent, fontWeight:700 }}>
          {isRtl ? `${digsLeft} حفريات` : `${digsLeft} digs left`}
        </div>
        <div style={{ padding:'5px 12px', borderRadius:8, background:'rgba(15,25,15,0.5)', border:`1px solid ${game.accent}33`, fontFamily:'"Orbitron",sans-serif', fontSize:11, fontWeight:900, color:game.accent }}>
          {total > 0 ? `+${total}` : '0'} SKZ
        </div>
      </div>

      {/* 3×3 map grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, width:264 }}>
        {grid.map((item,i) => (
          <motion.button key={i} whileTap={{ scale:0.9 }} onClick={() => dig(i)} style={{ height:76, borderRadius:12, border: revealed[i] ? `1px solid ${item!=='X'?game.accent+'55':'rgba(255,255,255,0.06)'}` : `1px solid ${game.accent}44`, background: revealed[i] ? (item!=='X' ? `${game.color1}66` : '#0a1014') : `${game.color1}44`, cursor: (revealed[i]||digsLeft<=0) ? 'default' : 'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, opacity: !revealed[i]&&digsLeft<=0 ? 0.3 : 1 }}>
            <AnimatePresence mode="wait">
              {!revealed[i]
                ? <motion.div key="h" exit={{ scale:0 }} style={{ fontSize:22 }}>◈</motion.div>
                : <motion.div key="v" initial={{ scale:0, rotate:15 }} animate={{ scale:1, rotate:0 }} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:26 }}>{ITEM_GLYPHS[item] ?? item}</div>
                    <div style={{ fontSize:8, fontWeight:700, color: item!=='X' ? game.accent : '#475569' }}>
                      {isRtl ? ITEM_NAMES_AR[item] : ITEM_NAMES_EN[item]}
                    </div>
                  </motion.div>
              }
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
      {done && <Res prize={total>0 ? prize : 0} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 15: PYRAMID (6 tiles, bottom→top, chain multiplier) ─────────────────
export function Pyramid({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  // Pyramid: row0=[0,1,2], row1=[3,4], row2=[5]
  const LAYOUTS = [[0,1,2],[3,4],[5]];

  const [[prize, labels, multipliers]] = useState<[number, string[], number[]]>(() => {
    const p = roll(tier);
    if (p === 0) {
      return [p, ['×1','×1','×1','×2','×1','?'], [1,1,1,2,1,0]];
    }
    const top = tier.prizes[tier.prizes.length-1];
    const ratio = p / top;
    if (ratio >= 0.9) return [p, ['×2','×2','×2','×3','×3','✦'], [2,2,2,3,3,1]];
    if (ratio >= 0.5) return [p, ['×1','×2','×2','×2','×3','★'], [1,2,2,2,3,1]];
    return [p, ['×1','×1','×2','×2','×1','●'], [1,1,2,2,1,1]];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(6).fill(false));
  const [phase, setPhase] = useState(0); // 0=base row, 1=mid, 2=top
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    if (revealed[i] || done) return;
    const n=[...revealed]; n[i]=true; setRevealed(n);
    // Check if current phase is complete
    const rowIndices = LAYOUTS[phase];
    if (rowIndices.every(ri => n[ri])) {
      if (phase < 2) setPhase(p => p+1);
      else {
        if (!called.current) { called.current=true; onResult(prize); }
        setDone(true);
      }
    }
  }

  const canScratch = (i: number) => {
    const myRow = LAYOUTS.findIndex(row => row.includes(i));
    return myRow === phase;
  };

  const ROW_COLORS = [game.accent+'bb', game.accent+'dd', game.accent];

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      {/* Pyramid */}
      <div style={{ display:'flex', flexDirection:'column-reverse', gap:6, alignItems:'center' }}>
        {LAYOUTS.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display:'flex', gap:6 }}>
            {row.map(tileIdx => {
              const active = canScratch(tileIdx) && !done;
              const rev = revealed[tileIdx];
              return (
                <ScratchZone key={tileIdx} width={76} height={70}
                  c1={game.color1} c2={game.color2}
                  emoji={active ? '?' : undefined}
                  label={active ? (isRtl?'احك':'Scratch') : undefined}
                  disabled={!active || rev}
                  onScratched={() => scratch(tileIdx)}
                  style={{ opacity: rowIdx > phase ? 0.35 : 1 }}
                >
                  <div style={{ width:76, height:70, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a1014', borderRadius:12, border: rev ? `2px solid ${ROW_COLORS[rowIdx]}` : `1px solid ${game.accent}33`, boxShadow: rev ? `0 0 12px ${ROW_COLORS[rowIdx]}44` : 'none' }}>
                    <div style={{ fontFamily:'"Orbitron",sans-serif', fontSize: rowIdx===2 ? 20 : 18, fontWeight:900, color:ROW_COLORS[rowIdx] }}>
                      {rev ? labels[tileIdx] : (rowIdx===0 ? '◆' : rowIdx===1 ? '◈' : '✦')}
                    </div>
                    {rowIdx===2 && rev && prize>0 && (
                      <div style={{ fontSize:10, color:'#22c55e', fontWeight:700 }}>
                        {prize.toLocaleString()} SKZ
                      </div>
                    )}
                  </div>
                </ScratchZone>
              );
            })}
          </div>
        ))}
      </div>

      {/* Phase indicator */}
      {!done && (
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {LAYOUTS.map((_, ri) => (
            <div key={ri} style={{ height:3, width:60, borderRadius:99, background: ri<=phase ? `linear-gradient(90deg,${game.accent},#22c55e)` : 'rgba(255,255,255,0.08)', transition:'background 0.3s' }} />
          ))}
        </div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
