import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type GameDef, type TierDef } from '../lib/games-data';
import { t, type Lang } from '../lib/i18n';

interface Props {
  game: GameDef;
  tier: TierDef;
  cardNum: number;
  lang: Lang;
  onResult: (prize: number) => void;
  onPlayAgain: () => void;
}

function rollPrize(tier: TierDef): number {
  let r = Math.random(), cum = 0;
  for (let i = 0; i < tier.weights.length; i++) {
    cum += tier.weights[i];
    if (r < cum) return tier.prizes[i];
  }
  return 0;
}

function getWinSymbols(prize: number, game: GameDef): [string, string, string] {
  if (prize === 0) {
    const s = game.symbols;
    return [s[0], s[1], s[2]];
  }
  const sym = game.symbols[3];
  return [sym, sym, sym];
}

export default function ScratchCanvas({ game, tier, cardNum, lang, onResult, onPlayAgain }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDown = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const revealedRef = useRef(false);
  const resultCalledRef = useRef(false);

  const [prize] = useState(() => rollPrize(tier));
  const [symbols] = useState<[string, string, string]>(() => getWinSymbols(rollPrize(tier), game));
  const [scratchPct, setScratchPct] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const prizeRef = useRef(prize);
  prizeRef.current = prize;

  const won = prize > 0;
  const isRtl = lang === 'ar';

  // Init canvas cover layer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Draw metallic gradient cover
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, game.color1);
    grd.addColorStop(0.5, adjustBrightness(game.color1, 30));
    grd.addColorStop(1, game.color2);
    ctx.fillStyle = grd;
    ctx.roundRect(0, 0, W, H, 18);
    ctx.fill();

    // Shimmer stripe overlay
    const shimmer = ctx.createLinearGradient(0, 0, W, H);
    shimmer.addColorStop(0, 'rgba(255,255,255,0)');
    shimmer.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    shimmer.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    shimmer.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    shimmer.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shimmer;
    ctx.roundRect(0, 0, W, H, 18);
    ctx.fill();

    // Dot pattern
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let x = 14; x < W; x += 22) {
      for (let y = 14; y < H; y += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Game emoji
    ctx.font = '36px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.emoji, W / 2, H / 2 - 22);

    // "احك هنا" label
    ctx.font = `bold 14px "Tajawal", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(isRtl ? '← احك بإصبعك →' : '← Scratch Here →', W / 2, H / 2 + 18);

    // Card number badge top-right
    ctx.font = `bold 11px "Orbitron", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = isRtl ? 'left' : 'right';
    ctx.fillText(`#${cardNum}`, isRtl ? 12 : W - 12, 16);
  }, []);

  function adjustBrightness(hex: string, amount: number) {
    try {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
      const b = Math.min(255, (num & 0x0000ff) + amount);
      return `rgb(${r},${g},${b})`;
    } catch {
      return hex;
    }
  }

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function scratchAt(x: number, y: number, fromX?: number, fromY?: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (fromX !== undefined && fromY !== undefined) {
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(x, y);
      ctx.lineWidth = 52;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    sampleReveal(canvas);
  }

  const sampleReveal = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    const step = 8;
    const total = Math.floor(canvas.width * canvas.height / step);
    for (let i = 3; i < data.length; i += 4 * step) {
      if (data[i] < 100) transparent++;
    }
    const pct = Math.min(100, Math.round((transparent / total) * 100));
    setScratchPct(pct);

    if (pct >= 60 && !revealedRef.current) {
      revealedRef.current = true;
      setRevealed(true);
      if (!resultCalledRef.current) {
        resultCalledRef.current = true;
        onResult(prizeRef.current);
      }
      // Fade out canvas
      let alpha = 1;
      const fade = () => {
        alpha -= 0.06;
        if (canvas) canvas.style.opacity = Math.max(0, alpha).toString();
        if (alpha > 0) requestAnimationFrame(fade);
        else if (canvas) canvas.style.pointerEvents = 'none';
      };
      setTimeout(() => requestAnimationFrame(fade), 200);
      setTimeout(() => setShowResult(true), 800);
    }
  }, [onResult]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    const pos = getCanvasPos(e);
    lastPos.current = pos;
    scratchAt(pos.x, pos.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDown.current || revealedRef.current) return;
    const pos = getCanvasPos(e);
    if (lastPos.current) {
      scratchAt(pos.x, pos.y, lastPos.current.x, lastPos.current.y);
    }
    lastPos.current = pos;
  };

  const onPointerUp = () => {
    isPointerDown.current = false;
    lastPos.current = null;
  };

  function handleRevealAll() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    revealedRef.current = true;
    setRevealed(true);
    setScratchPct(100);
    if (!resultCalledRef.current) {
      resultCalledRef.current = true;
      onResult(prizeRef.current);
    }
    let alpha = 1;
    const fade = () => {
      alpha -= 0.1;
      canvas.style.opacity = Math.max(0, alpha).toString();
      if (alpha > 0) requestAnimationFrame(fade);
      else canvas.style.pointerEvents = 'none';
    };
    requestAnimationFrame(fade);
    setTimeout(() => setShowResult(true), 600);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 16px',
      width: '100%',
      maxWidth: 360,
    }}>
      {/* Prize card backing (canvas sits on top) */}
      <div style={{
        width: '100%',
        maxWidth: 320,
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: `0 8px 40px ${game.color1}cc`,
        border: `1px solid ${revealed && won ? game.accent + '88' : game.accent + '22'}`,
        transition: 'border-color 0.4s',
      }}>
        {/* ── Prize reveal layer (behind canvas) ── */}
        <div style={{
          background: won
            ? `linear-gradient(145deg, #0a1f0a, #0e2d10)`
            : `linear-gradient(145deg, #0a0e14, #0d1220)`,
          padding: '22px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          minHeight: 200,
          justifyContent: 'center',
        }}>
          {/* Game name strip */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '7px 12px',
            background: `linear-gradient(90deg, ${game.color1}88, transparent)`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontSize: 9, fontFamily: '"Orbitron", sans-serif',
              color: game.accent, fontWeight: 800, letterSpacing: '0.08em',
            }}>
              SOUQRATES SCRATCHY
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              #{cardNum} • {tier.cost} SKZ
            </span>
          </div>

          {/* 3 symbol windows */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {([0, 1, 2] as const).map(idx => (
              <motion.div
                key={idx}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.1 + 0.1, type: 'spring', stiffness: 280 }}
                style={{
                  width: 70, height: 70,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 30,
                  fontWeight: 900,
                  background: won
                    ? `linear-gradient(135deg, ${game.color1}cc, ${game.color2})`
                    : 'rgba(15,20,30,0.8)',
                  border: won
                    ? `2px solid ${game.accent}88`
                    : '1px solid rgba(100,116,139,0.15)',
                  boxShadow: won ? `0 0 20px ${game.accent}44` : 'none',
                  color: won ? game.accent : '#334155',
                }}
              >
                {symbols[idx]}
              </motion.div>
            ))}
          </div>

          {/* Prize amount */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                style={{ textAlign: 'center' }}
              >
                {won ? (
                  <>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                      {t('winMsg')}
                    </div>
                    <div style={{
                      fontFamily: '"Orbitron", sans-serif',
                      fontSize: 32, fontWeight: 900,
                      background: `linear-gradient(90deg, ${game.accent}, #22c55e)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      letterSpacing: '0.02em',
                    }}>
                      +{prize.toLocaleString()} SKZ
                    </div>
                  </>
                ) : (
                  <div style={{
                    fontSize: 13, color: '#475569', fontWeight: 600,
                    fontFamily: '"Tajawal", sans-serif',
                  }}>
                    {t('loseMsg')}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Canvas scratch overlay ── */}
        <canvas
          ref={canvasRef}
          width={320}
          height={220}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            borderRadius: 20,
            cursor: revealed ? 'default' : 'crosshair',
            touchAction: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      {/* Scratch progress bar */}
      {!revealed && (
        <div style={{ width: '100%', maxWidth: 320, marginTop: 12 }}>
          <div style={{
            height: 3,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <motion.div
              style={{
                height: '100%',
                background: `linear-gradient(90deg, ${game.accent}, #22c55e)`,
                borderRadius: 99,
              }}
              animate={{ width: `${scratchPct}%` }}
              transition={{ duration: 0.12 }}
            />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 5,
            fontSize: 10,
            color: '#475569',
          }}>
            <span>{t('scratchToReveal')}</span>
            <span style={{ color: scratchPct > 40 ? game.accent : '#475569', fontWeight: 700 }}>
              {scratchPct}%
            </span>
          </div>
        </div>
      )}

      {/* Quick reveal button */}
      {!revealed && scratchPct < 60 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleRevealAll}
          style={{
            marginTop: 10,
            background: 'transparent',
            border: 'none',
            color: '#334155',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: '"Tajawal", sans-serif',
            textDecoration: 'underline',
          }}
        >
          {isRtl ? 'كشف تلقائي' : 'Auto Reveal'}
        </motion.button>
      )}

      {/* Play again */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ width: '100%', maxWidth: 320, marginTop: 14 }}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onPlayAgain}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 14,
                border: `1px solid ${game.accent}44`,
                background: `linear-gradient(135deg, ${game.color1}cc, ${game.color2})`,
                color: game.accent,
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: '"Tajawal", sans-serif',
                boxShadow: `0 4px 20px ${game.color1}88`,
              }}
            >
              {t('scratchAnother')}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
