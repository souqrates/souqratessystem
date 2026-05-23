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

export const SKZ_RATES = {
  perUsdt: 100,
  perStar: 1,
  perTon: 500,
};

export const MOCK_TRANSACTIONS = [
  { id: "1", type: "credit", bot: "Games",   botIcon: "🎮", amount: "+250",  currency: "SKZ", date: "Today 14:30" },
  { id: "2", type: "credit", bot: "Video",   botIcon: "🎬", amount: "+500",  currency: "SKZ", date: "Today 10:15" },
  { id: "3", type: "debit",  bot: "Withdraw",botIcon: "📤", amount: "-1000", currency: "SKZ", date: "Yesterday 18:45" },
  { id: "4", type: "credit", bot: "Store",   botIcon: "🛒", amount: "+150",  currency: "SKZ", date: "Yesterday 09:20" },
  { id: "5", type: "credit", bot: "Deposit", botIcon: "📥", amount: "+1250", currency: "SKZ", date: "2 days ago 11:00" },
];

export const MOCK_REFERRALS = [
  { id: "1", name: "Khalid S.", earnings: "120 SKZ", date: "Joined 2 days ago" },
  { id: "2", name: "Sara M.",   earnings: "80 SKZ",  date: "Joined a week ago" },
  { id: "3", name: "Omar F.",   earnings: "40 SKZ",  date: "Joined a month ago" },
];
