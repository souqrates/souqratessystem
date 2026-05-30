import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { GameDef, TierDef } from '../lib/games-data';
import type { Lang } from '../lib/i18n';

import { ClassicMatch, LuckyLines, SlotScratch } from './games/MatchGames';
import { YourNumber, TripleDice, BingoGame } from './games/NumberGames';
import { BeatDealer, PokerGame, SuperSevens } from './games/CardGames';
import { CashBags, Envelopes, SymbolMatch } from './games/CollectGames';
import { Multiplier, TreasureHunt, Pyramid } from './games/SpecialGames';

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
};

export default function ScratchReveal({ game, tier, cardNum, lang, onResult, onPlayAgain }: Props) {
  const isRtl = lang === 'ar';
  const [result, setResult] = useState<number | null>(null);
  const fired = useRef(false);

  function handleResult(prize: number) {
    if (fired.current) return;
    fired.current = true;
    setResult(prize);
    onResult(prize);
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
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{game.emoji}</span>
            <span style={{
              fontSize: 14, fontWeight: 800, color: '#f1f5f9',
              letterSpacing: '0.01em',
            }}>
              {isRtl ? game.nameAr : game.nameEn}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, color: game.accent, fontWeight: 700,
              background: `${game.accent}18`, borderRadius: 6,
              padding: '2px 7px',
            }}>
              {tier.icon} {tier.label}
            </span>
            <span style={{ fontSize: 10, color: '#475569' }}>
              {isRtl ? 'بطاقة' : 'Card'} #{cardNum}
            </span>
            <span style={{
              fontSize: 10, color: '#64748b',
              background: 'rgba(255,255,255,0.04)', borderRadius: 6,
              padding: '2px 7px',
            }}>
              {isRtl ? `حتى ${tier.maxPrize.toLocaleString()} SKZ` : `Up to ${tier.maxPrize.toLocaleString()} SKZ`}
            </span>
          </div>
        </div>

        {/* Win badge */}
        {result !== null && result > 0 && (
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            style={{
              padding: '6px 10px', borderRadius: 10,
              background: `linear-gradient(135deg,${game.color1}cc,${game.color2})`,
              border: `1px solid ${game.accent}66`,
              fontSize: 11, fontWeight: 900,
              color: game.accent, textAlign: 'center',
              boxShadow: `0 0 16px ${game.accent}44`,
            }}
          >
            <div style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 14 }}>WIN</div>
            <div style={{ fontSize: 9 }}>+{result.toLocaleString()} SKZ</div>
          </motion.div>
        )}
      </div>

      {/* Game content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '16px 0 24px',
        gap: 0,
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
