export const MOCK_USER = {
  firstName: "Ahmed",
  lastName: "M.",
  username: "ahmed_m",
  isPremium: true,
  avatarUrl: null,
};

export const MOCK_BALANCES = {
  skz: 4780,
  usdt: 12.50,
  stars: 1200,
  ton: 0.85,
  totalEarnedSkz: 12350,
  totalWithdrawnSkz: 7570,
};

// ── XP / Level data ────────────────────────────────────────
export const MOCK_XP = {
  totalXp: 4_820,   // puts user at level 13 "Shark" rank
  streak: 7,        // consecutive daily login days
  weeklyXp: 380,
  achievements: 12,
};

// ── XP History ─────────────────────────────────────────────
export const MOCK_XP_HISTORY: {
  id: string; action: string; xp: number; label: string; icon: string; date: string;
}[] = [
  { id: "x1", action: "games_win",     xp: 40,  label: "Games Win",        icon: "🎮", date: "Today 14:30"         },
  { id: "x2", action: "video_watch",   xp: 10,  label: "Video Watched",    icon: "🎬", date: "Today 12:05"         },
  { id: "x3", action: "daily_login",   xp: 25,  label: "Daily Login",      icon: "📅", date: "Today 08:00"         },
  { id: "x4", action: "deposit",       xp: 50,  label: "Deposit",          icon: "📥", date: "Yesterday 18:45"     },
  { id: "x5", action: "ai_use",        xp: 12,  label: "AI Usage",         icon: "🤖", date: "Yesterday 15:30"     },
  { id: "x6", action: "store_buy",     xp: 45,  label: "Store Purchase",   icon: "🛒", date: "Yesterday 09:20"     },
  { id: "x7", action: "referral",      xp: 150, label: "Referral Joined",  icon: "👥", date: "2 days ago"          },
  { id: "x8", action: "contest_entry", xp: 35,  label: "Contest Entry",    icon: "🏆", date: "2 days ago"          },
  { id: "x9", action: "voice_join",    xp: 20,  label: "Voice Room",       icon: "🎙", date: "3 days ago"          },
  { id:"x10", action: "withdraw",      xp: 30,  label: "Withdrawal",       icon: "📤", date: "3 days ago"          },
];

export const SKZ_RATES = {
  perUsdt: 100,
  perStar: 1,
  perTon: 500,
};

export const MOCK_TRANSACTIONS = [
  { id: "1", type: "credit", bot: "Games",    botIcon: "🎮", amount: "+250",  currency: "SKZ", date: "Today 14:30" },
  { id: "2", type: "credit", bot: "Video",    botIcon: "🎬", amount: "+500",  currency: "SKZ", date: "Today 10:15" },
  { id: "3", type: "debit",  bot: "Withdraw", botIcon: "📤", amount: "-1000", currency: "SKZ", date: "Yesterday 18:45" },
  { id: "4", type: "credit", bot: "Store",    botIcon: "🛒", amount: "+150",  currency: "SKZ", date: "Yesterday 09:20" },
  { id: "5", type: "credit", bot: "Deposit",  botIcon: "📥", amount: "+1250", currency: "SKZ", date: "2 days ago 11:00" },
];

export const MOCK_REFERRALS = [
  { id: "1", name: "Khalid S.", earnings: "120 SKZ", date: "Joined 2 days ago" },
  { id: "2", name: "Sara M.",   earnings: "80 SKZ",  date: "Joined a week ago" },
  { id: "3", name: "Omar F.",   earnings: "40 SKZ",  date: "Joined a month ago" },
];

// ── Achievements ──────────────────────────────────────────
export const MOCK_ACHIEVEMENTS = [
  { id: "a1", icon: "🚀", label: "First Deposit",    desc: "Made your first deposit",        unlocked: true },
  { id: "a2", icon: "🎯", label: "Win Streak x5",    desc: "5 consecutive wins in Games",    unlocked: true },
  { id: "a3", icon: "👥", label: "Influencer",       desc: "Referred 3+ friends",            unlocked: true },
  { id: "a4", icon: "💎", label: "Big Spender",      desc: "Spent 1,000+ SKZ in Store",      unlocked: false },
  { id: "a5", icon: "🔥", label: "Week Streak",      desc: "7-day consecutive daily login",  unlocked: true },
  { id: "a6", icon: "🏆", label: "Contest Victor",   desc: "Win your first contest",         unlocked: false },
];
