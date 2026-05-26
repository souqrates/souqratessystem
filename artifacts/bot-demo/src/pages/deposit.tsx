import { useState } from "react";
import { Zap, Copy, Check, AlertCircle, CreditCard, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { IconBox, CURRENCY_ICONS } from "../components/icons";
import { openTelegramApp } from "../lib/telegram";
import { useT, useLang } from "../lib/i18n";

// Telegram Stars deposit path is intentionally hidden from the UI per
// product decision — keeping the underlying API/handlers in place so the
// option can be re-enabled later without code surgery, just by adding
// "stars" back to METHODS below.
//
// Card method: Cryptomus removed (content restrictions). The "card" slot
// now redirects users to @wallet (Telegram's official wallet bot) where
// they buy USDT/TON with Visa/Mastercard, then send the crypto to our
// deposit address on the USDT or TON tab below.
type Method = "card" | "usdt" | "ton";

const METHODS: { id: Method; label: string | null; labelKey: string | null; subKey: string; currencyKey: string }[] = [
  { id: "card", label: null,   labelKey: "deposit.method.card.label", subKey: "deposit.method.card.sub", currencyKey: "USDT" },
  { id: "usdt", label: "USDT", labelKey: null,                        subKey: "deposit.method.usdt.sub", currencyKey: "USDT" },
  { id: "ton",  label: "TON",  labelKey: null,                        subKey: "deposit.method.ton.sub",  currencyKey: "TON"  },
];

export function Deposit() {
  const t = useT();
  const [lang] = useLang();
  const [method, setMethod] = useState<Method>("card");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();

  const address    = settings.usdtDepositAddress;
  const tonAddress = settings.tonDepositAddress;
  const activeAddress = method === "usdt" ? address : tonAddress;
  const addressConfigured = method === "card" || activeAddress.trim().length > 0;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: t("deposit.copied") });
    }
  };

  const getRate = () => {
    if (method === "ton") return settings.skzPerTon;
    return settings.skzPerUsdt;
  };

  const num = parseFloat(amount || "0");
  const skzPreview = amount && num > 0 ? Math.floor(num * getRate()) : null;
  const currencyKey = method === "ton" ? "TON" : "USDT";

  const minForMethod =
    method === "ton" ? parseFloat(settings.minDepositTon) :
                       parseFloat(settings.minDepositUsdt);

  const isBelowMin = num > 0 && num < minForMethod;
  const canSubmitCrypto = num >= minForMethod && addressConfigured;

  const methodUnit = method === "ton" ? "TON" : "USDT";

  return (
    <div className="px-4 pt-4 pb-6 space-y-5" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">{t("deposit.title")}</h1>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">{t("deposit.subtitle")}</p>
      </div>

      {/* Conversion banner */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 16px rgba(147,51,234,0.3)" }}>
          <IconBox iconKey="download" size={18} color="white" bg="transparent" border="transparent" boxSize={40} radius={10} />
        </div>
        <div>
          <p className="text-sm font-bold text-skz-light">{t("deposit.banner.title")}</p>
          <p className="text-[11px] text-white/40">{t("deposit.banner.sub")}</p>
        </div>
        <div className="mr-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
          style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <Zap size={10} className="text-skz-light" />
          <span className="text-[10px] font-black text-skz-light">+50 XP</span>
        </div>
      </div>

      {/* Method tabs */}
      <div>
        <p className="section-label mb-3">{t("deposit.chooseMethod")}</p>
        <div className="space-y-2.5">
          {METHODS.map((m) => {
            const isActive = method === m.id;
            const ci = CURRENCY_ICONS[m.currencyKey];
            const rateStr = m.id === "ton"
              ? `1 TON = ${settings.skzPerTon} SKZ`
              : m.id === "usdt"
              ? `1 USDT = ${settings.skzPerUsdt} SKZ`
              : `1 USDT = ${settings.skzPerUsdt} SKZ${t("deposit.rate.cardSuffix")}`;

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
                        {m.label ?? t(m.labelKey!)}
                      </p>
                      <p className="text-[10px] text-white/35 font-medium mt-0.5">{t(m.subKey)} · {rateStr}</p>
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

            {/* Intro card */}
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)" }}>
              <p className="text-skz-light font-bold text-sm flex items-center gap-2">
                <CreditCard size={14} /> {t("deposit.card.heading")} <span dir="ltr">@wallet</span>
              </p>
              <p className="text-[12px] text-white/70 leading-relaxed">
                {t("deposit.card.intro")}
              </p>
            </div>

            {/* Steps */}
            <div className="rounded-2xl p-3.5 text-[11px] leading-relaxed"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white/80 font-bold mb-2">{t("deposit.card.steps")}</p>
              <ol className="text-white/60 list-decimal pr-4 space-y-1.5">
                <li>{t("deposit.card.step1")}</li>
                <li>{t("deposit.card.step2")}</li>
                <li>{t("deposit.card.step3")}</li>
                <li>{t("deposit.card.step4")}</li>
              </ol>
            </div>

            {/* Quick rate hint */}
            <div className="rounded-2xl p-3 text-[11px] flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-white/50">{t("deposit.card.currentRate")}</span>
              <span className="font-mono font-bold text-skz-light">
                1 USDT = {settings.skzPerUsdt} SKZ · 1 TON = {settings.skzPerTon} SKZ
              </span>
            </div>

            {/* Primary CTA: open @wallet inside Telegram */}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => openTelegramApp("https://t.me/wallet")}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #9333ea, #7c3aed)",
                boxShadow: "0 4px 24px rgba(147,51,234,0.4)",
              }}>
              <CreditCard size={18} />
              {t("deposit.card.openWallet")}
              <ExternalLink size={14} className="opacity-70" />
            </motion.button>

            {/* Secondary: jump to USDT tab */}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { setMethod("usdt"); setAmount(""); }}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
              }}>
              {t("deposit.card.showUsdtAddr")}
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
              <p className="section-label">{t("deposit.amountLabel", { unit: methodUnit })}</p>
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
                    <AlertCircle size={12} /> {t("deposit.minErr", { min: minForMethod, unit: methodUnit })}
                  </motion.p>
                )}
                {skzPreview !== null && !isBelowMin && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="glass-card-skz rounded-2xl p-3.5 flex items-center justify-between">
                    <p className="text-sm text-white/50">{t("deposit.willReceive")}</p>
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
                {t("deposit.addressLabel", { network: method === "usdt" ? "TRC20" : "TON Network" })}
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
                  {t("deposit.addressUnavailable", { support: settings.supportUsername })}
                </p>
              )}
            </div>

            {/* Warning + rules */}
            <div className="rounded-2xl p-4 space-y-1.5 text-[11px] font-medium"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-danger font-bold flex items-center gap-2">
                <IconBox iconKey="shield" size={12} color="#ef4444" bg="rgba(239,68,68,0.15)"
                  border="rgba(239,68,68,0.2)" boxSize={20} radius={5} />
                {t("deposit.warn.networkOnly", { sym: method.toUpperCase() })}
              </div>
              <p className="text-white/40">
                {t("deposit.warn.min", { min: minForMethod, unit: methodUnit })}
              </p>
              <p className="text-white/40">{t("deposit.warn.eta")}</p>
              <p style={{ color: CURRENCY_ICONS[currencyKey].color }}>
                {t("deposit.warn.todayRate", { sym: method.toUpperCase(), rate: getRate() })}
              </p>
            </div>

            <motion.button disabled={!canSubmitCrypto} whileTap={{ scale: canSubmitCrypto ? 0.97 : 1 }}
              onClick={() => {
                if (!canSubmitCrypto) return;
                const wa = window.Telegram?.WebApp;
                const msg = t("deposit.confirmAlert", { amount, sym: method.toUpperCase(), skz: skzPreview?.toLocaleString() ?? "" });
                if (wa?.showAlert) wa.showAlert(msg); else alert(msg);
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-white"
              style={{
                background: canSubmitCrypto ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: canSubmitCrypto ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: canSubmitCrypto ? 1 : 0.45,
              }}>
              {!amount || num <= 0
                ? t("deposit.cta.enterAmount")
                : isBelowMin
                ? t("deposit.cta.minNeeded", { min: minForMethod, unit: methodUnit })
                : !addressConfigured
                ? t("deposit.cta.addrInactive")
                : t("deposit.cta.iSent")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
