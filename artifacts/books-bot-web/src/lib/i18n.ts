/**
 * Bilingual (ar/en) i18n for SOUQRATES SOUQ Mini App.
 *
 * Usage:
 *   const t = useT();
 *   <h1>{t("home_title")}</h1>
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
  // Splash / chrome
  app_name:        { ar: "SOUQRATES SOUQ",        en: "SOUQRATES SOUQ" },
  app_tagline:     { ar: "كتب ومنتجات رقمية",      en: "Books & digital products" },
  // Header
  nav_home:        { ar: "الرئيسية",               en: "Home" },
  nav_library:     { ar: "مكتبتي",                 en: "My library" },
  nav_publish:     { ar: "نشر",                    en: "Publish" },
  // Common
  loading:         { ar: "جاري التحميل…",          en: "Loading…" },
  error_generic:   { ar: "حدث خطأ، حاول مجدداً.",  en: "Something went wrong, try again." },
  empty_books:     { ar: "لا توجد كتب بعد",        en: "No books yet" },
  // Cards
  by_author:       { ar: "بقلم {name}",            en: "by {name}" },
  buy_for:         { ar: "اشتري بـ {price} SKZ",   en: "Buy for {price} SKZ" },
  download:        { ar: "تحميل",                  en: "Download" },
  back:            { ar: "← رجوع",                 en: "← Back" },
  // Language toggle
  lang_label:      { ar: "EN",                     en: "ع" },
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
