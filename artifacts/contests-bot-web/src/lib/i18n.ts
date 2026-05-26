/**
 * Bilingual (ar/en) i18n for SOUQRATES STAGE Mini App.
 * See artifacts/books-bot-web/src/lib/i18n.ts for the design notes; this is
 * the same shape with a stage-specific TR dict.
 */
import { useEffect, useState } from "react";

export type Lang = "ar" | "en";
const LANGS: readonly Lang[] = ["ar", "en"] as const;
const DEFAULT_LANG: Lang = "ar";
const STORAGE_KEY = "souqrates:lang";
const EVENT = "souqrates:lang-change";

const TR: Record<string, Record<Lang, string>> = {
  langToggle_aria:  { ar: "تبديل اللغة",           en: "Toggle language" },
  langToggle_title: { ar: "التبديل إلى الإنجليزية", en: "Switch to Arabic" },
  app_name:      { ar: "SOUQRATES STAGE",          en: "SOUQRATES STAGE" },
  app_tagline:   { ar: "مسرح المسابقات والتصويت",   en: "Contests & voting arena" },
  open_bot:      { ar: "افتح البوت",                en: "Open Bot" },
  active_now:    { ar: "النشط الآن",                en: "Active now" },
  no_contest:    { ar: "لا توجد مسابقة نشطة",        en: "No active contest" },
  contestants:   { ar: "المتسابقون",                en: "Contestants" },
  votes:         { ar: "صوت",                       en: "votes" },
  rank:          { ar: "المرتبة",                   en: "Rank" },
  vote_btn:      { ar: "صَوِّت",                     en: "Vote" },
  vote_packs:    { ar: "باقات التصويت",              en: "Vote Packs" },
  ends_in:       { ar: "ينتهي خلال",                en: "Ends in" },
  days:          { ar: "ي",                          en: "d" },
  hours:         { ar: "س",                          en: "h" },
  mins:          { ar: "د",                          en: "m" },
  secs:          { ar: "ث",                          en: "s" },
  total_votes:   { ar: "إجمالي الأصوات",             en: "Total votes" },
  live:          { ar: "مباشر",                      en: "LIVE" },
  loading:       { ar: "جاري التحميل…",              en: "Loading…" },
  error_generic: { ar: "حدث خطأ، حاول مجدداً.",      en: "Something went wrong, try again." },
  lang_label:    { ar: "EN",                         en: "ع" },

  contest_ended:        { ar: "⛔ انتهت المسابقة",                en: "⛔ Contest ended" },
  countdown_title:      { ar: "الوقت المتبقي لانتهاء المسابقة",   en: "Time remaining until contest ends" },
  day_full:             { ar: "يوم",                              en: "day" },
  hour_full:            { ar: "ساعة",                             en: "hour" },
  minute_full:          { ar: "دقيقة",                            en: "min" },
  second_full:          { ar: "ثانية",                            en: "sec" },

  activity_title:       { ar: "نشاط آخر 60 ثانية",                en: "Last 60s activity" },
  donut_title:          { ar: "توزيع الأصوات بين المتسابقين",      en: "Vote distribution across contestants" },

  live_broadcast:       { ar: "بث مباشر",                         en: "Live broadcast" },
  active_contest:       { ar: "مسابقة نشطة",                      en: "Active contest" },
  votes_per_minute:     { ar: "⚡ {n} صوت / آخر دقيقة",            en: "⚡ {n} votes / last minute" },
  total_votes_label:    { ar: "إجمالي الأصوات",                   en: "Total votes" },
  contestants_label:    { ar: "المتسابقون",                       en: "Contestants" },
  live_activity:        { ar: "نشاط لحظي",                        en: "Live activity" },
  vote_distribution:    { ar: "توزيع الأصوات",                    en: "Vote share" },
  vote_now_cta:         { ar: "🗳 صَوِّت الآن",                    en: "🗳 Vote now" },
  vote_packs_cta:       { ar: "🎟 باقات التصويت",                 en: "🎟 Vote packs" },
  daily_free_vote_hint: { ar: "🎁 صوت مجاني واحد لكل مستخدم يوميًا — استخدمه قبل أن ينتهي!", en: "🎁 One free vote per user every day — use it before it expires!" },

  votes_unit:           { ar: "صوت",                              en: "votes" },
  vote_for_him:         { ar: "صوِّت له",                          en: "Vote for them" },

  live_events_title:    { ar: "آخر الأحداث المباشرة",              en: "Latest live events" },
  trending_fastest:     { ar: "الأسرع صعوداً",                    en: "Top riser" },
  now_word:             { ar: "الآن",                             en: "now" },
  trending_gain:        { ar: "+{n} صوت / آخر دقيقة",             en: "+{n} votes / last minute" },
  vote_with_him:        { ar: "صوِّت معه",                         en: "Vote with them" },

  new_badge:            { ar: "✨ جديد",                          en: "✨ New" },
  flat_stable:          { ar: "— ثابت",                          en: "— Steady" },
  rising_badge:         { ar: "🔥 صاعد",                         en: "🔥 Rising" },
  falling_badge:        { ar: "❄️ هابط",                         en: "❄️ Falling" },
  disqualified:         { ar: "مستبعد",                           en: "Disqualified" },
  vote_short:           { ar: "صوِّت",                             en: "Vote" },

  leaderboard_title:    { ar: "🏆 لوحة المتسابقين المباشرة",       en: "🏆 Live leaderboard" },
  refresh_every:        { ar: "تحديث كل {n} ثوانٍ",                en: "Refresh every {n}s" },
  no_contestants_yet:   { ar: "لا يوجد متسابقون بعد.",             en: "No contestants yet." },

  pack_label:           { ar: "باقة",                             en: "Pack" },
  bonus_file_badge:     { ar: "🎁 ملف مكافأة",                    en: "🎁 Bonus file" },
  bonus_votes_suffix:   { ar: "(+{n} مكافأة)",                    en: "(+{n} bonus)" },
  price_label:          { ar: "السعر",                            en: "Price" },
  buy_now:              { ar: "اشترِ الآن",                        en: "Buy now" },
  pay_with_skz:         { ar: "الدفع برصيد SKZ من البوت الأم",     en: "Pay with SKZ balance from the mother bot" },

  empty_title:          { ar: "لا توجد مسابقة نشطة حاليًّا",        en: "No active contest right now" },
  empty_subtitle:       { ar: "ترقّب المسابقة القادمة قريبًا على مسرح SOUQRATES STAGE.", en: "Stay tuned for the next contest on SOUQRATES STAGE." },
  open_bot_notifications:{ar: "افتح البوت لتلقّي الإشعارات",         en: "Open the bot for notifications" },

  footer_brand:         { ar: "★ SOUQRATES STAGE — جزء من منظومة SOUQRATES SYSTEM", en: "★ SOUQRATES STAGE — part of the SOUQRATES SYSTEM" },
  footer_legal:         { ar: "جميع المعاملات مالية ومسجّلة وقابلة للتدقيق.",       en: "All transactions are financial, logged, and auditable." },

  connection_failed:    { ar: "تعذّر الاتصال بالخادم",              en: "Could not reach the server" },
  connection_failed_short:{ar:"تعذّر الاتصال",                     en: "Connection failed" },

  event_vote:           { ar: "⚡ +{n} لـ {name}",                 en: "⚡ +{n} for {name}" },
  event_new:            { ar: "✨ متسابق جديد: {name}",            en: "✨ New contestant: {name}" },
  event_take1:          { ar: "👑 {name} يتصدّر القائمة!",          en: "👑 {name} takes the lead!" },
  event_rise:           { ar: "🔥 {name} صعد إلى المركز {rank}",    en: "🔥 {name} moved up to rank {rank}" },
  event_fall:           { ar: "❄️ {name} هبط إلى المركز {rank}",    en: "❄️ {name} dropped to rank {rank}" },
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

export function registerTranslations(extra: Record<string, Record<Lang, string>>): void {
  Object.assign(TR, extra);
}
