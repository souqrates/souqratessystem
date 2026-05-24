// Display metadata for the 7 bots managed from the super-admin panel.
// `slug` matches the bots table in the database. Bots that haven't been
// seeded yet (e.g. souqrates stage) still appear in the sidebar but their
// settings page will indicate they aren't registered yet.
export interface BotMeta {
  slug: string;
  brand: string;
  arName: string;
  color: string;
  icon: string;
}

export const BOTS: BotMeta[] = [
  { slug: "mother-bot", brand: "souqrates system", arName: "البوت الأم", color: "#6366f1", icon: "👑" },
  { slug: "games-bot", brand: "souqrates skillz", arName: "بوت الألعاب", color: "#f97316", icon: "🎮" },
  { slug: "video-bot", brand: "souqrates stream", arName: "بوت الفيديو", color: "#ec4899", icon: "🎬" },
  { slug: "store-bot", brand: "souqrates store", arName: "المتجر الرقمي", color: "#10b981", icon: "🛍️" },
  { slug: "voice-bot", brand: "souqrates scene", arName: "الغرف الصوتية", color: "#8b5cf6", icon: "🎙️" },
  { slug: "ai-bot", brand: "souqrates signal", arName: "بوت الذكاء", color: "#06b6d4", icon: "🤖" },
  { slug: "contests-bot", brand: "souqrates stage", arName: "بوت المسابقات", color: "#eab308", icon: "🏆" },
];

export function botMeta(slug: string): BotMeta | undefined {
  return BOTS.find((b) => b.slug === slug);
}
