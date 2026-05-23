import { useState } from "react";
import { MOCK_REFERRALS } from "../lib/mock-data";
import { Users, Copy, Share2, Check, ChevronLeft } from "lucide-react";

export function Referral() {
  const [copied, setCopied] = useState(false);
  const refLink = "t.me/MotherBot?start=ref_482917";

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "تم نسخ الرابط" });
    }
  };

  const handleShare = () => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('انضم إلي في البوت الأم واكسب من البوتات!')}`);
    } else {
      handleCopy();
    }
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Hero Section */}
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-3xl bg-accent/20 flex items-center justify-center text-accent mx-auto mb-4 rotate-12">
          <Users size={32} />
        </div>
        <h1 className="text-3xl font-black mb-2">نظام الإحالة</h1>
        <p className="text-white/60 text-sm max-w-[240px] mx-auto leading-relaxed">
          اكسب <span className="text-accent font-bold">5%</span> من أرباح أصدقائك في جميع بوتات الشبكة مدى الحياة.
        </p>
      </div>

      {/* Link Card */}
      <div className="glass-card rounded-3xl p-5 border-accent/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-[50px]"></div>
        
        <p className="text-sm font-bold mb-3 relative z-10">رابط الدعوة الخاص بك</p>
        <div className="bg-base/50 p-3 rounded-xl flex items-center justify-between mb-4 relative z-10 border border-white/5">
          <p className="font-mono text-xs text-white/80 truncate w-3/4 text-left" dir="ltr">{refLink}</p>
          <button 
            onClick={handleCopy}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>
        
        <button 
          onClick={handleShare}
          className="w-full bg-accent text-base font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 relative z-10"
        >
          <Share2 size={18} />
          مشاركة الرابط
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-center gap-1 border-white/5">
          <p className="text-xs text-white/50">أصدقاء مدعوين</p>
          <p className="font-bold text-xl">{MOCK_REFERRALS.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-center gap-1 border-white/5">
          <p className="text-xs text-white/50">إجمالي المكاسب</p>
          <p className="font-bold text-xl text-usdt">2.40 USDT</p>
        </div>
      </div>

      {/* Referral List */}
      <section>
        <h3 className="text-sm font-bold mb-3 px-1 text-white/80">أصدقائك ({MOCK_REFERRALS.length})</h3>
        <div className="glass-card rounded-3xl p-2 flex flex-col gap-1 border-white/5">
          {MOCK_REFERRALS.map((ref) => (
            <div key={ref.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent/20 to-purple-600/20 flex items-center justify-center font-bold text-sm">
                  {ref.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{ref.name}</p>
                  <p className="text-[10px] text-white/40">{ref.date}</p>
                </div>
              </div>
              <div className="text-left font-bold text-sm text-usdt">
                +{ref.earnings}
              </div>
            </div>
          ))}
          
          <button className="flex items-center justify-between p-3 text-sm text-white/50 hover:text-white transition-colors w-full">
            <span>عرض الجميع</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      </section>
      
      {/* How it works */}
      <section className="pt-4">
        <h3 className="text-sm font-bold mb-4 px-1 text-white/80">كيف يعمل؟</h3>
        <div className="space-y-4 px-2">
          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center shrink-0">1</div>
            <p className="text-sm text-white/70 mt-0.5">شارك رابط الإحالة الخاص بك مع أصدقائك أو مجتمعك.</p>
          </div>
          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center shrink-0">2</div>
            <p className="text-sm text-white/70 mt-0.5">يسجل أصدقاؤك ويبدأون في استخدام البوتات المختلفة.</p>
          </div>
          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center shrink-0">3</div>
            <p className="text-sm text-white/70 mt-0.5">تحصل على 5% من أرباحهم بشكل تلقائي في محفظتك الموحدة.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
