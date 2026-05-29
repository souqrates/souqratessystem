import { useState, useCallback, useEffect } from "react";
import LottoPicker from "../components/LottoPicker";
import { getLottoCurrent, enterLotto, getMyLottoEntries, getBalance, ApiError, type LottoEntry } from "../lib/api";
import { haptic } from "../lib/telegram";

interface Props {
  initData: string;
}

export default function Lotto({ initData }: Props) {
  const [selectedNums, setSelectedNums] = useState<number[]>([]);
  const [entries, setEntries] = useState<LottoEntry[]>([]);
  const [jackpot, setJackpot] = useState<string>("0");
  const [entryPrice, setEntryPrice] = useState(5);
  const [drawNumber, setDrawNumber] = useState<number | null>(null);
  const [hasOpenDraw, setHasOpenDraw] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [current, myEntries, balanceRes] = await Promise.all([
        getLottoCurrent(initData),
        getMyLottoEntries(initData),
        getBalance(initData),
      ]);
      setJackpot(current.jackpotBalanceSkz);
      setEntryPrice(current.entryPriceSKZ);
      setHasOpenDraw(!!current.draw);
      setDrawNumber(current.draw?.drawNumber ?? null);
      setEntries(myEntries.data);
      setBalance(parseFloat(balanceRes.balanceSkz));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRandomPick = useCallback(() => {
    const all = Array.from({ length: 49 }, (_, i) => i + 1);
    const shuffled = all.sort(() => Math.random() - 0.5);
    setSelectedNums(shuffled.slice(0, 6).sort((a, b) => a - b));
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (selectedNums.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    haptic("medium");
    try {
      await enterLotto(initData, [...selectedNums].sort((a, b) => a - b));
      setSelectedNums([]);
      setShowSuccess(true);
      haptic("success");
      setTimeout(() => setShowSuccess(false), 3000);
      const myEntries = await getMyLottoEntries(initData);
      setEntries(myEntries.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "حدث خطأ — حاول مجدداً");
      haptic("error");
    } finally {
      setSubmitting(false);
    }
  }, [selectedNums, submitting, initData]);

  return (
    <div className="px-4 pt-6 fade-up">
      {/* Header */}
      <div className="mb-5">
        <div className="section-label mb-1">SOUQRATES SWEEP</div>
        <h2 className="font-orbitron font-black text-xl text-white">🎱 اللوتو الأسبوعي</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          اختر 6 أرقام من 1 إلى 49 — السحب كل سبت
        </p>
      </div>

      {/* Jackpot banner */}
      {!loading && (
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>الجائزة الكبرى الحالية</div>
            <div className="font-orbitron font-black text-lg" style={{ color: "#f59e0b" }}>
              {parseFloat(jackpot).toLocaleString()} SKZ
            </div>
          </div>
          {drawNumber && (
            <div className="text-right">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>السحب رقم</div>
              <div className="font-orbitron font-black text-lg text-white">#{drawNumber}</div>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-10 gap-3">
          <div className="text-4xl trophy-float">🎱</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>جاري التحميل…</div>
        </div>
      )}

      {/* No open draw */}
      {!loading && !hasOpenDraw && (
        <div className="rounded-2xl p-6 text-center mb-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-4xl mb-2">🔒</div>
          <div className="font-bold text-white mb-1">لا يوجد سحب مفتوح حالياً</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            ستُفتح جولة جديدة قريباً — تابعنا
          </div>
        </div>
      )}

      {/* Success banner */}
      {showSuccess && (
        <div className="rounded-2xl px-4 py-3 mb-4 win-pop flex items-center gap-3"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-bold text-sm" style={{ color: "#10b981" }}>تم الاشتراك بنجاح!</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              خُصم {entryPrice} SKZ · أرقامك مسجلة في السحب الأسبوعي
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl px-4 py-3 mb-4 text-sm font-bold"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Picker + subscribe (only when draw is open) */}
      {!loading && hasOpenDraw && (
        <>
          <LottoPicker
            selected={selectedNums}
            onChange={setSelectedNums}
            onRandom={handleRandomPick}
            maxSelect={6}
          />

          <div className="mt-4 rounded-2xl p-4"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>سعر الورقة</span>
              <span className="font-orbitron font-black text-sm" style={{ color: "#f59e0b" }}>{entryPrice} SKZ</span>
            </div>
            {balance !== null && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>رصيدك</span>
                <span className="font-orbitron font-black text-sm"
                  style={{ color: balance >= entryPrice ? "#10b981" : "#ef4444" }}>
                  {balance.toLocaleString()} SKZ
                </span>
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>الأرقام المختارة</span>
              <span className="font-bold text-sm"
                style={{ color: selectedNums.length === 6 ? "#10b981" : "rgba(255,255,255,0.4)" }}>
                {selectedNums.length}/6
              </span>
            </div>

            {selectedNums.length === 6 && (
              <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
                {[...selectedNums].sort((a, b) => a - b).map((n) => (
                  <span key={n} className="font-orbitron font-black text-sm px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                    {n}
                  </span>
                ))}
              </div>
            )}

            {balance !== null && balance < entryPrice && (
              <div className="rounded-xl px-3 py-2 mb-3 text-xs font-bold flex items-center gap-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                <span>⚠️</span>
                <span>رصيدك أقل من سعر الورقة — اشحن محفظتك أولاً</span>
              </div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={selectedNums.length !== 6 || submitting || (balance !== null && balance < entryPrice)}
              className="btn-gold w-full py-3.5 font-black text-base"
              style={{ opacity: (selectedNums.length !== 6 || submitting || (balance !== null && balance < entryPrice)) ? 0.6 : 1 }}
            >
              {submitting
                ? "⏳ جاري الاشتراك…"
                : balance !== null && balance < entryPrice
                  ? "💸 رصيد غير كافٍ"
                  : selectedNums.length === 6
                    ? `🎱 اشترك الآن — ${entryPrice} SKZ`
                    : `اختر ${6 - selectedNums.length} أرقام أخرى`}
            </button>
          </div>
        </>
      )}

      {/* My entries */}
      {entries.length > 0 && (
        <div className="mt-5">
          <div className="section-label mb-3">اشتراكاتي ({entries.length})</div>
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <EntryRow key={e.entry.id} entry={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry: e }: { entry: LottoEntry }) {
  const nums = e.entry.chosenNumbers;
  const winning = e.winningNumbers;
  const isDrawn = e.drawStatus === "drawn";

  return (
    <div className="rounded-2xl p-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {nums.map((n) => {
          const matched = isDrawn && winning?.includes(n);
          return (
            <span key={n} className="font-orbitron font-black text-xs px-2 py-0.5 rounded-lg"
              style={{
                background: matched ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.15)",
                color: matched ? "#10b981" : "#f59e0b",
                border: `1px solid ${matched ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.2)"}`,
              }}>
              {n}
            </span>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {new Date(e.entry.createdAt).toLocaleString("ar-EG")}
          {e.drawNumber ? ` · سحب #${e.drawNumber}` : ""}
        </div>
        {isDrawn && e.entry.matchCount !== null && (
          <div className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{
              background: e.entry.isJackpot ? "rgba(245,158,11,0.2)" : e.entry.matchCount > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
              color: e.entry.isJackpot ? "#f59e0b" : e.entry.matchCount > 0 ? "#10b981" : "rgba(255,255,255,0.4)",
            }}>
            {e.entry.isJackpot ? "🏆 جائزة كبرى" : e.entry.matchCount > 0 ? `${e.entry.matchCount} تطابق` : "لا تطابق"}
          </div>
        )}
        {!isDrawn && (
          <div className="text-xs px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(245,158,11,0.08)", color: "rgba(245,158,11,0.7)" }}>
            ⏳ انتظار السحب
          </div>
        )}
      </div>
    </div>
  );
}
