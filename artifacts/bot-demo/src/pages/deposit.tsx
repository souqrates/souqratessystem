import { useState } from "react";
import { Zap, Copy, Check, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { IconBox, CURRENCY_ICONS } from "../components/icons";
import { showTelegramAlert } from "../lib/telegram";

type Method = "usdt" | "stars" | "ton";

const STAR_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

const METHODS: { id: Method; label: string; sub: string; currencyKey: string }[] = [
  { id: "usdt",  label: "USDT",           sub: "Tether · TRC20 Network",     currencyKey: "USDT"  },
  { id: "stars", label: "Telegram Stars", sub: "In-app Stars · Instant",     currencyKey: "Stars" },
  { id: "ton",   label: "TON",            sub: "The Open Network",           currencyKey: "TON"   },
];

export function Deposit() {
  const [method, setMethod] = useState<Method>("usdt");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();

  const address    = "TRX9xKmN4pQ8vLs2wYjF7bDcAeR6hZmU1";
  const tonAddress = "UQCk9pn7Xm8kGzR3LwV1uQ2aJ5mBfD8sYeT6Xm8k";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "✓ Copied!" });
    }
  };

  const getRate = () => {
    if (method === "usdt")  return settings.skzPerUsdt;
    if (method === "stars") return settings.skzPerStar;
    return settings.skzPerTon;
  };

  const skzPreview = amount ? Math.floor(parseFloat(amount) * getRate()) : null;
  const currencyKey = method === "usdt" ? "USDT" : method === "stars" ? "Stars" : "TON";

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">Deposit SKZ</h1>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">Deposit and auto-convert to SKZ</p>
      </div>

      {/* Conversion banner */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 16px rgba(147,51,234,0.3)" }}>
          <IconBox iconKey="download" size={18} color="white" bg="transparent" border="transparent" boxSize={40} radius={10} />
        </div>
        <div>
          <p className="text-sm font-bold text-skz-light">Auto-converted to SKZ</p>
          <p className="text-[11px] text-white/40">At the current rate set by the admin</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
          style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <Zap size={10} className="text-skz-light" />
          <span className="text-[10px] font-black text-skz-light">+50 XP</span>
        </div>
      </div>

      {/* Method tabs */}
      <div>
        <p className="section-label mb-3">Select Deposit Method</p>
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
        {method === "stars" && (
          <motion.div key="stars"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            <div className="divider" />
            <p className="section-label">Select Amount</p>
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
                <p className="text-sm text-white/60">You will receive</p>
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-skz-light" />
                  <p className="font-black text-2xl gradient-text">{skzPreview.toLocaleString()}</p>
                  <p className="text-sm text-white/40 font-bold">SKZ</p>
                </div>
              </motion.div>
            )}

            <motion.button disabled={!amount} whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!amount) return;
                showTelegramAlert(
                  `Telegram Stars payment will open here.\nAmount: ${parseInt(amount).toLocaleString()} ⭐ → ${skzPreview?.toLocaleString()} SKZ\n\nPayment processor is being finalized — the button will work once Stars is connected.`
                );
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all"
              style={{
                background: amount ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: amount ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: amount ? 1 : 0.5,
              }}>
              {amount
                ? `Pay ${parseInt(amount).toLocaleString()} ⭐ → ${skzPreview?.toLocaleString()} SKZ`
                : "Select Star Amount"}
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
              <p className="section-label">Amount ({method.toUpperCase()})</p>
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
                {skzPreview !== null && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="glass-card-skz rounded-2xl p-3.5 flex items-center justify-between">
                    <p className="text-sm text-white/50">You will receive</p>
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-skz-light" />
                      <p className="font-black text-xl gradient-text">{skzPreview.toLocaleString()}</p>
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
              <p className="text-[11px] text-white/35 font-medium">Scan QR to copy address</p>
            </div>

            {/* Address */}
            <div className="rounded-2xl p-4 relative"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="section-label mb-2">
                Deposit Address ({method === "usdt" ? "TRC20" : "TON Network"})
              </p>
              <p className="font-mono text-sm text-white/70 break-all pr-12 leading-relaxed text-left" dir="ltr">
                {method === "usdt" ? address : tonAddress}
              </p>
              <motion.button
                onClick={() => handleCopy(method === "usdt" ? address : tonAddress)}
                whileTap={{ scale: 0.9 }}
                className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)" }}>
                {copied
                  ? <Check size={15} className="text-success" strokeWidth={2.5} />
                  : <Copy size={15} className="text-white/60" />}
              </motion.button>
            </div>

            {/* Warning */}
            <div className="rounded-2xl p-4 space-y-1.5 text-[11px] font-medium"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-danger font-bold flex items-center gap-2">
                <IconBox iconKey="shield" size={12} color="#ef4444" bg="rgba(239,68,68,0.15)"
                  border="rgba(239,68,68,0.2)" boxSize={20} radius={5} />
                Send only {method.toUpperCase()} on this network
              </div>
              <p className="text-white/40">
                Minimum: {method === "usdt" ? `${settings.minDepositUsdt} USDT` : `${settings.minDepositTon} TON`}
              </p>
              <p className="text-white/40">Auto-credited in SKZ after network confirmation</p>
              <p style={{ color: CURRENCY_ICONS[currencyKey].color }}>
                Today's rate: 1 {method.toUpperCase()} = {getRate()} SKZ
              </p>
            </div>

            <motion.button disabled={!amount || parseFloat(amount) <= 0} whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!amount || parseFloat(amount) <= 0) return;
                showTelegramAlert(
                  `Deposit registered.\nAmount: ${amount} ${method.toUpperCase()} → ${skzPreview?.toLocaleString()} SKZ\n\nSend the funds to the address above. Your balance will update automatically once the network confirms the transaction.`
                );
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-white"
              style={{
                background: amount ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
                boxShadow: amount ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
                opacity: amount ? 1 : 0.45,
              }}>
              {amount ? "I've Sent the Funds" : "Enter Amount"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
