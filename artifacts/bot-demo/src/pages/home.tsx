import { getTelegramUser } from "../lib/telegram";
import { MOCK_BALANCES, MOCK_TRANSACTIONS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { motion } from "framer-motion";
import { Star, TrendingUp, ArrowUpRight, Zap, Bell, ChevronRight, Download, Upload } from "lucide-react";
import { Link } from "wouter";

const stagger = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function Home() {
  const user = getTelegramUser();
  const { settings } = usePlatformSettings();
  const initials = `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ""}`;
  const usdtEquiv = (MOCK_BALANCES.skz / settings.skzPerUsdt).toFixed(2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Welcome" : "Good evening";

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-3 space-y-4">

      {/* ── Top bar ── */}
      <motion.header variants={fadeUp} className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base text-white overflow-hidden skz-coin"
              style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #0891b2 100%)" }}
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                : initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-base" />
          </div>
          <div>
            <p className="text-[11px] text-white/40 font-medium">{greeting}</p>
            <h1 className="text-base font-black leading-tight flex items-center gap-1">
              {user.firstName}
              {user.isPremium && <Star size={12} className="text-stars fill-stars" />}
            </h1>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-2xl glass-card flex items-center justify-center relative"
        >
          <Bell size={18} className="text-white/60" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-skz" />
        </motion.button>
      </motion.header>

      {/* ── Hero Balance Card ── */}
      <motion.div variants={fadeUp}>
        <div className="hero-card rounded-3xl p-6 relative overflow-hidden noise">
          <div className="orb-1 absolute -top-14 -right-14 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)" }} />
          <div className="orb-2 absolute -bottom-14 -left-14 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 70%)" }} />

          <div className="relative z-10">
            {/* Platform badge */}
            <div className="flex items-center justify-between mb-5">
              <div className="chip chip-skz">
                <Zap size={10} className="text-skz" />
                {settings.platformName}
              </div>
              <Link href="/wallet">
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                >
                  Details
                  <ChevronRight size={12} />
                </motion.div>
              </Link>
            </div>

            {/* Big number */}
            <div className="text-center mb-5">
              <p className="text-[11px] text-white/40 font-medium mb-1.5 tracking-wide uppercase">SKZ Balance</p>
              <motion.h2
                className="text-[58px] font-black gradient-text tracking-tighter leading-none mb-1"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {MOCK_BALANCES.skz.toLocaleString()}
              </motion.h2>
              <p className="text-sm font-bold text-white/30">
                ≈ <span className="text-white/50">${usdtEquiv}</span> USDT
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/deposit">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                  style={{
                    background: "linear-gradient(135deg, #9333ea, #7c3aed)",
                    boxShadow: "0 4px 20px rgba(147,51,234,0.4)",
                  }}
                >
                  <Download size={16} />
                  Deposit
                </motion.button>
              </Link>
              <Link href="/withdraw">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm glass-card"
                >
                  <Upload size={16} className="text-white/70" />
                  <span className="text-white/80">Withdraw</span>
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Mini stats ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-success/15 flex items-center justify-center">
              <TrendingUp size={12} className="text-success" />
            </div>
            <p className="text-[11px] text-white/50 font-medium">Total Earned</p>
          </div>
          <p className="text-xl font-black text-success">{MOCK_BALANCES.totalEarnedSkz.toLocaleString()}</p>
          <p className="text-[10px] text-white/25 font-medium mt-0.5">SKZ</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
              <ArrowUpRight size={12} className="text-white/50" />
            </div>
            <p className="text-[11px] text-white/50 font-medium">Withdrawn</p>
          </div>
          <p className="text-xl font-black text-white/70">{MOCK_BALANCES.totalWithdrawnSkz.toLocaleString()}</p>
          <p className="text-[10px] text-white/25 font-medium mt-0.5">SKZ</p>
        </div>
      </motion.div>

      {/* ── Currency balance pills ── */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-2.5">Currency Balances</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { label: "USDT", val: MOCK_BALANCES.usdt.toFixed(1), color: "#26d0a0", glow: "rgba(38,208,160,0.2)", rate: settings.skzPerUsdt, balance: MOCK_BALANCES.usdt },
            { label: "TON",  val: MOCK_BALANCES.ton.toFixed(2),  color: "#0098ea", glow: "rgba(0,152,234,0.2)", rate: settings.skzPerTon,  balance: MOCK_BALANCES.ton },
            { label: "⭐",   val: MOCK_BALANCES.stars.toString(), color: "#f59e0b", glow: "rgba(245,158,11,0.2)", rate: settings.skzPerStar, balance: MOCK_BALANCES.stars },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 rounded-2xl p-3.5 min-w-[110px]"
              style={{
                background: `${item.color}10`,
                border: `1px solid ${item.color}25`,
                boxShadow: `0 4px 16px ${item.glow}`,
              }}
            >
              <p className="text-[10px] font-bold mb-1.5" style={{ color: item.color }}>{item.label}</p>
              <p className="text-xl font-black text-white">{item.val}</p>
              <p className="text-[9px] text-white/30 mt-1 font-medium">
                = {Math.round(item.balance * item.rate).toLocaleString()} SKZ
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Bots strip ── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Bots</p>
          <span className="chip chip-skz">6 Active</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { icon: "🎮", name: "Games",    skz: 250,  color: "#a855f7" },
            { icon: "🎬", name: "Video",    skz: 100,  color: "#3b82f6" },
            { icon: "🎙", name: "Voice",    skz: 80,   color: "#06b6d4" },
            { icon: "🤖", name: "AI",       skz: 50,   color: "#8b5cf6" },
            { icon: "🛒", name: "Store",    skz: 30,   color: "#10b981" },
            { icon: "🏆", name: "Contests", skz: 500,  color: "#f59e0b" },
          ].map((bot) => (
            <motion.div
              key={bot.name}
              whileTap={{ scale: 0.93 }}
              className="flex-shrink-0 glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5 min-w-[70px] pressable"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: `${bot.color}18`, border: `1px solid ${bot.color}25` }}
              >
                {bot.icon}
              </div>
              <p className="text-[10px] font-bold text-white/80 text-center leading-tight">{bot.name}</p>
              <div className="flex items-center gap-0.5">
                <Zap size={9} style={{ color: bot.color }} />
                <span className="text-[9px] font-black" style={{ color: bot.color }}>+{bot.skz}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Referral promo ── */}
      <motion.div variants={fadeUp}>
        <Link href="/referral">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="relative rounded-2xl p-4 overflow-hidden pressable"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(34,211,238,0.08))",
              border: "1px solid rgba(168,85,247,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🎁</span>
                  <p className="text-sm font-black text-white">Invite Friends</p>
                </div>
                <p className="text-[11px] text-white/50 leading-snug">
                  Earn <span className="text-skz-light font-bold">{settings.referralBonusPercent}%</span> of their earnings — for life
                </p>
              </div>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.3)" }}
              >
                <ChevronRight size={18} className="text-skz-light" />
              </div>
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* ── Recent transactions ── */}
      <motion.div variants={fadeUp} className="pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Recent Transactions</p>
          <Link href="/wallet">
            <span className="text-[11px] text-skz-light font-bold">View All</span>
          </Link>
        </div>

        <div className="space-y-2">
          {MOCK_TRANSACTIONS.slice(0, 4).map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              className="flex items-center justify-between px-4 py-3 rounded-2xl glass-card pressable"
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: tx.type === "credit" ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.05)" }}
                >
                  {tx.botIcon}
                </div>
                <div>
                  <p className="font-bold text-sm text-white/90">{tx.bot}</p>
                  <p className="text-[10px] text-white/30 font-medium">{tx.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-sm ${tx.type === "credit" ? "text-skz-light" : "text-white/50"}`}>
                  {tx.amount}
                </p>
                <p className="text-[10px] text-white/25 font-medium">{tx.currency}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
