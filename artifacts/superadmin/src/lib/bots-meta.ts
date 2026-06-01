// Display metadata for the 8 bots in the SOUQRATES ecosystem.
// `slug` matches the bots table in the database. Bots that haven't been
// seeded yet still appear in the sidebar but their settings page will
// indicate they aren't registered yet.
//
// Canonical brand taxonomy (single source of truth):
//   mother-bot     → SOUQRATES SYSTEM     (البوت الأم — المحفظة الموحدة)
//   games-bot      → SOUQRATES SKILLZ     (الألعاب)
//   books-bot      → SOUQRATES SOUQ       (الكتب والمنتجات الرقمية)
//   video-bot      → SOUQRATES SCENE      (الفيديوهات)
//   voice-bot      → SOUQRATES STREAM     (الغرف الصوتية)
//   subagents-bot  → SOUQRATES SUB-AGENTS (برنامج الشركاء / الموزّعين)
//   contests-bot   → SOUQRATES STAGE      (المسابقات والتصويت)
//   scratchy-bot   → SOUQRATES SCRATCHY   (ألعاب الحظ والحك واربح)
export interface BotMeta {
  slug: string;
  brand: string;
  arName: string;
  color: string;
}

export const BOTS: BotMeta[] = [
  { slug: "mother-bot",    brand: "SOUQRATES SYSTEM",     arName: "البوت الأم",          color: "#6366f1" },
  { slug: "games-bot",     brand: "SOUQRATES SKILLZ",     arName: "الألعاب",              color: "#f97316" },
  { slug: "books-bot",     brand: "SOUQRATES SOUQ",       arName: "الكتب والمنتجات",      color: "#0F766E" },
  { slug: "video-bot",     brand: "SOUQRATES SCENE",      arName: "الفيديوهات",           color: "#ec4899" },
  { slug: "voice-bot",     brand: "SOUQRATES STREAM",     arName: "الغرف الصوتية",        color: "#8b5cf6" },
  { slug: "subagents-bot", brand: "SOUQRATES SUB-AGENTS", arName: "برنامج الشركاء",       color: "#D4AF37" },
  { slug: "contests-bot",  brand: "SOUQRATES STAGE",      arName: "المسابقات والتصويت",   color: "#eab308" },
  { slug: "scratchy-bot",  brand: "SOUQRATES SCRATCHY",   arName: "الحك واربح",            color: "#22c55e" },
];

export function botMeta(slug: string): BotMeta | undefined {
  return BOTS.find((b) => b.slug === slug);
}
