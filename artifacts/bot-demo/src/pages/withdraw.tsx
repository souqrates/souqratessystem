import { useState } from "react";
import { MOCK_BALANCES } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Zap, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Target = "usdt" | "ton";

export function Withdraw() {
  const [target, setTarget] = useState<Target>("usdt");
  const [skzAmount, setSkzAmount] = useState("");
  const [address, setAddress] = useState("");
  const { settings } = usePlatformSettings();

  const getRate = () => (target === "usdt" ? settings.skzPerUsdt : settings.skzPerTon);
  const feePercent = target === "usdt"
    ? parseFloat(settings.withdrawalFeeUsdtPercent) / 100
    : parseFloat(settings.withdrawalFeeTonPercent) / 100;

  const maxSkz = MOCK_BALANCES.skz;
  const minSkz = parseFloat(settings.minWithdrawalSkz);
  const numSkz = parseFloat(skzAmount || "0");
  const isOverMax = numSkz > maxSkz;
  const isBelowMin = numSkz > 0 && numSkz < minSkz;
  const realAmount = numSkz / getRate();
  const fee = realAmount * feePercent;
  const netReal = Math.max(0, realAmount - fee);
  const isValid = numSkz >= minSkz && !isOverMax && address.length > 10;

  const TARGETS = [
    { id: "usdt" as Target, label: "USDT", sub: `${settings.skzPerUsdt} SKZ = 1 USDT`, color: "#26d0a0", icon: "💵" },
    { id: "ton"  as Target, label: "TON",  sub: `${settings.skzPerTon} SKZ = 1 TON`,  color: "#0098ea", icon: "💎" },
  ];

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">Withdraw SKZ</h1>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">Convert SKZ to external currency</p>
      </div>

      {/* Balance card */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white skz-coin"
            style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)" }}
          >
            S
          </div>
          <div>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Available Balance</p>
            <p className="text-xl font-black gradient-text">{maxSkz.toLocaleString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/30 font-medium">≈</p>
          <p className="text-sm font-bold text-white/50">${(maxSkz / settings.skzPerUsdt).toFixed(2)}</p>
        </div>
      </div>

      {/* Target currency */}
      <div>
        <p className="section-label mb-3">Convert To</p>
        <div className="grid grid-cols-2 gap-2.5">
          {TARGETS.map((t) => {
            const isActive = target === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setTarget(t.id)}
                whileTap={{ scale: 0.96 }}
                className="p-4 rounded-2xl text-left transition-all"
                style={{
                  background: isActive ? `${t.color}12` : "rgba(255,255,255,0.04)",
                  border: isActive ? `1.5px solid ${t.color}40` : "1.5px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? `0 4px 20px ${t.color}25` : "none",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: isActive ? t.color : "rgba(255,255,255,0.8)" }}>
                      {t.label}
                    </p>
                    <p className="text-[10px] text-white/30 font-medium mt-0.5">{t.sub}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* SKZ amount */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="section-label">Amount in SKZ</p>
          <motion.button
            onClick={() => setSkzAmount(maxSkz.toString())}
            whileTap={{ scale: 0.93 }}
            className="chip chip-skz pressable"
          >
            Max — {maxSkz.toLocaleString()}
          </motion.button>
        </div>

        <div className="relative">
          <input
            type="number"
            value={skzAmount}
            onChange={(e) => setSkzAmount(e.target.value)}
            placeholder="0"
            className="premium-input w-full px-4 py-4 text-2xl font-black text-right pl-14"
            dir="ltr"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Zap size={14} className="text-skz-light" />
            <span className="text-xs font-bold text-skz-light">SKZ</span>
          </div>
        </div>

        <AnimatePresence>
          {isOverMax && (
            <motion.p
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[11px] text-danger flex items-center gap-1.5 font-bold"
            >
              <AlertCircle size={12} /> Exceeds available balance
            </motion.p>
          )}
          {isBelowMin && (
            <motion.p
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[11px] text-warn flex items-center gap-1.5 font-bold"
            >
              <AlertCircle size={12} /> Minimum is {minSkz.toLocaleString()} SKZ
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Wallet address */}
      <div className="space-y-2">
        <p className="section-label">Wallet Address ({target === "usdt" ? "TRC20" : "TON"})</p>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={`Enter ${target.toUpperCase()} address...`}
          className="premium-input w-full px-4 py-3.5 text-sm font-mono text-left"
          dir="ltr"
        />
      </div>

      {/* Summary */}
      <AnimatePresence>
        {numSkz >= minSkz && !isOverMax && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="p-1">
              {[
                { label: "Amount (SKZ)",                           value: `${numSkz.toLocaleString()} SKZ`,           color: "rgba(255,255,255,0.85)" },
                { label: "Equivalent",                             value: `${realAmount.toFixed(4)} ${target.toUpperCase()}`, color: "rgba(255,255,255,0.85)" },
                { label: `Network Fee (${(feePercent*100).toFixed(1)}%)`, value: `-${fee.toFixed(4)} ${target.toUpperCase()}`,  color: "#f87171" },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3">
                  <span className="text-[12px] text-white/45 font-medium">{row.label}</span>
                  <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div className="divider mx-3" />
              <div className="flex justify-between items-center px-4 py-3.5">
                <span className="text-sm font-bold text-white/70">You Receive</span>
                <span className="text-lg font-black text-success">
                  {netReal.toFixed(target === "usdt" ? 2 : 4)} {target.toUpperCase()}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button
        disabled={!isValid}
        whileTap={{ scale: isValid ? 0.97 : 1 }}
        className="w-full py-4 rounded-2xl font-black text-base text-white transition-all"
        style={{
          background: isValid ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(255,255,255,0.06)",
          boxShadow: isValid ? "0 4px 24px rgba(147,51,234,0.4)" : "none",
          opacity: isValid ? 1 : 0.4,
        }}
      >
        {isValid ? `Withdraw ${netReal.toFixed(2)} ${target.toUpperCase()}` : "Enter Details"}
      </motion.button>
    </div>
  );
}
