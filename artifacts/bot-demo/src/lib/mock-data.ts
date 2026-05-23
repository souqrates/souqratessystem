export const MOCK_USER = {
  firstName: "أحمد",
  lastName: "محمد",
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

export const SKZ_RATES = {
  perUsdt: 100,
  perStar: 1,
  perTon: 500,
};

export const MOCK_TRANSACTIONS = [
  { id: "1", type: "credit", bot: "الألعاب", botIcon: "🎮", amount: "+250", currency: "SKZ", date: "اليوم 14:30" },
  { id: "2", type: "credit", bot: "الفيديو", botIcon: "🎬", amount: "+500", currency: "SKZ", date: "اليوم 10:15" },
  { id: "3", type: "debit", bot: "سحب", botIcon: "📤", amount: "-1000", currency: "SKZ", date: "أمس 18:45" },
  { id: "4", type: "credit", bot: "المتجر", botIcon: "🛒", amount: "+150", currency: "SKZ", date: "أمس 09:20" },
  { id: "5", type: "credit", bot: "إيداع", botIcon: "📥", amount: "+1250", currency: "SKZ", date: "منذ يومين 11:00" },
];

export const MOCK_REFERRALS = [
  { id: "1", name: "خالد س.", earnings: "120 SKZ", date: "انضم منذ يومين" },
  { id: "2", name: "سارة م.", earnings: "80 SKZ", date: "انضمت منذ أسبوع" },
  { id: "3", name: "عمر ف.", earnings: "40 SKZ", date: "انضم منذ شهر" },
];
