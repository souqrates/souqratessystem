import { MOCK_BALANCES, MOCK_TRANSACTIONS } from "../lib/mock-data";
import { CircleDollarSign, Star, Gem, Download, Upload } from "lucide-react";
import { Link } from "wouter";

export function Wallet() {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold mt-2">المحفظة</h1>
      
      {/* Main Wallet Card */}
      <div className="rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-[#1a233a] to-[#0a0f1e] border border-white/10 shadow-[0_8px_32px_rgba(0,212,255,0.15)]">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent rounded-full blur-[100px] opacity-30"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600 rounded-full blur-[100px] opacity-30"></div>
        
        <div className="relative z-10">
          <p className="text-white/60 text-sm font-medium mb-1">إجمالي الرصيد المقدر</p>
          <h2 className="text-4xl font-black text-white tracking-tight mb-6">
            $47.80
          </h2>
          
          <div className="flex gap-4">
            <Link href="/deposit" className="flex-1">
              <button className="w-full bg-accent text-base font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                <Download size={18} />
                إيداع
              </button>
            </Link>
            <Link href="/withdraw" className="flex-1">
              <button className="w-full bg-white/10 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 backdrop-blur-md">
                <Upload size={18} />
                سحب
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Currency Breakdown */}
      <div className="space-y-3">
        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-usdt/10 flex items-center justify-center text-usdt">
              <CircleDollarSign size={24} />
            </div>
            <div>
              <p className="font-bold text-base">Tether USDT</p>
              <p className="text-xs text-white/50">TRC20</p>
            </div>
          </div>
          <div className="text-left">
            <p className="font-bold text-lg">{MOCK_BALANCES.usdt.toFixed(2)}</p>
            <p className="text-xs text-usdt">≈ ${MOCK_BALANCES.usdt.toFixed(2)}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-stars/10 flex items-center justify-center text-stars">
              <Star size={24} className="fill-stars" />
            </div>
            <div>
              <p className="font-bold text-base">Telegram Stars</p>
              <p className="text-xs text-white/50">In-app currency</p>
            </div>
          </div>
          <div className="text-left">
            <p className="font-bold text-lg">{MOCK_BALANCES.stars}</p>
            <p className="text-xs text-stars">≈ ${(MOCK_BALANCES.stars * 0.015).toFixed(2)}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-ton/10 flex items-center justify-center text-ton">
              <Gem size={24} className="fill-ton" />
            </div>
            <div>
              <p className="font-bold text-base">Toncoin</p>
              <p className="text-xs text-white/50">The Open Network</p>
            </div>
          </div>
          <div className="text-left">
            <p className="font-bold text-lg">{MOCK_BALANCES.ton.toFixed(3)}</p>
            <p className="text-xs text-ton">≈ ${(MOCK_BALANCES.ton * 5.2).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* History */}
      <section className="pb-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-bold text-white">سجل المعاملات</h3>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white font-medium">الكل</button>
            <button className="text-xs px-3 py-1.5 rounded-full text-white/50 font-medium">إيداع</button>
            <button className="text-xs px-3 py-1.5 rounded-full text-white/50 font-medium">سحب</button>
          </div>
        </div>
        
        <div className="space-y-3">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {tx.type === 'credit' ? <Download size={18} /> : <Upload size={18} />}
                </div>
                <div>
                  <p className="font-medium text-sm">{tx.bot}</p>
                  <p className="text-xs text-white/40">{tx.date}</p>
                </div>
              </div>
              <div className="text-left">
                <p className={`font-bold text-sm ${tx.type === 'credit' ? 'text-success' : 'text-white'}`}>
                  {tx.amount} {tx.currency}
                </p>
                <p className="text-[10px] text-white/40">مكتمل</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
