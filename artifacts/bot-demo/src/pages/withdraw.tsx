import { useState } from "react";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { useWallet } from "../lib/use-wallet";
import { Zap, AlertCircle, Upload, Loader2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IconBox, CURRENCY_ICONS } from "../components/icons";
import { showTelegramAlert } from "../lib/telegram";
import { useT, useLang } from "../lib/i18n";

type Target = "usdt" | "ton";

const TARGETS: { id: Target; label: string; currencyKey: string }[] = [
  { id: "usdt", label: "USDT", currencyKey: "USDT" },
  { id: "ton",  label: "TON",  currencyKey: "TON"  },
];

// Address format validation
// TRC20: starts with 'T', 34 chars total, Base58 (no 0, O, I, l)
// TON: starts with EQ/UQ/kQ/0Q (non-bounceable/bounceable mainnet), 48 chars, base64url
const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const TON_RE   = /^(EQ|UQ)[A-Za-z0-9_-]{46}$/;

function validateAddress(target: Target, addr: string): { ok: boolean; reason?: string } {
  if (!addr) return { ok: false };
  if (target === "usdt") {
    if (!TRC20_RE.test(addr)) {
      return { ok: false, reason: "عنوان TRC20 غير صحيح (يبدأ بـ T وطوله 34 خانة)" };
    }
  } else {
    if (!TON_RE.test(addr)) {
      return { ok: false, reason: "عنوان TON غير صحيح (يبدأ بـ EQ/UQ/kQ/0Q وطوله 48 خانة)" };
    }
  }
  return { ok: true };
}

export function Withdraw() {
  const t = useT();
  const [lang] = useLang();
  const [target, setTarget] = useState<Target>("usdt");
  const [skzAmount, setSkzAmount] = useState("");
  const [address, setAddress] = useState("");
  const { settings } = usePlatformSettings();
  const { balanceSkz, isLoading: walletLoading } = useWallet();

  const ci = CURRENCY_ICONS[target === "usdt" ? "USDT" : "TON"];
  const getRate = () => (target === "usdt" ? settings.skzPerUsdt : settings.skzPerTon);
  const feePercent = target === "usdt"
    ? parseFloat(settings.withdrawalFeeUsdtPercent) / 100
    : parseFloat(settings.withdrawalFeeTonPercent) / 100;

  const maxSkz = balanceSkz;
  const minSkz = parseFloat(settings.minWithdrawalSkz);
  const numSkz = parseFloat(skzAmount || "0");
  const isOverMax  = numSkz > maxSkz;
  const isBelowMin = numSkz > 0 && numSkz < minSkz;
  const realAmount = numSkz / getRate();
  const fee        = realAmount * feePercent;
  const netReal    = Math.max(0, realAmount - fee);

  const addrCheck = address ? validateAddress(target, address.trim()) : { ok: false };
  const isValid   = numSkz >= minSkz && !isOverMax && addrCheck.ok;

  const etaHours = parseInt(settings.withdrawalEtaHours) || 24;
  const targetLabel = target === "usdt" ? "USDT" : "TON";

  return (
    <div className="px-4 pt-4 pb-8 space-y-5" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">{t("withdraw.title")}</h1>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">{t("withdraw.subtitle")}</p>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)" }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 16px rgba(147,51,234,0.35)" }}>
            <IconBox iconKey="zap" size={20} color="white" bg="transparent" border="transparent" boxSize={44} radius={12} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{t("withdraw.available")}</p>
            {walletLoading ? (
              <Loader2 size={16} className="text-skz-light animate-spin mt-1" />
            ) : (
              <p className="text-xl font-black gradient-text">{maxSkz.toLocaleString()}</p>
            )}
          </div>
        </div>
        <div className="text-left">
          <p className="text-[10px] text-white/30 font-medium">≈</p>
          <p className="text-sm font-bold text-white/50">
            ${(maxSkz / settings.skzPerUsdt).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Target currency */}
      <div>
        <p className="section-label mb-3">{t("withdraw.convertTo")}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {TARGETS.map((tg) => {
            const isActive = target === tg.id;
            const tci = CURRENCY_ICONS[tg.currencyKey];
            const rateStr = tg.id === "usdt"
              ? `${settings.skzPerUsdt} SKZ = 1 USDT`
              : `${settings.skzPerTon} SKZ = 1 TON`;
            return (
              <motion.button key={tg.id} onClick={() => { setTarget(tg.id); setAddress(""); }} whileTap={{ scale: 0.96 }}
                className="p-4 rounded-2xl text-right transition-all"
                style={{
                  background: isActive ? `${tci.color}12` : "rgba(255,255,255,0.04)",
                  border: isActive ? `1.5px solid ${tci.color}40` : "1.5px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? `0 4px 20px ${tci.glow}` : "none",
                }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: isActive ? tci.bg : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isActive ? tci.color + "30" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <IconBox iconKey={tci.iconKey} size={20} color={tci.color}
                      bg="transparent" border="transparent" boxSize={44} radius={12} />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: isActive ? tci.color : "rgba(255,255,255,0.8)" }}>
                      {tg.label}
                    </p>
                    <p className="text-[10px] text-white/30 font-medium mt-0.5">{rateStr}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Rules info box */}
      <div className="rounded-2xl p-3.5 space-y-1.5 text-[11px] font-medium"
        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
        <p className="text-info font-bold flex items-center gap-1.5 mb-1" style={{ color: "#60a5fa" }}>
          <Info size={12} /> {t("withdraw.rules.title")}
        </p>
        <p className="text-white/55">{t("withdraw.rules.min", { min: minSkz.toLocaleString() })}</p>
        <p className="text-white/55">{t("withdraw.rules.fee", { pct: (feePercent * 100).toFixed(1) })}</p>
        <p className="text-white/55">{t("withdraw.rules.eta", { hrs: etaHours })}</p>
        <p className="text-white/55">
          {target === "usdt" ? t("withdraw.rules.addrTrc20") : t("withdraw.rules.addrTon")}
        </p>
        <p className="text-warn text-[10px] mt-1.5">
          {t("withdraw.rules.warn")}
        </p>
      </div>

      {/* SKZ amount */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="section-label">{t("withdraw.amountLabel")}</p>
          <motion.button onClick={() => setSkzAmount(maxSkz.toString())} whileTap={{ scale: 0.93 }}
            className="chip chip-skz pressable">
            {t("withdraw.max", { max: maxSkz.toLocaleString() })}
          </motion.button>
        </div>
        <div className="relative">
          <input type="number" value={skzAmount} onChange={(e) => setSkzAmount(e.target.value)}
            placeholder="0"
            className="premium-input w-full px-4 py-4 text-2xl font-black text-right pl-16"
            dir="ltr" />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.3)" }}>
              <Zap size={13} className="text-skz-light" />
            </div>
          </div>
        </div>
        <AnimatePresence>
          {isOverMax && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[11px] text-danger flex items-center gap-1.5 font-bold">
              <AlertCircle size={12} /> {t("withdraw.err.overMax")}
            </motion.p>
          )}
          {isBelowMin && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[11px] text-warn flex items-center gap-1.5 font-bold">
              <AlertCircle size={12} /> {t("withdraw.err.belowMin", { min: minSkz.toLocaleString() })}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Wallet address */}
      <div className="space-y-2">
        <p className="section-label">{t("withdraw.addrLabel", { net: target === "usdt" ? "TRC20" : "TON" })}</p>
        <div className="relative">
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder={t("withdraw.addrPlaceholder", { sym: targetLabel })}
            className="premium-input w-full px-4 py-3.5 text-sm font-mono text-left pl-14"
            dir="ltr" />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: ci.bg, border: `1px solid ${ci.color}25` }}>
              <Upload size={12} style={{ color: ci.color }} />
            </div>
          </div>
        </div>
        <AnimatePresence>
          {address.length > 0 && !addrCheck.ok && addrCheck.reason && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[11px] text-danger flex items-center gap-1.5 font-bold">
              <AlertCircle size={12} /> {target === "usdt" ? t("withdraw.addr.invalidTrc20") : t("withdraw.addr.invalidTon")}
            </motion.p>
          )}
          {address.length > 0 && addrCheck.ok && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[11px] text-success flex items-center gap-1.5 font-bold">
              {t("withdraw.addr.valid")}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Summary */}
      <AnimatePresence>
        {numSkz >= minSkz && !isOverMax && (
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="p-1">
              {[
                { label: t("withdraw.sum.amount"),                                 value: `${numSkz.toLocaleString()} SKZ`,                   color: "rgba(255,255,255,0.85)" },
                { label: t("withdraw.sum.equiv"),                                  value: `${realAmount.toFixed(4)} ${targetLabel}`, color: "rgba(255,255,255,0.85)" },
                { label: t("withdraw.sum.fee", { pct: (feePercent*100).toFixed(1) }), value: `-${fee.toFixed(4)} ${targetLabel}`,       color: "#f87171" },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3">
                  <span className="text-[12px] text-white/45 font-medium">{row.label}</span>
                  <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div className="divider mx-3" />
              <div className="flex justify-between items-center px-4 py-3.5">
                <span className="text-sm font-bold text-white/70">{t("withdraw.sum.net")}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-success">
                    {netReal.toFixed(target === "usdt" ? 2 : 4)} {targetLabel}
                  </span>
                  <IconBox iconKey={ci.iconKey} size={14} color={ci.color} bg={`${ci.color}15`}
                    border={`${ci.color}20`} boxSize={24} radius={6} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button disabled={!isValid} whileTap={{ scale: isValid ? 0.97 : 1 }}
        onClick={() => {
          if (!isValid) return;
          showTelegramAlert(
            t("withdraw.confirmAlert", {
              skz: numSkz.toLocaleString(),
              net: netReal.toFixed(target === "usdt" ? 2 : 4),
              sym: targetLabel,
              addr: `${address.slice(0, 8)}...${address.slice(-6)}`,
              hrs: etaHours,
            })
          );
        }}
        className="w-full py-4 rounded-2xl font-black text-base text-white transition-all"
        style={{
          background: isValid ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
          boxShadow: isValid ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
          opacity: isValid ? 1 : 0.4,
        }}>
        {!skzAmount || numSkz <= 0
          ? t("withdraw.cta.enterAmount")
          : isOverMax
          ? t("withdraw.cta.overMax")
          : isBelowMin
          ? t("withdraw.cta.belowMin", { min: minSkz.toLocaleString() })
          : !address
          ? t("withdraw.cta.enterAddr")
          : !addrCheck.ok
          ? t("withdraw.cta.invalidAddr")
          : t("withdraw.cta.submit", { amount: netReal.toFixed(2), sym: targetLabel })}
      </motion.button>
    </div>
  );
}
