import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameDef, TierDef } from '../lib/games-data';
import type { Lang } from '../lib/i18n';
import GameIcon from './GameIcon';
import { playReveal, playWin } from '../lib/useSound';

import { ClassicMatch, LuckyLines, SlotScratch } from './games/MatchGames';
import { YourNumber, TripleDice, BingoGame } from './games/NumberGames';
import { BeatDealer, PokerGame, SuperSevens } from './games/CardGames';
import { CashBags, Envelopes, SymbolMatch } from './games/CollectGames';
import { Multiplier, TreasureHunt, Pyramid } from './games/SpecialGames';
import {
  SafeCracker, GoldRush, FortuneWheel, CrystalMatch, NeonVault,
  DragonCoins, StormStrike, KatanaChain,
} from './games/ScratchGames2';
import {
  RuneCombo, PirateMap, GemLadder, NeonJackpot,
  ShadowReveal, TimeScratch, VolcanoRush,
} from './games/ScratchGames3';

interface Props {
  game: GameDef;
  tier: TierDef;
  cardNum: number;
  lang: Lang;
  onResult: (prize: number) => void;
  onPlayAgain: () => void;
}

type GameComp = (p: { game: GameDef; tier: TierDef; lang: Lang; onResult: (n: number) => void; onPlayAgain: () => void }) => React.ReactNode;

const MECHANIC_MAP: Record<string, GameComp> = {
  'classic':        ClassicMatch,
  'lucky-lines':    LuckyLines,
  'slot':           SlotScratch,
  'your-number':    YourNumber,
  'triple-dice':    TripleDice,
  'bingo':          BingoGame,
  'beat-dealer':    BeatDealer,
  'poker':          PokerGame,
  'super-sevens':   SuperSevens,
  'cash-bags':      CashBags,
  'envelopes':      Envelopes,
  'symbol-match':   SymbolMatch,
  'multiplier':     Multiplier,
  'treasure-hunt':  TreasureHunt,
  'pyramid':        Pyramid,
  'safe-cracker':   SafeCracker,
  'gold-rush':      GoldRush,
  'fortune-wheel':  FortuneWheel,
  'crystal-match':  CrystalMatch,
  'neon-vault':     NeonVault,
  'dragon-coins':   DragonCoins,
  'storm-strike':   StormStrike,
  'katana-chain':   KatanaChain,
  'rune-combo':     RuneCombo,
  'pirate-map':     PirateMap,
  'gem-ladder':     GemLadder,
  'neon-jackpot':   NeonJackpot,
  'shadow-reveal':  ShadowReveal,
  'time-scratch':   TimeScratch,
  'volcano-rush':   VolcanoRush,
};

interface Particle {
  id: number; x: number; y: number;
  vx: number; vy: number;
  color: string; size: number; rot: number;
}

const CONFETTI_COLORS = ['#f59e0b','#22c55e','#818cf8','#06b6d4','#f43f5e','#fbbf24','#a3e635'];

function useConfetti(active: boolean, big: boolean) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    const count = big ? 60 : 32;
    const ps: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 8,
      vy: -6 - Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: big ? 7 + Math.random() * 6 : 5 + Math.random() * 5,
      rot: Math.random() * 360,
    }));
    setParticles(ps);
    let tick = 0;
    const animate = () => {
      tick++;
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx * 0.6,
        y: p.y + p.vy * 0.6 + tick * 0.3,
        vy: p.vy + 0.5,
        vx: p.vx * 0.96,
        rot: p.rot + 6,
      })).filter(p => p.y < 120));
      if (tick < 80) raf.current = requestAnimationFrame(animate);
      else setParticles([]);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [active]);

  return particles;
}

export default function ScratchReveal({ game, tier, cardNum, lang, onResult, onPlayAgain }: Props) {
  const isRtl = lang === 'ar';
  const [result, setResult] = useState<number | null>(null);
  const [flash, setFlash]   = useState(false);
  const fired = useRef(false);
  const isBig = result !== null && result >= 100;
  const particles = useConfetti(result !== null && result > 0, isBig);

  function handleResult(prize: number) {
    if (fired.current) return;
    fired.current = true;
    setResult(prize);
    onResult(prize);
    playReveal();
    if (prize > 0) {
      setTimeout(() => {
        playWin(prize >= 100);
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
        try {
          const tg = (window as any).Telegram?.WebApp;
          if (tg?.HapticFeedback) {
            if (prize >= 100) tg.HapticFeedback.notificationOccurred('success');
            else tg.HapticFeedback.impactOccurred('medium');
          }
        } catch {}
      }, 180);
    }
  }

  const GameComponent = MECHANIC_MAP[game.mechanic];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg,#050d0a 0%,#071510 60%,#050d0a 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Tajawal", sans-serif',
      direction: isRtl ? 'rtl' : 'ltr',
      overflowY: 'auto',
    }}>

      {/* Screen flash on win */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none',
              background: isBig
                ? 'radial-gradient(ellipse at 50% 40%, rgba(251,191,36,0.55) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at 50% 40%, rgba(34,197,94,0.4) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Confetti particles */}
      {particles.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 998, overflow: 'hidden' }}>
          {particles.map(p => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`, top: `${p.y}%`,
                width: p.size, height: p.size,
                background: p.color,
                borderRadius: Math.random() > 0.5 ? '50%' : 2,
                transform: `rotate(${p.rot}deg)`,
                opacity: Math.max(0, 1 - p.y / 110),
                boxShadow: `0 0 ${p.size}px ${p.color}88`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GameIcon game={game} size={20} />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.01em' }}>
              {isRtl ? game.nameAr : game.nameEn}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, color: game.accent, fontWeight: 700,
              background: `${game.accent}18`, borderRadius: 6, padding: '2px 7px',
            }}>
              {tier.icon} {tier.label}
            </span>
            <span style={{ fontSize: 10, color: '#475569' }}>
              {isRtl ? 'بطاقة' : 'Card'} #{cardNum}
            </span>
            <span style={{
              fontSize: 10, color: '#64748b',
              background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 7px',
            }}>
              {isRtl ? `حتى ${tier.maxPrize.toLocaleString()} SKZ` : `Up to ${tier.maxPrize.toLocaleString()} SKZ`}
            </span>
          </div>
        </div>

        {result !== null && result > 0 && (
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            style={{
              padding: '6px 10px', borderRadius: 10,
              background: `linear-gradient(135deg,${game.color1}cc,${game.color2})`,
              border: `1px solid ${game.accent}66`,
              fontSize: 11, fontWeight: 900,
              color: game.accent, textAlign: 'center',
              boxShadow: `0 0 20px ${game.accent}66`,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, repeat: 3 }}
              style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 14 }}
            >
              WIN!
            </motion.div>
            <div style={{ fontSize: 9 }}>+{result.toLocaleString()} SKZ</div>
          </motion.div>
        )}
      </div>

      {/* Game content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '16px 0 24px',
      }}>
        {GameComponent ? (
          <GameComponent
            game={game}
            tier={tier}
            lang={lang}
            onResult={handleResult}
            onPlayAgain={onPlayAgain}
          />
        ) : (
          <div style={{ color: '#475569', fontSize: 13 }}>
            {isRtl ? 'لعبة غير معروفة' : 'Unknown game mechanic'}
          </div>
        )}
      </div>
    </div>
  );
}
