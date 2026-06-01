export type VoucherCategory = 'gaming' | 'apple' | 'google' | 'entertainment' | 'social' | 'other';

export type VoucherBrand = {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  bgGradient: string;
  category: VoucherCategory;
  denominations: number[];
  available: boolean;
  comingSoon?: boolean;
  hot?: boolean;
};

export const VOUCHER_CATEGORY_META: { id: VoucherCategory; nameAr: string; color: string }[] = [
  { id: 'gaming',        nameAr: 'الألعاب',            color: '#22d3ee' },
  { id: 'apple',         nameAr: 'Apple',              color: '#94a3b8' },
  { id: 'google',        nameAr: 'Google',             color: '#34a853' },
  { id: 'entertainment', nameAr: 'الترفيه والموسيقى',  color: '#ec4899' },
  { id: 'social',        nameAr: 'الشبكات الاجتماعية', color: '#f59e0b' },
  { id: 'other',         nameAr: 'بطاقات أخرى',        color: '#a855f7' },
];

export const VOUCHER_BRANDS: VoucherBrand[] = [
  /* ── Gaming ── */
  {
    id: 'psn',
    name: 'PlayStation Network',
    nameAr: 'بلايستيشن',
    color: '#006FCD',
    bgGradient: 'linear-gradient(135deg, #003087 0%, #0050a0 100%)',
    category: 'gaming',
    denominations: [1000, 2500, 5000, 10000],
    available: true,
    hot: true,
  },
  {
    id: 'xbox',
    name: 'Xbox Gift Card',
    nameAr: 'Xbox',
    color: '#107C10',
    bgGradient: 'linear-gradient(135deg, #0a4a0a 0%, #107C10 100%)',
    category: 'gaming',
    denominations: [1000, 2500, 5000],
    available: true,
  },
  {
    id: 'steam',
    name: 'Steam Wallet',
    nameAr: 'Steam',
    color: '#66c0f4',
    bgGradient: 'linear-gradient(135deg, #1b2838 0%, #2a475e 100%)',
    category: 'gaming',
    denominations: [1000, 2500, 5000, 10000],
    available: true,
    hot: true,
  },
  {
    id: 'fortnite',
    name: 'Fortnite V-Bucks',
    nameAr: 'فورتنايت',
    color: '#00b4f0',
    bgGradient: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%)',
    category: 'gaming',
    denominations: [1000, 2800, 5000, 13500],
    available: true,
    hot: true,
  },
  {
    id: 'pubg',
    name: 'PUBG Mobile UC',
    nameAr: 'ببجي موبايل',
    color: '#f2a900',
    bgGradient: 'linear-gradient(135deg, #1a1200 0%, #3d2c00 100%)',
    category: 'gaming',
    denominations: [500, 1500, 4000, 8000],
    available: true,
  },
  {
    id: 'freefire',
    name: 'Free Fire Diamonds',
    nameAr: 'فري فاير',
    color: '#ff6b00',
    bgGradient: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 100%)',
    category: 'gaming',
    denominations: [500, 1200, 3000, 6000],
    available: true,
  },
  {
    id: 'razer-gold',
    name: 'Razer Gold',
    nameAr: 'رازر جولد',
    color: '#44d62c',
    bgGradient: 'linear-gradient(135deg, #0a1a08 0%, #0f2c0d 100%)',
    category: 'gaming',
    denominations: [500, 1500, 3000, 5000],
    available: true,
  },
  /* ── Apple ── */
  {
    id: 'apple-store',
    name: 'Apple App Store',
    nameAr: 'آبل / App Store',
    color: '#94a3b8',
    bgGradient: 'linear-gradient(135deg, #1a1a1f 0%, #282830 100%)',
    category: 'apple',
    denominations: [1500, 3000, 7500, 15000],
    available: true,
    hot: true,
  },
  {
    id: 'itunes',
    name: 'iTunes Gift Card',
    nameAr: 'iTunes',
    color: '#fc3c44',
    bgGradient: 'linear-gradient(135deg, #2a0a0f 0%, #4a1018 100%)',
    category: 'apple',
    denominations: [1500, 3000, 7500],
    available: true,
  },
  /* ── Google ── */
  {
    id: 'google-play',
    name: 'Google Play',
    nameAr: 'Google Play',
    color: '#34a853',
    bgGradient: 'linear-gradient(135deg, #0a2010 0%, #0f3a1a 100%)',
    category: 'google',
    denominations: [1000, 2500, 5000, 10000],
    available: true,
    hot: true,
  },
  {
    id: 'youtube-premium',
    name: 'YouTube Premium',
    nameAr: 'يوتيوب بريميوم',
    color: '#ff0000',
    bgGradient: 'linear-gradient(135deg, #1a0000 0%, #3a0000 100%)',
    category: 'google',
    denominations: [1200, 3600],
    available: true,
  },
  /* ── Entertainment ── */
  {
    id: 'spotify',
    name: 'Spotify Premium',
    nameAr: 'سبوتيفاي',
    color: '#1db954',
    bgGradient: 'linear-gradient(135deg, #0a1a0f 0%, #0f2a18 100%)',
    category: 'entertainment',
    denominations: [1200, 3600],
    available: true,
    hot: true,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    nameAr: 'نتفليكس',
    color: '#e50914',
    bgGradient: 'linear-gradient(135deg, #1a0003 0%, #2d0005 100%)',
    category: 'entertainment',
    denominations: [3000, 6000, 12000],
    available: true,
  },
  {
    id: 'shahid',
    name: 'Shahid VIP',
    nameAr: 'شاهد VIP',
    color: '#e4a82e',
    bgGradient: 'linear-gradient(135deg, #1a1200 0%, #2a1d00 100%)',
    category: 'entertainment',
    denominations: [1500, 4500],
    available: true,
  },
  /* ── Social ── */
  {
    id: 'snapchat',
    name: 'Snapchat+',
    nameAr: 'سناب شات+',
    color: '#fffc00',
    bgGradient: 'linear-gradient(135deg, #1a1a00 0%, #2a2a00 100%)',
    category: 'social',
    denominations: [800, 2400],
    available: true,
  },
  /* ── Other ── */
  {
    id: 'amazon',
    name: 'Amazon Gift Card',
    nameAr: 'أمازون',
    color: '#ff9900',
    bgGradient: 'linear-gradient(135deg, #1a0f00 0%, #2d1a00 100%)',
    category: 'other',
    denominations: [2500, 5000, 10000],
    available: true,
  },
];

export function vouchersByCategory(cat: VoucherCategory): VoucherBrand[] {
  return VOUCHER_BRANDS.filter(v => v.category === cat);
}

export function hotVouchers(): VoucherBrand[] {
  return VOUCHER_BRANDS.filter(v => v.hot && v.available);
}
