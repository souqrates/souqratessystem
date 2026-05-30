import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, Sparkles, ChevronLeft } from "lucide-react";
import { HUB_BOTS, type HubBot } from "./data/bots";
import { getTelegramUser, haptic, openTelegram } from "./lib/telegram";

const MOTHER_BOT_USERNAME = "Souqrates_bot";

function go(bot: HubBot) {
  haptic("light");
  if (bot.href) {
    window.location.href = bot.href;
  } else if (bot.telegram) {
    openTelegram(bot.telegram);
  }
}

function BotCard({ bot, index }: { bot: HubBot; index: number }) {
  const disabled = !bot.href && !bot.telegram;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && go(bot)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4, ease: "easeOut" }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl p-4 text-right transition-colors"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 120% at 100% 0%, ${bot.color}22, transparent 60%)`,
        }}
      />
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{
          background: `${bot.color}1f`,
          border: `1px solid ${bot.color}55`,
          boxShadow: `0 0 24px ${bot.color}22`,
        }}
      >
        {bot.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className="font-orbitron truncate text-[13px] font-bold"
            style={{ color: bot.color }}
          >
            {bot.brand}
          </span>
          {bot.badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${bot.color}22`, color: bot.color }}
            >
              {bot.badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[15px] font-bold text-white">
          {bot.arName}
        </span>
        <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--muted)" }}>
          {bot.desc}
        </span>
      </span>
      {!disabled && (
        <ChevronLeft
          className="shrink-0 opacity-40 transition-transform group-hover:-translate-x-1"
          size={20}
        />
      )}
    </motion.button>
  );
}

export default function App() {
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const u = getTelegramUser();
    if (u?.first_name) setName(u.first_name);
  }, []);

  const greeting = useMemo(
    () => (name ? `أهلاً ${name} 👋` : "أهلاً بك في"),
    [name],
  );

  return (
    <div className="relative min-h-[100svh] w-full overflow-x-hidden">
      <div className="hub-aurora pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex w-full max-w-md flex-col px-5 pb-12 pt-8">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{
              background: "rgba(99,102,241,0.16)",
              border: "1px solid rgba(99,102,241,0.4)",
              boxShadow: "0 0 40px rgba(99,102,241,0.35)",
              animation: "hub-float 4s ease-in-out infinite",
            }}
          >
            ◆
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {greeting}
          </p>
          <h1 className="font-orbitron mt-1 text-2xl font-extrabold tracking-wide text-white">
            SOUQRATES <span style={{ color: "var(--indigo)" }}>SYSTEM</span>
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
            البوّابة الموحّدة — محفظة واحدة تربط كل بوتات سوقراط في مكان واحد
          </p>
        </motion.header>

        {/* Wallet CTA */}
        <motion.button
          type="button"
          onClick={() => {
            haptic("medium");
            openTelegram(`https://t.me/${MOTHER_BOT_USERNAME}?start=wallet`);
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45 }}
          whileTap={{ scale: 0.98 }}
          className="relative mt-7 flex w-full items-center gap-4 overflow-hidden rounded-2xl p-5 text-right"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.12))",
            border: "1px solid rgba(99,102,241,0.45)",
            boxShadow: "0 10px 40px -12px rgba(99,102,241,0.5)",
          }}
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(99,102,241,0.25)" }}
          >
            <Wallet size={24} className="text-indigo-200" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-white">
              محفظتي الموحّدة
            </span>
            <span className="mt-0.5 block text-[12px]" style={{ color: "var(--muted)" }}>
              الرصيد، الإيداع، السحب والإحالة — في البوت الأم
            </span>
          </span>
          <ArrowUpRight size={20} className="shrink-0 text-indigo-200" />
        </motion.button>

        {/* Section label */}
        <div className="mb-3 mt-8 flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--gold)" }} />
          <h2 className="font-orbitron text-[13px] font-bold tracking-wide text-white">
            الخدمات
          </h2>
          <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
            {HUB_BOTS.filter((b) => b.href).length} تطبيقات
          </span>
        </div>

        {/* Bot grid */}
        <div className="flex flex-col gap-3">
          {HUB_BOTS.map((bot, i) => (
            <BotCard key={bot.slug} bot={bot} index={i} />
          ))}
        </div>

        <footer className="mt-10 text-center">
          <p className="font-orbitron text-[11px] tracking-widest" style={{ color: "var(--muted)" }}>
            SOUQRATES SYSTEM
          </p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            منصّة سوقراط — كل الخدمات بمحفظة واحدة
          </p>
        </footer>
      </div>
    </div>
  );
}
