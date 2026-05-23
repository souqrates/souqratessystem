import { getTelegramUser } from "../lib/telegram";
import { MOCK_BALANCES, MOCK_TRANSACTIONS } from "../lib/mock-data";
import { motion } from "framer-motion";
import { Star, CircleDollarSign, Gem } from "lucide-react";

export function Home() {
  const user = getTelegramUser();
  const initials = `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ''}`;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center pt-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-base flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold">{initials}</span>
              )}
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-1">
              {user.firstName} {user.lastName}
              {user.isPremium && <Star size={14} className="text-stars fill-stars" />}
            </h1>
            <p className="text-xs text-white/50">@{user.username}</p>
          </div>
        </div>
      </header>

      {/* Main Balance */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-6"
      >
        <p className="text-sm font-medium text-white/60 mb-2">إجمالي رصيدك</p>
        <h2 className="text-5xl font-black gradient-text tracking-tight">
          ${MOCK_BALANCES.totalEarnedUsdt.toFixed(2)}
        </h2>
      </motion.div>

      {/* Mini Currency Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-3 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-usdt/20 flex items-center justify-center text-usdt">
            <CircleDollarSign size={18} />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-white/50 mb-0.5">USDT</p>
            <p className="font-bold text-sm">{MOCK_BALANCES.usdt.toFixed(2)}</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-3 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-stars/20 flex items-center justify-center text-stars">
            <Star size={18} className="fill-stars" />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-white/50 mb-0.5">Stars</p>
            <p className="font-bold text-sm">{MOCK_BALANCES.stars}</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-3 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-ton/20 flex items-center justify-center text-ton">
            <Gem size={18} className="fill-ton" />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-white/50 mb-0.5">TON</p>
            <p className="font-bold text-sm">{MOCK_BALANCES.ton.toFixed(3)}</p>
          </div>
        </div>
      </div>

      {/* Bots Section */}
      <section>
        <h3 className="text-sm font-bold mb-3 px-1 text-white/80">بوتاتنا</h3>
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
          {[
            { icon: "🎮", name: "الألعاب" },
            { icon: "🎬", name: "الفيديو" },
            { icon: "🎙", name: "الصوت" },
            { icon: "🤖", name: "ذكاء اصطناعي" },
            { icon: "🛒", name: "المتجر" },
            { icon: "🏆", name: "مسابقات" },
          ].map((bot, i) => (
            <div key={i} className="snap-start shrink-0 w-24 glass-card rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">{bot.icon}</span>
              <span className="text-xs font-medium">{bot.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Transactions */}
      <section className="pb-8">
        <h3 className="text-sm font-bold mb-3 px-1 text-white/80">آخر المعاملات</h3>
        <div className="glass-card rounded-3xl p-2 flex flex-col gap-1">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
                  {tx.botIcon}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tx.bot}</p>
                  <p className="text-[10px] text-white/40">{tx.date}</p>
                </div>
              </div>
              <div className={`font-bold text-sm ${tx.type === 'credit' ? 'text-success' : 'text-white'}`}>
                {tx.amount} {tx.currency}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
