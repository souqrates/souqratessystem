import { MOCK_BALANCES, MOCK_TRANSACTIONS, SKZ_RATES } from "../lib/mock-data";
import { Download, Upload, TrendingUp, ArrowDownRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export function Wallet() {
  return (
    <div className="p-4 space-y-5">
      <h1 className="text-2xl font-bold mt-2">المحفظة</h1>

      {/* Primary SKZ Card */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-3xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a0b2e 0%, #0e1428 50%, #0a1628 100%)",
          border: "1px solid rgba(168,85,247,0.25)",
          boxShadow: "0 8px 48px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-skz rounded-full blur-[90px] opacity-25 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-accent rounded-full blur-[90px] opacity-15 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-skz to-skz-dark flex items-center justify-center text-white font-black text-sm skz-coin">S</div>
            <div>
              <p className="text-white/50 text-xs">الرصيد الأساسي</p>
              <p className="text-[10px] text-white/30">≈ ${(MOCK_BALANCES.skz / SKZ_RATES.perUsdt).toFixed(2)} USDT</p>
            </div>
          </div>
          <h2 className="text-5xl font-black gradient-text tracking-tight mb-6">
            {MOCK_BALANCES.skz.toLocaleString("ar")} <span className="text-2xl">SKZ</span>
          </h2>

          <div className="flex gap-3">
            <Link href="/deposit" className="flex-1">
              <button className="w-full bg-gradient-to-r from-skz to-skz-dark text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 skz-glow">
                <Download size={17} />
                إيداع
              </button>
            </Link>
            <Link href="/withdraw" className="flex-1">
              <button className="w-full glass-card font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                <Upload size={17} />
                سحب
              </button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-success" />
            <p className="text-xs text-white/50">إجمالي المكتسب</p>
          </div>
          <p className="font-black text-xl text-success">{MOCK_BALANCES.totalEarnedSkz.toLocaleString("ar")}</p>
          <p className="text-xs text-white/30 mt-0.5">SKZ</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDownRight size={13} className="text-white/50" />
            <p className="text-xs text-white/50">إجمالي المسحوب</p>
          </div>
          <p className="font-black text-xl text-white/70">{MOCK_BALANCES.totalWithdrawnSkz.toLocaleString("ar")}</p>
          <p className="text-xs text-white/30 mt-0.5">SKZ</p>
        </div>
      </div>

      {/* Deposit sources */}
      <div>
        <p className="text-xs font-bold text-white/40 mb-3 px-1">مصادر الإيداع</p>
        <div className="space-y-2.5">
          {[
            {
              label: "USDT", sub: "TRC20", color: "text-usdt", bg: "bg-usdt/10 border-usdt/20",
              val: MOCK_BALANCES.usdt.toFixed(2), skzEq: (MOCK_BALANCES.usdt * SKZ_RATES.perUsdt).toFixed(0),
              rate: `1 USDT = ${SKZ_RATES.perUsdt} SKZ`,
            },
            {
              label: "Telegram Stars ⭐", sub: "In-app", color: "text-stars", bg: "bg-stars/10 border-stars/20",
              val: MOCK_BALANCES.stars.toString(), skzEq: (MOCK_BALANCES.stars * SKZ_RATES.perStar).toFixed(0),
              rate: `1 ⭐ = ${SKZ_RATES.perStar} SKZ`,
            },
            {
              label: "TON", sub: "The Open Network", color: "text-ton", bg: "bg-ton/10 border-ton/20",
              val: MOCK_BALANCES.ton.toFixed(3), skzEq: (MOCK_BALANCES.ton * SKZ_RATES.perTon).toFixed(0),
              rate: `1 TON = ${SKZ_RATES.perTon} SKZ`,
            },
          ].map((item, i) => (
            <div key={i} className={`rounded-2xl p-4 border flex items-center justify-between ${item.bg}`}>
              <div>
                <p className={`font-bold text-sm ${item.color}`}>{item.label}</p>
                <p className="text-[10px] text-white/30">{item.sub} · {item.rate}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{item.val}</p>
                <p className="text-[10px] text-white/40">= {item.skzEq} SKZ</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <section className="pb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-base font-bold">سجل المعاملات</h3>
        </div>
        <div className="space-y-2">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="glass-card rounded-2xl flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'credit' ? 'bg-skz/10' : 'bg-white/5'}`}>
                  {tx.type === 'credit'
                    ? <Download size={17} className="text-skz-light" />
                    : <Upload size={17} className="text-white/40" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tx.bot}</p>
                  <p className="text-[10px] text-white/30">{tx.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-sm ${tx.type === 'credit' ? 'text-skz-light' : 'text-white/50'}`}>
                  {tx.amount}
                </p>
                <p className="text-[10px] text-white/30">{tx.currency}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
