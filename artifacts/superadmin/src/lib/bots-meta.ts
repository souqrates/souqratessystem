// Display metadata for the 7 bots in the SOUQRATES ecosystem.
// `slug` matches the bots table in the database. Bots that haven't been
// seeded yet still appear in the sidebar but their settings page will
// indicate they aren't registered yet.
//
// Canonical brand taxonomy (single source of truth):
//   mother-bot     → SOUQRATES SYSTEM     (البوت الأم — المحفظة الموحدة)
//   games-bot      → SOUQRATES SKILLZ     (الألعاب)
//   books-bot      → SOUQRATES SOUQ       (الكتب والمنتجات الرقمية)
//   sweep-bot      → SOUQRATES SWEEP      (ألعاب الحظ واليانصيب)
//   voice-bot      → SOUQRATES STREAM     (الغرف الصوتية)
//   subagents-bot  → SOUQRATES SUB-AGENTS (برنامج الشركاء / الموزّعين)
//   contests-bot   → SOUQRATES STAGE      (المسابقات والتصويت)
export interface BotMeta {
  slug: string;
  brand: string;
  arName: string;
  color: string;
  icon: string;
}

export const BOTS: BotMeta[] = [
  { slug: "mother-bot",    brand: "SOUQRATES SYSTEM",     arName: "البوت الأم",          color: "#6366f1", icon: "◆" },
  { slug: "games-bot",     brand: "SOUQRATES SKILLZ",     arName: "الألعاب",              color: "#f97316", icon: "▲" },
  { slug: "books-bot",     brand: "SOUQRATES SOUQ",       arName: "الكتب والمنتجات",      color: "#0F766E", icon: "❖" },
  { slug: "sweep-bot",     brand: "SOUQRATES SWEEP",      arName: "ألعاب الحظ",           color: "#f59e0b", icon: "🎰" },
  { slug: "voice-bot",     brand: "SOUQRATES STREAM",     arName: "الغرف الصوتية",        color: "#8b5cf6", icon: "◉" },
  { slug: "subagents-bot", brand: "SOUQRATES SUB-AGENTS", arName: "برنامج الشركاء",       color: "#D4AF37", icon: "♛" },
  { slug: "contests-bot",  brand: "SOUQRATES STAGE",      arName: "المسابقات والتصويت",   color: "#eab308", icon: "★" },
];

export function botMeta(slug: string): BotMeta | undefined {
  return BOTS.find((b) => b.slug === slug);
}
