export type GameMechanic =
  | 'classic' | 'lucky-lines' | 'your-number' | 'triple-dice' | 'bingo'
  | 'cash-bags' | 'beat-dealer' | 'envelopes' | 'multiplier' | 'poker'
  | 'super-sevens' | 'symbol-match' | 'treasure-hunt' | 'slot' | 'pyramid';

export interface GameDef {
  id: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  color1: string;
  color2: string;
  accent: string;
  symbols: [string, string, string, string];
  description: string;
  mechanic: GameMechanic;
  mechanicDescAr: string;
  mechanicDescEn: string;
}

export interface TierDef {
  id: string;
  cost: number;
  maxPrize: number;
  label: string;
  icon: string;
  prizes: number[];
  weights: number[];
}

export const GAMES: GameDef[] = [
  {
    id: 'pharaoh', mechanic: 'classic',
    nameAr: 'كنز الفراعنة', nameEn: "Pharaoh's Treasure",
    emoji: '𓂀', color1: '#92400e', color2: '#78350f', accent: '#f59e0b',
    symbols: ['𓂀', '☥', '◈', '✦'],
    description: 'أسرار الفراعنة الخالدة',
    mechanicDescAr: 'احك ٣ مناطق — طابق الرموز الثلاثة لتفوز',
    mechanicDescEn: 'Scratch 3 zones — match all 3 symbols to win',
  },
  {
    id: 'diamond', mechanic: 'lucky-lines',
    nameAr: 'الجوهرة الزرقاء', nameEn: 'Lucky Lines',
    emoji: '💎', color1: '#1e3a8a', color2: '#1e40af', accent: '#60a5fa',
    symbols: ['◆', '✦', '◈', '◇'],
    description: 'جواهر نادرة من أعماق الأرض',
    mechanicDescAr: 'اكشف شبكة ٣×٣ — أكمل خطاً كاملاً من الرموز',
    mechanicDescEn: 'Reveal 3×3 grid — complete any line of matching symbols',
  },
  {
    id: 'stars', mechanic: 'your-number',
    nameAr: 'نجوم الحظ', nameEn: 'Your Lucky Number',
    emoji: '⭐', color1: '#78350f', color2: '#92400e', accent: '#fbbf24',
    symbols: ['★', '✦', '⭐', '✧'],
    description: 'النجوم تقود طريقك للثروة',
    mechanicDescAr: 'احك رقمك المحظوظ — إذا ظهر في الأرقام الثمانية ربحت',
    mechanicDescEn: 'Scratch your lucky number — match it in 8 prize numbers to win',
  },
  {
    id: 'dragon', mechanic: 'triple-dice',
    nameAr: 'تنين الثروة', nameEn: 'Triple Dice',
    emoji: '🐉', color1: '#7f1d1d', color2: '#991b1b', accent: '#f87171',
    symbols: ['◈', '✦', '★', '◆'],
    description: 'قوة التنين الأسطورية بيدك',
    mechanicDescAr: 'دحرج ٣ نرد — التوليفة المثالية تجلب الجائزة الكبرى',
    mechanicDescEn: 'Roll 3 dice — the perfect combo wins the jackpot',
  },
  {
    id: 'galaxy', mechanic: 'bingo',
    nameAr: 'بينغو المجرة', nameEn: 'Galaxy Bingo',
    emoji: '🚀', color1: '#0c4a6e', color2: '#0e7490', accent: '#38bdf8',
    symbols: ['✦', '◉', '★', '◈'],
    description: 'كنوز الكون اللامتناهية',
    mechanicDescAr: 'ضع علامة على الأرقام المسحوبة — أكمل صفاً أو عموداً لتفوز',
    mechanicDescEn: 'Mark drawn numbers on your card — complete a line to win',
  },
  {
    id: 'ocean', mechanic: 'cash-bags',
    nameAr: 'كنز البحار', nameEn: 'Cash Bags',
    emoji: '⚓', color1: '#134e4a', color2: '#0f766e', accent: '#2dd4bf',
    symbols: ['⚓', '◆', '◈', '✦'],
    description: 'كنوز مخفية في أعماق البحر',
    mechanicDescAr: 'اكشف ٥ صناديق — اجمع مبالغها للحصول على جائزتك',
    mechanicDescEn: 'Reveal 5 chests — sum their amounts to get your prize',
  },
  {
    id: 'ice', mechanic: 'beat-dealer',
    nameAr: 'تحدي الجليد', nameEn: 'Beat the Dealer',
    emoji: '❄', color1: '#0f4c75', color2: '#1e40af', accent: '#93c5fd',
    symbols: ['❄', '◆', '✦', '◈'],
    description: 'بلورات الجليد الملكية النادرة',
    mechanicDescAr: 'احك بطاقتك وبطاقة الخصم — الأعلى يفوز',
    mechanicDescEn: 'Scratch your card and dealer\'s card — highest card wins',
  },
  {
    id: 'fire', mechanic: 'envelopes',
    nameAr: 'الظروف المشتعلة', nameEn: 'Lucky Envelopes',
    emoji: '🔥', color1: '#7c2d12', color2: '#9a3412', accent: '#fb923c',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'لهيب الحظ يشعل طريقك',
    mechanicDescAr: 'اختر ٣ ظروف من ٩ — مجموع ما بداخلها هو جائزتك',
    mechanicDescEn: 'Pick 3 envelopes from 9 — their sum is your prize',
  },
  {
    id: 'moon', mechanic: 'multiplier',
    nameAr: 'مضاعف القمر', nameEn: 'Multiplier Magic',
    emoji: '🌙', color1: '#1e1b4b', color2: '#312e81', accent: '#c4b5fd',
    symbols: ['☽', '✦', '◈', '★'],
    description: 'سحر القمر يكشف الكنوز',
    mechanicDescAr: 'احك منطقتين — الجائزة الأساسية × المضاعف = جائزتك',
    mechanicDescEn: 'Scratch 2 zones — base prize × multiplier = your prize',
  },
  {
    id: 'lightning', mechanic: 'poker',
    nameAr: 'بوكر الصاعقة', nameEn: 'Poker Scratch',
    emoji: '⚡', color1: '#713f12', color2: '#92400e', accent: '#fde047',
    symbols: ['⚡', '★', '◆', '✦'],
    description: 'سرعة الصاعقة تجلب الثروة',
    mechanicDescAr: 'اكشف ٥ ورقات — أفضل تشكيلة بوكر تفوز',
    mechanicDescEn: 'Reveal 5 cards — best poker hand wins',
  },
  {
    id: 'lion', mechanic: 'super-sevens',
    nameAr: '٧ سوبر ذهبي', nameEn: 'Super Sevens',
    emoji: '🦁', color1: '#064e3b', color2: '#065f46', accent: '#f59e0b',
    symbols: ['◈', '★', '✦', '◆'],
    description: 'ملك الغابة يحرس كنوزه',
    mechanicDescAr: 'احك ٣ مناطق بالتسلسل — كل ٧ يضاعف جائزتك',
    mechanicDescEn: 'Scratch 3 zones in sequence — each 7 multiplies your prize',
  },
  {
    id: 'garden', mechanic: 'symbol-match',
    nameAr: 'مطابقة الرموز', nameEn: 'Symbol Match',
    emoji: '🌸', color1: '#052e16', color2: '#14532d', accent: '#4ade80',
    symbols: ['✿', '◆', '★', '✦'],
    description: 'ثمار الحظ الناضجة في انتظارك',
    mechanicDescAr: 'احك رموزك الثلاثة — ابحث عنها في نافذة الفائزين',
    mechanicDescEn: 'Scratch your 3 symbols — find them in the winning window',
  },
  {
    id: 'mask', mechanic: 'treasure-hunt',
    nameAr: 'صيد الكنز', nameEn: 'Treasure Hunt',
    emoji: '🎭', color1: '#4a044e', color2: '#701a75', accent: '#e879f9',
    symbols: ['◆', '✦', '◈', '★'],
    description: 'ألغاز الليل تخفي ثروات عظيمة',
    mechanicDescAr: 'احفر ٥ مواقع من ٩ — اجمع المسكوكات والجواهر',
    mechanicDescEn: 'Dig 5 spots from 9 — collect coins and gems',
  },
  {
    id: 'sword', mechanic: 'slot',
    nameAr: 'سلوت الملوك', nameEn: 'Royal Slots',
    emoji: '⚔', color1: '#0f172a', color2: '#1e293b', accent: '#94a3b8',
    symbols: ['⚔', '◈', '✦', '◆'],
    description: 'شجاعة الملوك تفتح أبواب الثروة',
    mechanicDescAr: 'احك ٣ بكرات — التوليفات الرابحة تجلب الجوائز',
    mechanicDescEn: 'Scratch 3 reels — winning combos bring prizes',
  },
  {
    id: 'butterfly', mechanic: 'pyramid',
    nameAr: 'هرم الجوائز', nameEn: 'Prize Pyramid',
    emoji: '🦋', color1: '#7c3aed', color2: '#6d28d9', accent: '#fb923c',
    symbols: ['✦', '◆', '★', '◈'],
    description: 'خفة الفراشة تحمل بشارة الفوز',
    mechanicDescAr: 'اكشف طبقات الهرم من الأسفل — كل طبقة تضاعف المكافأة',
    mechanicDescEn: 'Reveal pyramid layers from bottom — each layer multiplies reward',
  },
];

export const TIERS: TierDef[] = [
  {
    id: 't1', label: 'برونزي', icon: '🪙', cost: 1, maxPrize: 10,
    prizes: [0, 2, 3, 5, 10],
    weights: [0.55, 0.22, 0.12, 0.08, 0.03],
  },
  {
    id: 't2', label: 'فضي', icon: '💰', cost: 5, maxPrize: 50,
    prizes: [0, 8, 15, 25, 50],
    weights: [0.53, 0.23, 0.12, 0.08, 0.04],
  },
  {
    id: 't3', label: 'ذهبي', icon: '🏅', cost: 20, maxPrize: 200,
    prizes: [0, 35, 80, 140, 200],
    weights: [0.50, 0.25, 0.13, 0.08, 0.04],
  },
  {
    id: 't4', label: 'ملكي', icon: '👑', cost: 100, maxPrize: 1000,
    prizes: [0, 175, 400, 700, 1000],
    weights: [0.48, 0.26, 0.14, 0.08, 0.04],
  },
  {
    id: 't5', label: 'ماسي', icon: '💎', cost: 500, maxPrize: 5000,
    prizes: [0, 900, 2000, 3500, 5000],
    weights: [0.45, 0.28, 0.14, 0.09, 0.04],
  },
];
