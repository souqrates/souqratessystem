export const MOCK_USER = {
  firstName: "أحمد",
  lastName: "محمد",
  username: "ahmed_m",
  isPremium: true,
  avatarUrl: null,
};

export const MOCK_BALANCES = {
  usdt: 12.50,
  stars: 1200,
  ton: 0.85,
  totalEarnedUsdt: 47.80,
};

export const MOCK_TRANSACTIONS = [
  { id: "1", type: "credit", bot: "الألعاب", botIcon: "🎮", amount: "+2.50", currency: "USDT", date: "اليوم 14:30" },
  { id: "2", type: "credit", bot: "الفيديو", botIcon: "🎬", amount: "+5.00", currency: "USDT", date: "اليوم 10:15" },
  { id: "3", type: "debit", bot: "سحب", botIcon: "📤", amount: "-10.00", currency: "USDT", date: "أمس 18:45" },
  { id: "4", type: "credit", bot: "المتجر", botIcon: "🛒", amount: "+150", currency: "Stars", date: "أمس 09:20" },
];

export const MOCK_REFERRALS = [
  { id: "1", name: "خالد س.", earnings: "1.20 USDT", date: "انضم منذ يومين" },
  { id: "2", name: "سارة م.", earnings: "0.80 USDT", date: "انضمت منذ أسبوع" },
  { id: "3", name: "عمر ف.", earnings: "0.40 USDT", date: "انضم منذ شهر" },
];
