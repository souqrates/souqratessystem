import { useState, useCallback } from "react";
import { GameConfig } from "../lib/games";
import ScratchCanvas from "../components/ScratchCanvas";
import FairVerifier from "../components/FairVerifier";
import { TicketResult } from "../lib/provablyFair";
import { buyTicket, ApiError } from "../lib/api";
import { haptic } from "../lib/telegram";
import { generateSeed } from "../lib/provablyFair";

interface Props {
  game: GameConfig;
  initData: string;
  onClose: () => void;
}

type Phase = "select" | "buying" | "scratch" | "result";

const QUANTITY_OPTIONS = [1, 2, 3, 5];

function ConfettiPiece({ color, left, delay }: { color: string; left: string; delay: string }) {
  return (
    <div className="fixed top-0 pointer-events-none z-50" style={{ left }}>
      <div style={{
        width: 8, height: 8,
        background: color,
        borderRadius: 2,
        animation: `confetti-1 1.6s ease-in ${delay} forwards`,
      }} />
    </div>
  );
}

const CONFETTI_COLORS = ["#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

export default function ScratchCard({ game, initData, onClose }: Props) {
  const [qty, setQty] = useState(1);
  const [phase, setPhase] = useState<Phase>("select");
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [showFair, setShowFair] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = useCallback(async () => {
    setPhase("buying");
    setError(null);
    haptic("medium");
    try {
      const clientSeed = generateSeed();
      const resp = await buyTicket(initData, game.id, clientSeed, qty);

      const result: TicketResult = {
        serverSeedHash: resp.serverSeedHash,
        serverSeed: resp.serverSeed,
        clientSeed: resp.clientSeed,
        nonce: resp.nonce,
        outcome: resp.outcome,
        isWinner: resp.isWinner,
        prize: resp.prizeSkz,
      };

      setTicket(result);
      setPhase("scratch");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "حدث خطأ — حاول مجدداً";
      setError(msg);
      setPhase("select");
    }
  }, [game, qty, initData]);

  const handleComplete = useCallback((pct: number) => {
    if (pct > 90 && ticket && phase === "scratch") {
      setPhase("result");
      if (ticket.isWinner) {
        setConfetti(true);
        haptic("success");
        setTimeout(() => setConfetti(false), 2500);
      } else {
        haptic("error");
      }
    }
  }, [ticket, phase]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#070511" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0">
        <button onClick={onClose} className="btn-ghost px-3 py-2 text-sm">← رجوع</button>
        <div className="flex-1">
          <div className="font-orbitron font-black text-base text-white">{game.emoji} {game.nameAr}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{game.mechanic}</div>
        </div>
        {ticket && phase === "result" && (
          <button onClick={() => setShowFair(true)} className="text-xl" title="Provably Fair">🔐</button>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">

        {/* SELECT PHASE */}
        {phase === "select" && (
          <div className="fade-up">
            {/* Game visual */}
            <div className="rounded-3xl p-6 mb-5 flex flex-col items-center"
              style={{
                background: `linear-gradient(135deg, ${game.gradientFrom}cc, ${game.gradientTo}77)`,
                border: `1px solid ${game.accentColor}33`,
                minHeight: 160,
              }}>
              <div className="text-7xl mb-3">{game.emoji}</div>
              <div className="font-bold text-white text-lg mb-1">{game.nameAr}</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{game.theme}</div>
              <div className="mt-3 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: `${game.accentColor}22`, color: game.accentColor }}>
                أعلى جائزة: {game.maxPrize.toLocaleString()} SKZ
              </div>
            </div>

            {/* Quantity selector */}
            <div className="mb-5">
              <div className="section-label mb-3">عدد الأوراق</div>
              <div className="grid grid-cols-4 gap-2">
                {QUANTITY_OPTIONS.map((q) => (
                  <button key={q} onClick={() => setQty(q)}
                    className="py-3 rounded-2xl font-orbitron font-black text-lg transition-all"
                    style={{
                      background: qty === q
                        ? `linear-gradient(135deg, ${game.gradientFrom}, ${game.gradientTo})`
                        : "rgba(255,255,255,0.05)",
                      border: qty === q ? `1px solid ${game.accentColor}` : "1px solid rgba(255,255,255,0.08)",
                      color: qty === q ? "#fff" : "rgba(255,255,255,0.5)",
                      boxShadow: qty === q ? `0 0 12px ${game.accentColor}44` : "none",
                      cursor: "pointer",
                    }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Price summary */}
            <div className="rounded-2xl p-4 mb-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex justify-between mb-2">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>سعر الورقة</span>
                <span className="font-orbitron text-sm" style={{ color: game.accentColor }}>{game.price} SKZ</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>عدد الأوراق</span>
                <span className="font-bold text-sm text-white">× {qty}</span>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
              <div className="flex justify-between">
                <span className="font-bold text-sm text-white">الإجمالي</span>
                <span className="font-orbitron font-black text-lg" style={{ color: "#f59e0b" }}>
                  {(game.price * qty).toLocaleString()} SKZ
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-2xl px-4 py-3 mb-4 text-sm font-bold text-center"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={handleBuy} className="btn-gold w-full py-4 font-black text-lg mb-2">
              💳 اشترِ {qty > 1 ? `${qty} أوراق` : "ورقة"} وابدأ الحك
            </button>
            <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              سيُخصم {(game.price * qty).toLocaleString()} SKZ من رصيدك
            </p>
          </div>
        )}

        {/* BUYING PHASE */}
        {phase === "buying" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 fade-up">
            <div className="text-5xl trophy-float">{game.emoji}</div>
            <div className="font-bold text-white">جاري تحضير ورقتك…</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>نولّد بذرة الخادم وتشفيرها</div>
          </div>
        )}

        {/* SCRATCH PHASE */}
        {phase === "scratch" && ticket && (
          <div className="fade-up">
            <div className="text-center mb-4">
              <div className="font-bold text-base text-white mb-1">احك بإصبعك لكشف الجائزة</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                اسحب ببطء على كل المربعات — تكتمل تلقائياً عند 90%
              </div>
            </div>

            <div className="flex justify-center">
              <ScratchCanvas
                symbols={ticket.outcome}
                gridSize={game.gridSize}
                accentColor={game.accentColor}
                gradientFrom={game.gradientFrom}
                onProgress={handleComplete}
              />
            </div>

            <div className="mt-4 text-center">
              <button onClick={() => handleComplete(91)} className="btn-ghost px-5 py-2.5 text-sm">
                كشف الكل دفعةً واحدة
              </button>
            </div>
          </div>
        )}

        {/* RESULT PHASE */}
        {phase === "result" && ticket && (
          <div className="fade-up flex flex-col items-center text-center">
            {ticket.isWinner ? (
              <>
                <div className="text-7xl mb-3 win-pop">🏆</div>
                <div className="font-orbitron font-black text-2xl mb-1" style={{ color: "#f59e0b" }}>
                  مبروك! ربحت!
                </div>
                <div className="text-xl font-bold mb-1 text-white">
                  +{ticket.prize.toLocaleString()} SKZ
                </div>
                <div className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                  تمت إضافة جائزتك إلى محفظتك
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-3 lose-shake">😔</div>
                <div className="font-bold text-xl text-white mb-1">لم تربح هذه المرة</div>
                <div className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                  حاول مجدداً — الحظ قادم!
                </div>
              </>
            )}

            {/* Outcome display */}
            <div className="rounded-2xl p-4 mb-4 w-full"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="section-label mb-2 text-center">نتيجة الورقة</div>
              <div className="flex flex-wrap justify-center gap-2">
                {ticket.outcome.map((sym, i) => (
                  <div key={i} className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {sym}
                  </div>
                ))}
              </div>
            </div>

            {/* Provably fair */}
            <button onClick={() => setShowFair(true)} className="btn-ghost px-5 py-2.5 text-sm mb-3 w-full">
              🔐 تحقق من النتيجة (Provably Fair)
            </button>

            <button
              onClick={() => { setPhase("select"); setTicket(null); setError(null); }}
              className="btn-gold w-full py-3.5 font-black text-base"
            >
              🎰 العب مجدداً
            </button>
          </div>
        )}
      </div>

      {/* Confetti */}
      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <ConfettiPiece
              key={i}
              color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]!}
              left={`${(Math.random() * 100).toFixed(1)}%`}
              delay={`${(Math.random() * 0.6).toFixed(2)}s`}
            />
          ))}
        </div>
      )}

      {/* Provably Fair modal */}
      {showFair && ticket && (
        <FairVerifier
          ticket={ticket}
          symbols={game.symbols}
          gridSize={game.gridSize}
          onClose={() => setShowFair(false)}
        />
      )}
    </div>
  );
}
