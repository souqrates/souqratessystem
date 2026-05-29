import { usePlatformSettings } from "../lib/use-platform-settings";
import { useWallet } from "../lib/use-wallet";
import { useTransactions, formatTxDate, txBotIcon } from "../lib/use-transactions";
import { Download, Upload, TrendingUp, ArrowUpRight, Zap } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { IconBox, CURRENCY_ICONS } from "../components/icons";
import { useT } from "../lib/i18n";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import numeral from "numeral";

const stagger = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

export function Wallet() {
  const t = useT();
  const { settings } = usePlatformSettings();
  const { balanceSkz, balanceUsdt, balanceTon, totalEarnedSkz, totalWithdrawnSkz, isLoading: walletLoading, internalUserId } = useWallet();
  const { transactions, isLoading: txLoading } = useTransactions(internalUserId, 30);

  const usdtEquiv = (balanceSkz / settings.skzPerUsdt).toFixed(2);
  const fmt = (n: number) => numeral(n).format("0,0");
  const fmtDec = (n: number, dp: number) => numeral(n).format(`0,0.${"0".repeat(dp)}`);

  return (
    <SkeletonTheme baseColor="rgba(255,255,255,0.06)" highlightColor="rgba(255,255,255,0.12)">
      <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-4 space-y-5">

        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">{t("wallet.title")}</h1>
            <p className="text-[11px] text-white/40 font-medium mt-0.5">{t("wallet.subtitle")}</p>
          </div>
          <div className="chip chip-skz"><Zap size={10} />SKZ</div>
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
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{t("wallet.mainBalance")}</p>
                  <p className="text-[11px] text-white/30 font-medium">≈ ${fmtDec(parseFloat(usdtEquiv), 2)} USDT</p>
                </div>
              </div>
              {walletLoading ? (
                <div className="flex items-center h-16 mb-6">
                  <Skeleton width={220} height={52} borderRadius={12} />
                </div>
              ) : (
                <h2 className="text-5xl font-black gradient-text tracking-tight mb-6">
                  {fmt(balanceSkz)}
                  <span className="text-xl text-white/40 ml-2">SKZ</span>
                </h2>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/deposit">
                  <motion.button whileTap={{ scale: 0.96 }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                    style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 4px 20px rgba(147,51,234,0.4)" }}>
                    <Download size={16} /> {t("wallet.deposit")}
                  </motion.button>
                </Link>
                <Link href="/withdraw">
                  <motion.button whileTap={{ scale: 0.96 }}
                    className="w-full glass-card flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm">
                    <Upload size={16} className="text-white/60" />
                    <span className="text-white/80">{t("wallet.withdraw")}</span>
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          {[
            { icon: TrendingUp,   label: t("wallet.stats.totalEarned"), value: totalEarnedSkz,    color: "#10b981", bg: "rgba(16,185,129,0.1)" },
            { icon: ArrowUpRight, label: t("wallet.stats.withdrawn"),   value: totalWithdrawnSkz, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.05)" },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                  <s.icon size={12} style={{ color: s.color }} />
                </div>
                <p className="text-[11px] text-white/45 font-medium">{s.label}</p>
              </div>
              <p className="text-xl font-black" style={{ color: s.color }}>
                {walletLoading ? <Skeleton width={80} height={24} /> : fmt(s.value)}
              </p>
              <p className="text-[10px] text-white/25 mt-0.5 font-medium">SKZ</p>
            </div>
          ))}
        </motion.div>

        {/* Currency deposit sources — USDT + TON only (no Stars) */}
        <motion.div variants={fadeUp}>
          <p className="section-label mb-3">{t("wallet.currencyBalances")}</p>
          <div className="space-y-2.5">
            {[
              { key: "USDT", label: "USDT", sub: t("wallet.currency.usdt.sub"), val: fmtDec(balanceUsdt, 2),  rate: settings.skzPerUsdt, balance: balanceUsdt },
              { key: "TON",  label: "TON",  sub: t("wallet.currency.ton.sub"),  val: fmtDec(balanceTon, 4),   rate: settings.skzPerTon,  balance: balanceTon  },
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
                    <p className="font-bold text-sm" style={{ color: ci.color }}>{item.label}</p>
                    <p className="text-[10px] text-white/30 font-medium">
                      {item.sub} · 1 {item.key} = {item.rate} SKZ
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-base text-white">
                      {walletLoading ? <Skeleton width={60} height={20} /> : item.val}
                    </p>
                    <p className="text-[10px] text-white/35 font-medium">
                      = {walletLoading ? "—" : fmt(Math.round(item.balance * item.rate))} SKZ
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div variants={fadeUp}>
          <p className="section-label mb-3">{t("wallet.history")}</p>

          {txLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} height={62} borderRadius={16} />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-white/30 text-sm font-medium">{t("wallet.history.empty")}</p>
              <p className="text-white/20 text-[11px] mt-1">{t("wallet.history.emptyHint")}</p>
            </div>
          ) : (
            <div className="glass-card rounded-3xl overflow-hidden">
              {transactions.map((tx, i) => {
                const isCredit = ["credit", "admin_credit", "deposit", "referral_bonus", "game_win"].includes(tx.type);
                const amt = parseFloat(tx.amount);
                const sign = isCredit ? "+" : "-";
                const emoji = txBotIcon(tx.sourceBot);
                return (
                  <div key={tx.id}>
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{
                            background: isCredit ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
                            border: isCredit ? "1px solid rgba(168,85,247,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          {emoji}
                        </div>
                        <div>
                          <p className="font-bold text-sm capitalize">
                            {tx.description ?? tx.sourceBot ?? tx.type}
                          </p>
                          <p className="text-[10px] text-white/30 font-medium mt-0.5">{formatTxDate(tx.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-sm ${isCredit ? "text-skz-light" : "text-white/50"}`}>
                          {sign}{fmt(Math.floor(amt))}
                        </p>
                        <p className="text-[10px] text-white/25 font-medium uppercase">{tx.currency}</p>
                      </div>
                    </div>
                    {i < transactions.length - 1 && <div className="divider mx-4" />}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </SkeletonTheme>
  );
}
