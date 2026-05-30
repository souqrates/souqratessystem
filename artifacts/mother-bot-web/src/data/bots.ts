export interface HubBot {
  slug: string;
  brand: string;
  arName: string;
  desc: string;
  color: string;
  icon: string;
  /** absolute production path of the Mini App, or null if external/coming-soon */
  href: string | null;
  /** Telegram deep-link fallback (t.me/...) */
  telegram?: string;
  badge?: string;
}

export const HUB_BOTS: HubBot[] = [
  {
    slug: "games-bot",
    brand: "SOUQRATES SKILLZ",
    arName: "الألعاب",
    desc: "ألعاب مهارة وتحديات تربح بها رصيد SKZ",
    color: "#f97316",
    icon: "▲",
    href: "/games-bot/",
  },
  {
    slug: "sweep-bot",
    brand: "SOUQRATES SWEEP",
    arName: "ألعاب الحظ واليانصيب",
    desc: "كروت الحك واللوتو الأسبوعي بجوائز ضخمة",
    color: "#f59e0b",
    icon: "🎰",
    href: "/sweep-bot-web/",
  },
  {
    slug: "books-bot",
    brand: "SOUQRATES SOUQ",
    arName: "الكتب والمنتجات الرقمية",
    desc: "سوق الكتب والمنتجات الرقمية بالدفع من محفظتك",
    color: "#0F766E",
    icon: "❖",
    href: "/books-bot-web/",
  },
  {
    slug: "contests-bot",
    brand: "SOUQRATES STAGE",
    arName: "المسابقات والتصويت",
    desc: "مسرح المسابقات والتصويت والجوائز",
    color: "#eab308",
    icon: "★",
    href: "/contests-bot-web/",
  },
  {
    slug: "subagents-bot",
    brand: "SOUQRATES SUB-AGENTS",
    arName: "برنامج الشركاء",
    desc: "كن موزّعاً معتمداً وابِع SKZ لعملائك بعمولة",
    color: "#D4AF37",
    icon: "♛",
    href: "/subagents-bot-web/",
  },
  {
    slug: "voice-bot",
    brand: "SOUQRATES STREAM",
    arName: "الغرف الصوتية",
    desc: "غرف صوتية مباشرة — قريباً",
    color: "#8b5cf6",
    icon: "◉",
    href: null,
    badge: "قريباً",
  },
];
