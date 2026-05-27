import { useState } from "react";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { useWallet, getTelegramId } from "../lib/use-wallet";
import { Users, Copy, Share2, Check, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IconBox } from "../components/icons";
import { useT, useLang } from "../lib/i18n";
import { showTelegramAlert } from "../lib/telegram";

const stagger = { animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

const TIERS_CONFIG = [
  { level: "L1", settingKey: "referralBonusPercent", labelKey: "referral.tier.gen1", color: "#a855f7", glow: "rgba(168,85,247,0.3)", iconKey: "users" },
  { level: "L2", settingKey: "referralL2Percent",    labelKey: "referral.tier.gen2", color: "#22d3ee", glow: "rgba(34,211,238,0.3)",  iconKey: "users" },
  { level: "L3", settingKey: "referralL3Percent",    labelKey: "referral.tier.gen3", color: "#10b981", glow: "rgba(16,185,129,0.3)",  iconKey: "users" },
];

export function Referral() {
  const t = useT();
  const [lang] = useLang();
  const [copied, setCopied] = useState(false);
  const { settings } = usePlatformSettings();
  const { user } = useWallet();

  const telegramId = getTelegramId();
  const botUsername = "MotherSkzBot";
  const refLink = telegramId
    ? `t.me/${botUsername}?start=ref_${telegramId}`
    : `t.me/${botUsername}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    showTelegramAlert(t("referral.copied"));
  };

  const handleShare = () => {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://${refLink}`)}&text=${encodeURIComponent(settings.referralMessage)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      handleCopy();
    }
  };

  const tierPcts: Record<string, string> = {
    referralBonusPercent: settings.referralBonusPercent,
    referralL2Percent:    settings.referralL2Percent,
    referralL3Percent:    settings.referralL3Percent,
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="px-4 pt-4 space-y-5">

      {/* Header hero */}
      <motion.div variants={fadeUp}
        className="relative rounded-3xl p-6 overflow-hidden noise"
        style={{
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
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))",
              border: "1px solid rgba(168,85,247,0.3)",
              boxShadow: "0 8px 32px rgba(168,85,247,0.2)",
            }}
          >
            <Users size={30} className="text-skz-light" />
          </div>
          <h1 className="text-2xl font-black mb-2">{t("referral.title")}</h1>
          <p className="text-[12px] text-white/50 leading-relaxed max-w-[260px] mx-auto">
            {t("referral.headerLine", { pct: settings.referralBonusPercent })}
          </p>
        </div>
      </motion.div>

      {/* Commission tiers */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">{t("referral.tiers")}</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS_CONFIG.map((tier) => (
            <div
              key={tier.level}
              className="rounded-2xl p-3.5 text-center"
              style={{
                background: `${tier.color}10`,
                border: `1px solid ${tier.color}25`,
                boxShadow: `0 4px 16px ${tier.glow}`,
              }}
            >
              <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                style={{ background: `${tier.color}20`, border: `1px solid ${tier.color}30` }}>
                <IconBox iconKey={tier.iconKey} size={18} color={tier.color}
                  bg="transparent" border="transparent" boxSize={40} radius={10} />
              </div>
              <p className="text-2xl font-black mb-0.5" style={{ color: tier.color }}>
                {tierPcts[tier.settingKey]}%
              </p>
              <p className="text-[9px] font-bold text-white/35 leading-tight">{t(tier.labelKey)}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Referral link card */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">{t("referral.inviteLink")}</p>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <div className="px-4 py-4 flex items-center justify-between gap-3">
            <p className="font-mono text-[12px] text-white/60 truncate flex-1 text-left" dir="ltr">
              {refLink}
            </p>
            <motion.button onClick={handleCopy} whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)" }}>
              <AnimatePresence mode="wait" initial={false}>
                {copied
                  ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={15} className="text-success" strokeWidth={2.5} /></motion.div>
                  : <motion.div key="copy"  initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy  size={15} className="text-white/60" /></motion.div>}
              </AnimatePresence>
            </motion.button>
          </div>
          <div className="divider mx-0" />
          <motion.button onClick={handleShare} whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-3 py-4 font-black text-sm"
            style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "white" }}>
            <Share2 size={18} />
            {t("referral.share")}
          </motion.button>
        </div>
      </motion.div>

      {/* Referral info */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl p-4"
          style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1">{t("referral.referredBy")}</p>
              <p className="text-sm font-black text-white/60">
                {user?.referrerId ? t("referral.user", { id: user.referrerId }) : t("referral.direct")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1">{t("referral.yourId")}</p>
              <p className="text-sm font-black text-skz-light font-mono">
                {telegramId ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Friends — empty state */}
      <motion.div variants={fadeUp}>
        <p className="section-label mb-3">{t("referral.friends")}</p>
        <div className="glass-card rounded-2xl p-8 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
          >
            <Users size={24} className="text-skz-light opacity-60" />
          </div>
          <p className="text-white/40 text-sm font-bold">{t("referral.empty")}</p>
          <p className="text-white/25 text-[11px] mt-1 leading-relaxed max-w-[220px] mx-auto">
            {t("referral.emptyHint", { pct: settings.referralBonusPercent })}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Zap size={12} className="text-skz-light" />
            <span className="text-[11px] font-bold text-skz-light">
              {t("referral.perGen", { l1: settings.referralBonusPercent, l2: settings.referralL2Percent, l3: settings.referralL3Percent })}
            </span>
          </div>
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div variants={fadeUp} className="pb-4">
        <p className="section-label mb-4">{t("referral.how")}</p>
        <div className="space-y-3">
          {[
            { step: "01", iconKey: "users",   color: "#a855f7", text: t("referral.step1") },
            { step: "02", iconKey: "gamepad", color: "#22d3ee", text: t("referral.step2") },
            { step: "03", iconKey: "zap",     color: "#10b981", text: t("referral.step3", { l1: settings.referralBonusPercent, l2: settings.referralL2Percent, l3: settings.referralL3Percent }) },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 items-start">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${item.color}18`, border: `1px solid ${item.color}28` }}
              >
                <IconBox iconKey={item.iconKey} size={14} color={item.color}
                  bg="transparent" border="transparent" boxSize={32} radius={10} />
              </div>
              <p className="text-sm text-white/55 leading-relaxed flex-1 font-medium pt-1">{item.text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
