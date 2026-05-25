import { useState } from "react";
import { Zap, Copy, Check, AlertCircle, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { IconBox, CURRENCY_ICONS } from "../components/icons";
import { showTelegramAlert } from "../lib/telegram";

type Method = "card" | "usdt" | "stars" | "ton";

const STAR_AMOUNTS = [50, 100, 250, 500, 1000, 2500];
const CARD_AMOUNTS_USDT = [5, 10, 25, 50, 100, 250];

const METHODS: { id: Method; label: string; sub: string; currencyKey: string }[] = [
  { id: "card",  label: "💳 شحن بالبطاقة", sub: "فيزا / ماستركارد · فوري عبر Cryptomus", currencyKey: "USDT" },
  { id: "usdt",  label: "USDT",            sub: "Tether · شبكة TRC20",                   currencyKey: "USDT"  },
  { id: "stars", label: "نجوم تيليغرام",   sub: "Telegram Stars · فوري",                 currencyKey: "Stars" },
  { id: "ton",   label: "TON",             sub: "The Open Network",                      currencyKey: "TON"   },
];

export function Deposit() {
  const [method, setMethod] = useState<Method>("card");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();

  const address    = settings.usdtDepositAddress;
  const tonAddress = settings.tonDepositAddress;
  const activeAddress = method === "usdt" ? address : tonAddress;
  const addressConfigured = method === "stars" || activeAddress.trim().length > 0;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "✓ تم النسخ" });
    }
  };

  const getRate = () => {
    if (method === "usdt")  return settings.skzPerUsdt;
    if (method === "stars") return settings.skzPerStar;
    return settings.skzPerTon;
  };

  const num = parseFloat(amount || "0");
  const skzPreview = amount && num > 0 ? Math.floor(num * getRate()) : null;
  const currencyKey = method === "usdt" ? "USDT" : method === "stars" ? "Stars" : "TON";

  const minForMethod =
    method === "usdt"  ? parseFloat(settings.minDepositUsdt) :
    method === "stars" ? parseFloat(settings.minDepositStars) :
                         parseFloat(settings.minDepositTon);

  const isBelowMin = num > 0 && num < minForMethod;
  const canSubmitCrypto = num >= minForMethod && addressConfigured;

  const methodUnit = method === "usdt" ? "USDT" : method === "stars" ? "نجمة" : "TON";

  return (
    <div className="px-4 pt-4 pb-6 space-y-5" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">إيداع SKZ</h1>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">أودِع وتحوَّل تلقائيًا إلى SKZ</p>
      </div>

      {/* Conversion banner */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 16px rgba(147,51,234,0.3)" }}>
          <IconBox iconKey="download" size={18} color="white" bg="transparent" border="transparent" boxSize={40} radius={10} />
        </div>
        <div>
          <p className="text-sm font-bold text-skz-light">تحويل تلقائي إلى SKZ</p>
          <p className="text-[11px] text-white/40">بالسعر الحالي المعتمد من الإدارة</p>
        </div>
        <div className="mr-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
          style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <Zap size={10} className="text-skz-light" />
          <span className="text-[10px] font-black text-skz-light">+50 XP</span>
        </div>
      </div>

      {/* Method tabs */}
      <div>
        <p className="section-label mb-3">اختر وسيلة الإيداع</p>
        <div className="space-y-2.5">
          {METHODS.map((m) => {
            const isActive = method === m.id;
            const ci = CURRENCY_ICONS[m.currencyKey];
            const rateStr = m.id === "usdt"
              ? `1 USDT = ${settings.skzPerUsdt} SKZ`
              : m.id === "stars"
              ? `1 ⭐ = ${settings.skzPerStar} SKZ`
              : `1 TON = ${settings.skzPerTon} SKZ`;

            return (
              <motion.div
                key={m.id}
                onClick={() => { setMethod(m.id); setAmount(""); }}
                whileTap={{ scale: 0.98 }}
                className="rounded-2xl p-4 cursor-pointer pressable transition-all"
                style={{
                  background: isActive ? `${ci.color}12` : "rgba(255,255,255,0.03)",
                  border: isActive ? `1.5px solid ${ci.color}40` : "1.5px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? `0 4px 20px ${ci.glow}` : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: isActive ? ci.bg : "rgba(255,255,255,0.05)",
                        border: `1px solid ${isActive ? ci.color + "30" : "rgba(255,255,255,0.08)"}`,
                        boxShadow: isActive ? `0 4px 12px ${ci.glow}` : "none",
                      }}
                    >
                      <IconBox iconKey={ci.iconKey} size={20} color={ci.color}
                        bg="transparent" border="transparent" boxSize={44} radius={12} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: isActive ? ci.color : "rgba(255,255,255,0.85)" }}>
                        {m.label}
                      </p>
                      <p className="text-[10px] text-white/35 font-medium mt-0.5">{m.sub} · {rateStr}</p>
                    </div>
                  </div>
                  {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: ci.color }}>
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
        {method === "card" && (
          <motion.div key="card"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            <div className="divider" />

            <p className="section-label">اختر مبلغ الشحن (USDT)</p>
            <div className="grid grid-cols-3 gap-2">
              {CARD_AMOUNTS_USDT.map((val) => {
                const isSel = amount === val.toString();
                return (
                  <motion.button key={val} onClick={() => setAmount(val.toString())} whileTap={{ scale: 0.93 }}
                    className="py-3.5 rounded-2xl font-bold text-sm transition-all"
                    style={{
                      background: isSel ? "rgba(168,85,247,0.20)" : "rgba(255,255,255,0.04)",
                      border: isSel ? "1.5px solid rgba(168,85,247,0.50)" : "1.5px solid rgba(255,255,255,0.07)",
                      color: isSel ? "#c084fc" : "rgba(255,255,255,0.7)",
                      boxShadow: isSel ? "0 4px 16px rgba(168,85,247,0.25)" : "none",
                    }}>
                    ${val}
                  </motion.button>
                );
              })}
            </div>

            {/* Custom amount input */}
            <div className="space-y-2">
              <p className="section-label">أو أدخل مبلغاً مخصصاً</p>
              <div className="relative">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="مثال: 15"
                  className="premium-input w-full px-4 py-4 text-xl font-black text-right pl-20"
                  dir="ltr" min="1" max="10000" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-skz-light" />
                  <span className="text-xs font-bold text-skz-light">USDT</span>
                </div>
              </div>
            </div>

            {skzPreview !== null && num >= 1 && num <= 10000 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="glass-card-skz rounded-2xl p-4 flex items-center justify-between">
                <p className="text-sm text-white/60">ستستلم</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white/40 font-bold">SKZ</p>
                  <p className="font-black text-2xl gradient-text">{skzPreview.toLocaleString()}</p>
                  <Zap size={15} className="text-skz-light" />
                </div>
              </motion.div>
            )}

            {/* How-to / where the button actually lives */}
            <div className="rounded-2xl p-3.5 text-[11px] leading-relaxed"
              style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
              <p className="text-skz-light font-bold mb-1.5 flex items-center gap-1.5">
                <CreditCard size={12} /> كيف يعمل الشحن بالبطاقة
              </p>
              <ol className="text-white/60 list-decimal pr-4 space-y-1">
                <li>افتح <b>@souqrates_system_bot</b> في تيليغرام واضغط <b>/start</b>.</li>
                <li>اضغط <b>💰 Balance</b> → <b>💳 شحن بالبطاقة</b>.</li>
                <li>اختر المبلغ، يفتح لك رابط دفع Cryptomus.</li>
                <li>ادفع بالفيزا/ماستركارد — يصلك تأكيد ويتحدّث رصيدك خلال ثوانٍ ⚡.</li>
              </ol>
            </div>

            <motion.button disabled={!amount || num < 1 || num > 10000} whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!amount || num < 1 || num > 10000) return;
                showTelegramAlert(
                  `لإتمام الدفع بالبطاقة:\n` +
                  `افتح البوت @souqrates_system_bot واضغط /start ثم 💰 Balance → 💳 شحن بالبطاقة.\n\n` +
                  `المبلغ: $${num} USDT → ${skzPreview?.toLocaleString()} SKZ`,
                );
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: amount && num >= 1 && num <= 10000
                  ? "linear-gradient(135deg, #9333ea, #7c3aed)"
                  : "rgba(255,255,255,0.06)",
                boxShadow: amount && num >= 1 && num <= 10000
                  ? "0 4px 24px rgba(147,51,234,0.4)"
                  : "none",
                opacity: amount && num >= 1 && num <= 10000 ? 1 : 0.5,
              }}>
              <CreditCard size={18} />
              {!amount
                ? "اختر مبلغ الشحن"
                : num < 1
                ? "الحد الأدنى $1 USDT"
                : num > 10000
                ? "الحد الأعلى $10,000 USDT"
                : `ادفع $${num} USDT بالبطاقة`}
            </motion.button>
          </motion.div>
        )}

        {method === "stars" && (
          <motion.div key="stars"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            <div className="divider" />
            <p className="section-label">اختر الباقة</p>
            <div className="grid grid-cols-3 gap-2">
              {STAR_AMOUNTS.map((val) => {
                const isSel = amount === val.toString();
                const ci = CURRENCY_ICONS["Stars"];
                return (
                  <motion.button key={val} onClick={() => setAmount(val.toString())} whileTap={{ scale: 0.93 }}
                    className="py-3.5 rounded-2xl font-bold text-sm transition-all"
                    style={{
                      background: isSel ? `${ci.color}20` : "rgba(255,255,255,0.04)",
                      border: isSel ? `1.5px solid ${ci.color}50` : "1.5px solid rgba(255,255,255,0.07)",
                      color: isSel ? ci.color : "rgba(255,255,255,0.7)",
                      boxShadow: isSel ? `0 4px 16px ${ci.glow}` : "none",
                    }}>
                    {val.toLocaleString()} ⭐
                  </motion.button>
                );
              })}
            </div>

            {skzPreview !== null && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="glass-card-skz rounded-2xl p-4 flex items-center justify-between">
                <p className="text-sm text-white/60">ستستلم</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white/40 font-bold">SKZ</p>
                  <p className="font-black text-2xl gradient-text">{skzPreview.toLocaleString()}</p>
                  <Zap size={15} className="text-skz-light" />
                </div>
              </motion.div>
            )}

            {/* Stars policy disclaimer */}
            <div className="rounded-2xl p-3.5 text-[11px] leading-relaxed"
              style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}>
              <p className="text-warn font-bold mb-1 flex items-center gap-1.5">
                <AlertCircle size={12} /> قبل المتابعة
              </p>
              <p className="text-white/55">
                ستفتح نافذة دفع Telegram Stars داخل تيليغرام. الدفع نهائي وغير قابل للإلغاء بعد التأكيد.
                في حال فشل العملية لن يُخصم أي رصيد، وفي حال نجاحها يُضاف SKZ مباشرة إلى محفظتك.
              </p>
            </div>

            <AnimatePresence>
              {isBelowMin && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[11px] text-danger flex items-center gap-1.5 font-bold">
                  <AlertCircle size={12} /> الحد الأدنى {minForMethod} نجمة
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button disabled={!amount || isBelowMin} whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!amount || isBelowMin) return;
                showTelegramAlert(
                  `سيُفتح دفع Telegram Stars الآن.\nالمبلغ: ${parseInt(amount).toLocaleString()} ⭐ → ${skzPreview?.toLocaleString()} SKZ\n\nيتم تجهيز معالج الدفع — الزر سيعمل فور تفعيله.`
                );
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all"
              style={{
                background: amount && !isBelowMin ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: amount && !isBelowMin ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: amount && !isBelowMin ? 1 : 0.5,
              }}>
              {!amount
                ? "اختر عدد النجوم"
                : isBelowMin
                ? `الحد الأدنى ${minForMethod} نجمة`
                : `ادفع ${parseInt(amount).toLocaleString()} ⭐ → ${skzPreview?.toLocaleString()} SKZ`}
            </motion.button>
          </motion.div>
        )}

        {(method === "usdt" || method === "ton") && (
          <motion.div key="crypto"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            <div className="divider" />

            {/* Amount input */}
            <div className="space-y-2">
              <p className="section-label">المبلغ ({methodUnit})</p>
              <div className="relative">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="premium-input w-full px-4 py-4 text-2xl font-black text-right pl-20"
                  dir="ltr" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <IconBox iconKey={CURRENCY_ICONS[currencyKey].iconKey} size={14}
                    color={CURRENCY_ICONS[currencyKey].color}
                    bg={`${CURRENCY_ICONS[currencyKey].color}20`}
                    border={`${CURRENCY_ICONS[currencyKey].color}25`}
                    boxSize={26} radius={7} />
                  <span className="text-xs font-bold" style={{ color: CURRENCY_ICONS[currencyKey].color }}>
                    {method.toUpperCase()}
                  </span>
                </div>
              </div>
              <AnimatePresence>
                {isBelowMin && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-[11px] text-danger flex items-center gap-1.5 font-bold">
                    <AlertCircle size={12} /> الحد الأدنى للإيداع {minForMethod} {methodUnit}
                  </motion.p>
                )}
                {skzPreview !== null && !isBelowMin && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="glass-card-skz rounded-2xl p-3.5 flex items-center justify-between">
                    <p className="text-sm text-white/50">ستستلم</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/40 font-bold">SKZ</span>
                      <p className="font-black text-xl gradient-text">{skzPreview.toLocaleString()}</p>
                      <Zap size={14} className="text-skz-light" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Address */}
            <div className="rounded-2xl p-4 relative"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="section-label mb-2">
                عنوان الإيداع ({method === "usdt" ? "TRC20" : "TON Network"})
              </p>
              {addressConfigured ? (
                <>
                  <p className="font-mono text-sm text-white/70 break-all pl-12 leading-relaxed text-left" dir="ltr">
                    {activeAddress}
                  </p>
                  <motion.button
                    onClick={() => handleCopy(activeAddress)}
                    whileTap={{ scale: 0.9 }}
                    className="absolute top-4 left-4 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                    style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)" }}>
                    {copied
                      ? <Check size={15} className="text-success" strokeWidth={2.5} />
                      : <Copy size={15} className="text-white/60" />}
                  </motion.button>
                </>
              ) : (
                <p className="text-[12px] text-warn font-bold leading-relaxed">
                  ⚠️ عنوان الإيداع غير مفعَّل حاليًا. يرجى التواصل مع الدعم
                  (@{settings.supportUsername}) أو انتظار تفعيله من قِبَل الإدارة.
                </p>
              )}
            </div>

            {/* Warning + rules */}
            <div className="rounded-2xl p-4 space-y-1.5 text-[11px] font-medium"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-danger font-bold flex items-center gap-2">
                <IconBox iconKey="shield" size={12} color="#ef4444" bg="rgba(239,68,68,0.15)"
                  border="rgba(239,68,68,0.2)" boxSize={20} radius={5} />
                أرسل {method.toUpperCase()} فقط عبر هذه الشبكة — أي عملة أخرى تُفقد نهائيًا
              </div>
              <p className="text-white/40">
                الحد الأدنى: {minForMethod} {methodUnit}
              </p>
              <p className="text-white/40">يُضاف الرصيد تلقائيًا بعد تأكيد الشبكة (٢-٥ دقائق)</p>
              <p style={{ color: CURRENCY_ICONS[currencyKey].color }}>
                سعر اليوم: 1 {method.toUpperCase()} = {getRate()} SKZ
              </p>
            </div>

            <motion.button disabled={!canSubmitCrypto} whileTap={{ scale: canSubmitCrypto ? 0.97 : 1 }}
              onClick={() => {
                if (!canSubmitCrypto) return;
                showTelegramAlert(
                  `تم تسجيل نية الإيداع.\nالمبلغ: ${amount} ${method.toUpperCase()} → ${skzPreview?.toLocaleString()} SKZ\n\nأرسل المبلغ إلى العنوان أعلاه. سيُضاف الرصيد تلقائيًا فور تأكيد المعاملة على الشبكة.`
                );
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-white"
              style={{
                background: canSubmitCrypto ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: canSubmitCrypto ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: canSubmitCrypto ? 1 : 0.45,
              }}>
              {!amount || num <= 0
                ? "أدخل المبلغ"
                : isBelowMin
                ? `الحد الأدنى ${minForMethod} ${methodUnit}`
                : !addressConfigured
                ? "العنوان غير مفعَّل"
                : "لقد أرسلت المبلغ"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
