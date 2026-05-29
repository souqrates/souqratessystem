import { useState, useCallback } from "react";
import LottoPicker from "../components/LottoPicker";

interface Props {
  initData: string;
}

interface Subscription {
  id: number;
  numbers: number[];
  timestamp: string;
}

const TICKET_PRICE = 100;

export default function Lotto({ initData: _initData }: Props) {
  const [selectedNums, setSelectedNums] = useState<number[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRandomPick = useCallback(() => {
    const all = Array.from({ length: 49 }, (_, i) => i + 1);
    const shuffled = all.sort(() => Math.random() - 0.5);
    setSelectedNums(shuffled.slice(0, 6).sort((a, b) => a - b));
  }, []);

  const handleSubscribe = useCallback(() => {
    if (selectedNums.length !== 6) return;
    const sub: Subscription = {
      id: Date.now(),
      numbers: [...selectedNums].sort((a, b) => a - b),
      timestamp: new Date().toLocaleString("ar-EG"),
    };
    setSubscriptions((prev) => [sub, ...prev]);
    setSelectedNums([]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }, [selectedNums]);

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

      {/* Success banner */}
      {showSuccess && (
        <div className="rounded-2xl px-4 py-3 mb-4 win-pop flex items-center gap-3"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-bold text-sm" style={{ color: "#10b981" }}>تم الاشتراك بنجاح!</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>أرقامك مسجلة في السحب الأسبوعي</div>
          </div>
        </div>
      )}

      {/* Number picker */}
      <LottoPicker
        selected={selectedNums}
        onChange={setSelectedNums}
        onRandom={handleRandomPick}
        maxSelect={6}
      />

      {/* Price summary + subscribe */}
      <div className="mt-4 rounded-2xl p-4"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>سعر الورقة</span>
          <span className="font-orbitron font-black text-sm" style={{ color: "#f59e0b" }}>{TICKET_PRICE} SKZ</span>
        </div>
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

        <button
          onClick={handleSubscribe}
          disabled={selectedNums.length !== 6}
          className="btn-gold w-full py-3.5 font-black text-base"
        >
          {selectedNums.length === 6 ? "🎱 اشترك الآن" : `اختر ${6 - selectedNums.length} أرقام أخرى`}
        </button>
      </div>

      {/* My subscriptions */}
      {subscriptions.length > 0 && (
        <div className="mt-5">
          <div className="section-label mb-3">اشتراكاتي في السحب الحالي</div>
          <div className="flex flex-col gap-2">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-2xl p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {sub.numbers.map((n) => (
                    <span key={n} className="font-orbitron font-black text-xs px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                      {n}
                    </span>
                  ))}
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{sub.timestamp}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
