import { useState } from "react";
import {
  Zap, Copy, Check, AlertCircle, ChevronRight,
  Wallet, Sparkles, Clock, Gem, ArrowLeft, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { IconBox, CURRENCY_ICONS } from "../components/icons";
import { useT, useLang } from "../lib/i18n";
import { showTelegramAlert } from "../lib/telegram";

// Brand glyphs — inline SVGs (monochrome, currentColor). Kept here so
// we don't pull in an icon-pack dependency just for two logos.
const AppleGlyph = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.41 2.23-1.23 3.06-.99 1.01-2.21 1.6-3.49 1.49-.14-1.1.4-2.27 1.23-3.06.83-.86 2.27-1.51 3.49-1.49zM20.5 17.27c-.45 1.04-.66 1.5-1.24 2.42-.81 1.28-1.95 2.87-3.36 2.89-1.26.01-1.58-.82-3.28-.81-1.7.01-2.06.82-3.32.81-1.41-.02-2.49-1.45-3.3-2.73C3.6 16.66 3.36 11.16 4.94 8.39c1.11-1.94 2.86-3.07 4.51-3.07 1.69 0 2.74.92 4.13.92 1.36 0 2.18-.92 4.13-.92 1.47 0 3.03.81 4.14 2.2-3.64 1.99-3.05 7.2-1.35 9.75z"/>
  </svg>
);
const PlayGlyph = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#34A853" d="M3.6 21.4l9.6-9.4-2.7-2.7L3.1 21z"/>
    <path fill="#FBBC05" d="M16.8 8.6l-3.6 3.4 3.6 3.5 4.2-2.4c1-.6 1-2 0-2.6z"/>
    <path fill="#EA4335" d="M3.1 3l7.4 7.3 2.7-2.7L3.6 2.6z"/>
    <path fill="#4285F4" d="M3.1 3v18l9.6-9z"/>
  </svg>
);

// Visual + UX parity with the mother-bot Telegram chat deposit flow:
//   1) Hub screen — 2 large cards: "I have a wallet" vs "I need a wallet"
//   2) "Have wallet"    → existing TON/USDT direct-deposit form
//   3) "Need wallet"    → TON Keeper install guide (image + 5 steps +
//                         App Store / Play Store + earnings reminder)
// No Visa / @wallet / card option — earnings flow back to the user's
// own TON Keeper wallet, so installing one is framed as one-time
// onboarding, not a payment method.
//
// Telegram Stars deposit path is intentionally hidden from the UI per
// product decision; underlying API/handlers remain in place.

type View = "hub" | "have" | "nowallet";
type Currency = "usdt" | "ton";

const TONKEEPER_APPSTORE_URL  = "https://apps.apple.com/app/tonkeeper/id1587742107";
const TONKEEPER_PLAYSTORE_URL = "https://play.google.com/store/apps/details?id=com.ton_keeper";

// Asset is served from /public; BASE_URL handles the artifact's path
// prefix in production (e.g. https://souqrates.com/<base>/deposit_guide.png).
const DEPOSIT_GUIDE_IMG = `${import.meta.env.BASE_URL}deposit_guide.png`;

export function Deposit() {
  const t = useT();
  const [lang] = useLang();
  const [view, setView] = useState<View>("hub");
  const [currency, setCurrency] = useState<Currency>("ton");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();

  const address    = settings.usdtDepositAddress;
  const tonAddress = settings.tonDepositAddress;
  const activeAddress = currency === "usdt" ? address : tonAddress;
  const addressConfigured = activeAddress.trim().length > 0;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showTelegramAlert(t("deposit.copied"));
  };

  const rate = currency === "ton" ? settings.skzPerTon : settings.skzPerUsdt;
  const num = parseFloat(amount || "0");
  const skzPreview = amount && num > 0 ? Math.floor(num * rate) : null;
  const currencyKey = currency === "ton" ? "TON" : "USDT";
  const minForMethod =
    currency === "ton" ? parseFloat(settings.minDepositTon) : parseFloat(settings.minDepositUsdt);
  const isBelowMin = num > 0 && num < minForMethod;
  const canSubmitCrypto = num >= minForMethod && addressConfigured;
  const methodUnit = currency === "ton" ? "TON" : "USDT";

  // ── Header (shared across all views) ──────────────────────────────
  const Header = (
    <div>
      <h1 className="text-2xl font-black">{t("deposit.title")}</h1>
      <p className="text-[11px] text-white/40 font-medium mt-0.5">{t("deposit.subtitle")}</p>
    </div>
  );

  const ConversionBanner = (
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
  );

  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;
  const BackButton = (
    <button
      onClick={() => setView("hub")}
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white/60 hover:text-white/90 transition-colors px-3 py-2 rounded-xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <BackArrow size={13} strokeWidth={2.5} />
      {t("deposit.back")}
    </button>
  );

  return (
    <div className="px-4 pt-4 pb-6 space-y-5" dir={lang === "ar" ? "rtl" : "ltr"}>
      {Header}
      {ConversionBanner}

      <AnimatePresence mode="wait">
        {/* ────────────────── HUB VIEW ────────────────── */}
        {view === "hub" && (
          <motion.div key="hub"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            <div>
              <p className="section-label mb-1">{t("deposit.hub.title")}</p>
              <p className="text-[12px] text-white/55 leading-relaxed">{t("deposit.hub.intro")}</p>
            </div>

            {/* Have wallet */}
            <motion.button whileTap={{ scale: 0.98 }}
              onClick={() => setView("have")}
              className="w-full rounded-2xl p-4 text-start transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(0,152,234,0.14), rgba(124,58,237,0.10))",
                border: "1.5px solid rgba(0,152,234,0.35)",
                boxShadow: "0 4px 20px rgba(0,152,234,0.18)",
              }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(0,152,234,0.18)", border: "1px solid rgba(0,152,234,0.3)" }}>
                  <Wallet size={22} strokeWidth={2} style={{ color: "#0098EA" }} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-[15px] text-white">{t("deposit.hub.have")}</p>
                  <p className="text-[11px] text-white/55 font-medium mt-0.5">{t("deposit.hub.haveSub")}</p>
                </div>
                <ChevronRight size={18} className={`text-white/40 ${lang === "ar" ? "rotate-180" : ""}`} />
              </div>
            </motion.button>

            {/* Need wallet */}
            <motion.button whileTap={{ scale: 0.98 }}
              onClick={() => setView("nowallet")}
              className="w-full rounded-2xl p-4 text-start transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.08))",
                border: "1.5px solid rgba(255,215,0,0.30)",
                boxShadow: "0 4px 20px rgba(255,215,0,0.15)",
              }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,215,0,0.18)", border: "1px solid rgba(255,215,0,0.3)" }}>
                  <Sparkles size={22} strokeWidth={2} style={{ color: "#FFD700" }} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-[15px] text-white">{t("deposit.hub.nowallet")}</p>
                  <p className="text-[11px] text-white/55 font-medium mt-0.5">{t("deposit.hub.nowalletSub")}</p>
                </div>
                <ChevronRight size={18} className={`text-white/40 ${lang === "ar" ? "rotate-180" : ""}`} />
              </div>
            </motion.button>
          </motion.div>
        )}

        {/* ────────────────── HAVE WALLET VIEW ────────────────── */}
        {view === "have" && (
          <motion.div key="have"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">

            <div className="flex items-center justify-between">
              <p className="section-label">{t("deposit.have.pickCurrency")}</p>
              {BackButton}
            </div>

            {/* TON / USDT toggle */}
            <div className="grid grid-cols-2 gap-2.5">
              {(["ton", "usdt"] as Currency[]).map((c) => {
                const isActive = currency === c;
                const ci = CURRENCY_ICONS[c === "ton" ? "TON" : "USDT"];
                return (
                  <motion.button key={c}
                    onClick={() => { setCurrency(c); setAmount(""); }}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-2xl p-3.5 transition-all"
                    style={{
                      background: isActive ? `${ci.color}14` : "rgba(255,255,255,0.03)",
                      border: isActive ? `1.5px solid ${ci.color}55` : "1.5px solid rgba(255,255,255,0.07)",
                      boxShadow: isActive ? `0 4px 16px ${ci.glow}` : "none",
                    }}>
                    <div className="flex items-center gap-2.5">
                      <IconBox iconKey={ci.iconKey} size={18} color={ci.color}
                        bg={`${ci.color}22`} border={`${ci.color}30`} boxSize={36} radius={10} />
                      <div className="text-start">
                        <p className="font-bold text-sm" style={{ color: isActive ? ci.color : "rgba(255,255,255,0.85)" }}>
                          {c.toUpperCase()}
                        </p>
                        <p className="text-[10px] text-white/40 font-medium">
                          {t(c === "ton" ? "deposit.method.ton.sub" : "deposit.method.usdt.sub")}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

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
                    {currency.toUpperCase()}
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
                {t("deposit.addressLabel", { network: currency === "usdt" ? "TRC20" : "TON Network" })}
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
                {t("deposit.warn.networkOnly", { sym: currency.toUpperCase() })}
              </div>
              <p className="text-white/40">
                {t("deposit.warn.min", { min: minForMethod, unit: methodUnit })}
              </p>
              <p className="text-white/40">{t("deposit.warn.eta")}</p>
              <p style={{ color: CURRENCY_ICONS[currencyKey].color }}>
                {t("deposit.warn.todayRate", { sym: currency.toUpperCase(), rate })}
              </p>
            </div>

            <motion.button disabled={!canSubmitCrypto} whileTap={{ scale: canSubmitCrypto ? 0.97 : 1 }}
              onClick={() => {
                if (!canSubmitCrypto) return;
                const msg = t("deposit.confirmAlert", { amount, sym: currency.toUpperCase(), skz: skzPreview?.toLocaleString() ?? "" });
                showTelegramAlert(msg);
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

        {/* ────────────────── NO WALLET (INSTALL GUIDE) VIEW ────────────────── */}
        {view === "nowallet" && (
          <motion.div key="nowallet"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">

            <div className="flex items-center justify-between">
              <p className="section-label">{t("deposit.nowallet.title")}</p>
              {BackButton}
            </div>

            {/* Hero image — falls back gracefully to a styled placeholder
                if the asset 404s for any reason (offline, CDN miss). */}
            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
              <img
                src={DEPOSIT_GUIDE_IMG}
                alt="TON Keeper deposit guide"
                loading="eager"
                className="w-full h-auto block"
                onError={(e) => { (e.currentTarget.style as CSSStyleDeclaration).display = "none"; }}
              />
            </div>

            {/* Lead */}
            <p className="text-[13px] text-white/80 leading-relaxed">{t("deposit.nowallet.lead")}</p>

            {/* Steps */}
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white/80 font-bold text-sm">{t("deposit.nowallet.stepsHeader")}</p>
              <ol className={`text-[12px] text-white/70 leading-relaxed list-decimal space-y-1.5 ${lang === "ar" ? "pr-4" : "pl-4"}`}>
                <li>{t("deposit.nowallet.step1")}</li>
                <li>{t("deposit.nowallet.step2")}</li>
                <li>{t("deposit.nowallet.step3")}</li>
                <li>{t("deposit.nowallet.step4")}</li>
                <li>{t("deposit.nowallet.step5")}</li>
              </ol>
            </div>

            {/* Time note */}
            <p className="inline-flex items-center justify-center gap-1.5 w-full text-[12px] font-bold text-skz-light">
              <Clock size={13} strokeWidth={2.5} />
              {t("deposit.nowallet.timeNote")}
            </p>

            {/* Store buttons — open in external browser via _blank */}
            <div className="grid grid-cols-2 gap-2.5">
              <a href={TONKEEPER_APPSTORE_URL} target="_blank" rel="noopener noreferrer"
                className="rounded-2xl py-3.5 font-bold text-sm transition-all inline-flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.12)", color: "white" }}>
                <AppleGlyph size={18} />
                {t("deposit.nowallet.appstore")}
              </a>
              <a href={TONKEEPER_PLAYSTORE_URL} target="_blank" rel="noopener noreferrer"
                className="rounded-2xl py-3.5 font-bold text-sm transition-all inline-flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.12)", color: "white" }}>
                <PlayGlyph size={18} />
                {t("deposit.nowallet.playstore")}
              </a>
            </div>

            {/* Earnings footer — the key encouragement line */}
            <div className="rounded-2xl p-4 flex items-start gap-3"
              style={{ background: "rgba(255,215,0,0.08)", border: "1.5px solid rgba(255,215,0,0.25)" }}>
              <Gem size={18} strokeWidth={2} style={{ color: "#FFE066", flexShrink: 0, marginTop: 2 }} />
              <p className="text-[12px] leading-relaxed font-medium" style={{ color: "#FFE066" }}>
                {t("deposit.nowallet.earnings")}
              </p>
            </div>

            {/* CTA: jump back to "have wallet" once installed */}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setView("have")}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all inline-flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #0098EA, #7c3aed)",
                boxShadow: "0 4px 24px rgba(0,152,234,0.35)",
              }}>
              <Wallet size={18} strokeWidth={2.5} />
              {t("deposit.nowallet.haveNow")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
