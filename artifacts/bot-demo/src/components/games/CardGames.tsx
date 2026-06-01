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

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const SUIT_COLORS: Record<string,string> = { '♠':'#e2e8f0', '♣':'#e2e8f0', '♥':'#f87171', '♦':'#f87171' };

// ── GAME 7: BEAT THE DEALER ──────────────────────────────────────────────────
export function BeatDealer({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';

  const [[prize, yourCard, dealerCard]] = useState<[number, {rank:string,suit:string,val:number}, {rank:string,suit:string,val:number}]>(() => {
    const p = roll(tier);
    const ranks = [...RANKS];
    const allCards = ranks.flatMap(r => SUITS.map(s => ({ rank:r, suit:s, val:ranks.indexOf(r) })));
    const sh = shuffle(allCards);
    let yc = sh[0], dc = sh[1];
    if (p > 0) {
      while (yc.val <= dc.val) { const s2 = shuffle(allCards); yc=s2[0]; dc=s2[1]; }
    } else {
      while (dc.val <= yc.val) { const s2 = shuffle(allCards); yc=s2[0]; dc=s2[1]; }
    }
    return [p, yc, dc];
  });

  const called = useRef(false);
  const [yourR, setYourR] = useState(false);
  const [dealerR, setDealerR] = useState(false);

  function bothRevealed(yr: boolean, dr: boolean) {
    if (yr && dr && !called.current) { called.current=true; onResult(prize); }
  }

  function CardFace({ card, label }: { card: {rank:string,suit:string,val:number}, label: string }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontSize:10, color:'#64748b', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</div>
        <div style={{ width:80, height:110, borderRadius:12, background:'#f8fafc', border:'1px solid rgba(255,255,255,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
          <div style={{ fontSize:28, fontWeight:900, color: SUIT_COLORS[card.suit], lineHeight:1 }}>{card.rank}</div>
          <div style={{ fontSize:20, color: SUIT_COLORS[card.suit] }}>{card.suit}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'center' }}>
        <ScratchZone width={90} height={120} c1={game.color1} c2={game.color2} label={isRtl?'احك':'Scratch'} onScratched={() => { setYourR(true); bothRevealed(true, dealerR); }}>
          <CardFace card={yourCard} label={isRtl ? 'بطاقتك' : 'Your Card'} />
        </ScratchZone>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div style={{ fontSize:18, fontWeight:900, color:'#475569' }}>VS</div>
          {yourR && dealerR && (
            <motion.div initial={{ scale:0 }} animate={{ scale:1 }} style={{ fontSize:11, fontWeight:800, color: prize>0 ? game.accent : '#f87171', textAlign:'center' }}>
              {prize>0 ? (isRtl ? 'فزت! ✓' : 'You Win! ✓') : (isRtl ? 'خسرت ✗' : 'Lost ✗')}
            </motion.div>
          )}
        </div>

        <ScratchZone width={90} height={120} c1={game.color1} c2={game.color2} label={isRtl?'احك':'Scratch'} onScratched={() => { setDealerR(true); bothRevealed(yourR, true); }}>
          <CardFace card={dealerCard} label={isRtl ? 'الخصم' : 'Dealer'} />
        </ScratchZone>
      </div>

      {yourR && dealerR && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 8: POKER SCRATCH (scratch to reveal all 5 cards) ────────────────────
const HAND_NAMES_AR = ['', 'زوج واحد', 'زوجان', 'ثلاثة متطابقة', 'ستريت', 'فلاش', 'فول هاوس', 'أربعة متطابقة', 'فلاش ملكي'];
const HAND_NAMES_EN = ['', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Royal Flush'];
type PCard = { rank: string; suit: string };

function pregenHand(prize: number, tier: TierDef): PCard[] {
  const top = tier.prizes[tier.prizes.length-1];
  const ratio = prize / top;
  if (prize === 0) return [{rank:'K',suit:'♠'},{rank:'J',suit:'♥'},{rank:'9',suit:'♦'},{rank:'7',suit:'♣'},{rank:'5',suit:'♠'}];
  if (ratio >= 0.9) return [{rank:'A',suit:'♠'},{rank:'K',suit:'♠'},{rank:'Q',suit:'♠'},{rank:'J',suit:'♠'},{rank:'10',suit:'♠'}];
  if (ratio >= 0.6) return [{rank:'A',suit:'♠'},{rank:'A',suit:'♥'},{rank:'A',suit:'♦'},{rank:'A',suit:'♣'},{rank:'K',suit:'♠'}];
  if (ratio >= 0.4) return [{rank:'A',suit:'♠'},{rank:'A',suit:'♥'},{rank:'A',suit:'♦'},{rank:'K',suit:'♣'},{rank:'K',suit:'♠'}];
  if (ratio >= 0.2) return [{rank:'A',suit:'♠'},{rank:'A',suit:'♥'},{rank:'A',suit:'♦'},{rank:'Q',suit:'♣'},{rank:'J',suit:'♠'}];
  return [{rank:'K',suit:'♠'},{rank:'K',suit:'♥'},{rank:'J',suit:'♦'},{rank:'J',suit:'♣'},{rank:'A',suit:'♠'}];
}

function handName(prize: number, tier: TierDef, lang: Lang): string {
  const top = tier.prizes[tier.prizes.length-1];
  const ratio = prize / top;
  const names = lang==='ar' ? HAND_NAMES_AR : HAND_NAMES_EN;
  if (prize === 0) return '';
  if (ratio >= 0.9) return names[8];
  if (ratio >= 0.6) return names[7];
  if (ratio >= 0.4) return names[6];
  if (ratio >= 0.2) return names[3];
  return names[1];
}

export function PokerGame({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const [[prize, hand]] = useState<[number, PCard[]]>(() => {
    const p = roll(tier);
    return [p, pregenHand(p, tier)];
  });
  const called = useRef(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(5).fill(false));
  const [done, setDone] = useState(false);

  function scratch(i: number) {
    const n=[...revealed]; n[i]=true; setRevealed(n);
    if (n.every(Boolean) && !called.current) { called.current=true; onResult(prize); setDone(true); }
  }

  const hn = done ? handName(prize, tier, lang) : '';

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ background:'#0c2212', border:`1px solid ${game.accent}33`, borderRadius:18, padding:'14px 10px', width:'100%', maxWidth:300 }}>
        <div style={{ fontSize:9, color:game.accent, textAlign:'center', letterSpacing:'0.1em', marginBottom:10, fontFamily:'"Orbitron",sans-serif' }}>POKER SCRATCH</div>
        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
          {hand.map((card,i) => (
            <ScratchZone key={i} width={50} height={74} c1={game.color1} c2={game.color2} label="?" onScratched={() => scratch(i)}>
              <div style={{ width:50, height:74, borderRadius:8, background: revealed[i] ? '#f8fafc' : '#0a1014', border: revealed[i] ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${game.accent}44`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
                {revealed[i] && (
                  <>
                    <div style={{ fontSize:15, fontWeight:900, color:SUIT_COLORS[card.suit], lineHeight:1 }}>{card.rank}</div>
                    <div style={{ fontSize:14, color:SUIT_COLORS[card.suit] }}>{card.suit}</div>
                  </>
                )}
              </div>
            </ScratchZone>
          ))}
        </div>
        {hn && (
          <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} style={{ textAlign:'center', marginTop:10, fontSize:13, fontWeight:800, color: prize>0 ? game.accent : '#475569' }}>
            {hn}
          </motion.div>
        )}
      </div>
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}

// ── GAME 9: SUPER SEVENS ─────────────────────────────────────────────────────
export function SuperSevens({ game, tier, lang, onResult, onPlayAgain }: GProps) {
  const isRtl = lang === 'ar';
  const NON_SEVEN = ['★','◆','✦','◈','☽','⭐','✿'];

  const [[prize, zones]] = useState<[number, string[]]>(() => {
    const p = roll(tier);
    const top = tier.prizes[tier.prizes.length-1];
    const ratio = p / top;
    const ns = NON_SEVEN[Math.floor(Math.random()*NON_SEVEN.length)];
    if (ratio >= 0.9) return [p, ['7','7','7']];
    if (ratio >= 0.5) return [p, ['7','7', ns]];
    if (ratio > 0)    return [p, ['7', ns, ns]];
    return [p, [ns, ns, ns]];
  });

  const called = useRef(false);
  const [revealed, setRevealed] = useState([false,false,false]);
  const [collected, setCollected] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [done, setDone] = useState(false);

  const activeZone = revealed.findIndex(r => !r);

  function scratch(i: number) {
    if (i !== activeZone || stopped || done) return;
    const n=[...revealed]; n[i]=true; setRevealed(n);
    const is7 = zones[i] === '7';
    if (is7) {
      const newCollected = i===0 ? Math.round(prize * (zones[1]==='7'&&zones[2]==='7' ? 0.15 : zones[1]==='7' ? 0.3 : 1))
        : i===1 ? Math.round(prize * (zones[2]==='7' ? 0.3 : 1))
        : prize;
      setCollected(newCollected);
      if (i===2 || !zones[i+1]) {
        if (!called.current) { called.current=true; onResult(prize); }
        setDone(true);
      }
    } else {
      setStopped(true);
      if (!called.current) { called.current=true; onResult(i===0 ? 0 : collected); }
      setDone(true);
    }
  }

  const zoneBase = [prize * 0.15, prize * 0.45, prize].map(v => Math.round(v));

  return (
    <div style={{ width:'100%', padding:'0 12px', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      <p style={{ margin:0, fontSize:11, color:'#64748b', textAlign:'center' }}>{isRtl ? game.mechanicDescAr : game.mechanicDescEn}</p>

      <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'center' }}>
        {[0,1,2].map(i => {
          const isActive = i === activeZone && !done;
          const isLocked = !revealed[i-1] && i>0;
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:9, color: i===0?'#fbbf24':i===1?'#f59e0b':'#f97316', fontWeight:700, letterSpacing:'0.06em' }}>
                  ZONE {i+1} • {zoneBase[i].toLocaleString()} SKZ
                </div>
                <ScratchZone width={82} height={82} c1={game.color1} c2={game.color2}
                  label={isActive ? (isRtl?'احك':'Scratch') : (isLocked ? (isRtl?'مقفل':'LOCKED') : undefined)}
                  disabled={isLocked || done || (i>0 && !revealed[i-1])}
                  onScratched={() => scratch(i)}
                >
                  <div style={{ width:82, height:82, display:'flex', alignItems:'center', justifyContent:'center', background:'#0a1014', borderRadius:14, fontSize: zones[i]==='7' ? 36 : 26, fontWeight:900, color: zones[i]==='7' ? '#fde047' : '#475569', border: revealed[i] && zones[i]==='7' ? '2px solid #fde04788' : '1px solid rgba(100,116,139,0.1)' }}>
                    {zones[i]}
                  </div>
                </ScratchZone>
              </div>
              {i < 2 && <div style={{ fontSize:16, color:'#475569', fontWeight:900 }}>→</div>}
            </div>
          );
        })}
      </div>

      {collected > 0 && !done && (
        <div style={{ fontSize:12, color:'#fde047', fontWeight:700 }}>
          {isRtl ? `جمعت ${collected} SKZ حتى الآن` : `Collected ${collected} SKZ so far`}
        </div>
      )}
      {done && <Res prize={prize} accent={game.accent} onPlayAgain={onPlayAgain} lang={lang} />}
    </div>
  );
}
