import { useState, useEffect } from "react";
import { getTelegramUser, showTelegramAlert, openTelegramApp } from "../lib/telegram";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { useWallet } from "../lib/use-wallet";
import { useTransactions, formatTxDate, txBotIcon } from "../lib/use-transactions";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ArrowUpRight, Zap, Bell, ChevronRight, Download, Upload, Crown, Flame, Trophy, Star, ChevronDown, Globe, Pencil, X } from "lucide-react";
import { Link } from "wouter";
import { IconBox, BOT_ICONS, CURRENCY_ICONS } from "../components/icons";
import { useT, useLang } from "../lib/i18n";
import { toast } from "sonner";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import numeral from "numeral";
import { levelFromXp, getRankForLevel, xpProgress, xpToNextLevel, xpInLevel, xpForLevelSpan } from "../lib/xp-system";

const stagger = { animate: { transition: { staggerChildren: 0.065, delayChildren: 0.04 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

const BOTS: { name: string; brand: string; short: string; live?: boolean; url?: string }[] = [
  { name: "Skillz",    brand: "SOUQRATES SKILLZ",     short: "SKILLZ",     live: true,  url: "https://t.me/Souqrates_skillz_bot/app" },
  { name: "Souq",      brand: "SOUQRATES SOUQ",        short: "SOUQ",       live: true,  url: "https://t.me/souqrates_souq_bot/app" },
  { name: "Scene",     brand: "SOUQRATES SCENE",       short: "SCENE" },
  { name: "Stream",    brand: "SOUQRATES STREAM",      short: "STREAM" },
  { name: "SubAgents", brand: "SOUQRATES SUB-AGENTS",  short: "SUB-AGENTS", live: true,  url: "/subagents" },
  { name: "Stage",     brand: "SOUQRATES STAGE",       short: "STAGE",      live: true,  url: "https://t.me/Souqrates_stage_bot/app" },
];

function useDailyStreak(): number {
  const [streak] = useState(() => {
    try {
      const raw = localStorage.getItem("souqrates:streak");
      const stored = raw ? JSON.parse(raw) : {};
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86_400_000).toDateString();
      if (stored.date === today) return stored.count as number || 1;
      const newCount = stored.date === yesterday ? (stored.count as number || 1) + 1 : 1;
      localStorage.setItem("souqrates:streak", JSON.stringify({ date: today, count: newCount }));
      return newCount;
    } catch { return 1; }
  });
  return streak;
}

const RANK_COLORS = ["#9ca3af","#34d399","#60a5fa","#22d3ee","#a78bfa","#f472b6","#fbbf24","#c084fc"];

export function Home() {
  const t = useT();
  const [lang, setLang] = useLang();
  const user = getTelegramUser();
  const { settings } = usePlatformSettings();
  const { balanceSkz, balanceUsdt, balanceTon, totalEarnedSkz, totalWithdrawnSkz, isLoading: walletLoading, internalUserId, user: platformUser, refetch: refetchWallet } = useWallet();
  const { transactions, isLoading: txLoading } = useTransactions(internalUserId, 4);
  const streak = useDailyStreak();
  const [rankExpanded, setRankExpanded] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [avatarUrlDraft, setAvatarUrlDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const initials = `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ""}`;
  const displayName = platformUser?.displayName || user.firstName;
  const avatarSrc   = platformUser?.avatarUrl   || user.avatarUrl || "";
  const usdtEquiv = (balanceSkz / settings.skzPerUsdt).toFixed(2);

  const openProfileEdit = () => {
    setDisplayNameDraft(platformUser?.displayName || user.firstName || "");
    setAvatarUrlDraft(platformUser?.avatarUrl || user.avatarUrl || "");
    setProfileEditOpen(true);
  };

  const saveProfile = async () => {
    const tid = typeof window !== "undefined"
      ? window.Telegram?.WebApp?.initDataUnsafe?.user?.id
      : null;
    if (!tid) return;
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/users/${tid}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayNameDraft.trim() || null,
          avatarUrl:   avatarUrlDraft.trim()   || null,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        toast.success(t("profile.saved"));
        setProfileEditOpen(false);
        void refetchWallet();
      } else {
        toast.error(t("error_generic"));
      }
    } catch {
      toast.error(t("error_generic"));
    } finally {
      setProfileSaving(false);
    }
  };

  const demoXp = Math.floor(totalEarnedSkz / 6);
  const level = levelFromXp(demoXp);
  const rank = getRankForLevel(level);
  const progress = xpProgress(demoXp);
  const xpCurrent = xpInLevel(demoXp);
  const xpSpan = xpForLevelSpan(level);
  const xpNeeded = xpToNextLevel(demoXp);

  const fmt = (n: number) => numeral(n).format("0,0");
  const fmtDec = (n: number, dp: number) => numeral(n).format(`0,0.${"0".repeat(dp)}`);

  return (
    <SkeletonTheme baseColor="rgba(255,255,255,0.06)" highlightColor="rgba(255,255,255,0.12)">
      <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-3 space-y-3.5">

        {/* ── Top bar ── */}
        <motion.header variants={fadeUp} className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base text-white overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #0891b2 100%)",
                  boxShadow: "0 0 0 2px rgba(168,85,247,0.4), 0 4px 16px rgba(0,0,0,0.4)",
                }}
              >
                {avatarSrc
                  ? <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                  : initials}
              </div>
              {/* Edit profile pencil */}
              <button
                onClick={openProfileEdit}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#7c3aed,#0891b2)", border: "1.5px solid #060a14", boxShadow: "0 2px 8px rgba(147,51,234,0.5)" }}
                aria-label={t("profile.editTitle")}
              >
                <Pencil size={8} color="#fff" />
              </button>
            </div>
            <div>
              <h1 className="text-base font-black leading-tight flex items-center gap-1.5">
                {displayName}
                {user.isPremium && <Star size={11} className="text-stars fill-stars" />}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span style={{ fontSize: 10, fontWeight: 700, color: rank.color }}>{rank.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: rank.color, letterSpacing: "0.04em" }}>{rank.name}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>· Lv.{level}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Lang toggle — inline next to Bell */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="w-9 h-9 rounded-2xl glass-card flex items-center justify-center"
              aria-label={t("langToggle.aria")}
            >
              <Globe size={15} className="text-white/50" />
            </motion.button>
            {/* Bell */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { showTelegramAlert(t("home.noNotifications")); toast.info(t("home.noNotifications"), { duration: 2500 }); }}
              className="w-9 h-9 rounded-2xl glass-card flex items-center justify-center"
            >
              <Bell size={17} className="text-white/60" />
            </motion.button>
          </div>
        </motion.header>

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
                    {t("home.hero.details")} <ChevronRight size={12} />
                  </motion.div>
                </Link>
              </div>
              <div className="text-center mb-5">
                <p className="text-[11px] text-white/40 font-medium mb-1.5 tracking-wide uppercase">{t("home.hero.skzBalance")}</p>
                {walletLoading ? (
                  <div className="flex justify-center items-center h-16">
                    <Skeleton width={180} height={54} borderRadius={12} />
                  </div>
                ) : (
                  <motion.h2
                    className="text-[54px] font-black gradient-text tracking-tighter leading-none mb-1 font-orbitron"
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {fmt(balanceSkz)}
                  </motion.h2>
                )}
                <p className="text-sm font-bold text-white/30">
                  ≈ <span className="text-white/50">${fmtDec(parseFloat(usdtEquiv), 2)}</span> USDT
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/deposit">
                  <motion.button whileTap={{ scale: 0.96 }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                    style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 20px rgba(147,51,234,0.4)" }}>
                    <Download size={16} /> {t("home.hero.deposit")}
                  </motion.button>
                </Link>
                <Link href="/withdraw">
                  <motion.button whileTap={{ scale: 0.96 }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm glass-card">
                    <Upload size={16} className="text-white/70" />
                    <span className="text-white/80">{t("home.hero.withdraw")}</span>
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Rank + XP Card ── */}
        <motion.div variants={fadeUp}>
          <motion.div
            className="rounded-3xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${rank.color}12, ${rank.color}06)`,
              border: `1px solid ${rank.color}30`,
              boxShadow: `0 8px 32px ${rank.glow}`,
            }}
          >
            <motion.button
              className="w-full px-4 pt-4 pb-3"
              onTap={() => setRankExpanded((v) => !v)}
              style={{ textAlign: "left" }}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{
                    background: rank.gradient,
                    boxShadow: `0 4px 20px ${rank.glow}`,
                  }}
                >
                  {rank.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-black tracking-wider uppercase" style={{ color: rank.color }}>{rank.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/40 font-medium">Lv.{level} / 50</span>
                      <motion.div animate={{ rotate: rankExpanded ? 180 : 0 }} transition={{ duration: 0.22 }}>
                        <ChevronDown size={12} className="text-white/30" />
                      </motion.div>
                    </div>
                  </div>
                  {/* XP Bar */}
                  <div className="w-full h-2 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(progress * 100)}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ background: rank.gradient }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold" style={{ color: rank.color }}>
                      {walletLoading ? "—" : `${fmt(xpCurrent)} / ${fmt(xpSpan)} XP`}
                    </span>
                    <span className="text-[9px] text-white/30 font-medium">
                      {level < 50 ? `${fmt(xpNeeded)} XP للمستوى التالي` : "MAX LEVEL"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* Expanded — rank ladder preview */}
            <AnimatePresence initial={false}>
              {rankExpanded && (
                <motion.div
                  key="ladder"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 16px 14px" }}>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2.5">مراحل الرتبة</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {["Ghost","Scout","Trader","Shark","Veteran","Elite","Legend","Mythic"].map((r, i) => {
                        const isCurrentRank = rank.name === r;
                        const isPast = i < ["Ghost","Scout","Trader","Shark","Veteran","Elite","Legend","Mythic"].indexOf(rank.name);
                        return (
                          <div key={r}
                            className="flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl"
                            style={{
                              background: isCurrentRank ? `${RANK_COLORS[i]}20` : "rgba(255,255,255,0.03)",
                              border: `1px solid ${isCurrentRank ? RANK_COLORS[i]+"50" : "rgba(255,255,255,0.07)"}`,
                              minWidth: 52,
                            }}
                          >
                            <span style={{ fontSize: 16, opacity: isPast || isCurrentRank ? 1 : 0.35 }}>
                              {["👻","🔍","📈","🦈","⚡","💎","🔱","👑"][i]}
                            </span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: isCurrentRank ? RANK_COLORS[i] : "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>{r.toUpperCase()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* ── Daily Strike + Mini stats ── */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2.5">
          {/* Daily Strike */}
          <div
            className="rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1 col-span-1"
            style={{
              background: streak >= 7 ? "rgba(251,191,36,0.1)" : "rgba(249,115,22,0.08)",
              border: `1px solid ${streak >= 7 ? "rgba(251,191,36,0.3)" : "rgba(249,115,22,0.22)"}`,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <Flame size={22} color={streak >= 7 ? "#fbbf24" : "#f97316"} />
            </motion.div>
            <p className="text-xl font-black font-orbitron" style={{ color: streak >= 7 ? "#fbbf24" : "#f97316", lineHeight: 1 }}>{streak}</p>
            <p className="text-[9px] text-white/35 font-bold text-center leading-tight">يوم متتالي</p>
          </div>
          {/* Total earned */}
          <div className="glass-card rounded-2xl p-3 col-span-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-success/15 flex items-center justify-center">
                <TrendingUp size={10} className="text-success" />
              </div>
              <p className="text-[10px] text-white/45 font-medium">{t("home.stats.totalEarned")}</p>
            </div>
            <p className="text-lg font-black text-success font-orbitron">
              {walletLoading ? <Skeleton width={60} height={22} /> : fmt(totalEarnedSkz)}
            </p>
            <p className="text-[9px] text-white/25 font-medium mt-0.5">SKZ</p>
          </div>
          {/* Withdrawn */}
          <div className="glass-card rounded-2xl p-3 col-span-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center">
                <ArrowUpRight size={10} className="text-white/50" />
              </div>
              <p className="text-[10px] text-white/45 font-medium">{t("home.stats.withdrawn")}</p>
            </div>
            <p className="text-lg font-black text-white/70 font-orbitron">
              {walletLoading ? <Skeleton width={60} height={22} /> : fmt(totalWithdrawnSkz)}
            </p>
            <p className="text-[9px] text-white/25 font-medium mt-0.5">SKZ</p>
          </div>
        </motion.div>

        {/* ── Currency pills — USDT + TON only (no Stars) ── */}
        <motion.div variants={fadeUp}>
          <p className="section-label mb-2.5">{t("home.currencyBalances")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { key: "USDT", val: fmtDec(balanceUsdt, 2),  rate: settings.skzPerUsdt, balance: balanceUsdt },
              { key: "TON",  val: fmtDec(balanceTon, 3),   rate: settings.skzPerTon,  balance: balanceTon  },
            ].map((item) => {
              const ci = CURRENCY_ICONS[item.key];
              return (
                <motion.div key={item.key} whileTap={{ scale: 0.95 }}
                  className="flex-shrink-0 rounded-2xl p-3.5 min-w-[120px]"
                  style={{ background: ci.bg, border: `1px solid ${ci.color}22`, boxShadow: `0 4px 16px ${ci.glow}` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <IconBox iconKey={ci.iconKey} size={12} color={ci.color} bg={`${ci.color}20`}
                      border={`${ci.color}25`} boxSize={22} radius={6} />
                    <p className="text-[10px] font-bold" style={{ color: ci.color }}>{item.key}</p>
                  </div>
                  <p className="text-xl font-black text-white font-orbitron">
                    {walletLoading ? <Skeleton width={70} height={24} /> : item.val}
                  </p>
                  <p className="text-[9px] text-white/30 mt-1 font-medium">
                    = {walletLoading ? "—" : fmt(Math.round(item.balance * item.rate))} SKZ
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Bots strip — no count chip ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="section-label">{t("home.bots")}</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {BOTS.map((bot) => {
              const bi = BOT_ICONS[bot.name] ?? { iconKey: "bot" as const, color: "#94a3b8", glow: "rgba(148,163,184,0.3)", bg: "linear-gradient(135deg,rgba(148,163,184,0.15),rgba(148,163,184,0.05))" };
              return (
                <motion.button
                  key={bot.name}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    if (bot.live && bot.url) {
                      if (bot.url.startsWith("/")) { window.location.href = bot.url; return; }
                      try {
                        const target = new URL(bot.url);
                        if (target.origin === window.location.origin) { window.location.href = target.pathname + target.search + target.hash; return; }
                      } catch {}
                      openTelegramApp(bot.url);
                    } else {
                      showTelegramAlert(t("home.bot.launchingSoon", { brand: bot.brand }));
                    }
                  }}
                  className="flex-shrink-0 glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5 min-w-[72px] pressable relative"
                  style={{ border: bot.live && bi ? `1px solid ${bi.color}40` : undefined }}
                >
                  {bot.live && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.7)" }} />
                  )}
                  <IconBox iconKey={bi.iconKey} size={20} color={bi.color} bg={bi.bg}
                    border={`${bi.color}25`} glow={bi.glow} boxSize={42} radius={12} />
                  <p className="text-[10px] font-bold text-white/80 text-center leading-tight tracking-wider" dir="ltr" lang="en" title={bot.brand}>{bot.short}</p>
                  <span className="text-[8px] font-bold text-white/30">{bot.live ? t("home.bot.open") : t("home.bot.soon")}</span>
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
                    <p className="text-sm font-black text-white mb-1">{t("home.referral.invite")}</p>
                    <p className="text-[11px] text-white/50 leading-snug">
                      {t("home.referral.earnLine", { pct: settings.referralBonusPercent })}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-skz-light flex-shrink-0" />
              </div>
            </motion.div>
          </Link>
        </motion.div>

        {/* ── Sub-Agents promo ── */}
        <motion.div variants={fadeUp}>
          <Link href="/subagents">
            <motion.div whileTap={{ scale: 0.98 }}
              className="relative rounded-2xl p-4 overflow-hidden pressable"
              style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(184,148,31,0.06))", border: "1px solid rgba(212,175,55,0.3)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.3), rgba(184,148,31,0.2))", border: "1px solid rgba(212,175,55,0.4)" }}
                  >
                    <Crown size={20} color="#D4AF37" />
                  </div>
                  <div>
                    <p className="text-sm font-black font-orbitron mb-1" style={{ color: "#D4AF37" }}>♛ SOUQRATES SUB-AGENTS</p>
                    <p className="text-[11px] text-white/50 leading-snug">برنامج الشركاء — بيع SKZ واربح عمولات تصاعدية</p>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: "#D4AF37" }} className="flex-shrink-0" />
              </div>
            </motion.div>
          </Link>
        </motion.div>

        {/* ── Recent transactions ── */}
        <motion.div variants={fadeUp} className="pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">{t("home.recent")}</p>
            <Link href="/wallet"><span className="text-[11px] text-skz-light font-bold">{t("home.viewAll")}</span></Link>
          </div>

          {txLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} height={58} borderRadius={16} />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-white/30 text-sm font-medium">{t("home.tx.empty")}</p>
              <p className="text-white/20 text-[11px] mt-1">{t("home.tx.emptyHint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 4).map((tx, i) => {
                const isCredit = ["credit", "admin_credit", "deposit", "referral_bonus", "game_win"].includes(tx.type);
                const amt = parseFloat(tx.amount);
                const sign = isCredit ? "+" : "-";
                const emoji = txBotIcon(tx.sourceBot);
                return (
                  <motion.div key={tx.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className="flex items-center justify-between px-3 py-3 rounded-2xl glass-card pressable"
                    whileTap={{ scale: 0.98 }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{
                          background: isCredit ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.05)",
                          border: isCredit ? "1px solid rgba(168,85,247,0.2)" : "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        {emoji}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white/90 capitalize">
                          {tx.sourceBot ?? tx.type}
                        </p>
                        <p className="text-[10px] text-white/30 font-medium">{formatTxDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-sm ${isCredit ? "text-skz-light" : "text-white/50"}`}>
                        {sign}{fmt(Math.floor(amt))}
                      </p>
                      <p className="text-[10px] text-white/25 font-medium uppercase">{tx.currency}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ── Profile Edit Modal ── */}
      <AnimatePresence>
        {profileEditOpen && (
          <motion.div
            key="profile-edit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setProfileEditOpen(false); }}
          >
            <motion.div
              key="profile-edit-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="w-full rounded-t-3xl p-6 space-y-4 safe-bottom"
              style={{ background: "rgba(10,14,28,0.98)", border: "1px solid rgba(168,85,247,0.2)", borderBottom: "none" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="font-black text-base text-white">{t("profile.editTitle")}</p>
                <button
                  onClick={() => setProfileEditOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <X size={15} className="text-white/60" />
                </button>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  {t("profile.displayName")}
                </label>
                <input
                  type="text"
                  value={displayNameDraft}
                  onChange={(e) => setDisplayNameDraft(e.target.value.slice(0, 50))}
                  placeholder={user.firstName}
                  className="w-full px-4 py-3 rounded-2xl text-sm font-semibold text-white placeholder:text-white/25 outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}
                  dir="auto"
                />
              </div>

              {/* Avatar URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  {t("profile.avatarUrl")}
                </label>
                <input
                  type="url"
                  value={avatarUrlDraft}
                  onChange={(e) => setAvatarUrlDraft(e.target.value.slice(0, 500))}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-2xl text-sm font-semibold text-white placeholder:text-white/25 outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}
                  dir="ltr"
                />
              </div>

              <p className="text-[10px] font-medium text-white/35 text-center">{t("profile.note")}</p>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setProfileEditOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white/60"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  {t("profile.cancel")}
                </button>
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="flex-1 py-3 rounded-2xl text-sm font-black text-white"
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#0891b2)",
                    boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
                    opacity: profileSaving ? 0.6 : 1,
                  }}
                >
                  {profileSaving ? t("profile.saving") : t("profile.save")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SkeletonTheme>
  );
}
