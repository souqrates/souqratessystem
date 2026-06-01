export type GameMechanic =
  | 'classic' | 'lucky-lines' | 'your-number' | 'triple-dice' | 'bingo'
  | 'cash-bags' | 'beat-dealer' | 'envelopes' | 'multiplier' | 'poker'
  | 'super-sevens' | 'symbol-match' | 'treasure-hunt' | 'slot' | 'pyramid'
  | 'safe-cracker' | 'gold-rush' | 'fortune-wheel' | 'crystal-match' | 'neon-vault'
  | 'dragon-coins' | 'storm-strike' | 'katana-chain' | 'rune-combo' | 'pirate-map'
  | 'gem-ladder' | 'neon-jackpot' | 'shadow-reveal' | 'time-scratch' | 'volcano-rush';

export interface GameDef {
  id: string;
  nameAr: string;
  nameEn: string;
  iconKey: string;
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
  // ─── Original 15 ───────────────────────────────────────────────
  {
    id: 'pharaoh', mechanic: 'classic',
    nameAr: 'كنز الفراعنة', nameEn: "Pharaoh's Treasure",
    iconKey: 'Crown',
    color1: '#92400e', color2: '#78350f', accent: '#f59e0b',
    symbols: ['𓂀', '☥', '◈', '✦'],
    description: 'أسرار الفراعنة الخالدة',
    mechanicDescAr: 'احك ٣ مناطق — طابق الرموز الثلاثة لتفوز',
    mechanicDescEn: 'Scratch 3 zones — match all 3 symbols to win',
  },
  {
    id: 'diamond', mechanic: 'lucky-lines',
    nameAr: 'الجوهرة الزرقاء', nameEn: 'Lucky Lines',
    iconKey: 'Gem',
    color1: '#1e3a8a', color2: '#1e40af', accent: '#60a5fa',
    symbols: ['◆', '✦', '◈', '◇'],
    description: 'جواهر نادرة من أعماق الأرض',
    mechanicDescAr: 'احك شبكة ٣×٣ — أكمل خطاً كاملاً من الرموز',
    mechanicDescEn: 'Scratch 3×3 grid — complete any line of matching symbols',
  },
  {
    id: 'stars', mechanic: 'your-number',
    nameAr: 'نجوم الحظ', nameEn: 'Your Lucky Number',
    iconKey: 'Star',
    color1: '#78350f', color2: '#92400e', accent: '#fbbf24',
    symbols: ['★', '✦', '✶', '✧'],
    description: 'النجوم تقود طريقك للثروة',
    mechanicDescAr: 'احك رقمك المحظوظ — إذا ظهر في الأرقام الثمانية ربحت',
    mechanicDescEn: 'Scratch your lucky number — match it in 8 prize numbers to win',
  },
  {
    id: 'dragon', mechanic: 'triple-dice',
    nameAr: 'تنين الثروة', nameEn: 'Triple Dice',
    iconKey: 'Swords',
    color1: '#7f1d1d', color2: '#991b1b', accent: '#f87171',
    symbols: ['◈', '✦', '★', '◆'],
    description: 'قوة التنين الأسطورية بيدك',
    mechanicDescAr: 'احك ٣ نرد — التوليفة المثالية تجلب الجائزة الكبرى',
    mechanicDescEn: 'Scratch 3 dice — the perfect combo wins the jackpot',
  },
  {
    id: 'galaxy', mechanic: 'bingo',
    nameAr: 'بينغو المجرة', nameEn: 'Galaxy Bingo',
    iconKey: 'Sparkles',
    color1: '#0c4a6e', color2: '#0e7490', accent: '#38bdf8',
    symbols: ['✦', '◉', '★', '◈'],
    description: 'كنوز الكون اللامتناهية',
    mechanicDescAr: 'احك بطاقتك — أكمل صفاً أو عموداً لتفوز',
    mechanicDescEn: 'Scratch your card — complete a line to win',
  },
  {
    id: 'ocean', mechanic: 'cash-bags',
    nameAr: 'كنز البحار', nameEn: 'Cash Bags',
    iconKey: 'Waves',
    color1: '#134e4a', color2: '#0f766e', accent: '#2dd4bf',
    symbols: ['⚓', '◆', '◈', '✦'],
    description: 'كنوز مخفية في أعماق البحر',
    mechanicDescAr: 'احك ٥ أكياس — اجمع مبالغها للحصول على جائزتك',
    mechanicDescEn: 'Scratch 5 bags — sum their amounts to get your prize',
  },
  {
    id: 'ice', mechanic: 'beat-dealer',
    nameAr: 'تحدي الجليد', nameEn: 'Beat the Dealer',
    iconKey: 'Snowflake',
    color1: '#0f4c75', color2: '#1e40af', accent: '#93c5fd',
    symbols: ['❄', '◆', '✦', '◈'],
    description: 'بلورات الجليد الملكية النادرة',
    mechanicDescAr: 'احك بطاقتك وبطاقة الخصم — الأعلى يفوز',
    mechanicDescEn: 'Scratch your card and dealer\'s — highest wins',
  },
  {
    id: 'fire', mechanic: 'envelopes',
    nameAr: 'الظروف المشتعلة', nameEn: 'Lucky Envelopes',
    iconKey: 'Flame',
    color1: '#7c2d12', color2: '#9a3412', accent: '#fb923c',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'لهيب الحظ يشعل طريقك',
    mechanicDescAr: 'احك ٣ ظروف من ٩ — مجموع ما بداخلها هو جائزتك',
    mechanicDescEn: 'Scratch 3 envelopes from 9 — their sum is your prize',
  },
  {
    id: 'moon', mechanic: 'multiplier',
    nameAr: 'مضاعف القمر', nameEn: 'Multiplier Magic',
    iconKey: 'Moon',
    color1: '#1e1b4b', color2: '#312e81', accent: '#c4b5fd',
    symbols: ['☽', '✦', '◈', '★'],
    description: 'سحر القمر يكشف الكنوز',
    mechanicDescAr: 'احك منطقتين — الجائزة الأساسية × المضاعف = جائزتك',
    mechanicDescEn: 'Scratch 2 zones — base prize × multiplier = your prize',
  },
  {
    id: 'lightning', mechanic: 'poker',
    nameAr: 'بوكر الصاعقة', nameEn: 'Poker Scratch',
    iconKey: 'Zap',
    color1: '#713f12', color2: '#92400e', accent: '#fde047',
    symbols: ['⚡', '★', '◆', '✦'],
    description: 'سرعة الصاعقة تجلب الثروة',
    mechanicDescAr: 'احك ٥ أوراق — أفضل تشكيلة بوكر تفوز',
    mechanicDescEn: 'Scratch 5 cards — best poker hand wins',
  },
  {
    id: 'lion', mechanic: 'super-sevens',
    nameAr: '٧ سوبر ذهبي', nameEn: 'Super Sevens',
    iconKey: 'Shield',
    color1: '#064e3b', color2: '#065f46', accent: '#f59e0b',
    symbols: ['◈', '★', '✦', '◆'],
    description: 'ملك الغابة يحرس كنوزه',
    mechanicDescAr: 'احك ٣ مناطق بالتسلسل — كل ٧ يضاعف جائزتك',
    mechanicDescEn: 'Scratch 3 zones in sequence — each 7 multiplies your prize',
  },
  {
    id: 'garden', mechanic: 'symbol-match',
    nameAr: 'مطابقة الرموز', nameEn: 'Symbol Match',
    iconKey: 'Leaf',
    color1: '#052e16', color2: '#14532d', accent: '#4ade80',
    symbols: ['✿', '◆', '★', '✦'],
    description: 'ثمار الحظ الناضجة في انتظارك',
    mechanicDescAr: 'احك رموزك الثلاثة — ابحث عنها في نافذة الفائزين',
    mechanicDescEn: 'Scratch your 3 symbols — find them in the winning window',
  },
  {
    id: 'mask', mechanic: 'treasure-hunt',
    nameAr: 'صيد الكنز', nameEn: 'Treasure Hunt',
    iconKey: 'Eye',
    color1: '#4a044e', color2: '#701a75', accent: '#e879f9',
    symbols: ['◆', '✦', '◈', '★'],
    description: 'ألغاز الليل تخفي ثروات عظيمة',
    mechanicDescAr: 'احك ٥ مواقع من ٩ — اجمع المسكوكات والجواهر',
    mechanicDescEn: 'Scratch 5 spots from 9 — collect coins and gems',
  },
  {
    id: 'sword', mechanic: 'slot',
    nameAr: 'سلوت الملوك', nameEn: 'Royal Slots',
    iconKey: 'Target',
    color1: '#0f172a', color2: '#1e293b', accent: '#94a3b8',
    symbols: ['⚔', '◈', '✦', '◆'],
    description: 'شجاعة الملوك تفتح أبواب الثروة',
    mechanicDescAr: 'احك ٣ بكرات — التوليفات الرابحة تجلب الجوائز',
    mechanicDescEn: 'Scratch 3 reels — winning combos bring prizes',
  },
  {
    id: 'butterfly', mechanic: 'pyramid',
    nameAr: 'هرم الجوائز', nameEn: 'Prize Pyramid',
    iconKey: 'Layers',
    color1: '#7c3aed', color2: '#6d28d9', accent: '#fb923c',
    symbols: ['✦', '◆', '★', '◈'],
    description: 'خفة الفراشة تحمل بشارة الفوز',
    mechanicDescAr: 'احك طبقات الهرم من الأسفل — كل طبقة تضاعف المكافأة',
    mechanicDescEn: 'Scratch pyramid layers from bottom — each layer multiplies reward',
  },
  // ─── New 15 (scratch-heavy, high-addiction) ─────────────────────
  {
    id: 'safe', mechanic: 'safe-cracker',
    nameAr: 'كاسر الخزنة', nameEn: 'Safe Cracker',
    iconKey: 'Lock',
    color1: '#0f172a', color2: '#1e293b', accent: '#e94560',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'اكسر رمز الخزنة السرية',
    mechanicDescAr: 'احك ٤ أقراص — طابق الرمز السري لكسر الخزنة',
    mechanicDescEn: 'Scratch 4 dials — match the secret code to crack the vault',
  },
  {
    id: 'mine', mechanic: 'gold-rush',
    nameAr: 'حمى الذهب', nameEn: 'Gold Rush',
    iconKey: 'Pickaxe',
    color1: '#422006', color2: '#78350f', accent: '#fcd34d',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'اكشف عروق الذهب المدفونة',
    mechanicDescAr: 'احك ١٦ حجراً — اجمع ٤ ذهبات أو أكثر لتفوز',
    mechanicDescEn: 'Scratch 16 stones — find 4+ gold nuggets to win',
  },
  {
    id: 'wheel', mechanic: 'fortune-wheel',
    nameAr: 'عجلة الحظ', nameEn: 'Fortune Wheel',
    iconKey: 'RotateCcw',
    color1: '#2d1b69', color2: '#4c1d95', accent: '#a78bfa',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'الحظ يدور على عجلة الثروة',
    mechanicDescAr: 'احك ٨ قطاعات — أعلى قيمة مكشوفة هي جائزتك',
    mechanicDescEn: 'Scratch 8 wheel sectors — highest revealed value is your prize',
  },
  {
    id: 'crystal', mechanic: 'crystal-match',
    nameAr: 'تطابق الكريستال', nameEn: 'Crystal Match',
    iconKey: 'Hexagon',
    color1: '#042f2e', color2: '#134e4a', accent: '#2dd4bf',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'بلورات نادرة تحمل أسرار الثروة',
    mechanicDescAr: 'احك ٦ بلورات — اعثر على ٣ بنفس اللون لتفوز',
    mechanicDescEn: 'Scratch 6 crystals — find 3 matching colors to win',
  },
  {
    id: 'neon', mechanic: 'neon-vault',
    nameAr: 'خزنة النيون', nameEn: 'Neon Vault',
    iconKey: 'LayoutGrid',
    color1: '#0f0f1a', color2: '#1a1a3e', accent: '#818cf8',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'أضواء النيون تكشف الثروات الخفية',
    mechanicDescAr: 'احك ٣ لوحات نيون — التوليفات الرابحة تُضيء الخزنة',
    mechanicDescEn: 'Scratch 3 neon panels — winning combos light up the vault',
  },
  {
    id: 'dcoins', mechanic: 'dragon-coins',
    nameAr: 'عملات التنين', nameEn: 'Dragon Coins',
    iconKey: 'Coins',
    color1: '#450a0a', color2: '#7f1d1d', accent: '#fca5a5',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'عملات التنين الذهبية تحت حراسته',
    mechanicDescAr: 'احك ٦ عملات — اجمع قيمها للحصول على جائزتك',
    mechanicDescEn: 'Scratch 6 coins — sum their values for your prize',
  },
  {
    id: 'storm', mechanic: 'storm-strike',
    nameAr: 'ضربة العاصفة', nameEn: 'Storm Strike',
    iconKey: 'CloudLightning',
    color1: '#0a0e1a', color2: '#0f172a', accent: '#38bdf8',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'قوة العاصفة تكسر الظلام',
    mechanicDescAr: 'احك شبكة ٣×٣ — صواعق في خط واحد = جائزة كبرى',
    mechanicDescEn: 'Scratch 3×3 grid — lightning bolts in a line = jackpot',
  },
  {
    id: 'katana', mechanic: 'katana-chain',
    nameAr: 'سلسلة الكاتانا', nameEn: 'Katana Chain',
    iconKey: 'Scissors',
    color1: '#111827', color2: '#1f2937', accent: '#e2e8f0',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'السيف الياباني يقطع طريق الثروة',
    mechanicDescAr: 'احك ٣ أهداف بالتسلسل — كل هدف يضاعف المكافأة',
    mechanicDescEn: 'Scratch 3 targets in sequence — each multiplies the reward',
  },
  {
    id: 'rune', mechanic: 'rune-combo',
    nameAr: 'طلاسم الروني', nameEn: 'Rune Combo',
    iconKey: 'Scan',
    color1: '#052e16', color2: '#064e3b', accent: '#86efac',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'طلاسم قديمة تخفي أسرار الثروة',
    mechanicDescAr: 'احك ٤ أحجار — الزوج المتطابق يفتح الكنز',
    mechanicDescEn: 'Scratch 4 rune stones — matching pair unlocks the treasure',
  },
  {
    id: 'pirate', mechanic: 'pirate-map',
    nameAr: 'خريطة القراصنة', nameEn: 'Pirate Map',
    iconKey: 'Map',
    color1: '#0c2340', color2: '#1e3a5f', accent: '#fbbf24',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'X يحدد المكان — أين الكنز؟',
    mechanicDescAr: 'احك ٩ مناطق — الـ X يعني الكنز الكبير',
    mechanicDescEn: 'Scratch 9 map zones — X marks the big treasure',
  },
  {
    id: 'ladder', mechanic: 'gem-ladder',
    nameAr: 'سلم الجواهر', nameEn: 'Gem Ladder',
    iconKey: 'TrendingUp',
    color1: '#022c22', color2: '#064e3b', accent: '#6ee7b7',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'كل درجة تُقربك من القمة',
    mechanicDescAr: 'احك ٥ درجات من الأسفل — كل درجة ترفع جائزتك',
    mechanicDescEn: 'Scratch 5 rungs from bottom — each step raises your prize',
  },
  {
    id: 'jackpot', mechanic: 'neon-jackpot',
    nameAr: 'جاكبوت النيون', nameEn: 'Neon Jackpot',
    iconKey: 'Cpu',
    color1: '#3b0764', color2: '#4a044e', accent: '#f0abfc',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'أضواء الجاكبوت تعشق الفائزين',
    mechanicDescAr: 'احك ٥ لوحات — طابق ٣ رموز أو أكثر للجاكبوت',
    mechanicDescEn: 'Scratch 5 panels — match 3+ symbols for jackpot',
  },
  {
    id: 'shadow', mechanic: 'shadow-reveal',
    nameAr: 'كشف الظلام', nameEn: 'Shadow Reveal',
    iconKey: 'EyeOff',
    color1: '#030712', color2: '#0f172a', accent: '#c026d3',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'خلف الظلام تختبئ أعظم الكنوز',
    mechanicDescAr: 'احك ٤ بوابات بالترتيب — الترتيب الصحيح يفتح الكنز',
    mechanicDescEn: 'Scratch 4 portals in order — correct sequence unlocks treasure',
  },
  {
    id: 'clock', mechanic: 'time-scratch',
    nameAr: 'خدش الوقت', nameEn: 'Time Scratch',
    iconKey: 'Clock',
    color1: '#0c0a09', color2: '#1c1917', accent: '#fdba74',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'الوقت المناسب يجلب الحظ الكبير',
    mechanicDescAr: 'احك ٦ قطاعات — مجموع الساعات المحظوظة = مضاعفك',
    mechanicDescEn: 'Scratch 6 clock sectors — sum of lucky hours = your multiplier',
  },
  {
    id: 'volcano', mechanic: 'volcano-rush',
    nameAr: 'اندفاع البركان', nameEn: 'Volcano Rush',
    iconKey: 'Mountain',
    color1: '#450a0a', color2: '#771d1d', accent: '#f97316',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'الحمم تخفي ذهباً لمن يجرؤ',
    mechanicDescAr: 'احك ٦ شقوق — كل ذهبة تضاعف ما قبلها',
    mechanicDescEn: 'Scratch 6 cracks — each gold found multiplies the previous',
  },
];

export const TIERS: TierDef[] = [
  {
    id: 't1', label: 'برونزي', icon: '◈', cost: 1, maxPrize: 10,
    prizes: [0, 2, 3, 5, 10],
    weights: [0.55, 0.22, 0.12, 0.08, 0.03],
  },
  {
    id: 't2', label: 'فضي', icon: '◆', cost: 5, maxPrize: 50,
    prizes: [0, 8, 15, 25, 50],
    weights: [0.53, 0.23, 0.12, 0.08, 0.04],
  },
  {
    id: 't3', label: 'ذهبي', icon: '★', cost: 20, maxPrize: 200,
    prizes: [0, 35, 80, 140, 200],
    weights: [0.50, 0.25, 0.13, 0.08, 0.04],
  },
  {
    id: 't4', label: 'ملكي', icon: '✦', cost: 100, maxPrize: 1000,
    prizes: [0, 175, 400, 700, 1000],
    weights: [0.48, 0.26, 0.14, 0.08, 0.04],
  },
  {
    id: 't5', label: 'ماسي', icon: '◉', cost: 500, maxPrize: 5000,
    prizes: [0, 900, 2000, 3500, 5000],
    weights: [0.45, 0.28, 0.14, 0.09, 0.04],
  },
];
