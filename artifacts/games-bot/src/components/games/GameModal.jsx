import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Zap, ChevronRight } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { triggerHaptic, exitFullscreen, refreshSession } from '../../lib/telegram';
import GameEngine, { preloadGameChunk } from './GameEngine';
import ResultOverlay from './games/ResultOverlay';
import useAppStore from '../../store/appStore';
import { recordGameEnd } from '../../lib/gamification';
import { xpRewardFor } from '../../lib/ranks';
import { chargeSoloEntry, creditSoloReward, validateGameResult, getSoloFeeTiers, refundSoloEntry } from '../../lib/payments';
import SoloGameIntro from './SoloGameIntro';
import { getSessionId, warmSession } from '../../lib/session';


const DIFF_COLOR = {
  Easy:   { text: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.22)' },
  Medium: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)' },
  Hard:   { text: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)'  },
};

const GAME_COLORS = {
  1:'#f43f5e', 2:'#0891b2', 3:'#f59e0b', 4:'#0ea5e9', 5:'#10b981',
  6:'#0ea5e9', 7:'#f59e0b', 8:'#14b8a6', 9:'#f59e0b', 10:'#94a3b8',
  11:'#10b981',22:'#ef4444',42:'#3b82f6',43:'#14b8a6',45:'#f43f5e',
  47:'#94a3b8',48:'#ec4899',49:'#10b981',51:'#3b82f6',52:'#14b8a6',
  54:'#0ea5e9',55:'#ec4899',
};

export default function GameModal({ game, onClose, prefetchedTiers = null }) {
  const { user, wallet, refreshBalance } = useAppStore();
  const [phase,         setPhase]         = useState('intro');
  const [myScore,       setMyScore]       = useState(0);
  const [entryError,    setEntryError]    = useState('');
  // charging: true while charge RPC is in-flight (plays concurrently with countdown)
  const [charging,      setCharging]      = useState(false);
  // chargeError: set if the charge RPC failed during countdown (interrupts game start)
  const [chargeError,   setChargeError]   = useState('');
  const [settling,      setSettling]      = useState(false);
  const [confirmExit,   setConfirmExit]   = useState(false);
  const [confirmFee,    setConfirmFee]    = useState(false);
  const [cdCount,       setCdCount]       = useState(3);
  const [tiers,         setTiers]         = useState(prefetchedTiers || []);
  const [selectedTier,  setSelectedTier]  = useState(() => {
    if (!prefetchedTiers?.length) return null;
    return prefetchedTiers.find(t => t.isDefault) || prefetchedTiers[0] || null;
  });
  const scoreRef              = useRef(0);
  const pendingAction         = useRef(null);
  const mountedRef            = useRef(true);
  // Ref to abort countdown if charge fails mid-flight
  const chargeResultRef       = useRef(null); // null | 'ok' | Error
  // Ref to carry the server-issued transaction ID into the credit call
  const chargeTransactionIdRef = useRef(null); // null | number

  // ── ALL hooks must come before any conditional return ──────────────────────

  useEffect(() => {
    mountedRef.current = true;
    chargeResultRef.current = null;
    // Eagerly warm session so the charge RPC fires immediately on Play
    warmSession().catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!game?.id) return;
    if (!wallet?.loaded) { try { refreshBalance?.(); } catch { /* ignore */ } }
    // Skip tier fetch if already provided by pre-fetch from game card tap
    if (prefetchedTiers?.length) return;
    getSoloFeeTiers(game.id).then(rows => {
      if (!mountedRef.current) return;
      setTiers(rows);
      const def = rows.find(t => t.isDefault) || rows[0] || null;
      setSelectedTier(def);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!game?.id) return;
    document.body.classList.toggle('game-locked', phase === 'playing');
    return () => document.body.classList.remove('game-locked');
  }, [phase, game?.id]);

  useEffect(() => {
    if (!game?.id) return;
    if (phase === 'intro') { setEntryError(''); setChargeError(''); }
  }, [phase, game?.id]);

  // Countdown effect — starts immediately and checks charge result before transitioning to playing
  useEffect(() => {
    if (!game?.id) return;
    if (phase !== 'countdown') return;
    setCdCount(3);
    let n = 3;
    triggerHaptic('medium');
    // Kick off game chunk download immediately so it's ready when countdown ends
    preloadGameChunk(game.id);
    const iv = setInterval(async () => {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        // If charge is still in-flight, wait for it (it should be done by now)
        if (chargeResultRef.current === null && charging) {
          // poll briefly — charge should finish within the 2.7s countdown
          let waited = 0;
          while (chargeResultRef.current === null && waited < 2000) {
            await new Promise(r => setTimeout(r, 80));
            waited += 80;
          }
        }
        if (!mountedRef.current) return;
        if (chargeResultRef.current instanceof Error) {
          // Charge failed — abort to intro with error
          const err = chargeResultRef.current;
          chargeResultRef.current = null;
          const msg = String(err?.message || '');
          const isSession = msg.includes('session') || msg.includes('Session') || msg.includes('28000');
          setEntryError(
            msg.includes('insufficient_balance')
              ? `Not enough SKZ. Entry fee is ${activeFeeRef.current} SKZ — top up your wallet to play.`
              : isSession
                ? 'Session expired. Close and reopen the app from Telegram.'
                : 'Could not start game. Please try again.'
          );
          if (isSession) refreshSession().catch(() => {});
          setCharging(false);
          setPhase('intro');
          return;
        }
        chargeResultRef.current = null;
        setCharging(false);
        setPhase('playing');
      } else {
        setCdCount(n);
        triggerHaptic('light');
      }
    }, 900);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, game?.id]);

  // Derived values — safe to compute with a possibly-null game using fallbacks
  const gameId    = game?.id || 0;
  const dc        = DIFF_COLOR[game?.difficulty] || DIFF_COLOR.Medium;
  const color     = GAME_COLORS[gameId] || '#00d4ff';

  const tierFee   = selectedTier ? Number(selectedTier.entryFee) : Number(game?.entryFee || 0);
  const tierPrize = selectedTier ? Math.round(selectedTier.entryFee * selectedTier.multiplier) : Number(game?.prize || 0);
  const activeFee   = isNaN(tierFee)   || tierFee   < 0 ? 0 : tierFee;
  const activePrize = isNaN(tierPrize) || tierPrize < 0 ? 0 : tierPrize;

  // Keep activeFee accessible in the countdown async closure via ref
  const activeFeeRef = useRef(activeFee);
  activeFeeRef.current = activeFee;

  const handleScoreUpdate = useCallback((score) => { scoreRef.current = score; }, []);

  const handleSetPhase = useCallback((p) => {
    if (!game?.id) return;
    if (p === 'won' || p === 'lost') {
      const target = Number(game.targetScore || 0);
      const finalPhase = (p === 'won' && target > 0 && (Number(scoreRef.current) || 0) < target) ? 'lost' : p;
      const isWin = finalPhase === 'won';
      const shouldCredit = isWin && activePrize > 0;

      // Show result immediately — credit runs in background
      setPhase(finalPhase);

      if (shouldCredit) {
        setSettling(true);
        (async () => {
          try {
            const finalScore = Number(scoreRef.current) || 0;
            await warmSession().catch(() => {});
            // Step 1: Obtain a server-signed result token.
            // Server validates: score >= minWinScore AND elapsed time >= game duration.
            // If validation fails (loss or instant call), resultToken is null → credit will also fail.
            const validateRes = await validateGameResult(chargeTransactionIdRef.current, finalScore).catch(() => null);
            const resultToken = validateRes?.resultToken ?? null;
            // Step 2: Credit reward — token required server-side. Skip
            // if validate didn't return a token (server rejected the win
            // as too-fast / score-too-low / etc — treat as forfeit).
            let creditOk = false;
            if (resultToken) {
              for (let attempt = 0; attempt < 3; attempt++) {
                try { await creditSoloReward(game.id, chargeTransactionIdRef.current, finalScore, resultToken); creditOk = true; break; }
                catch { if (attempt < 2) await new Promise(r => setTimeout(r, 600)); }
              }
            }

            // Step 3: If validate succeeded but credit failed (rare —
            // network/DB blip), refund the entry fee so the user is made
            // whole. Server is idempotent for refunds.
            let refundedAfterFailure = false;
            if (resultToken && !creditOk && chargeTransactionIdRef.current) {
              try {
                const r = await refundSoloEntry(chargeTransactionIdRef.current);
                if (r?.ok) refundedAfterFailure = true;
              } catch { /* surface generic error below */ }
            }

            await Promise.allSettled([
              refreshBalance?.(),
              user?.telegram_id ? recordGameEnd(user.telegram_id, isWin, game?.difficulty || 'Medium') : Promise.resolve(),
            ]);
            if (!mountedRef.current) return;
            setSettling(false);
            if (!creditOk) {
              setEntryError(
                refundedAfterFailure
                  ? 'Could not credit the prize — your entry fee was refunded automatically.'
                  : 'Prize credit failed — contact support if SKZ was not added.'
              );
            }
          } catch {
            if (!mountedRef.current) return;
            setSettling(false);
          }
        })();
      } else {
        if (user?.telegram_id) recordGameEnd(user.telegram_id, isWin, game?.difficulty || 'Medium').catch(() => {});
        // refresh balance in background even on loss
        refreshBalance?.().catch(() => {});
      }
      return;
    }
    if (p === 'playing' && (phase === 'won' || phase === 'lost')) {
      if (activeFee > 0) {
        if (!wallet?.trial_active && wallet?.loaded) {
          const bal = Number(wallet?.sc_balance || 0);
          if (bal < activeFee) { setEntryError(`Not enough SKZ. You have ${bal.toLocaleString()} SKZ but need ${activeFee} SKZ — top up your wallet.`); setPhase('intro'); return; }
        }
        pendingAction.current = 'playing';
        setConfirmFee(true);
        return;
      }
      scoreRef.current = 0; setMyScore(0);
    }
    setPhase(p);
  }, [phase, game, activeFee, activePrize, refreshBalance, user?.telegram_id, wallet?.trial_active, wallet?.sc_balance]);

  // Intercept Telegram BackButton during play so users don't accidentally
  // forfeit their entry fee with a single back-tap. The dispatcher in
  // App.jsx fires a cancelable 'game-modal-back' event; we preventDefault
  // and show the same confirm dialog the close (X) button uses.
  useEffect(() => {
    function onBack(ev) {
      if (phase === 'playing' && activeFee > 0 && !wallet?.trial_active) {
        ev.preventDefault();
        triggerHaptic('warning');
        setConfirmExit(true);
      }
    }
    window.addEventListener('game-modal-back', onBack);
    return () => window.removeEventListener('game-modal-back', onBack);
  }, [phase, activeFee, wallet?.trial_active]);

  // ── Guard: render nothing if game is invalid ───────────────────────────────
  if (!game?.id) return null;

  // ── Event handlers that reference derived values ───────────────────────────
  const doClose = () => { triggerHaptic('light'); exitFullscreen(); onClose(); };
  const exitForfeitsFee = phase === 'playing' && activeFee > 0 && !wallet?.trial_active;
  const handleClose = () => {
    if (exitForfeitsFee) { triggerHaptic('warning'); setConfirmExit(true); return; }
    doClose();
  };
  const handleRestart = () => {
    triggerHaptic('medium');
    scoreRef.current = 0; setMyScore(0);
    if (activeFee > 0) { pendingAction.current = 'countdown'; setConfirmFee(true); return; }
    setPhase('intro');
  };

  // Fire charge RPC immediately, start countdown in parallel — no waiting
  const proceedAfterFeeConfirm = async () => {
    setConfirmFee(false);
    const action = pendingAction.current || 'countdown';
    pendingAction.current = null;
    scoreRef.current = 0;
    chargeTransactionIdRef.current = null;
    setMyScore(0);

    if (activeFee > 0 && !wallet?.trial_active) {
      chargeResultRef.current = null;
      setCharging(true);
      setChargeError('');

      // Fire charge RPC in background — countdown starts immediately without waiting
      (async () => {
        try {
          await warmSession().catch(() => {});
          let lastErr = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const chargeResult = await chargeSoloEntry(game.id, activeFee);
              chargeTransactionIdRef.current = chargeResult?.transactionId ?? null;
              refreshBalance?.().catch(() => {});
              lastErr = null;
              break;
            } catch (e) {
              lastErr = e;
              const msg = String(e?.message || '');
              if (attempt === 0 && (msg.includes('session') || msg.includes('JWT'))) {
                try { await refreshSession(); } catch { /* ignore */ }
                continue;
              }
              break;
            }
          }
          if (!mountedRef.current) return;
          chargeResultRef.current = lastErr || 'ok';
        } catch (e) {
          if (!mountedRef.current) return;
          chargeResultRef.current = e instanceof Error ? e : new Error(String(e));
        }
      })();
    }

    // Start countdown immediately — charge runs in parallel
    setPhase(action === 'countdown' ? 'countdown' : 'playing');
  };

  return (
    <motion.div
      onClick={phase === 'playing' ? undefined : handleClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'tween', duration: 0.1 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column' }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: 'min(95dvh, calc(var(--tg-viewport-height, 95vh) - 8px))',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(175deg, #080d14 0%, #050810 50%, #030508 100%)',
          borderRadius: '28px 28px 0 0',
          border: `1px solid ${color}18`,
          borderBottom: 'none',
          overflow: 'hidden',
          boxShadow: `0 -8px 80px ${color}08`,
          willChange: 'transform',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.1 }}
      >
        {/* Ambient glow top */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, flexShrink: 0 }}>
          <div style={{ width: 44, height: 4, borderRadius: 99, background: `${color}30` }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0,
              background: `${color}12`, border: `1px solid ${color}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              boxShadow: `0 0 16px ${color}18`,
            }}>{game.emoji}</div>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#fff', fontSize: 13, letterSpacing: '0.04em' }}>{game.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', background: dc.bg, border: `1px solid ${dc.border}`, color: dc.text }}>{game.difficulty}</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#f59e0b' }}>+{activePrize} SKZ</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#06b6d4' }}>· {activeFee} SKZ entry</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {phase !== 'intro' && (
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleRestart}
                style={{ width: 36, height: 36, borderRadius: 11, cursor: 'pointer', border: `1px solid ${color}20`, background: `${color}08`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={15} color={color} />
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.88 }} onClick={handleClose}
              style={{ width: 36, height: 36, borderRadius: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="rgba(148,163,184,0.7)" />
            </motion.button>
          </div>
        </div>

        {/* Body — flex column: scrollable area + fixed footer */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Scrollable content area */}
          <div className="game-modal-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}>
            <div style={{ padding: '8px 12px 12px' }}>
              <AnimatePresence mode="wait">

                {/* INTRO — scrollable content only (no Play button here) */}
                {phase === 'intro' && (
                  <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'tween', duration: 0.1 }}>
                    <SoloGameIntro
                      game={game}
                      color={color}
                      wallet={wallet}
                      tiers={tiers}
                      selectedTier={selectedTier}
                      onTierSelect={setSelectedTier}
                    />
                  </motion.div>
                )}

                {/* 3-2-1 COUNTDOWN */}
                {phase === 'countdown' && (
                  <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ type: 'tween', duration: 0.1 }}
                    style={{ minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.2em', fontFamily: 'Orbitron, sans-serif' }}>GET READY</div>
                    <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={cdCount}
                          initial={{ scale: 1.15, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.85, opacity: 0 }}
                          transition={{ type: 'tween', duration: 0.1 }}
                          style={{ position: 'absolute', fontSize: 120, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color, lineHeight: 1, textShadow: `0 0 40px ${color}66` }}
                        >
                          {cdCount}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(148,163,184,0.5)' }}>{game.name}</div>
                    {charging && (
                      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 600, letterSpacing: '0.06em' }}>
                        Securing entry…
                      </div>
                    )}
                  </motion.div>
                )}

                {/* PLAYING */}
                {phase === 'playing' && (
                  <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'tween', duration: 0.1 }}>
                    <GameEngine game={game} phase={phase} setPhase={handleSetPhase} onScoreUpdate={handleScoreUpdate} />
                  </motion.div>
                )}

                {/* WON / LOST */}
                {(phase === 'won' || phase === 'lost') && (
                  <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'tween', duration: 0.1 }}>
                    {entryError && (
                      <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
                        {entryError}
                      </div>
                    )}
                    <ResultOverlay
                      won={phase === 'won'}
                      earnings={phase === 'won' ? activePrize : 0}
                      score={scoreRef.current}
                      xpEarned={xpRewardFor(game.difficulty, phase === 'won')}
                      setPhase={handleSetPhase}
                      winLabel={game.winLabel}
                      loseLabel={game.loseLabel}
                      settling={settling}
                    />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* Fixed Play Now footer — always visible, never scrolls */}
          <AnimatePresence>
            {phase === 'intro' && (
              <motion.div
                key="sticky-footer"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: 'tween', duration: 0.1 }}
                style={{
                  flexShrink: 0,
                  padding: '10px 16px',
                  paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  background: 'linear-gradient(0deg, #030508 70%, rgba(3,5,8,0.92) 100%)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <AnimatePresence>
                  {entryError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5', fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}
                    >
                      {entryError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Balance + fee row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, padding: '7px 11px', borderRadius: 10, background: wallet?.trial_active ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.05)', border: wallet?.trial_active ? '1px solid rgba(245,158,11,0.18)' : '1px solid rgba(16,185,129,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.14em', color: 'rgba(148,163,184,0.5)', margin: 0, textTransform: 'uppercase' }}>Balance</p>
                    <p style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Orbitron, sans-serif' }}>
                      {Number(wallet?.sc_balance || 0).toLocaleString()} SKZ
                    </p>
                  </div>
                  {wallet?.trial_active ? (
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, padding: '2px 8px', letterSpacing: '0.08em' }}>
                      TRIAL · FREE ENTRY
                    </span>
                  ) : activeFee > 0 ? (
                    <span style={{ fontSize: 9, fontWeight: 900, color: `${color}cc`, background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.08em' }}>
                      ENTRY {activeFee} SKZ
                    </span>
                  ) : null}
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    triggerHaptic('medium');
                    setEntryError('');
                    if (activeFee > 0) {
                      if (!wallet?.trial_active && wallet?.loaded) {
                        const bal = Number(wallet?.sc_balance || 0);
                        if (bal < activeFee) { setEntryError(`Not enough SKZ. You have ${bal.toLocaleString()} but need ${activeFee} — top up your wallet.`); return; }
                      }
                      pendingAction.current = 'countdown';
                      setConfirmFee(true);
                      return;
                    }
                    setPhase('countdown');
                  }}
                  style={{
                    width: '100%', padding: '16px 0', borderRadius: 14,
                    cursor: 'pointer',
                    fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '0.1em',
                    background: `linear-gradient(135deg, ${color}cc 0%, ${color} 100%)`,
                    border: `1px solid ${color}55`,
                    boxShadow: `0 4px 24px ${color}30, 0 2px 6px ${color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    position: 'relative', overflow: 'hidden',
                    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', userSelect: 'none', minHeight: 52,
                  }}
                >
                  <motion.div
                    animate={{ x: ['-120%', '220%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 2.5 }}
                    style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', pointerEvents: 'none' }}
                  />
                  <Zap size={16} fill="white" />
                  {game.ctaLabel || 'PLAY NOW'}
                  <ChevronRight size={15} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Confirmation dialogs */}
      <AnimatePresence>
        {(confirmExit || confirmFee) && (
          <motion.div
            key={confirmExit ? 'exit-overlay' : 'fee-overlay'}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'tween', duration: 0.1 }}
            onClick={confirmExit ? () => setConfirmExit(false) : () => { pendingAction.current = null; setConfirmFee(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            {confirmExit && (
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.92, opacity: 0, y: 14 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={{ type: 'tween', duration: 0.1 }}
                style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(160deg, #1a0808 0%, #0c0606 100%)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 22, padding: 24, textAlign: 'center', boxShadow: '0 20px 60px rgba(239,68,68,0.18), 0 0 0 1px rgba(255,255,255,0.04)' }}
              >
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <X size={26} color="#ef4444" />
                </div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 17, color: '#fff', margin: '0 0 8px', letterSpacing: '0.04em' }}>Leave the game?</p>
                <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.7)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  If you leave now, you will <span style={{ color: '#ef4444', fontWeight: 800 }}>forfeit your entry fee</span>.
                </p>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: '#ef4444', margin: '6px 0 18px' }}>−{activeFee} SKZ</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setConfirmExit(false)}
                    style={{ flex: 1, padding: '13px 0', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>
                    KEEP PLAYING
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setConfirmExit(false); doClose(); }}
                    style={{ flex: 1, padding: '13px 0', borderRadius: 12, cursor: 'pointer', background: 'linear-gradient(135deg, rgba(239,68,68,0.85), rgba(185,28,28,0.85))', border: '1px solid rgba(239,68,68,0.55)', color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: '0.06em', boxShadow: '0 0 24px rgba(239,68,68,0.3)' }}>
                    LEAVE
                  </motion.button>
                </div>
              </motion.div>
            )}

            {confirmFee && (
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.9, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={{ type: 'tween', duration: 0.1 }}
                style={{
                  width: '100%', maxWidth: 360,
                  background: wallet?.trial_active ? 'linear-gradient(160deg, #1a1408 0%, #0c0a06 100%)' : 'linear-gradient(160deg, #1a0808 0%, #0c0606 100%)',
                  border: `1px solid ${wallet?.trial_active ? 'rgba(251,191,36,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  borderRadius: 22, padding: 28, textAlign: 'center',
                  boxShadow: `0 24px 80px ${wallet?.trial_active ? 'rgba(251,191,36,0.22)' : 'rgba(239,68,68,0.22)'}, 0 0 0 1px rgba(255,255,255,0.04)`,
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: wallet?.trial_active ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)', border: `2px solid ${wallet?.trial_active ? 'rgba(251,191,36,0.5)' : 'rgba(239,68,68,0.5)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: `0 0 30px ${wallet?.trial_active ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  <Zap size={28} color={wallet?.trial_active ? '#fbbf24' : '#ef4444'} fill={wallet?.trial_active ? '#fbbf24' : '#ef4444'} />
                </div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: '#fff', margin: '0 0 10px', letterSpacing: '0.04em' }}>Entry Fee</p>
                <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.7)', margin: '0 0 8px', lineHeight: 1.6 }}>
                  {wallet?.trial_active
                    ? <>This game costs <span style={{ color: '#fbbf24', fontWeight: 800 }}>{activeFee} SKZ</span> to enter. Your trial waives this fee.</>
                    : <>This amount will be <span style={{ color: '#ef4444', fontWeight: 800 }}>deducted from your balance</span> when you enter the game.</>}
                </p>
                <div style={{ background: wallet?.trial_active ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${wallet?.trial_active ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 14, padding: '14px 20px', margin: '12px 0 8px' }}>
                  <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: wallet?.trial_active ? 'rgba(251,191,36,0.6)' : 'rgba(239,68,68,0.6)', margin: '0 0 4px' }}>ENTRY FEE</p>
                  <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 28, color: wallet?.trial_active ? '#fbbf24' : '#ef4444', margin: 0, textShadow: `0 0 20px ${wallet?.trial_active ? 'rgba(251,191,36,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                    {wallet?.trial_active ? 'FREE' : `−${activeFee} SKZ`}
                  </p>
                </div>
                {activePrize > 0 && (
                  <p style={{ fontSize: 11, color: 'rgba(16,185,129,0.8)', margin: '0 0 16px', fontWeight: 700 }}>
                    Win prize: <span style={{ color: '#10b981', fontFamily: 'Orbitron, sans-serif', fontWeight: 900 }}>{activePrize} SKZ</span>
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { pendingAction.current = null; setConfirmFee(false); }}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(226,232,240,0.7)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>
                    CANCEL
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={proceedAfterFeeConfirm}
                    style={{
                      flex: 1, padding: '14px 0', borderRadius: 12, cursor: 'pointer',
                      background: wallet?.trial_active ? 'linear-gradient(135deg, rgba(251,191,36,0.9), rgba(217,119,6,0.9))' : 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(185,28,28,0.9))',
                      border: `1px solid ${wallet?.trial_active ? 'rgba(251,191,36,0.6)' : 'rgba(239,68,68,0.6)'}`,
                      color: wallet?.trial_active ? '#0a0a0f' : '#fff',
                      fontWeight: 900, fontSize: 13, letterSpacing: '0.06em',
                      boxShadow: `0 0 28px ${wallet?.trial_active ? 'rgba(251,191,36,0.35)' : 'rgba(239,68,68,0.35)'}`,
                    }}>
                    {wallet?.trial_active ? 'PLAY FREE' : 'CONFIRM'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
