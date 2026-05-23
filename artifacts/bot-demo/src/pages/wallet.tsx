import { MOCK_BALANCES, MOCK_TRANSACTIONS, MOCK_XP, MOCK_XP_HISTORY, MOCK_ACHIEVEMENTS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Download, Upload, TrendingUp, ArrowUpRight, Zap, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { XpBar } from "../components/xp-bar";
import { levelFromXp, getRankForLevel, RANKS } from "../lib/xp-system";
import { IconBox, RANK_ICONS, ACHIEVEMENT_ICONS, ACTION_ICONS, TX_ICONS, CURRENCY_ICONS } from "../components/icons";

const stagger = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
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
        <div className="chip chip-skz"><Zap size={10} />SKZ</div>
      </motion.div>

      {/* XP Bar */}
      <motion.div variants={fadeUp}><XpBar /></motion.div>

      {/* Rank Progression */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">Rank Progression</p>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex gap-1 items-center">
            {RANKS.map((r, i) => {
              const isCurrentRank = rank.name === r.name;
              const isPastRank = level > r.maxLevel;
              const rIcon = RANK_ICONS[r.name]?.iconKey ?? "zap";
              return (
                <div key={r.name} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center relative"
                      style={{
                        background: isPastRank || isCurrentRank ? r.gradient : "rgba(255,255,255,0.04)",
                        border: isCurrentRank ? `2px solid ${r.color}` : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isCurrentRank ? `0 0 12px ${r.glow}` : "none",
                        opacity: isPastRank ? 0.7 : isCurrentRank ? 1 : 0.3,
                      }}
                    >
                      <IconBox iconKey={rIcon} size={12} color="rgba(255,255,255,0.9)"
                        bg="transparent" border="transparent" boxSize={28} radius={8} />
                      {isCurrentRank && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-base"
                          style={{ background: r.color }} />
                      )}
                    </div>
                    <span className="text-[7px] font-bold"
                      style={{ color: isCurrentRank ? r.color : "rgba(255,255,255,0.2)" }}>
                      L{r.minLevel}
                    </span>
                  </div>
                  {i < RANKS.length - 1 && (
                    <div className="h-0.5 flex-1 rounded-full"
                      style={{ background: isPastRank ? r.gradient : "rgba(255,255,255,0.06)" }} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-white/35 font-medium mt-3 text-center">
            Current: <span style={{ color: rank.color }} className="font-black">{rank.name}</span>
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
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white skz-coin"
                style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)" }}>
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
                <motion.button whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 20px rgba(147,51,234,0.4)" }}>
                  <Download size={16} /> Deposit
                </motion.button>
              </Link>
              <Link href="/withdraw">
                <motion.button whileTap={{ scale: 0.96 }}
                  className="w-full glass-card flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm">
                  <Upload size={16} className="text-white/60" />
                  <span className="text-white/80">Withdraw</span>
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
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
            <IconBox iconKey="trophy" size={11} color="#f59e0b" bg="transparent" border="transparent" boxSize={14} radius={3} />
            <span className="text-[11px] font-black text-stars">
              {MOCK_ACHIEVEMENTS.filter(a => a.unlocked).length}/{MOCK_ACHIEVEMENTS.length}
            </span>
          </div>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          {MOCK_ACHIEVEMENTS.map((a, i) => {
            const ai = ACHIEVEMENT_ICONS[a.id];
            return (
              <div key={a.id}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: a.unlocked ? ai?.bg : "rgba(255,255,255,0.03)",
                      filter: a.unlocked ? "none" : "grayscale(1) brightness(0.25)",
                    }}
                  >
                    <IconBox iconKey={ai?.iconKey ?? "zap"} size={18} color={a.unlocked ? ai?.color : "#555"}
                      bg="transparent" border="transparent" boxSize={40} radius={10} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: a.unlocked ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)" }}>
                      {a.label}
                    </p>
                    <p className="text-[10px] text-white/30 font-medium truncate">{a.desc}</p>
                  </div>
                  {a.unlocked
                    ? <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#9333ea,#22d3ee)" }}>
                        <span className="text-[9px] font-black text-white">✓</span>
                      </div>
                    : <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                        <IconBox iconKey="shield" size={10} color="rgba(255,255,255,0.15)" bg="transparent" border="transparent" boxSize={20} radius={4} />
                      </div>}
                </div>
                {i < MOCK_ACHIEVEMENTS.length - 1 && <div className="divider mx-4" />}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* XP Activity Log */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">XP Activity</p>
          <span className="text-[11px] font-black px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>
            +{MOCK_XP.weeklyXp} this week
          </span>
        </div>
        <div className="glass-card rounded-3xl overflow-hidden">
          {MOCK_XP_HISTORY.slice(0, 7).map((entry, i) => {
            const ai = ACTION_ICONS[entry.action];
            return (
              <div key={entry.id}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: ai ? `${ai.color}15` : "rgba(168,85,247,0.1)",
                      border: ai ? `1px solid ${ai.color}20` : "1px solid rgba(168,85,247,0.15)",
                    }}
                  >
                    <IconBox iconKey={ai?.iconKey ?? "zap"} size={16} color={ai?.color ?? "#a855f7"}
                      bg="transparent" border="transparent" boxSize={36} radius={10} />
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
                {i < Math.min(MOCK_XP_HISTORY.length, 7) - 1 && <div className="divider mx-4" />}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Currency sources */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">Deposit Sources</p>
        <div className="space-y-2.5">
          {[
            { key: "USDT",  label: "USDT",           sub: "TRC20 · Tether",      val: MOCK_BALANCES.usdt.toFixed(2),  rate: settings.skzPerUsdt, balance: MOCK_BALANCES.usdt,   xpR: "+50 XP" },
            { key: "Stars", label: "Telegram Stars",  sub: "In-app payment",      val: MOCK_BALANCES.stars.toString(), rate: settings.skzPerStar, balance: MOCK_BALANCES.stars,  xpR: "+50 XP" },
            { key: "TON",   label: "TON",             sub: "The Open Network",    val: MOCK_BALANCES.ton.toFixed(3),  rate: settings.skzPerTon,  balance: MOCK_BALANCES.ton,    xpR: "+50 XP" },
          ].map((item) => {
            const ci = CURRENCY_ICONS[item.key];
            return (
              <motion.div key={item.key} whileTap={{ scale: 0.98 }}
                className="rounded-2xl p-4 flex items-center gap-4 pressable"
                style={{
                  background: `${ci.color}0c`, border: `1px solid ${ci.color}22`,
                  boxShadow: `0 4px 20px ${ci.glow}`,
                }}>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: ci.bg, border: `1px solid ${ci.color}25`, boxShadow: `0 4px 12px ${ci.glow}` }}
                >
                  <IconBox iconKey={ci.iconKey} size={20} color={ci.color} bg="transparent"
                    border="transparent" boxSize={44} radius={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm" style={{ color: ci.color }}>{item.label}</p>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>
                      {item.xpR}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30 font-medium">
                    {item.sub} · 1 {item.key === "Stars" ? "⭐" : item.key} = {item.rate} SKZ
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-base text-white">{item.val}</p>
                  <p className="text-[10px] text-white/35 font-medium">
                    = {Math.round(item.balance * item.rate).toLocaleString()} SKZ
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Transaction history */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">Transaction History</p>
        <div className="glass-card rounded-3xl overflow-hidden">
          {MOCK_TRANSACTIONS.map((tx, i) => {
            const ti = TX_ICONS[tx.bot];
            return (
              <div key={tx.id}>
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <IconBox
                      iconKey={ti?.iconKey ?? "zap"} size={18}
                      color={ti?.color ?? "#a855f7"}
                      bg={tx.type === "credit" ? `${ti?.color ?? "#a855f7"}15` : "rgba(255,255,255,0.04)"}
                      border={tx.type === "credit" ? `${ti?.color ?? "#a855f7"}20` : "rgba(255,255,255,0.06)"}
                      boxSize={40} radius={12}
                    />
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
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
