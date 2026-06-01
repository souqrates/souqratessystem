import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { t, type Lang } from '../lib/i18n';
import { GAMES, TIERS, type GameDef, type TierDef } from '../lib/games-data';
import GameIcon from '../components/GameIcon';
import ScratchCanvas from '../components/ScratchReveal';

interface Props {
  lang: Lang;
  balance: number;
  onDeduct: (n: number) => void;
  onCredit: (n: number) => void;
}

type Step = 'games' | 'tier' | 'picker' | 'scratch';

export default function Cards({ lang, balance, onDeduct, onCredit }: Props) {
  const [step, setStep] = useState<Step>('games');
  const [game, setGame] = useState<GameDef | null>(null);
  const [tier, setTier] = useState<TierDef | null>(null);
  const [cardNum, setCardNum] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notEnough, setNotEnough] = useState(false);

  const isRtl = lang === 'ar';

  function selectGame(g: GameDef) {
    setGame(g);
    setTier(null);
    setCardNum(null);
    setStep('tier');
  }

  function selectTier(tr: TierDef) {
    setTier(tr);
    setStep('picker');
  }

  function selectCard(n: number) {
    setCardNum(n);
  }

  function confirmPlay() {
    if (!tier || cardNum === null) return;
    if (balance < tier.cost) {
      setNotEnough(true);
      setTimeout(() => setNotEnough(false), 2200);
      return;
    }
    onDeduct(tier.cost);
    setStep('scratch');
  }

  function handleResult(prize: number) {
    if (prize > 0) {
      onCredit(prize);
      setToast(`${t('winMsg')} ${prize} SKZ`);
    } else {
      setToast(t('loseMsg'));
    }
    setTimeout(() => setToast(null), 3500);
  }

  function reset() {
    setStep('games');
    setGame(null);
    setTier(null);
    setCardNum(null);
  }

  function backToTier() {
    setStep('tier');
    setTier(null);
    setCardNum(null);
  }

  return (
    <div style={{ minHeight: '100%', background: '#030a05' }}>
      <AnimatePresence mode="wait">

        {/* ─── STEP 1: GAMES GRID ─── */}
        {step === 'games' && (
          <motion.div
            key="games"
            initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
            transition={{ duration: 0.22 }}
            style={{ padding: '14px 12px 0' }}
          >
            <div style={{ marginBottom: 14 }}>
              <h2 style={{
                margin: 0, fontSize: 18, fontWeight: 900,
                fontFamily: '"Orbitron", sans-serif',
                background: 'linear-gradient(90deg, #22c55e, #fbbf24)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '0.04em',
              }}>
                {t('scratchWin')}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#475569' }}>
                {t('selectGame')} — 30 {isRtl ? 'لعبة مختلفة' : 'unique games'}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              paddingBottom: 16,
            }}>
              {GAMES.map((g, i) => (
                <motion.button
                  key={g.id}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 320 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => selectGame(g)}
                  style={{
                    background: `linear-gradient(145deg, ${g.color1}ee, ${g.color2})`,
                    border: `1px solid ${g.accent}33`,
                    borderRadius: 14,
                    padding: '12px 6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: `0 3px 12px ${g.color1}88`,
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%)',
                    pointerEvents: 'none',
                  }} />
                  <GameIcon game={g} size={26} />
                  <div style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: g.accent,
                    textAlign: 'center',
                    lineHeight: 1.3,
                    fontFamily: '"Tajawal", sans-serif',
                  }}>
                    {isRtl ? g.nameAr : g.nameEn}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                    {isRtl ? 'حتى' : 'up to'} 5,000 SKZ
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── STEP 2: TIER SELECTION ─── */}
        {step === 'tier' && game && (
          <motion.div
            key="tier"
            initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
            transition={{ duration: 0.22 }}
            style={{ padding: '12px 12px 0' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setStep('games')}
                style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 8, padding: '6px 10px',
                  color: '#22c55e', cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: '"Tajawal", sans-serif',
                }}
              >
                <ArrowRight size={12} style={{ transform: isRtl ? 'none' : 'rotate(180deg)' }} />
                {t('backToGames')}
              </motion.button>
              <div style={{
                background: `linear-gradient(135deg, ${game.color1}, ${game.color2})`,
                borderRadius: 8, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${game.accent}44`,
                flexShrink: 0,
              }}>
                <GameIcon game={game} size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: game.accent }}>
                  {isRtl ? game.nameAr : game.nameEn}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>{game.description}</div>
              </div>
            </div>

            <div style={{
              fontSize: 11, fontWeight: 700, color: '#64748b',
              letterSpacing: '0.06em', marginBottom: 10,
              textTransform: 'uppercase',
            }}>
              {t('selectTier')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
              {TIERS.map((tr, i) => (
                <motion.button
                  key={tr.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectTier(tr)}
                  style={{
                    background: 'rgba(15,23,12,0.8)',
                    border: `1px solid ${game.accent}22`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      fontSize: 24,
                      width: 44, height: 44,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${game.color1}cc, ${game.color2})`,
                      border: `1px solid ${game.accent}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {tr.icon}
                    </div>
                    <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
                        {tr.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                        {isRtl ? 'اربح حتى' : 'Win up to'}{' '}
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>
                          {tr.maxPrize.toLocaleString()} SKZ
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{
                    background: `linear-gradient(135deg, ${game.accent}cc, ${game.accent})`,
                    borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 800, color: '#000',
                    fontFamily: '"Orbitron", sans-serif',
                    letterSpacing: '0.02em',
                    flexShrink: 0,
                  }}>
                    {tr.cost} SKZ
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── STEP 3: 100-CARD PICKER ─── */}
        {step === 'picker' && game && tier && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
            transition={{ duration: 0.22 }}
            style={{ padding: '12px 12px 0' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={backToTier}
                style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 8, padding: '6px 10px',
                  color: '#22c55e', cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: '"Tajawal", sans-serif',
                }}
              >
                <ArrowRight size={12} style={{ transform: isRtl ? 'none' : 'rotate(180deg)' }} />
              </motion.button>
              <GameIcon game={game} size={16} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: game.accent }}>
                  {isRtl ? game.nameAr : game.nameEn}
                  <span style={{ color: '#475569', fontWeight: 400 }}>
                    {' '}• {tier.icon} {tier.cost} SKZ
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>{t('chooseCard')}</div>
              </div>
            </div>

            {/* 10×10 card grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 4,
              marginBottom: 12,
            }}>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => {
                const sel = cardNum === n;
                return (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => selectCard(n)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 6,
                      border: sel
                        ? `1.5px solid ${game.accent}`
                        : '1px solid rgba(255,255,255,0.06)',
                      background: sel
                        ? `linear-gradient(135deg, ${game.color1}ee, ${game.color2})`
                        : 'rgba(15,25,15,0.6)',
                      color: sel ? game.accent : '#334155',
                      fontSize: 8.5,
                      fontWeight: sel ? 800 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                      boxShadow: sel ? `0 0 8px ${game.accent}66` : 'none',
                    }}
                  >
                    {n}
                  </motion.button>
                );
              })}
            </div>

            {/* Confirm button */}
            <AnimatePresence>
              {cardNum !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  style={{ paddingBottom: 16 }}
                >
                  <div style={{
                    background: 'rgba(15,25,15,0.6)',
                    border: `1px solid ${game.accent}33`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    marginBottom: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {t('cardSelected')}{' '}
                      <span style={{ color: game.accent, fontWeight: 800 }}>#{cardNum}</span>
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {t('maxWin')}{' '}
                      <span style={{ color: '#22c55e', fontWeight: 800 }}>
                        {tier.maxPrize.toLocaleString()} SKZ
                      </span>
                    </span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={confirmPlay}
                    style={{
                      width: '100%',
                      padding: '15px 0',
                      borderRadius: 14,
                      border: `1px solid ${game.accent}44`,
                      background: `linear-gradient(135deg, ${game.color1}, ${game.color2})`,
                      color: game.accent,
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: '"Tajawal", sans-serif',
                      letterSpacing: '0.03em',
                      boxShadow: `0 4px 20px ${game.color1}88`,
                    }}
                  >
                    {t('confirmPlay')} — {tier.cost} SKZ
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── STEP 4: SCRATCH SCREEN ─── */}
        {step === 'scratch' && game && tier && cardNum !== null && (
          <motion.div
            key="scratch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: '#030a05',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(34,197,94,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GameIcon game={game} size={22} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: game.accent }}>
                    {isRtl ? game.nameAr : game.nameEn}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>
                    {tier.icon} {tier.label} • {t('cardNo')} #{cardNum}
                  </div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={reset}
                style={{
                  background: 'rgba(100,116,139,0.1)',
                  border: '1px solid rgba(100,116,139,0.2)',
                  borderRadius: 8, padding: '6px 10px',
                  color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={15} />
              </motion.button>
            </div>

            {/* Scratch area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ScratchCanvas
                game={game}
                tier={tier}
                cardNum={cardNum}
                lang={lang}
                onResult={handleResult}
                onPlayAgain={reset}
              />
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 88, left: '50%',
              transform: 'translateX(-50%)',
              background: '#0c1d10',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 14, padding: '11px 22px',
              fontSize: 13, fontWeight: 700, color: '#4ade80',
              zIndex: 200, whiteSpace: 'nowrap',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          >
            {toast}
          </motion.div>
        )}
        {notEnough && (
          <motion.div
            key="notenough"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', bottom: 88, left: '50%',
              transform: 'translateX(-50%)',
              background: '#1a0505',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 14, padding: '11px 22px',
              fontSize: 13, fontWeight: 700, color: '#f87171',
              zIndex: 200, whiteSpace: 'nowrap',
            }}
          >
            {isRtl ? 'رصيد غير كافٍ' : 'Insufficient balance'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
