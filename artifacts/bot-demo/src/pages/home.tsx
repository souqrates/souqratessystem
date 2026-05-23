import { getTelegramUser, showTelegramAlert, openTelegramApp } from "../lib/telegram";
import { MOCK_BALANCES, MOCK_TRANSACTIONS, MOCK_XP, MOCK_ACHIEVEMENTS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { motion } from "framer-motion";
import { Star, TrendingUp, ArrowUpRight, Zap, Bell, ChevronRight, Download, Upload } from "lucide-react";
import { Link } from "wouter";
import { XpBar } from "../components/xp-bar";
import { levelFromXp, getRankForLevel } from "../lib/xp-system";
import { IconBox, BOT_ICONS, ACHIEVEMENT_ICONS, TX_ICONS, CURRENCY_ICONS } from "../components/icons";

const stagger = { animate: { transition: { staggerChildren: 0.065, delayChildren: 0.04 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

const BOTS: { name: string; xp: string; skz: number; live?: boolean; url?: string }[] = [
  { name: "Games",    xp: "+40 XP",  skz: 250, live: true, url: "https://souqrates.com/games-bot/" },
  { name: "Video",    xp: "+10 XP",  skz: 100 },
  { name: "Voice",    xp: "+20 XP",  skz: 80  },
  { name: "AI",       xp: "+12 XP",  skz: 50  },
  { name: "Store",    xp: "+45 XP",  skz: 30  },
  { name: "Contests", xp: "+200 XP", skz: 500 },
];

export function Home() {
  const user = getTelegramUser();
  const { settings } = usePlatformSettings();
  const initials = `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ""}`;
  const usdtEquiv = (MOCK_BALANCES.skz / settings.skzPerUsdt).toFixed(2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Welcome" : "Good evening";

  const level = levelFromXp(MOCK_XP.totalXp);
  const rank = getRankForLevel(level);
  const unlockedCount = MOCK_ACHIEVEMENTS.filter((a) => a.unlocked).length;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-3 space-y-3.5">

      {/* ── Top bar ── */}
      <motion.header variants={fadeUp} className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base text-white overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #0891b2 100%)",
                boxShadow: `0 0 0 2px ${rank.color}60, 0 4px 16px rgba(0,0,0,0.4)`,
              }}
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                : initials}
            </div>
            {/* Rank icon badge */}
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center"
              style={{ background: rank.gradient, boxShadow: `0 2px 8px ${rank.glow}`, border: "1.5px solid #060a14" }}
            >
              <IconBox
                iconKey="zap"
                size={10}
                color="white"
                bg="transparent"
                border="transparent"
                boxSize={20}
                radius={6}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-white/40 font-medium">{greeting}</p>
            <h1 className="text-base font-black leading-tight flex items-center gap-1.5">
              {user.firstName}
              {user.isPremium && <Star size={11} className="text-stars fill-stars" />}
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                style={{ background: `${rank.color}20`, color: rank.color }}>
                Lv {level}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)" }}
          >
            <Zap size={11} className="text-skz-light" />
            <span className="text-[10px] font-black text-skz-light">+{MOCK_XP.weeklyXp}</span>
            <span className="text-[9px] text-white/35 font-medium">this week</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => showTelegramAlert("You have no new notifications. We'll alert you here when you earn SKZ, level up, or get a referral bonus.")}
            className="w-9 h-9 rounded-2xl glass-card flex items-center justify-center relative"
          >
            <Bell size={17} className="text-white/60" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-skz" />
          </motion.button>
        </div>
      </motion.header>

      {/* ── XP Bar ── */}
      <motion.div variants={fadeUp}><XpBar /></motion.div>

      {/* ── Hero Balance Card ── */}
      <motion.div variants={fadeUp}>
        <div className="hero-card rounded-3xl p-5 relative overflow-hidden noise">
          <div className="orb-1 absolute -top-14 -right-14 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)" }} />
          <div className="orb-2 absolute -bottom-14 -left-14 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 70%)" }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="chip chip-skz"><Zap size={10} className="text-skz" />{settings.platformName}</div>
              <Link href="/wallet">
                <motion.div whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors">
                  Details <ChevronRight size={12} />
                </motion.div>
              </Link>
            </div>
            <div className="text-center mb-5">
              <p className="text-[11px] text-white/40 font-medium mb-1.5 tracking-wide uppercase">SKZ Balance</p>
              <motion.h2
                className="text-[54px] font-black gradient-text tracking-tighter leading-none mb-1"
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
            <div className="grid grid-cols-2 gap-3">
              <Link href="/deposit">
                <motion.button whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 20px rgba(147,51,234,0.4)" }}>
                  <Download size={16} /> Deposit
                </motion.button>
              </Link>
              <Link href="/withdraw">
                <motion.button whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm glass-card">
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

      {/* ── Currency pills ── */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-2.5">Currency Balances</p>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: "USDT", val: MOCK_BALANCES.usdt.toFixed(1),   rate: settings.skzPerUsdt, balance: MOCK_BALANCES.usdt   },
            { key: "TON",  val: MOCK_BALANCES.ton.toFixed(2),    rate: settings.skzPerTon,  balance: MOCK_BALANCES.ton    },
            { key: "Stars",val: MOCK_BALANCES.stars.toString(),  rate: settings.skzPerStar, balance: MOCK_BALANCES.stars  },
          ].map((item) => {
            const ci = CURRENCY_ICONS[item.key];
            return (
              <motion.div key={item.key} whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 rounded-2xl p-3.5 min-w-[110px]"
                style={{ background: ci.bg, border: `1px solid ${ci.color}22`, boxShadow: `0 4px 16px ${ci.glow}` }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <IconBox iconKey={ci.iconKey} size={12} color={ci.color} bg={`${ci.color}20`}
                    border={`${ci.color}25`} boxSize={22} radius={6} />
                  <p className="text-[10px] font-bold" style={{ color: ci.color }}>{item.key}</p>
                </div>
                <p className="text-xl font-black text-white">{item.val}</p>
                <p className="text-[9px] text-white/30 mt-1 font-medium">
                  = {Math.round(item.balance * item.rate).toLocaleString()} SKZ
                </p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Achievements strip ── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Achievements</p>
          <span className="chip chip-skz">
            <IconBox iconKey="trophy" size={9} color="#a855f7" bg="transparent" border="transparent" boxSize={12} radius={3} />
            {unlockedCount}/{MOCK_ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          {MOCK_ACHIEVEMENTS.map((a) => {
            const ai = ACHIEVEMENT_ICONS[a.id];
            return (
              <motion.div key={a.id} whileTap={{ scale: 0.93 }}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 pressable">
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: a.unlocked ? ai?.bg : "rgba(255,255,255,0.03)",
                      border: a.unlocked ? `1px solid ${ai?.color}30` : "1px solid rgba(255,255,255,0.06)",
                      filter: a.unlocked ? "none" : "grayscale(1) brightness(0.3)",
                    }}
                  >
                    <IconBox iconKey={ai?.iconKey ?? "zap"} size={20} color={a.unlocked ? ai?.color : "#666"}
                      bg="transparent" border="transparent" boxSize={48} radius={14} />
                  </div>
                  {a.unlocked && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border border-base"
                      style={{ background: "linear-gradient(135deg,#9333ea,#22d3ee)" }}
                    >
                      <span className="text-[7px] font-black text-white">✓</span>
                    </span>
                  )}
                </div>
                <p className="text-[9px] font-bold text-center leading-tight max-w-[52px]"
                  style={{ color: a.unlocked ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}>
                  {a.label}
                </p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Bots strip ── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Bots</p>
          <span className="chip chip-skz">6 Active</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {BOTS.map((bot) => {
            const bi = BOT_ICONS[bot.name];
            return (
              <motion.button
                key={bot.name}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  if (bot.live && bot.url) {
                    openTelegramApp(bot.url);
                  } else {
                    showTelegramAlert(`${bot.name} bot is launching soon. Stay tuned!`);
                  }
                }}
                className="flex-shrink-0 glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5 min-w-[72px] pressable relative"
                style={{ border: bot.live ? `1px solid ${bi.color}40` : undefined }}
              >
                {bot.live && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <IconBox iconKey={bi.iconKey} size={20} color={bi.color} bg={bi.bg}
                  border={`${bi.color}25`} glow={bi.glow} boxSize={42} radius={12} />
                <p className="text-[10px] font-bold text-white/80 text-center leading-tight">{bot.name}</p>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-0.5">
                    <Zap size={8} style={{ color: bi.color }} />
                    <span className="text-[8px] font-black" style={{ color: bi.color }}>+{bot.skz} SKZ</span>
                  </div>
                  <span className="text-[8px] font-bold text-white/30">{bot.live ? "Open" : bot.xp}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Referral promo ── */}
      <motion.div variants={fadeUp}>
        <Link href="/referral">
          <motion.div whileTap={{ scale: 0.98 }}
            className="relative rounded-2xl p-4 overflow-hidden pressable"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(34,211,238,0.08))", border: "1px solid rgba(168,85,247,0.25)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))", border: "1px solid rgba(168,85,247,0.3)" }}
                >
                  <IconBox iconKey="users" size={20} color="#c084fc" bg="transparent" border="transparent" boxSize={44} radius={12} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-black text-white">Invite Friends</p>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>
                      +150 XP
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-snug">
                    Earn <span className="text-skz-light font-bold">{settings.referralBonusPercent}%</span> of their earnings — for life
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-skz-light flex-shrink-0" />
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* ── Recent transactions ── */}
      <motion.div variants={fadeUp} className="pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Recent Transactions</p>
          <Link href="/wallet"><span className="text-[11px] text-skz-light font-bold">View All</span></Link>
        </div>
        <div className="space-y-2">
          {MOCK_TRANSACTIONS.slice(0, 4).map((tx, i) => {
            const ti = TX_ICONS[tx.bot];
            return (
              <motion.div key={tx.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
                className="flex items-center justify-between px-3 py-3 rounded-2xl glass-card pressable"
                whileTap={{ scale: 0.98 }}>
                <div className="flex items-center gap-3">
                  <IconBox
                    iconKey={ti?.iconKey ?? "zap"}
                    size={18}
                    color={ti?.color ?? "#a855f7"}
                    bg={tx.type === "credit" ? `${ti?.color ?? "#a855f7"}15` : "rgba(255,255,255,0.05)"}
                    border={tx.type === "credit" ? `${ti?.color ?? "#a855f7"}20` : "rgba(255,255,255,0.06)"}
                    boxSize={40} radius={12}
                  />
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
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
