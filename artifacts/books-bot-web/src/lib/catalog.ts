import type { CategorySlug } from "./constants";

export type Category = {
  slug: CategorySlug;
  name: string;
  desc: string;
  iconKey:
    | "religion"
    | "education"
    | "literature"
    | "kids"
    | "self"
    | "audio";
};

export const CATEGORIES: Category[] = [
  { slug: "religion",         name: "كتب دينية",   desc: "تفسير، حديث، وفقه",          iconKey: "religion"   },
  { slug: "education",        name: "كتب تعليمية", desc: "مناهج وشروحات أكاديمية",     iconKey: "education"  },
  { slug: "literature",       name: "روايات وأدب", desc: "قصص، شعر، ونثر",             iconKey: "literature" },
  { slug: "kids",             name: "كتب الأطفال", desc: "قصص مصوّرة ومنهجية",         iconKey: "kids"       },
  { slug: "self-development", name: "تطوير الذات", desc: "نجاح، إلهام، وأعمال",        iconKey: "self"       },
  { slug: "audio",            name: "كتب صوتية",   desc: "استمع في أي وقت ومكان",     iconKey: "audio"      },
];

export type Book = {
  id: string;
  title: string;
  author: string;
  category: CategorySlug;
  priceSkz: number;
  pages?: number;
  duration?: string;
  year: number;
  excerpt: string;
  rating: number;
  ratingCount: number;
};

export const BOOKS: Book[] = [
  { id: "b001", title: "في ظلال القرآن",         author: "سيد قطب",          category: "religion",         priceSkz: 1200, pages: 412, year: 1956, excerpt: "جولةٌ تأمليّةٌ في معاني القرآن الكريم، تجمع بين البيان الأدبي والفقه الاجتماعي.", rating: 4.9, ratingCount: 1284 },
  { id: "b002", title: "الرحيق المختوم",          author: "صفي الرحمن المباركفوري", category: "religion",   priceSkz: 950,  pages: 568, year: 1976, excerpt: "سيرةٌ نبويةٌ شاملة كُتبت بأسلوبٍ علميٍّ مُحقَّق ونالت الجائزة الأولى في مسابقة عالمية.", rating: 4.8, ratingCount: 982 },
  { id: "b003", title: "أسس الرياضيات الحديثة",  author: "د. أحمد سعيد",     category: "education",        priceSkz: 1500, pages: 320, year: 2022, excerpt: "مرجعٌ منهجيٌّ في الجبر التجريدي والتحليل العقدي للسنوات الأولى في الجامعة.", rating: 4.7, ratingCount: 412 },
  { id: "b004", title: "موسوعة الفيزياء النظرية", author: "أ.د. ليلى منصور",  category: "education",        priceSkz: 1800, pages: 612, year: 2024, excerpt: "أحدث ما توصّلت إليه الفيزياء من نظرياتٍ في النسبية الكمّيّة والكون المبكّر.", rating: 4.9, ratingCount: 305 },
  { id: "b005", title: "موسم الهجرة إلى الشمال", author: "الطيب صالح",       category: "literature",       priceSkz: 800,  pages: 178, year: 1966, excerpt: "روايةٌ كلاسيكيةٌ عن صراع الهويّة بين الشرق والغرب، من روائع الأدب العربي الحديث.", rating: 4.8, ratingCount: 2104 },
  { id: "b006", title: "ديوان المتنبي",           author: "أبو الطيب المتنبي", category: "literature",      priceSkz: 600,  pages: 412, year: 965,  excerpt: "ديوانُ شاعر العربية الأكبر، بشروحاتٍ تاريخيةٍ ولغوية موثَّقة.", rating: 5.0, ratingCount: 3201 },
  { id: "b007", title: "حكايات قبل النوم",        author: "نهى الزين",        category: "kids",             priceSkz: 350,  pages: 96,  year: 2023, excerpt: "خمس عشرة حكايةً قصيرةً تزرع القيم الأخلاقية بأسلوبٍ محبَّب للأطفال.", rating: 4.6, ratingCount: 188 },
  { id: "b008", title: "مغامرات سامي في الغابة", author: "محمد القرني",      category: "kids",             priceSkz: 400,  pages: 120, year: 2024, excerpt: "سلسلةٌ مصوَّرةٌ تنمّي حبّ الاستكشاف وتشجّع على القراءة المبكّرة.", rating: 4.7, ratingCount: 240 },
  { id: "b009", title: "العادات السبع للناجحين",  author: "ستيفن كوفي (مترجَم)", category: "self-development", priceSkz: 1100, pages: 392, year: 1989, excerpt: "كلاسيكيةُ التطوير الذاتي التي باعت ملايين النسخ — بترجمةٍ عربيةٍ مُحرَّرة.", rating: 4.9, ratingCount: 5108 },
  { id: "b010", title: "فنّ اللامبالاة",          author: "مارك مانسون (مترجَم)", category: "self-development", priceSkz: 900, pages: 240, year: 2016, excerpt: "نظرةٌ مختلفةٌ للسعادة تُعلّمك التركيز على ما يستحقّ فعلًا اهتمامك.", rating: 4.6, ratingCount: 4011 },
  { id: "b011", title: "تفسير الجلالين — كتاب صوتي", author: "د. سعد الكفراوي", category: "audio",         priceSkz: 1300, duration: "26 ساعة", year: 2025, excerpt: "تلاوةٌ صوتيةٌ متأنّيةٌ مع شرحٍ موجزٍ لكلِّ آية، بصوتٍ هادئٍ يصلح للسيارة والمشي.", rating: 4.8, ratingCount: 460 },
  { id: "b012", title: "الإلياذة — رواية صوتية",  author: "هوميروس (سرد عربي)", category: "audio",          priceSkz: 1000, duration: "18 ساعة", year: 2024, excerpt: "الملحمة الإغريقية الخالدة بصياغةٍ عربيةٍ سرديةٍ آسرة.", rating: 4.9, ratingCount: 305 },
];

export function booksByCategory(slug: CategorySlug): Book[] {
  return BOOKS.filter((b) => b.category === slug);
}

export function findBook(id: string): Book | undefined {
  return BOOKS.find((b) => b.id === id);
}

export function findCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function searchBooks(q: string): Book[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return BOOKS;
  return BOOKS.filter(
    (b) =>
      b.title.toLowerCase().includes(needle) ||
      b.author.toLowerCase().includes(needle),
  );
}
