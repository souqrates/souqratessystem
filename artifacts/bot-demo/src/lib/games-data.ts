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
    id: 'pharaoh',
    nameAr: 'كنز الفراعنة', nameEn: "Pharaoh's Treasure",
    emoji: '𓂀', color1: '#92400e', color2: '#78350f',
    accent: '#f59e0b',
    symbols: ['𓂀', '☥', '◈', '✦'],
    description: 'أسرار الفراعنة الخالدة',
  },
  {
    id: 'diamond',
    nameAr: 'الجوهرة الزرقاء', nameEn: 'Blue Diamond',
    emoji: '💎', color1: '#1e3a8a', color2: '#1e40af',
    accent: '#60a5fa',
    symbols: ['◆', '✦', '◈', '◇'],
    description: 'جواهر نادرة من أعماق الأرض',
  },
  {
    id: 'stars',
    nameAr: 'نجوم الحظ', nameEn: 'Lucky Stars',
    emoji: '⭐', color1: '#78350f', color2: '#92400e',
    accent: '#fbbf24',
    symbols: ['★', '✦', '⭐', '✧'],
    description: 'النجوم تقود طريقك للثروة',
  },
  {
    id: 'dragon',
    nameAr: 'تنين الثروة', nameEn: 'Fortune Dragon',
    emoji: '🐉', color1: '#7f1d1d', color2: '#991b1b',
    accent: '#f87171',
    symbols: ['◈', '✦', '★', '◆'],
    description: 'قوة التنين الأسطورية بيدك',
  },
  {
    id: 'galaxy',
    nameAr: 'مجرة الذهب', nameEn: 'Gold Galaxy',
    emoji: '🚀', color1: '#0c4a6e', color2: '#0e7490',
    accent: '#38bdf8',
    symbols: ['✦', '◉', '★', '◈'],
    description: 'كنوز الكون اللامتناهية',
  },
  {
    id: 'ocean',
    nameAr: 'كنز البحار', nameEn: 'Sea Treasure',
    emoji: '⚓', color1: '#134e4a', color2: '#0f766e',
    accent: '#2dd4bf',
    symbols: ['⚓', '◆', '◈', '✦'],
    description: 'كنوز مخفية في أعماق البحر',
  },
  {
    id: 'ice',
    nameAr: 'الجليد الملكي', nameEn: 'Royal Ice',
    emoji: '❄', color1: '#0f4c75', color2: '#1e40af',
    accent: '#93c5fd',
    symbols: ['❄', '◆', '✦', '◈'],
    description: 'بلورات الجليد الملكية النادرة',
  },
  {
    id: 'fire',
    nameAr: 'نار الحظ', nameEn: 'Fire Luck',
    emoji: '🔥', color1: '#7c2d12', color2: '#9a3412',
    accent: '#fb923c',
    symbols: ['◆', '★', '✦', '◈'],
    description: 'لهيب الحظ يشعل طريقك',
  },
  {
    id: 'moon',
    nameAr: 'سحر القمر', nameEn: 'Moon Magic',
    emoji: '🌙', color1: '#1e1b4b', color2: '#312e81',
    accent: '#c4b5fd',
    symbols: ['☽', '✦', '◈', '★'],
    description: 'سحر القمر يكشف الكنوز',
  },
  {
    id: 'lightning',
    nameAr: 'صاعقة الثروة', nameEn: 'Fortune Lightning',
    emoji: '⚡', color1: '#713f12', color2: '#92400e',
    accent: '#fde047',
    symbols: ['⚡', '★', '◆', '✦'],
    description: 'سرعة الصاعقة تجلب الثروة',
  },
  {
    id: 'lion',
    nameAr: 'الأسد الذهبي', nameEn: 'Golden Lion',
    emoji: '🦁', color1: '#064e3b', color2: '#065f46',
    accent: '#f59e0b',
    symbols: ['◈', '★', '✦', '◆'],
    description: 'ملك الغابة يحرس كنوزه',
  },
  {
    id: 'garden',
    nameAr: 'حديقة الثروة', nameEn: 'Fortune Garden',
    emoji: '🌸', color1: '#052e16', color2: '#14532d',
    accent: '#4ade80',
    symbols: ['✿', '◆', '★', '✦'],
    description: 'ثمار الحظ الناضجة في انتظارك',
  },
  {
    id: 'mask',
    nameAr: 'قناع الليل', nameEn: 'Night Mask',
    emoji: '🎭', color1: '#4a044e', color2: '#701a75',
    accent: '#e879f9',
    symbols: ['◆', '✦', '◈', '★'],
    description: 'ألغاز الليل تخفي ثروات عظيمة',
  },
  {
    id: 'sword',
    nameAr: 'سيف الملوك', nameEn: "Kings' Sword",
    emoji: '⚔', color1: '#0f172a', color2: '#1e293b',
    accent: '#94a3b8',
    symbols: ['⚔', '◈', '✦', '◆'],
    description: 'شجاعة الملوك تفتح أبواب الثروة',
  },
  {
    id: 'butterfly',
    nameAr: 'فراشة الحظ', nameEn: 'Lucky Butterfly',
    emoji: '🦋', color1: '#7c3aed', color2: '#6d28d9',
    accent: '#fb923c',
    symbols: ['✦', '◆', '★', '◈'],
    description: 'خفة الفراشة تحمل بشارة الفوز',
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
