import { MOCK_BALANCES, MOCK_TRANSACTIONS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Download, Upload, TrendingUp, ArrowUpRight, Zap } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

const stagger = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export function Wallet() {
  const { settings } = usePlatformSettings();
  const usdtEquiv = (MOCK_BALANCES.skz / settings.skzPerUsdt).toFixed(2);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-4 space-y-5">

      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Wallet</h1>
          <p className="text-[11px] text-white/40 font-medium mt-0.5">All your balances in one place</p>
        </div>
        <div className="chip chip-skz">
          <Zap size={10} />
          SKZ
        </div>
      </motion.div>

      {/* Hero SKZ card */}
      <motion.div variants={fadeUp}>
        <div className="hero-card rounded-3xl p-6 relative overflow-hidden noise">
          <div className="orb-1 absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)" }} />
          <div className="orb-2 absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)" }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white skz-coin"
                style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)" }}
              >
                S
              </div>
              <div>
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Main Balance</p>
                <p className="text-[11px] text-white/30 font-medium">≈ ${usdtEquiv} USDT</p>
              </div>
            </div>

            <h2 className="text-5xl font-black gradient-text tracking-tight mb-6">
              {MOCK_BALANCES.skz.toLocaleString()}
              <span className="text-xl text-white/40 ml-2">SKZ</span>
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/deposit">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 20px rgba(147,51,234,0.4)" }}
                >
                  <Download size={16} />
                  Deposit
                </motion.button>
              </Link>
              <Link href="/withdraw">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="w-full glass-card flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
                >
                  <Upload size={16} className="text-white/60" />
                  <span className="text-white/80">Withdraw</span>
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
        {[
          { icon: TrendingUp,  label: "Total Earned",  value: MOCK_BALANCES.totalEarnedSkz,    color: "#10b981", bg: "rgba(16,185,129,0.1)" },
          { icon: ArrowUpRight, label: "Withdrawn",    value: MOCK_BALANCES.totalWithdrawnSkz, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.05)" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={12} style={{ color: s.color }} />
              </div>
              <p className="text-[11px] text-white/45 font-medium">{s.label}</p>
            </div>
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
            <p className="text-[10px] text-white/25 mt-0.5 font-medium">SKZ</p>
          </div>
        ))}
      </motion.div>

      {/* Currency sources */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">Deposit Sources</p>
        <div className="space-y-2.5">
          {[
            {
              label: "USDT", sub: "TRC20 · Tether",
              color: "#26d0a0", glow: "rgba(38,208,160,0.15)",
              val: MOCK_BALANCES.usdt.toFixed(2),
              skzEq: Math.round(MOCK_BALANCES.usdt * settings.skzPerUsdt),
              rate: `1 USDT = ${settings.skzPerUsdt} SKZ`,
              icon: "💵",
            },
            {
              label: "Telegram Stars", sub: "⭐ In-app",
              color: "#f59e0b", glow: "rgba(245,158,11,0.15)",
              val: MOCK_BALANCES.stars.toString(),
              skzEq: Math.round(MOCK_BALANCES.stars * settings.skzPerStar),
              rate: `1 ⭐ = ${settings.skzPerStar} SKZ`,
              icon: "⭐",
            },
            {
              label: "TON", sub: "The Open Network",
              color: "#0098ea", glow: "rgba(0,152,234,0.15)",
              val: MOCK_BALANCES.ton.toFixed(3),
              skzEq: Math.round(MOCK_BALANCES.ton * settings.skzPerTon),
              rate: `1 TON = ${settings.skzPerTon} SKZ`,
              icon: "💎",
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl p-4 flex items-center gap-4 pressable"
              style={{
                background: `${item.color}0c`,
                border: `1px solid ${item.color}22`,
                boxShadow: `0 4px 20px ${item.glow}`,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${item.color}18`, border: `1px solid ${item.color}25` }}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: item.color }}>{item.label}</p>
                <p className="text-[10px] text-white/30 font-medium">{item.sub} · {item.rate}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-base text-white">{item.val}</p>
                <p className="text-[10px] text-white/35 font-medium">= {item.skzEq.toLocaleString()} SKZ</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Transaction history */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">Transaction History</p>
        <div className="glass-card rounded-3xl overflow-hidden">
          {MOCK_TRANSACTIONS.map((tx, i) => (
            <div key={tx.id}>
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: tx.type === "credit" ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)" }}
                  >
                    {tx.botIcon}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{tx.bot}</p>
                    <p className="text-[10px] text-white/30 font-medium mt-0.5">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${tx.type === "credit" ? "text-skz-light" : "text-white/50"}`}>
                    {tx.amount}
                  </p>
                  <p className="text-[10px] text-white/25 font-medium">{tx.currency}</p>
                </div>
              </div>
              {i < MOCK_TRANSACTIONS.length - 1 && <div className="divider mx-4" />}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
