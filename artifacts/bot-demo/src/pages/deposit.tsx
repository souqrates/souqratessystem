import { useState } from "react";
import { Star, CircleDollarSign, Gem, Copy, Check, Zap, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformSettings } from "../lib/use-platform-settings";

type Method = "usdt" | "stars" | "ton";

const STAR_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

export function Deposit() {
  const [method, setMethod] = useState<Method>("usdt");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();

  const address = "TRX9xKmN4pQ8vLs2wYjF7bDcAeR6hZmU1";
  const tonAddress = "UQCk9pn7Xm8kGzR3LwV1uQ2aJ5mBfD8sYeT6Xm8k";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "✓ تم النسخ" });
    }
  };

  const getRate = () => {
    if (method === "usdt") return settings.skzPerUsdt;
    if (method === "stars") return settings.skzPerStar;
    return settings.skzPerTon;
  };

  const skzPreview = amount ? Math.floor(parseFloat(amount) * getRate()) : null;

  const METHODS: { id: Method; label: string; sub: string; icon: React.ReactNode; color: string; glow: string }[] = [
    {
      id: "usdt", label: "USDT", sub: `1 USDT = ${settings.skzPerUsdt} SKZ`,
      icon: <CircleDollarSign size={20} style={{ color: "#26d0a0" }} />,
      color: "#26d0a0", glow: "rgba(38,208,160,0.2)",
    },
    {
      id: "stars", label: "Telegram Stars ⭐", sub: `1 ⭐ = ${settings.skzPerStar} SKZ`,
      icon: <Star size={20} style={{ color: "#f59e0b" }} className="fill-[#f59e0b]" />,
      color: "#f59e0b", glow: "rgba(245,158,11,0.2)",
    },
    {
      id: "ton", label: "TON", sub: `1 TON = ${settings.skzPerTon} SKZ`,
      icon: <Gem size={20} style={{ color: "#0098ea" }} />,
      color: "#0098ea", glow: "rgba(0,152,234,0.2)",
    },
  ];

  const selected = METHODS.find((m) => m.id === method)!;

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-black">إيداع SKZ</h1>
          <p className="text-[11px] text-white/40 font-medium mt-0.5">أودع وحوّل تلقائياً إلى SKZ</p>
        </div>
      </div>

      {/* Conversion banner */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center skz-coin"
          style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)" }}>
          <span className="text-white font-black text-sm">S</span>
        </div>
        <div>
          <p className="text-sm font-bold text-skz-light">يُحوَّل تلقائياً إلى SKZ</p>
          <p className="text-[11px] text-white/40">بالمعدل الحالي المحدد من الإدارة</p>
        </div>
      </div>

      {/* Method tabs */}
      <div>
        <p className="section-label mb-3">اختر طريقة الإيداع</p>
        <div className="space-y-2.5">
          {METHODS.map((m) => {
            const isActive = method === m.id;
            return (
              <motion.div
                key={m.id}
                onClick={() => { setMethod(m.id); setAmount(""); }}
                whileTap={{ scale: 0.98 }}
                className="rounded-2xl p-4 cursor-pointer pressable transition-all"
                style={{
                  background: isActive ? `${m.color}12` : "rgba(255,255,255,0.03)",
                  border: isActive ? `1.5px solid ${m.color}40` : "1.5px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? `0 4px 20px ${m.glow}` : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: isActive ? `${m.color}20` : "rgba(255,255,255,0.05)" }}
                    >
                      {m.icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{m.label}</p>
                      <p className="text-[10px] text-white/35 font-medium mt-0.5">{m.sub}</p>
                    </div>
                  </div>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: m.color }}
                    >
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Method-specific form */}
      <AnimatePresence mode="wait">
        {method === "stars" && (
          <motion.div
            key="stars"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="divider" />
            <p className="section-label">اختر عدد النجوم</p>
            <div className="grid grid-cols-3 gap-2">
              {STAR_AMOUNTS.map((val) => {
                const isSelected = amount === val.toString();
                return (
                  <motion.button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    whileTap={{ scale: 0.93 }}
                    className="py-3.5 rounded-2xl font-bold text-sm transition-all"
                    style={{
                      background: isSelected ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                      border: isSelected ? "1.5px solid rgba(245,158,11,0.5)" : "1.5px solid rgba(255,255,255,0.07)",
                      color: isSelected ? "#f59e0b" : "rgba(255,255,255,0.7)",
                      boxShadow: isSelected ? "0 4px 16px rgba(245,158,11,0.2)" : "none",
                    }}
                  >
                    {val.toLocaleString()} ⭐
                  </motion.button>
                );
              })}
            </div>

            {skzPreview !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card-skz rounded-2xl p-4 flex items-center justify-between"
              >
                <p className="text-sm text-white/60">ستحصل على</p>
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-skz-light" />
                  <p className="font-black text-2xl gradient-text">{skzPreview.toLocaleString("ar-SA")}</p>
                  <p className="text-sm text-white/40 font-bold">SKZ</p>
                </div>
              </motion.div>
            )}

            <motion.button
              disabled={!amount}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all"
              style={{
                background: amount ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: amount ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: amount ? 1 : 0.5,
              }}
            >
              {amount
                ? `ادفع ${parseInt(amount).toLocaleString()} ⭐ ← ${skzPreview?.toLocaleString()} SKZ`
                : "اختر عدد النجوم"}
            </motion.button>
          </motion.div>
        )}

        {(method === "usdt" || method === "ton") && (
          <motion.div
            key="crypto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="divider" />

            {/* Amount input */}
            <div className="space-y-2">
              <p className="section-label">المبلغ ({method.toUpperCase()})</p>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="premium-input w-full px-4 py-4 text-2xl font-black text-right"
                  dir="ltr"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <span className="text-sm font-bold" style={{ color: selected.color }}>{method.toUpperCase()}</span>
                </div>
              </div>
              <AnimatePresence>
                {skzPreview !== null && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="glass-card-skz rounded-2xl p-3.5 flex items-center justify-between"
                  >
                    <p className="text-sm text-white/50">ستحصل على</p>
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-skz-light" />
                      <p className="font-black text-xl gradient-text">{skzPreview.toLocaleString("ar-SA")}</p>
                      <span className="text-[11px] text-white/40 font-bold">SKZ</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* QR placeholder */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-36 h-36 bg-white rounded-2xl flex items-center justify-center relative p-3">
                <div className="absolute inset-3 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <div className="absolute inset-6 bg-gray-200 rounded" />
                  <div className="absolute top-0 left-0 w-8 h-8 bg-gray-700 rounded-sm" />
                  <div className="absolute top-0 right-0 w-8 h-8 bg-gray-700 rounded-sm" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 bg-gray-700 rounded-sm" />
                </div>
              </div>
              <p className="text-[11px] text-white/35 font-medium">امسح QR لنسخ العنوان</p>
            </div>

            {/* Address */}
            <div
              className="rounded-2xl p-4 relative"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="section-label mb-2">عنوان الإيداع ({method === "usdt" ? "TRC20" : "TON Network"})</p>
              <p className="font-mono text-sm text-white/70 break-all pr-12 leading-relaxed text-left" dir="ltr">
                {method === "usdt" ? address : tonAddress}
              </p>
              <motion.button
                onClick={() => handleCopy(method === "usdt" ? address : tonAddress)}
                whileTap={{ scale: 0.9 }}
                className="absolute top-4 left-4 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)" }}
              >
                {copied
                  ? <Check size={15} className="text-success" strokeWidth={2.5} />
                  : <Copy size={15} className="text-white/60" />}
              </motion.button>
            </div>

            {/* Warning */}
            <div
              className="rounded-2xl p-4 space-y-1.5 text-[11px] font-medium"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-danger font-bold">⚠ أرسل فقط {method.toUpperCase()} على هذه الشبكة</p>
              <p className="text-white/40">الحد الأدنى: {method === "usdt" ? `${settings.minDepositUsdt} USDT` : `${settings.minDepositTon} TON`}</p>
              <p className="text-white/40">يُضاف تلقائياً بـ SKZ بعد تأكيد الشبكة</p>
              <p style={{ color: selected.color }}>معدل اليوم: 1 {method.toUpperCase()} = {getRate()} SKZ</p>
            </div>

            <motion.button
              disabled={!amount || parseFloat(amount) <= 0}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-black text-base text-white"
              style={{
                background: amount ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: amount ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: amount ? 1 : 0.45,
              }}
            >
              {amount ? `تأكيد الإيداع` : "أدخل المبلغ"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
