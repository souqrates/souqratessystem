import { MOCK_BALANCES, MOCK_TRANSACTIONS, MOCK_XP, MOCK_XP_HISTORY, MOCK_ACHIEVEMENTS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Download, Upload, TrendingUp, ArrowUpRight, Zap, Trophy, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { XpBar } from "../components/xp-bar";
import { levelFromXp, getRankForLevel, xpProgress, xpInLevel, xpThreshold } from "../lib/xp-system";
import { RANKS } from "../lib/xp-system";

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
  const level = levelFromXp(MOCK_XP.totalXp);
  const rank = getRankForLevel(level);

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

      {/* XP Bar */}
      <motion.div variants={fadeUp}>
        <XpBar />
      </motion.div>

      {/* Level Road Map */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">Rank Progression</p>
        <div className="glass-card rounded-2xl p-4 overflow-hidden relative">
          <div className="flex gap-1 items-center">
            {RANKS.map((r, i) => {
              const isCurrentRank = rank.name === r.name;
              const isPastRank = level > r.maxLevel;
              return (
                <div key={r.name} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm relative"
                      style={{
                        background: isPastRank || isCurrentRank ? r.gradient : "rgba(255,255,255,0.04)",
                        border: isCurrentRank ? `2px solid ${r.color}` : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isCurrentRank ? `0 0 12px ${r.glow}` : "none",
                        opacity: isPastRank ? 0.7 : isCurrentRank ? 1 : 0.35,
                      }}
                    >
                      {r.icon}
                      {isCurrentRank && (
                        <span
                          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-base"
                          style={{ background: r.color }}
                        />
                      )}
                    </div>
                    <span className="text-[7px] font-bold" style={{ color: isCurrentRank ? r.color : "rgba(255,255,255,0.2)" }}>
                      L{r.minLevel}
                    </span>
                  </div>
                  {i < RANKS.length - 1 && (
                    <div
                      className="h-0.5 flex-1 rounded-full"
                      style={{
                        background: isPastRank
                          ? r.gradient
                          : "rgba(255,255,255,0.06)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-white/35 font-medium mt-3 text-center">
            Current: <span style={{ color: rank.color }} className="font-black">{rank.icon} {rank.name}</span>
            {" "}· Level {level} · {MOCK_XP.totalXp.toLocaleString()} XP total
          </p>
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
          { icon: TrendingUp,   label: "Total Earned",  value: MOCK_BALANCES.totalEarnedSkz,    color: "#10b981", bg: "rgba(16,185,129,0.1)" },
          { icon: ArrowUpRight, label: "Withdrawn",     value: MOCK_BALANCES.totalWithdrawnSkz, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.05)" },
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

      {/* Achievements */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Achievements</p>
          <div className="flex items-center gap-1.5">
            <Trophy size={11} className="text-stars" />
            <span className="text-[11px] font-black text-stars">
              {MOCK_ACHIEVEMENTS.filter(a => a.unlocked).length}/{MOCK_ACHIEVEMENTS.length}
            </span>
          </div>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          {MOCK_ACHIEVEMENTS.map((a, i) => (
            <div key={a.id}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{
                    background: a.unlocked
                      ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(34,211,238,0.12))"
                      : "rgba(255,255,255,0.03)",
                    filter: a.unlocked ? "none" : "grayscale(1) brightness(0.25)",
                  }}
                >
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: a.unlocked ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)" }}>
                    {a.label}
                  </p>
                  <p className="text-[10px] text-white/30 font-medium truncate">{a.desc}</p>
                </div>
                {a.unlocked
                  ? <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#9333ea,#22d3ee)" }}>
                      <span className="text-[9px] font-black text-white">✓</span>
                    </div>
                  : <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                      <span className="text-[10px] text-white/20">🔒</span>
                    </div>}
              </div>
              {i < MOCK_ACHIEVEMENTS.length - 1 && <div className="divider mx-4" />}
            </div>
          ))}
        </div>
      </motion.div>

      {/* XP Activity Log */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">XP Activity</p>
          <span
            className="text-[11px] font-black px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}
          >
            +{MOCK_XP.weeklyXp} this week
          </span>
        </div>
        <div className="glass-card rounded-3xl overflow-hidden">
          {MOCK_XP_HISTORY.slice(0, 7).map((entry, i) => (
            <div key={entry.id}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.15)" }}
                >
                  {entry.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white/90">{entry.label}</p>
                  <p className="text-[10px] text-white/30 font-medium">{entry.date}</p>
                </div>
                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)" }}
                >
                  <Zap size={10} className="text-skz-light" />
                  <span className="text-[11px] font-black text-skz-light">+{entry.xp}</span>
                </div>
              </div>
              {i < MOCK_XP_HISTORY.slice(0, 7).length - 1 && <div className="divider mx-4" />}
            </div>
          ))}
        </div>
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
              xpReward: "+50 XP",
              icon: "💵",
            },
            {
              label: "Telegram Stars", sub: "⭐ In-app",
              color: "#f59e0b", glow: "rgba(245,158,11,0.15)",
              val: MOCK_BALANCES.stars.toString(),
              skzEq: Math.round(MOCK_BALANCES.stars * settings.skzPerStar),
              rate: `1 ⭐ = ${settings.skzPerStar} SKZ`,
              xpReward: "+50 XP",
              icon: "⭐",
            },
            {
              label: "TON", sub: "The Open Network",
              color: "#0098ea", glow: "rgba(0,152,234,0.15)",
              val: MOCK_BALANCES.ton.toFixed(3),
              skzEq: Math.round(MOCK_BALANCES.ton * settings.skzPerTon),
              rate: `1 TON = ${settings.skzPerTon} SKZ`,
              xpReward: "+50 XP",
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
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm" style={{ color: item.color }}>{item.label}</p>
                  <span
                    className="text-[8px] font-black px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}
                  >
                    {item.xpReward}
                  </span>
                </div>
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
