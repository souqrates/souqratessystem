import { useState } from "react";
import { MOCK_REFERRALS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Users, Copy, Share2, Check, ChevronLeft, Zap } from "lucide-react";

export function Referral() {
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();
  const refLink = "t.me/MotherBot?start=ref_482917";

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "تم نسخ الرابط" });
    }
  };

  const handleShare = () => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(settings.referralMessage)}`
      );
    } else {
      handleCopy();
    }
  };

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Hero */}
      <div className="text-center py-5">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-skz/30 to-accent/20 flex items-center justify-center mx-auto mb-4 skz-coin">
          <Users size={30} className="text-skz-light" />
        </div>
        <h1 className="text-3xl font-black mb-2">نظام الإحالة</h1>
        <p className="text-white/50 text-sm max-w-[260px] mx-auto leading-relaxed">
          اكسب <span className="text-skz-light font-bold">{settings.referralBonusPercent}%</span> من أرباح أصدقائك و
          <span className="text-sky-400 font-bold"> {settings.referralL2Percent}%</span> من الجيل الثاني و
          <span className="text-violet-400 font-bold"> {settings.referralL3Percent}%</span> من الثالث بـ
          <span className="gradient-text font-bold"> SKZ</span> مدى الحياة.
        </p>
      </div>

      {/* SKZ Earnings Banner */}
      <div className="glass-card-skz rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40">إجمالي المكاسب من الإحالات</p>
          <div className="flex items-center gap-2 mt-1">
            <Zap size={16} className="text-skz-light" />
            <p className="font-black text-2xl gradient-text">240</p>
            <p className="text-sm font-bold text-white/50">SKZ</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">عدد الأصدقاء</p>
          <p className="font-black text-2xl">{MOCK_REFERRALS.length}</p>
        </div>
      </div>

      {/* Link Card */}
      <div className="glass-card rounded-3xl p-5 relative overflow-hidden border border-skz/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-skz/10 rounded-full blur-[50px] pointer-events-none" />
        <p className="text-sm font-bold mb-3 relative z-10 text-white/70">رابط الدعوة الخاص بك</p>
        <div className="bg-surface/80 p-3 rounded-xl flex items-center justify-between mb-4 relative z-10 border border-white/5">
          <p className="font-mono text-xs text-white/70 truncate w-3/4 text-left" dir="ltr">{refLink}</p>
          <button
            onClick={handleCopy}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>
        <button
          onClick={handleShare}
          className="w-full bg-gradient-to-r from-skz to-skz-dark text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 relative z-10 skz-glow"
        >
          <Share2 size={17} />
          مشاركة الرابط
        </button>
      </div>

      {/* Referral List */}
      <section>
        <h3 className="text-sm font-bold mb-3 px-1 text-white/60">أصدقاؤك ({MOCK_REFERRALS.length})</h3>
        <div className="glass-card rounded-3xl p-2 flex flex-col gap-1">
          {MOCK_REFERRALS.map((ref) => (
            <div key={ref.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-skz/20 to-accent/20 flex items-center justify-center font-bold text-sm text-skz-light">
                  {ref.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{ref.name}</p>
                  <p className="text-[10px] text-white/30">{ref.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-sm text-skz-light">+{ref.earnings}</p>
              </div>
            </div>
          ))}
          <button className="flex items-center justify-between p-3 text-sm text-white/40 hover:text-white transition-colors w-full">
            <span>عرض الجميع</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      </section>

      {/* How it works */}
      <section className="pb-4">
        <h3 className="text-sm font-bold mb-4 px-1 text-white/60">كيف يعمل؟</h3>
        <div className="space-y-4">
          {[
            "شارك رابط الإحالة مع أصدقائك أو مجتمعك.",
            "يسجل أصدقاؤك ويبدأون في استخدام البوتات المختلفة.",
            `تحصل على ${settings.referralBonusPercent}% من أرباح الجيل الأول، ${settings.referralL2Percent}% من الثاني، ${settings.referralL3Percent}% من الثالث — بـ SKZ تلقائياً.`,
          ].map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-skz to-skz-dark text-white font-bold text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <p className="text-sm text-white/60 mt-0.5 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
