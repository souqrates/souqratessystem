import { useState } from "react";
import { Star, CircleDollarSign, Gem, Copy, Check, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SKZ_RATES } from "../lib/mock-data";

type Method = "stars" | "usdt" | "ton";

export function Deposit() {
  const [method, setMethod] = useState<Method>("usdt");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const address = "TRX9xKmN4pQ8vLs2wYjF7bDcAeR6hZmU1";
  const tonAddress = "UQCk...Xm8k";

  const handleCopy = () => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "تم نسخ العنوان" });
    }
  };

  const getRate = () => {
    if (method === "usdt") return SKZ_RATES.perUsdt;
    if (method === "stars") return SKZ_RATES.perStar;
    return SKZ_RATES.perTon;
  };

  const skzPreview = amount ? (parseFloat(amount) * getRate()).toFixed(0) : null;

  const methods: { id: Method; label: string; sub: string; icon: React.ReactNode; border: string; bg: string }[] = [
    {
      id: "usdt", label: "USDT", sub: `1 USDT = ${SKZ_RATES.perUsdt} SKZ`,
      icon: <CircleDollarSign size={20} className="text-usdt" />,
      border: "border-usdt", bg: "bg-usdt/8",
    },
    {
      id: "stars", label: "Telegram Stars ⭐", sub: `1 Star = ${SKZ_RATES.perStar} SKZ`,
      icon: <Star size={20} className="text-stars fill-stars" />,
      border: "border-stars", bg: "bg-stars/8",
    },
    {
      id: "ton", label: "TON", sub: `1 TON = ${SKZ_RATES.perTon} SKZ`,
      icon: <Gem size={20} className="text-ton" />,
      border: "border-ton", bg: "bg-ton/8",
    },
  ];

  return (
    <div className="p-4 space-y-5 pb-24">
      <h1 className="text-2xl font-bold mt-2">إيداع SKZ</h1>

      {/* SKZ Conversion Banner */}
      <div className="glass-card-skz rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-skz to-skz-dark flex items-center justify-center flex-shrink-0 skz-coin">
          <span className="text-white font-black text-sm">S</span>
        </div>
        <div>
          <p className="text-sm font-bold text-skz-light">كل إيداع يُحوَّل تلقائياً إلى SKZ</p>
          <p className="text-[11px] text-white/40">المُعدّل يُحدّد من لوحة الإدارة</p>
        </div>
      </div>

      {/* Method Selection */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-white/40 px-1">اختر طريقة الإيداع</p>
        {methods.map((m) => (
          <div
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${method === m.id ? `${m.border} ${m.bg}` : "border-white/5 glass-card"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full glass-card flex items-center justify-center">
                  {m.icon}
                </div>
                <div>
                  <p className="font-bold text-sm">{m.label}</p>
                  <p className="text-[10px] text-white/40">{m.sub}</p>
                </div>
              </div>
              {method === m.id && (
                <div className="w-5 h-5 rounded-full bg-skz flex items-center justify-center">
                  <Check size={11} className="text-white" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {method === "stars" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="stars-form"
            className="space-y-4 pt-4 border-t border-white/10"
          >
            <p className="text-sm font-bold text-white/70">اختر عدد النجوم:</p>
            <div className="grid grid-cols-3 gap-2">
              {[50, 100, 250, 500, 1000, 2500].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount(val.toString())}
                  className={`py-3 rounded-xl font-bold text-sm transition-colors ${amount === val.toString() ? "bg-stars text-base" : "glass-card text-white hover:bg-white/10"}`}
                >
                  {val} ⭐
                </button>
              ))}
            </div>
            {skzPreview && (
              <div className="glass-card-skz rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm text-white/60">ستحصل على</span>
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-skz-light" />
                  <span className="font-black text-xl gradient-text">{parseInt(skzPreview).toLocaleString("ar")}</span>
                  <span className="text-sm font-bold text-white/60">SKZ</span>
                </div>
              </div>
            )}
            <button
              disabled={!amount}
              className="w-full bg-gradient-to-r from-skz to-skz-dark text-white font-bold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95 skz-glow"
            >
              ادفع الآن {amount ? `(${amount} ⭐ → ${parseInt(skzPreview ?? "0").toLocaleString()} SKZ)` : ""}
            </button>
          </motion.div>
        )}

        {(method === "usdt" || method === "ton") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="crypto-form"
            className="space-y-4 pt-4 border-t border-white/10"
          >
            {/* Amount input with SKZ preview */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-white/40">المبلغ ({method.toUpperCase()})</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full glass-card rounded-2xl px-4 py-4 text-xl font-bold bg-transparent outline-none focus:border-accent transition-colors text-right"
                dir="ltr"
              />
              {skzPreview && (
                <div className="glass-card-skz rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-xs text-white/50">ستحصل على</span>
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-skz-light" />
                    <span className="font-black text-lg gradient-text">{parseInt(skzPreview).toLocaleString("ar")}</span>
                    <span className="text-xs text-white/50">SKZ</span>
                  </div>
                </div>
              )}
            </div>

            {/* QR + Address */}
            <div className="bg-white p-4 rounded-3xl w-40 h-40 mx-auto flex items-center justify-center">
              <div className="w-full h-full border-4 border-dashed border-gray-300 rounded-xl flex items-center justify-center relative">
                <div className="absolute inset-4 border-2 border-gray-400" />
                <div className="absolute inset-8 border-4 border-gray-500 rounded-sm bg-gray-200" />
                <div className="absolute top-0 left-0 w-7 h-7 bg-gray-500" />
                <div className="absolute top-0 right-0 w-7 h-7 bg-gray-500" />
                <div className="absolute bottom-0 left-0 w-7 h-7 bg-gray-500" />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 relative">
              <p className="text-xs text-white/40 mb-1">عنوان الإيداع ({method === "usdt" ? "TRC20" : "TON"})</p>
              <p className="font-mono text-sm break-all pr-10 leading-relaxed text-white/80">
                {method === "usdt" ? address : tonAddress}
              </p>
              <button
                onClick={handleCopy}
                className="absolute top-1/2 -translate-y-1/2 left-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
              </button>
            </div>

            <div className="glass-card p-4 rounded-2xl text-xs text-white/50 space-y-1.5">
              <p className="text-danger font-bold">• أرسل فقط {method.toUpperCase()} إلى هذا العنوان.</p>
              <p>• الحد الأدنى: {method === "usdt" ? "5 USDT" : "0.5 TON"}.</p>
              <p>• سيُضاف الرصيد تلقائياً بعد التأكيد بـ SKZ.</p>
              <p className="text-skz-light font-medium">• معدل اليوم: 1 {method.toUpperCase()} = {getRate()} SKZ</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
