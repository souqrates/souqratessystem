/**
 * Bilingual (ar/en) i18n for SOUQRATES SOUQ Mini App.
 *
 * Usage:
 *   const t = useT();
 *   <h1>{t("home.heroTitle")}</h1>
 *
 * Language is stored in localStorage and synced to <html dir/lang>. Changes
 * trigger a custom event so all useT() subscribers re-render.
 */
import { useEffect, useState } from "react";

export type Lang = "ar" | "en";
const LANGS: readonly Lang[] = ["ar", "en"] as const;
const DEFAULT_LANG: Lang = "ar";
const STORAGE_KEY = "souqrates:lang";
const EVENT = "souqrates:lang-change";

const TR: Record<string, Record<Lang, string>> = {
  "langToggle.aria":  { ar: "تبديل اللغة",           en: "Toggle language" },
  "langToggle.title": { ar: "التبديل إلى الإنجليزية", en: "Switch to Arabic" },
  // ── Splash / chrome ───────────────────────────────────────────────
  app_name:           { ar: "SOUQRATES SOUQ",                en: "SOUQRATES SOUQ" },
  app_tagline:        { ar: "كتب ومنتجات رقمية",              en: "Books & digital products" },
  "splash.tagline":   { ar: "digital books · est. 2026",     en: "digital books · est. 2026" },
  "splash.loading":   { ar: "LOADING",                       en: "LOADING" },
  "splash.aria":      { ar: "Loading SOUQRATES SOUQ",        en: "Loading SOUQRATES SOUQ" },
  "splash.progressAria": { ar: "Loading progress",           en: "Loading progress" },

  // ── Header / nav ──────────────────────────────────────────────────
  nav_home:           { ar: "الرئيسية",                       en: "Home" },
  nav_library:        { ar: "المكتبة",                        en: "Library" },
  nav_publish:        { ar: "انشر معنا",                      en: "Publish with us" },
  "header.openInTelegram": { ar: "افتح في تيليغرام",          en: "Open in Telegram" },
  "header.eyebrow":   { ar: "digital books · est. 2026",     en: "digital books · est. 2026" },

  // ── Footer ────────────────────────────────────────────────────────
  "footer.chapter":   { ar: "a chapter of SOUQRATES SYSTEM", en: "a chapter of SOUQRATES SYSTEM" },
  "footer.ecosystem": { ar: "The SOUQRATES Ecosystem",       en: "The SOUQRATES Ecosystem" },
  "footer.ecosystemList": { ar: "SYSTEM · SKILLZ · SOUQ · SCENE · STREAM · SIGNAL · STAGE", en: "SYSTEM · SKILLZ · SOUQ · SCENE · STREAM · SIGNAL · STAGE" },
  "footer.rights":    { ar: "— جميع الحقوق محفوظة.",          en: "— All rights reserved." },
  "footer.crafted":   { ar: "crafted with precision",        en: "crafted with precision" },

  // ── Common ────────────────────────────────────────────────────────
  loading:            { ar: "جاري التحميل…",                  en: "Loading…" },
  "common.loadingLong":{ ar: "جارٍ التحميل…",                 en: "Loading…" },
  error_generic:      { ar: "حدث خطأ، حاول مجدداً.",          en: "Something went wrong, please try again." },
  back:               { ar: "← رجوع",                         en: "← Back" },

  // ── Lang toggle ───────────────────────────────────────────────────
  lang_label:         { ar: "EN",                            en: "ع" },

  // ── Home: hero ────────────────────────────────────────────────────
  "home.volume":      { ar: "Volume I",                      en: "Volume I" },
  "home.volumeAr":    { ar: "· المجلَّد الأوّل",                en: "· Volume One" },
  "home.heroTitleL1": { ar: "مكتبةٌ كاملة",                   en: "An entire library" },
  "home.heroTitleL2": { ar: "in your pocket.",               en: "in your pocket." },
  "home.heroLead":    { ar: "اقتنِ، اقرأ، وانشر آلاف الإصدارات الرقمية مباشرةً عبر تيليغرام — مدفوعةً بمحفظة {skz} الموحَّدة، ومحميَّةً بتوقيع تحميل فريد لكلِّ نسخة.", en: "Buy, read, and publish thousands of digital titles right inside Telegram — paid with your unified {skz} wallet, and secured by a unique download signature for every copy." },
  "home.enterLibrary":{ ar: "ادخل المكتبة",                    en: "Enter the library" },
  "home.browseCategories":{ ar: "تصفَّح الفئات",               en: "Browse categories" },

  // ── Home: categories ─────────────────────────────────────────────
  "home.categoriesEyebrow":{ ar: "The Collection",           en: "The Collection" },
  "home.categoriesTitle":  { ar: "ست فئاتٍ. مكتبةٌ واحدة.",   en: "Six chapters. One library." },
  "home.categoriesLead":   { ar: "اختر اهتمامك، وابدأ القراءة في الحال.", en: "Pick your interest and start reading right away." },

  // ── Home: features ───────────────────────────────────────────────
  "home.featuresEyebrow":  { ar: "The Promise",              en: "The Promise" },
  "home.featuresTitleA":   { ar: "لماذا",                     en: "Why" },
  "home.featuresTitleB":   { ar: "؟",                         en: "?" },
  "home.feat1Title":       { ar: "محفظة موحّدة",             en: "One unified wallet" },
  "home.feat1Desc":        { ar: "ادفع بـ {skz} من محفظتك في {system} — بلا بطاقات، بلا تحويلات.", en: "Pay in {skz} from your {system} wallet — no cards, no transfers." },
  "home.feat2Title":       { ar: "تسليم لحظي",                en: "Instant delivery" },
  "home.feat2Desc":        { ar: "روابط آمنة مُوقَّعة بـ {hmac}، صالحة لمدّة سبعة أيام بعد الشراء.", en: "Secure {hmac}-signed links, valid for seven days after purchase." },
  "home.feat3Title":       { ar: "حقوق النشر محفوظة",        en: "Authors' rights protected" },
  "home.feat3Desc":        { ar: "كل عملية موثَّقة على السلسلة المالية، والمؤلِّف يستلم نصيبه تلقائيًا.", en: "Every sale is logged on the financial ledger, and the author receives their share automatically." },
  "home.feat4Title":       { ar: "للمكتبة العربية",           en: "Built for Arabic readers" },
  "home.feat4Desc":        { ar: "ست فئات منتقاة تغطّي اهتمام القارئ العربي المعاصر.", en: "Six curated chapters covering what today's Arabic reader cares about." },

  // ── Home: ritual / steps ─────────────────────────────────────────
  "home.ritualEyebrow":    { ar: "The Ritual",               en: "The Ritual" },
  "home.ritualTitle":      { ar: "أربعُ خطواتٍ بسيطة.",       en: "Four simple steps." },
  "home.step1Title":       { ar: "افتح البوت",                en: "Open the bot" },
  "home.step1Desc":        { ar: "ابدأ {start} في {souq} عبر تيليغرام.", en: "Send {start} to {souq} on Telegram." },
  "home.step2Title":       { ar: "اختر إصدارًا",              en: "Pick a title" },
  "home.step2Desc":        { ar: "تصفّح حسب الفئة، أو ابحث بعنوان أو مؤلِّف.", en: "Browse by chapter, or search by title or author." },
  "home.step3Title":       { ar: "ادفع بـ {skz}",             en: "Pay in {skz}" },
  "home.step3Desc":        { ar: "خصم لحظي من محفظتك الموحّدة، بلا وسطاء.", en: "Instant debit from your unified wallet — no middlemen." },
  "home.step4Title":       { ar: "حمِّل واقرأ",                en: "Download & read" },
  "home.step4Desc":        { ar: "رابط مُؤمَّن صالح سبعة أيام — لك وحدك.", en: "A secured link, valid for seven days — yours alone." },

  // ── Home: publish CTA ────────────────────────────────────────────
  "home.publishEyebrow":   { ar: "For Authors & Publishers", en: "For Authors & Publishers" },
  "home.publishTitle":     { ar: "أنشر إبداعك. واستلم أرباحك.", en: "Publish your work. Earn your share." },
  "home.publishLead":      { ar: "ارفع كتبك مباشرةً من البوت، حدِّد سعرك بـ {skz}، واستلم نصيبك تلقائيًا في محفظتك بعد خصم العمولة الموثَّقة.", en: "Upload your books straight from the bot, set your price in {skz}, and receive your share automatically after the documented commission." },
  "home.publishCta":       { ar: "ابدأ النشر اليوم",          en: "Start publishing today" },
  "home.publishDetails":   { ar: "التفاصيل والشروط",          en: "Details & terms" },

  // ── Categories (catalog) ─────────────────────────────────────────
  "cat.religion.name":         { ar: "كتب دينية",   en: "Religion" },
  "cat.religion.desc":         { ar: "تفسير، حديث، وفقه",  en: "Tafsir, hadith and fiqh" },
  "cat.education.name":        { ar: "كتب تعليمية", en: "Education" },
  "cat.education.desc":        { ar: "مناهج وشروحات أكاديمية", en: "Academic curricula and study guides" },
  "cat.literature.name":       { ar: "روايات وأدب", en: "Fiction & Literature" },
  "cat.literature.desc":       { ar: "قصص، شعر، ونثر", en: "Stories, poetry and prose" },
  "cat.kids.name":             { ar: "كتب الأطفال", en: "Kids" },
  "cat.kids.desc":             { ar: "قصص مصوّرة ومنهجية", en: "Picture stories and learning books" },
  "cat.self-development.name": { ar: "تطوير الذات", en: "Self-development" },
  "cat.self-development.desc": { ar: "نجاح، إلهام، وأعمال", en: "Success, inspiration and business" },
  "cat.audio.name":            { ar: "كتب صوتية",   en: "Audiobooks" },
  "cat.audio.desc":            { ar: "استمع في أي وقت ومكان", en: "Listen anytime, anywhere" },

  // ── Library ──────────────────────────────────────────────────────
  "library.eyebrow":     { ar: "The Library",                 en: "The Library" },
  "library.title":       { ar: "تصفَّح المكتبة كاملةً.",        en: "Browse the entire library." },
  "library.searchPh":    { ar: "ابحث بعنوان أو مؤلِّف…",       en: "Search by title or author…" },
  "library.clear":       { ar: "مسح",                         en: "Clear" },
  "library.all":         { ar: "الكلّ",                        en: "All" },
  "library.titleOne":    { ar: "Title",                       en: "Title" },
  "library.titleMany":   { ar: "Titles",                      en: "Titles" },
  "library.allCats":     { ar: "كل الفئات",                    en: "All chapters" },
  "library.loadingEy":   { ar: "Loading…",                    en: "Loading…" },
  "library.loadingMsg":  { ar: "جارٍ تحميل المكتبة…",          en: "Loading the library…" },
  "library.nothingEy":   { ar: "Nothing found",               en: "Nothing found" },
  "library.nothingMsg":  { ar: "لم نعثر على نتائج. جرّب كلمةً أخرى أو فئةً مختلفة.", en: "No results. Try a different keyword or chapter." },
  "library.resetFilters":{ ar: "أعد ضبط الفلاتر",              en: "Reset filters" },
  "library.backHome":    { ar: "← العودة إلى الواجهة",         en: "← Back to home" },

  // ── Category page ────────────────────────────────────────────────
  "category.chapter":    { ar: "Chapter",                     en: "Chapter" },
  "category.empty":      { ar: "لا توجد عناوين في هذه الفئة بعد. عد قريبًا.", en: "No titles in this chapter yet. Check back soon." },
  "category.allLibrary": { ar: "← كل المكتبة",                en: "← Full library" },
  "category.home":       { ar: "الواجهة",                     en: "Home" },

  // ── Book / ProductDetail ─────────────────────────────────────────
  "book.bcHome":         { ar: "الواجهة",                     en: "Home" },
  "book.bcLibrary":      { ar: "المكتبة",                     en: "Library" },
  "book.coverVol":       { ar: "Vol. {year}",                  en: "Vol. {year}" },
  "book.titleFallback":  { ar: "Title",                       en: "Title" },
  "book.by":             { ar: "بقلم",                        en: "By" },
  "book.pages":          { ar: "{n} صفحة",                    en: "{n} pages" },
  "book.price":          { ar: "Price",                       en: "Price" },
  "book.instantPay1":    { ar: "دفع لحظي من",                  en: "Instant payment via" },
  "book.instantPay2":    { ar: "SOUQRATES SYSTEM",            en: "SOUQRATES SYSTEM" },
  "book.buy":            { ar: "اشترِ عبر تيليغرام",            en: "Buy on Telegram" },
  "book.moreIn":         { ar: "المزيد في {name}",            en: "More in {name}" },
  "book.assure1":        { ar: "توقيع تحميل فريد",             en: "Unique download signature" },
  "book.assure2":        { ar: "صالح ٧ أيام بعد الشراء",       en: "Valid 7 days after purchase" },
  "book.assure3":        { ar: "حقوق المؤلِّف محفوظة",          en: "Author's rights protected" },
  "book.alsoEyebrow":    { ar: "Also in this chapter",        en: "Also in this chapter" },
  "book.alsoTitle":      { ar: "إصدارات قد تعجبك",             en: "You might also like" },

  // ── Publish ──────────────────────────────────────────────────────
  "publish.eyebrow":     { ar: "For Authors & Publishers",   en: "For Authors & Publishers" },
  "publish.title":       { ar: "أنشر إبداعك. واستلم أرباحك.", en: "Publish your work. Earn your share." },
  "publish.lead":        { ar: "نمنحُكَ منصّةً بوتيكيةً موقَّرة لنشر أعمالك الرقمية، مع نظامِ دفعٍ موحَّدٍ بـ {skz}، وحقوقٍ محفوظةٍ بتوقيعٍ مشفَّر، وتسويةٍ آنيةٍ لكلِّ عملية بيع.", en: "A refined boutique platform to publish your digital work — paid in {skz}, secured by a cryptographic signature, and settled instantly on every sale." },
  "publish.processEy":   { ar: "The Process",                en: "The Process" },
  "publish.processTitle":{ ar: "أربعُ خطواتٍ، لا أكثر.",       en: "Four steps, nothing more." },
  "publish.step1Title":  { ar: "ارفع كتابك",                  en: "Upload your book" },
  "publish.step1Desc":   { ar: "أرسل الملف إلى البوت بصيغة {pdf} أو {epub} أو صوتي.", en: "Send the file to the bot as {pdf}, {epub} or audio." },
  "publish.step2Title":  { ar: "حدِّد سعرك",                   en: "Set your price" },
  "publish.step2Desc":   { ar: "اختر سعرًا بـ {skz} يناسب جمهورك، وعدِّله متى شئت.", en: "Pick a {skz} price that fits your audience — change it anytime." },
  "publish.step3Title":  { ar: "راجعةٌ ومُوثَّقة",              en: "Reviewed & verified" },
  "publish.step3Desc":   { ar: "فريق التحرير يراجع المحتوى، ثم يُنشر بتوقيعٍ مُؤمَّن.", en: "Our editorial team reviews the content, then publishes it with a secure signature." },
  "publish.step4Title":  { ar: "استلم أرباحك",                 en: "Receive your earnings" },
  "publish.step4Desc":   { ar: "نصيبك يُودَع تلقائيًا في محفظتك بعد كل عملية بيع.", en: "Your share is deposited to your wallet automatically after every sale." },
  "publish.ctaTitle":    { ar: "جاهز للبدء؟",                  en: "Ready to start?" },
  "publish.ctaLead":     { ar: "افتح البوت الآن وابدأ {cmd} لرفع أوّل عمل لك.", en: "Open the bot and send {cmd} to upload your first title." },
  "publish.ctaButton":   { ar: "ابدأ النشر الآن",              en: "Start publishing now" },
  "publish.browse":      { ar: "تصفَّح ما نُشر",                en: "Browse what's published" },

  // ── 404 ──────────────────────────────────────────────────────────
  "nf.eyebrow":          { ar: "Error · 404",                en: "Error · 404" },
  "nf.title":            { ar: "الصفحة غير موجودة.",          en: "Page not found." },
  "nf.lead":             { ar: "ربما حُذف العنوان أو نُقل إلى موضعٍ آخر. عد إلى الواجهة لاستكشاف المكتبة.", en: "The page may have been removed or moved. Head back home to explore the library." },
  "nf.back":             { ar: "العودة إلى الواجهة",          en: "Back to home" },
};

export function getLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (v && (LANGS as readonly string[]).includes(v)) return v;
  } catch {}
  try {
    const wa = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } }).Telegram?.WebApp;
    const code = wa?.initDataUnsafe?.user?.language_code;
    if (code?.startsWith("en")) return "en";
    if (code?.startsWith("ar")) return "ar";
  } catch {}
  return DEFAULT_LANG;
}

export function setLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch {}
  applyHtmlAttrs(lang);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
}

function applyHtmlAttrs(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => getLang());
  useEffect(() => {
    applyHtmlAttrs(lang);
    const handler = (e: Event) => setLangState((e as CustomEvent<Lang>).detail);
    window.addEventListener(EVENT, handler as EventListener);
    return () => window.removeEventListener(EVENT, handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { applyHtmlAttrs(lang); }, [lang]);
  return [lang, setLang];
}

export function t(lang: Lang, key: string, fmt?: Record<string, string | number>): string {
  const entry = TR[key];
  if (!entry) return key;
  let s = entry[lang] ?? entry[DEFAULT_LANG] ?? entry.en ?? key;
  if (fmt) {
    for (const [k, v] of Object.entries(fmt)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export function useT(): (key: string, fmt?: Record<string, string | number>) => string {
  const [lang] = useLang();
  return (key, fmt) => t(lang, key, fmt);
}

/** Register more translations from feature folders. */
export function registerTranslations(extra: Record<string, Record<Lang, string>>): void {
  Object.assign(TR, extra);
}
