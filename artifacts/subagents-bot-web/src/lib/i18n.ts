/**
 * Bilingual (ar/en) i18n for SOUQRATES SUB-AGENTS Mini App.
 * Same pattern as artifacts/books-bot-web/src/lib/i18n.ts.
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
  loading:            { ar: "جاري التحميل…",           en: "Loading…" },

  // ── Landing ───────────────────────────────────────────────────────
  "landing.heroTitle":   { ar: "برنامج الشركاء",                           en: "Partner Program" },
  "landing.heroDesc":    {
    ar: "بوابة النخبة لبيع وتوزيع أرصدة SKZ. انضم الآن، تدرج في مستويات الشراكة، واحصل على خصومات حصرية ومزايا استثنائية.",
    en: "The elite gateway for selling and distributing SKZ credits. Join now, advance through partnership tiers, and earn exclusive discounts and exceptional benefits.",
  },
  "landing.tiersTitle":    { ar: "مستويات الشراكة",        en: "Partnership Tiers" },
  "landing.tierDiscount":  { ar: "خصم {rate}%",             en: "{rate}% discount" },
  "landing.tierSales":     { ar: "مبيعات: {n} SKZ",         en: "Sales: {n} SKZ" },
  "landing.tierCustomers": { ar: "عملاء: {n}",               en: "Customers: {n}" },
  "landing.applyBtn":      { ar: "تقديم طلب انضمام",         en: "Apply to Join" },

  // ── Dashboard ────────────────────────────────────────────────────
  "dashboard.certifiedPartner": { ar: "شريك معتمد",             en: "Certified Partner" },
  "dashboard.balanceLabel":     { ar: "رصيد SKZ المتاح",         en: "Available SKZ Balance" },
  "dashboard.sellBtn":          { ar: "بيع SKZ",                 en: "Sell SKZ" },
  "dashboard.salesHistoryBtn":  { ar: "سجل المبيعات",            en: "Sales History" },
  "dashboard.nextTierTitle":    { ar: "التقدم للمستوى التالي",   en: "Progress to Next Tier" },
  "dashboard.upgradeTo":        { ar: "الترقية إلى",              en: "Upgrade to" },
  "dashboard.salesVolume":      { ar: "حجم المبيعات",             en: "Sales Volume" },
  "dashboard.customersCount":   { ar: "عدد العملاء",              en: "Customers" },
  "dashboard.currentPerks":     { ar: "مزايا مستواك الحالي",      en: "Current Tier Benefits" },

  // ── Apply ─────────────────────────────────────────────────────────
  "apply.title":          { ar: "طلب الانضمام كشريك",                       en: "Partner Application" },
  "apply.subtitle":       { ar: "يرجى تعبئة البيانات بدقة لتسريع عملية المراجعة (KYC).", en: "Please fill in your details accurately to expedite the review process (KYC)." },
  "apply.fullName":       { ar: "الاسم الثلاثي كما في الهوية *",            en: "Full legal name *" },
  "apply.dob":            { ar: "تاريخ الميلاد *",                           en: "Date of birth *" },
  "apply.country":        { ar: "بلد الإقامة *",                             en: "Country of residence *" },
  "apply.phone":          { ar: "رقم الجوال (مع كود الدولة) *",              en: "Phone number (with country code) *" },
  "apply.email":          { ar: "البريد الإلكتروني (اختياري)",               en: "Email (optional)" },
  "apply.address":        { ar: "العنوان الكامل *",                           en: "Full address *" },
  "apply.idPhoto":        { ar: "صورة إثبات الهوية (جواز سفر أو هوية وطنية) *", en: "ID photo (passport or national ID) *" },
  "apply.uploadSuccess":  { ar: "تم الرفع بنجاح",                            en: "Uploaded successfully" },
  "apply.uploading":      { ar: "جاري الرفع...",                              en: "Uploading..." },
  "apply.clickToChange":  { ar: "انقر للتغيير",                               en: "Click to change" },
  "apply.clickToSelect":  { ar: "انقر لاختيار صورة",                          en: "Click to select image" },
  "apply.maxSize":        { ar: "JPG, PNG, WEBP (الحد الأقصى 8 ميجابايت)",   en: "JPG, PNG, WEBP (Max 8MB)" },
  "apply.submitBtn":      { ar: "إرسال الطلب",                                en: "Submit Application" },
  "apply.err.format":     { ar: "صيغة الملف غير مدعومة. يرجى رفع صورة (JPG, PNG, WEBP)", en: "Unsupported file format. Please upload an image (JPG, PNG, WEBP)" },
  "apply.err.size":       { ar: "حجم الصورة يجب أن لا يتجاوز 8 ميجابايت",   en: "Image size must not exceed 8 MB" },
  "apply.err.required":   { ar: "يرجى تعبئة جميع الحقول المطلوبة",           en: "Please fill in all required fields" },
  "apply.err.uploadFail": { ar: "فشل رفع الصورة، يرجى المحاولة مرة أخرى",   en: "Image upload failed, please try again" },
  "apply.success":        { ar: "تم إرسال الطلب بنجاح",                      en: "Application submitted successfully" },
  "apply.err.generic":    { ar: "حدث خطأ أثناء تقديم الطلب",                 en: "An error occurred while submitting your application" },

  // ── Sell ──────────────────────────────────────────────────────────
  "sell.title":             { ar: "بيع SKZ",                     en: "Sell SKZ" },
  "sell.balanceLabel":      { ar: "رصيدك المتاح",                 en: "Your Available Balance" },
  "sell.customerIdLabel":   { ar: "معرف العميل (Telegram ID) *",  en: "Customer ID (Telegram ID) *" },
  "sell.customerIdHint":    { ar: "يجب أن يكون المعرف الرقمي الخاص بحساب العميل على تيليغرام.", en: "Must be the numeric ID of the customer's Telegram account." },
  "sell.amountLabel":       { ar: "المبلغ (SKZ) *",               en: "Amount (SKZ) *" },
  "sell.noteLabel":         { ar: "ملاحظة (اختياري)",              en: "Note (optional)" },
  "sell.notePh":            { ar: "ملاحظة لك أو للعميل...",       en: "A note for you or the customer..." },
  "sell.confirmBtn":        { ar: "تأكيد التحويل",                  en: "Confirm Transfer" },
  "sell.success.title":     { ar: "تم التحويل بنجاح!",             en: "Transfer Successful!" },
  "sell.success.desc":      { ar: "تم إرسال {n} SKZ إلى العميل.", en: "{n} SKZ sent to the customer." },
  "sell.success.remaining": { ar: "رصيدك المتبقي:",                en: "Your remaining balance:" },
  "sell.success.totalSales":{ ar: "إجمالي مبيعاتك:",               en: "Your total sales:" },
  "sell.success.backBtn":   { ar: "العودة للرئيسية",                en: "Back to Dashboard" },
  "sell.err.invalidAmount": { ar: "يرجى إدخال مبلغ صحيح",         en: "Please enter a valid amount" },
  "sell.err.generic":       { ar: "فشلت عملية البيع. تأكد من توفر الرصيد وصحة معرف العميل.", en: "Transfer failed. Check your balance and the customer ID." },
  "sell.toast.success":     { ar: "تمت العملية بنجاح!",            en: "Transfer completed successfully!" },

  // ── Pending ───────────────────────────────────────────────────────
  "pending.title":      { ar: "جاري مراجعة طلبك",      en: "Application Under Review" },
  "pending.desc":       {
    ar: "طلبك قيد المراجعة من قبل الإدارة. ستتلقى إشعاراً فور الموافقة عليه للبدء في استخدام لوحة التحكم الخاصة بك.",
    en: "Your application is under review by the administration. You will receive a notification once it is approved so you can start using your dashboard.",
  },
  "pending.autoRefresh": { ar: "يتم التحديث تلقائياً...", en: "Auto-refreshing..." },

  // ── Rejected ──────────────────────────────────────────────────────
  "rejected.title":        { ar: "عذراً، تم رفض طلبك",    en: "Application Rejected" },
  "rejected.reasonLabel":  { ar: "سبب الرفض:",              en: "Rejection reason:" },
  "rejected.noReason":     { ar: "لم يتم توضيح السبب. يرجى التأكد من صحة بياناتك المرفقة.", en: "No reason was specified. Please ensure your submitted details are accurate." },
  "rejected.reapplyBtn":   { ar: "تقديم طلب جديد",          en: "Submit New Application" },

  // ── Suspended ─────────────────────────────────────────────────────
  "suspended.title":   { ar: "حساب موقوف",           en: "Account Suspended" },
  "suspended.desc":    {
    ar: "تم إيقاف حساب الشراكة الخاص بك مؤقتاً. يرجى التواصل مع الدعم الفني للحصول على مزيد من التفاصيل أو لحل المشكلة.",
    en: "Your partner account has been temporarily suspended. Please contact technical support for more details or to resolve the issue.",
  },
  "suspended.contactBtn": { ar: "تواصل مع الدعم الفني", en: "Contact Support" },

  // ── Sales history ─────────────────────────────────────────────────
  "sales.title":   { ar: "سجل المبيعات",          en: "Sales History" },
  "sales.empty":   { ar: "لا يوجد مبيعات حتى الآن", en: "No sales yet" },

  // ── Not found ─────────────────────────────────────────────────────
  "notfound.title": { ar: "الصفحة غير موجودة", en: "Page Not Found" },
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
