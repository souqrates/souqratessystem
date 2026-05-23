import { getTelegramUser } from "../lib/telegram";
import { MOCK_BALANCES, MOCK_TRANSACTIONS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { motion } from "framer-motion";
import { Star, TrendingUp, Zap, Settings2 } from "lucide-react";

export function Home() {
  const user = getTelegramUser();
  const { settings } = usePlatformSettings();
  const initials = `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ""}`;

  const usdtEquiv = (MOCK_BALANCES.skz / settings.skzPerUsdt).toFixed(2);

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <header className="flex justify-between items-center pt-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-skz to-accent p-[2px] skz-coin">
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
            <p className="text-xs text-white/40">@{user.username}</p>
          </div>
        </div>
        <div className="glass-card rounded-xl px-3 py-1.5 flex items-center gap-1.5">
          <Zap size={12} className="text-skz" />
          <span className="text-xs font-bold text-skz-light">مُتصل</span>
        </div>
      </header>

      {/* Platform Name Banner */}
      <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2">
        <Settings2 size={12} className="text-white/30" />
        <p className="text-xs text-white/50 flex-1">
          <span className="text-white/70 font-semibold">{settings.platformName}</span>
          {" — "}{settings.platformTagline}
        </p>
      </div>

      {/* Primary SKZ Balance Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card-skz rounded-3xl p-6 relative overflow-hidden"
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-skz rounded-full blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-accent rounded-full blur-[80px] opacity-15 pointer-events-none" />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-skz to-skz-dark flex items-center justify-center text-white font-black text-xs">
              S
            </div>
            <p className="text-sm font-medium text-white/60">رصيد SKZ</p>
          </div>
          <h2 className="text-6xl font-black gradient-text tracking-tight mb-1">
            {MOCK_BALANCES.skz.toLocaleString("ar")}
          </h2>
          <p className="text-base font-bold text-white/50 mb-4">SKZ</p>
          <p className="text-xs text-white/40">
            ≈ ${usdtEquiv} USDT
            <span className="text-white/20 mx-1">·</span>
            سعر الصرف: {settings.skzPerUsdt} SKZ/USDT
          </p>
        </div>
      </motion.div>

      {/* SKZ Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-success" />
            <p className="text-xs text-white/50">إجمالي المكتسب</p>
          </div>
          <p className="font-black text-lg text-success">
            {MOCK_BALANCES.totalEarnedSkz.toLocaleString("ar")}
          </p>
          <p className="text-[10px] text-white/30">SKZ</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} className="text-stars fill-stars" />
            <p className="text-xs text-white/50">محول للخارج</p>
          </div>
          <p className="font-black text-lg text-white/70">
            {MOCK_BALANCES.totalWithdrawnSkz.toLocaleString("ar")}
          </p>
          <p className="text-[10px] text-white/30">SKZ</p>
        </div>
      </div>

      {/* Currency mini cards — rates from API */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "USDT",
            val: `${MOCK_BALANCES.usdt.toFixed(1)}`,
            color: "text-usdt",
            bg: "bg-usdt/10",
            note: `= ${Math.round(MOCK_BALANCES.usdt * settings.skzPerUsdt)} SKZ`,
          },
          {
            label: "Stars ⭐",
            val: `${MOCK_BALANCES.stars}`,
            color: "text-stars",
            bg: "bg-stars/10",
            note: `= ${Math.round(MOCK_BALANCES.stars * settings.skzPerStar)} SKZ`,
          },
          {
            label: "TON",
            val: `${MOCK_BALANCES.ton.toFixed(2)}`,
            color: "text-ton",
            bg: "bg-ton/10",
            note: `= ${Math.round(MOCK_BALANCES.ton * settings.skzPerTon)} SKZ`,
          },
        ].map((item, i) => (
          <div key={i} className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1">
            <p className={`text-[10px] font-bold ${item.color}`}>{item.label}</p>
            <p className="font-black text-sm">{item.val}</p>
            <p className="text-[9px] text-white/30">{item.note}</p>
          </div>
        ))}
      </div>

      {/* Bots Grid */}
      <section>
        <h3 className="text-sm font-bold mb-3 px-1 text-white/70">البوتات</h3>
        <div
          className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {[
            { icon: "🎮", name: "الألعاب", skz: "+250" },
            { icon: "🎬", name: "الفيديو", skz: "+100" },
            { icon: "🎙", name: "الصوت", skz: "+80" },
            { icon: "🤖", name: "الذكاء", skz: "+50" },
            { icon: "🛒", name: "المتجر", skz: "+30" },
            { icon: "🏆", name: "مسابقات", skz: "+500" },
          ].map((bot, i) => (
            <div
              key={i}
              className="snap-start shrink-0 glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5 w-[76px]"
            >
              <span className="text-2xl">{bot.icon}</span>
              <span className="text-[10px] font-bold text-white/80 text-center leading-tight">
                {bot.name}
              </span>
              <span className="text-[9px] font-black text-skz-light">{bot.skz}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Referral promo */}
      <div className="glass-card rounded-2xl p-4 border border-skz/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🎁</span>
          <p className="text-xs font-bold text-skz-light">
            ادعُ أصدقاءك واكسب {settings.referralBonusPercent}% من أرباحهم
          </p>
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed">
          {settings.referralMessage}
        </p>
      </div>

      {/* Recent Transactions */}
      <section className="pb-8">
        <h3 className="text-sm font-bold mb-3 px-1 text-white/70">آخر المعاملات</h3>
        <div className="glass-card rounded-3xl p-2 flex flex-col gap-1">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
                  {tx.botIcon}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tx.bot}</p>
                  <p className="text-[10px] text-white/30">{tx.date}</p>
                </div>
              </div>
              <div
                className={`font-black text-sm ${
                  tx.type === "credit" ? "text-skz-light" : "text-white/60"
                }`}
              >
                {tx.amount}{" "}
                <span className="text-[10px] font-bold opacity-70">{tx.currency}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
