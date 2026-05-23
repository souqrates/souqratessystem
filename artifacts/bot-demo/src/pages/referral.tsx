import { useState } from "react";
import { MOCK_REFERRALS } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Users, Copy, Share2, Check, ChevronLeft, Zap, TrendingUp, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const stagger = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export function Referral() {
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();
  const refLink = "t.me/MotherBot?start=ref_482917";

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "✓ تم نسخ الرابط" });
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

  const TIERS = [
    { level: "L1", pct: settings.referralBonusPercent, label: "الجيل الأول",  color: "#a855f7", glow: "rgba(168,85,247,0.3)", icon: "👥" },
    { level: "L2", pct: settings.referralL2Percent,    label: "الجيل الثاني", color: "#22d3ee", glow: "rgba(34,211,238,0.3)",  icon: "🌊" },
    { level: "L3", pct: settings.referralL3Percent,    label: "الجيل الثالث", color: "#10b981", glow: "rgba(16,185,129,0.3)",  icon: "🌱" },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-4 space-y-5">

      {/* Header hero */}
      <motion.div variants={fadeUp} className="relative rounded-3xl p-6 overflow-hidden noise" style={{
        background: "linear-gradient(135deg, #0d0b2e 0%, #0a1430 50%, #0b1020 100%)",
        border: "1px solid rgba(168,85,247,0.3)",
        boxShadow: "0 8px 40px rgba(168,85,247,0.12)",
      }}>
        <div className="orb-1 absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)" }} />
        <div className="orb-2 absolute -bottom-12 -left-12 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 70%)" }} />

        <div className="relative z-10 text-center">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 skz-coin"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            <Users size={28} className="text-skz-light" />
          </div>
          <h1 className="text-2xl font-black mb-2">نظام الإحالة</h1>
          <p className="text-[12px] text-white/50 leading-relaxed max-w-[260px] mx-auto">
            ادعُ أصدقاءك واكسب حتى{" "}
            <span className="text-skz-light font-bold">{settings.referralBonusPercent}%</span>
            {" "}من أرباحهم بـ SKZ — مدى الحياة
          </p>
        </div>
      </motion.div>

      {/* Earnings banner */}
      <motion.div variants={fadeUp}>
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
        >
          <div>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">إجمالي أرباح الإحالات</p>
            <div className="flex items-center gap-2 mt-1">
              <Zap size={16} className="text-skz-light" />
              <p className="text-2xl font-black gradient-text">240</p>
              <p className="text-sm font-bold text-white/40">SKZ</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 font-medium">الأصدقاء</p>
            <p className="text-3xl font-black text-white">{MOCK_REFERRALS.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Commission tiers */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">مستويات العمولة</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((tier) => (
            <div
              key={tier.level}
              className="rounded-2xl p-3.5 text-center"
              style={{
                background: `${tier.color}10`,
                border: `1px solid ${tier.color}25`,
                boxShadow: `0 4px 16px ${tier.glow}`,
              }}
            >
              <span className="text-xl mb-1.5 block">{tier.icon}</span>
              <p className="text-2xl font-black mb-0.5" style={{ color: tier.color }}>{tier.pct}%</p>
              <p className="text-[9px] font-bold text-white/35 leading-tight">{tier.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Referral link card */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">رابط الدعوة</p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}
        >
          {/* Link display */}
          <div className="px-4 py-4 flex items-center justify-between gap-3">
            <p
              className="font-mono text-[12px] text-white/60 truncate flex-1 text-left"
              dir="ltr"
            >
              {refLink}
            </p>
            <motion.button
              onClick={handleCopy}
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)" }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied
                  ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={15} className="text-success" strokeWidth={2.5} /></motion.div>
                  : <motion.div key="copy"  initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy  size={15} className="text-white/60" /></motion.div>}
              </AnimatePresence>
            </motion.button>
          </div>

          <div className="divider mx-0" />

          {/* Share button */}
          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-3 py-4 font-black text-sm"
            style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "white" }}
          >
            <Share2 size={18} />
            مشاركة الرابط
          </motion.button>
        </div>
      </motion.div>

      {/* Friends list */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">أصدقاؤك ({MOCK_REFERRALS.length})</p>
          <div className="flex items-center gap-1">
            <TrendingUp size={11} className="text-success" />
            <span className="text-[11px] text-success font-bold">نشط</span>
          </div>
        </div>

        <div className="glass-card rounded-3xl overflow-hidden">
          {MOCK_REFERRALS.map((ref, i) => (
            <div key={ref.id}>
              <div className="flex items-center gap-3 px-4 py-4">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))", color: "#c084fc" }}
                >
                  {ref.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white/90">{ref.name}</p>
                  <p className="text-[10px] text-white/30 font-medium">{ref.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-skz-light">+{ref.earnings}</p>
                  <div className="flex items-center justify-end gap-0.5 mt-0.5">
                    <Star size={8} className="text-stars fill-stars" />
                    <span className="text-[9px] text-white/30 font-medium">L1</span>
                  </div>
                </div>
              </div>
              {i < MOCK_REFERRALS.length - 1 && <div className="divider mx-4" />}
            </div>
          ))}
          <div className="divider" />
          <button className="w-full flex items-center justify-between px-4 py-4 text-sm text-white/40 hover:text-white/60 transition-colors">
            <span className="font-medium">عرض جميع الأصدقاء</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div variants={fadeUp} className="pb-4">
        <p className="section-label mb-4">كيف يعمل؟</p>
        <div className="space-y-3">
          {[
            { step: "01", text: "شارك رابط الإحالة مع أصدقائك.", color: "#a855f7" },
            { step: "02", text: "يسجلون ويبدأون استخدام البوتات المختلفة.", color: "#22d3ee" },
            { step: "03", text: `تحصل على ${settings.referralBonusPercent}% من الجيل 1، ${settings.referralL2Percent}% من 2، ${settings.referralL3Percent}% من 3 — بـ SKZ تلقائياً.`, color: "#10b981" },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 items-start">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-[10px] flex-shrink-0 mt-0.5"
                style={{ background: `${item.color}20`, border: `1px solid ${item.color}30`, color: item.color }}
              >
                {item.step}
              </div>
              <p className="text-sm text-white/55 leading-relaxed flex-1 font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
