/**
 * Bilingual (ar/en) i18n for the bot-demo Mini App.
 * Mirror of artifacts/books-bot-web/src/lib/i18n.ts.
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
  greeting_morning: { ar: "صباح الخير",            en: "Good morning" },
  greeting_day:     { ar: "أهلاً",                  en: "Welcome" },
  greeting_evening: { ar: "مساء الخير",             en: "Good evening" },
  wallet_title:     { ar: "محفظتي",                 en: "My Wallet" },
  deposit:          { ar: "إيداع",                  en: "Deposit" },
  withdraw:         { ar: "سحب",                    en: "Withdraw" },
  referral:         { ar: "الإحالة",                en: "Referral" },
  agreement:        { ar: "الشروط والأحكام",        en: "Terms & Conditions" },
  open_app:         { ar: "افتح التطبيق",           en: "Open App" },
  open_in_telegram: { ar: "افتح في تيليغرام",       en: "Open in Telegram" },
  loading:          { ar: "جاري التحميل…",          en: "Loading…" },
  error_generic:    { ar: "حدث خطأ، حاول مجدداً.",  en: "Something went wrong, try again." },
  lang_label:       { ar: "EN",                     en: "ع" },

  // ── App ──
  "app.notFound": { ar: "الصفحة غير موجودة", en: "Page not found" },

  // ── Navigation (bottom bar) ──
  "nav.referral": { ar: "الإحالة", en: "Referral" },
  "nav.withdraw": { ar: "سحب",     en: "Withdraw" },
  "nav.home":     { ar: "الرئيسية", en: "Home" },
  "nav.deposit":  { ar: "إيداع",   en: "Deposit" },
  "nav.wallet":   { ar: "المحفظة", en: "Wallet" },

  // ── Splash ──
  "splash.loading": { ar: "جارٍ التحميل", en: "Loading" },

  // ── Home ──
  "home.greeting.morning":   { ar: "صباح الخير",   en: "Good morning" },
  "home.greeting.day":       { ar: "أهلاً",         en: "Welcome" },
  "home.greeting.evening":   { ar: "مساء الخير",   en: "Good evening" },
  "home.noNotifications":    { ar: "لا توجد إشعارات جديدة الآن.", en: "No new notifications right now." },
  "home.hero.details":       { ar: "التفاصيل",    en: "Details" },
  "home.hero.skzBalance":    { ar: "رصيد SKZ",   en: "SKZ Balance" },
  "home.hero.deposit":       { ar: "إيداع",       en: "Deposit" },
  "home.hero.withdraw":      { ar: "سحب",         en: "Withdraw" },
  "home.stats.totalEarned":  { ar: "إجمالي الأرباح",  en: "Total Earned" },
  "home.stats.withdrawn":    { ar: "تم سحبه",         en: "Withdrawn" },
  "home.currencyBalances":   { ar: "أرصدة العملات",  en: "Currency Balances" },
  "home.bots":               { ar: "البوتات",         en: "Bots" },
  "home.botsCount":          { ar: "{count} بوتات",   en: "{count} Bots" },
  "home.bot.open":           { ar: "فتح",   en: "Open" },
  "home.bot.soon":           { ar: "قريباً", en: "Soon" },
  "home.bot.launchingSoon":  { ar: "{brand} سيُطلق قريباً. ترقّب!", en: "{brand} is launching soon. Stay tuned!" },
  "home.referral.invite":    { ar: "ادعُ أصدقاءك", en: "Invite Friends" },
  "home.referral.earnLine":  { ar: "اربح {pct}% من أرباحهم — مدى الحياة", en: "Earn {pct}% of their earnings — for life" },
  "home.recent":             { ar: "آخر العمليات",  en: "Recent Transactions" },
  "home.viewAll":            { ar: "عرض الكل",       en: "View All" },
  "home.tx.empty":           { ar: "لا توجد عمليات بعد", en: "No transactions yet" },
  "home.tx.emptyHint":       { ar: "ستظهر حركاتك هنا", en: "Your activity will appear here" },

  // ── Wallet ──
  "wallet.title":         { ar: "المحفظة",                    en: "Wallet" },
  "wallet.subtitle":      { ar: "كل أرصدتك في مكان واحد",  en: "All your balances in one place" },
  "wallet.mainBalance":   { ar: "الرصيد الرئيسي",            en: "Main Balance" },
  "wallet.deposit":       { ar: "إيداع",                      en: "Deposit" },
  "wallet.withdraw":      { ar: "سحب",                        en: "Withdraw" },
  "wallet.stats.totalEarned": { ar: "إجمالي الأرباح",        en: "Total Earned" },
  "wallet.stats.withdrawn":   { ar: "تم سحبه",                en: "Withdrawn" },
  "wallet.currencyBalances":  { ar: "أرصدة العملات",         en: "Currency Balances" },
  "wallet.currency.usdt.sub": { ar: "TRC20 · تيثر",          en: "TRC20 · Tether" },
  "wallet.currency.stars.label": { ar: "نجوم تيليغرام",      en: "Telegram Stars" },
  "wallet.currency.stars.sub":   { ar: "دفع داخل التطبيق",   en: "In-app payment" },
  "wallet.currency.ton.sub":     { ar: "ذا أوبن نتورك",       en: "The Open Network" },
  "wallet.history":              { ar: "سجل العمليات",       en: "Transaction History" },
  "wallet.history.empty":        { ar: "لا توجد عمليات بعد", en: "No transactions yet" },
  "wallet.history.emptyHint":    { ar: "أودِع أو اربح SKZ لرؤية سجلك", en: "Deposit or earn SKZ to see your history" },

  // ── Deposit ──
  "deposit.copied":           { ar: "✓ تم النسخ",  en: "✓ Copied" },
  "deposit.title":            { ar: "إيداع SKZ",   en: "Deposit SKZ" },
  "deposit.subtitle":         { ar: "أودِع وتحوَّل تلقائيًا إلى SKZ", en: "Deposit and auto-convert to SKZ" },
  "deposit.banner.title":     { ar: "تحويل تلقائي إلى SKZ", en: "Auto-converted to SKZ" },
  "deposit.banner.sub":       { ar: "بالسعر الحالي المعتمد من الإدارة", en: "At the current admin-approved rate" },
  "deposit.chooseMethod":     { ar: "اختر وسيلة الإيداع", en: "Choose deposit method" },
  "deposit.method.card.label": { ar: "💳 شحن بالبطاقة", en: "💳 Top up by card" },
  "deposit.method.card.sub":   { ar: "عبر @wallet · فيزا → USDT/TON", en: "via @wallet · Visa → USDT/TON" },
  "deposit.method.usdt.sub":   { ar: "Tether · شبكة TRC20", en: "Tether · TRC20 network" },
  "deposit.method.ton.sub":    { ar: "The Open Network",    en: "The Open Network" },
  "deposit.rate.cardSuffix":   { ar: " · بطاقة فيزا", en: " · Visa card" },
  "deposit.card.heading":      { ar: "الشحن بالبطاقة عبر", en: "Top up by card via" },
  "deposit.card.intro":        {
    ar: "اشترِ USDT أو TON بالفيزا/ماستركارد من محفظة تيليغرام الرسمية @wallet، ثم أرسلها إلى عنوان الإيداع الخاص بالبوت ليُحوَّل تلقائياً إلى SKZ.",
    en: "Buy USDT or TON with Visa/Mastercard from Telegram's official @wallet, then send it to the bot's deposit address to be auto-converted to SKZ.",
  },
  "deposit.card.steps":        { ar: "الخطوات", en: "Steps" },
  "deposit.card.step1":        { ar: "اضغط «افتح @wallet» بالأسفل واشترِ USDT (TRC20) أو TON بالبطاقة.", en: "Tap “Open @wallet” below and buy USDT (TRC20) or TON by card." },
  "deposit.card.step2":        { ar: "ارجع إلى هذا التطبيق واختر تبويب USDT أو TON من الأعلى.", en: "Return to this app and pick the USDT or TON tab above." },
  "deposit.card.step3":        { ar: "انسخ عنوان الإيداع المعروض وأرسل المبلغ من @wallet إليه.", en: "Copy the deposit address shown and send the amount from @wallet to it." },
  "deposit.card.step4":        { ar: "يُضاف رصيد SKZ تلقائياً خلال 2-5 دقائق بعد تأكيد الشبكة ⚡.", en: "SKZ is credited automatically within 2–5 minutes after network confirmation ⚡." },
  "deposit.card.currentRate":  { ar: "السعر الحالي", en: "Current rate" },
  "deposit.card.openWallet":   { ar: "افتح @wallet للشراء بالبطاقة", en: "Open @wallet to buy by card" },
  "deposit.card.showUsdtAddr": { ar: "عرض عنوان إيداع USDT", en: "Show USDT deposit address" },
  "deposit.amountLabel":       { ar: "المبلغ ({unit})", en: "Amount ({unit})" },
  "deposit.minErr":            { ar: "الحد الأدنى للإيداع {min} {unit}", en: "Minimum deposit is {min} {unit}" },
  "deposit.willReceive":       { ar: "ستستلم", en: "You receive" },
  "deposit.addressLabel":      { ar: "عنوان الإيداع ({network})", en: "Deposit address ({network})" },
  "deposit.addressUnavailable": {
    ar: "⚠️ عنوان الإيداع غير مفعَّل حاليًا. يرجى التواصل مع الدعم (@{support}) أو انتظار تفعيله من قِبَل الإدارة.",
    en: "⚠️ Deposit address isn't active right now. Please contact support (@{support}) or wait for it to be enabled by admins.",
  },
  "deposit.warn.networkOnly":  { ar: "أرسل {sym} فقط عبر هذه الشبكة — أي عملة أخرى تُفقد نهائيًا", en: "Send {sym} only over this network — any other asset will be lost permanently" },
  "deposit.warn.min":          { ar: "الحد الأدنى: {min} {unit}", en: "Minimum: {min} {unit}" },
  "deposit.warn.eta":          { ar: "يُضاف الرصيد تلقائيًا بعد تأكيد الشبكة (٢-٥ دقائق)", en: "Balance is credited automatically after network confirmation (2–5 minutes)" },
  "deposit.warn.todayRate":    { ar: "سعر اليوم: 1 {sym} = {rate} SKZ", en: "Today's rate: 1 {sym} = {rate} SKZ" },
  "deposit.cta.enterAmount":   { ar: "أدخل المبلغ", en: "Enter amount" },
  "deposit.cta.minNeeded":     { ar: "الحد الأدنى {min} {unit}", en: "Minimum {min} {unit}" },
  "deposit.cta.addrInactive":  { ar: "العنوان غير مفعَّل", en: "Address not active" },
  "deposit.cta.iSent":         { ar: "لقد أرسلت المبلغ", en: "I've sent the amount" },
  "deposit.confirmAlert":      {
    ar: "تم تسجيل نية الإيداع.\nالمبلغ: {amount} {sym} → {skz} SKZ\n\nأرسل المبلغ إلى العنوان أعلاه. سيُضاف الرصيد تلقائيًا فور تأكيد المعاملة على الشبكة.",
    en: "Deposit intent recorded.\nAmount: {amount} {sym} → {skz} SKZ\n\nSend the amount to the address above. Your balance will be credited automatically once the transaction is confirmed on-chain.",
  },

  // ── Withdraw ──
  "withdraw.title":           { ar: "سحب SKZ", en: "Withdraw SKZ" },
  "withdraw.subtitle":        { ar: "حوِّل SKZ إلى عملة خارجية", en: "Convert SKZ to an external currency" },
  "withdraw.available":       { ar: "الرصيد المتاح", en: "Available balance" },
  "withdraw.convertTo":       { ar: "حوِّل إلى", en: "Convert to" },
  "withdraw.rules.title":     { ar: "قواعد السحب", en: "Withdrawal rules" },
  "withdraw.rules.min":       { ar: "• الحد الأدنى: {min} SKZ", en: "• Minimum: {min} SKZ" },
  "withdraw.rules.fee":       { ar: "• رسوم الشبكة: {pct}% (تُخصم من المبلغ المُستلَم)", en: "• Network fee: {pct}% (deducted from received amount)" },
  "withdraw.rules.eta":       { ar: "• مدة المعالجة: حتى {hrs} ساعة بعد الموافقة", en: "• Processing time: up to {hrs}h after approval" },
  "withdraw.rules.addrTrc20": { ar: "• صيغة العنوان: TRC20 يبدأ بـ T (٣٤ خانة)", en: "• Address format: TRC20 starting with T (34 chars)" },
  "withdraw.rules.addrTon":   { ar: "• صيغة العنوان: TON يبدأ بـ EQ/UQ (٤٨ خانة)", en: "• Address format: TON starting with EQ/UQ (48 chars)" },
  "withdraw.rules.warn":      { ar: "⚠️ تأكَّد من صحة العنوان والشبكة — أي خطأ يُفقد المبلغ نهائيًا", en: "⚠️ Verify address and network — any mistake will result in permanent loss" },
  "withdraw.amountLabel":     { ar: "المبلغ بـ SKZ", en: "Amount in SKZ" },
  "withdraw.max":             { ar: "الأقصى — {max}", en: "Max — {max}" },
  "withdraw.err.overMax":     { ar: "المبلغ يتجاوز رصيدك المتاح", en: "Amount exceeds your available balance" },
  "withdraw.err.belowMin":    { ar: "الحد الأدنى للسحب {min} SKZ", en: "Minimum withdrawal is {min} SKZ" },
  "withdraw.addrLabel":       { ar: "عنوان المحفظة ({net})", en: "Wallet address ({net})" },
  "withdraw.addrPlaceholder": { ar: "أدخل عنوان {sym}...", en: "Enter {sym} address..." },
  "withdraw.addr.invalidTrc20": { ar: "عنوان TRC20 غير صحيح (يبدأ بـ T وطوله 34 خانة)", en: "Invalid TRC20 address (starts with T, 34 chars)" },
  "withdraw.addr.invalidTon":   { ar: "عنوان TON غير صحيح (يبدأ بـ EQ/UQ/kQ/0Q وطوله 48 خانة)", en: "Invalid TON address (starts with EQ/UQ/kQ/0Q, 48 chars)" },
  "withdraw.addr.valid":      { ar: "✓ صيغة العنوان صحيحة", en: "✓ Address format is valid" },
  "withdraw.sum.amount":      { ar: "المبلغ (SKZ)", en: "Amount (SKZ)" },
  "withdraw.sum.equiv":       { ar: "المعادل", en: "Equivalent" },
  "withdraw.sum.fee":         { ar: "رسوم الشبكة ({pct}%)", en: "Network fee ({pct}%)" },
  "withdraw.sum.net":         { ar: "صافي الاستلام", en: "Net received" },
  "withdraw.cta.enterAmount": { ar: "أدخل المبلغ", en: "Enter amount" },
  "withdraw.cta.overMax":     { ar: "المبلغ يتجاوز الرصيد", en: "Amount exceeds balance" },
  "withdraw.cta.belowMin":    { ar: "الحد الأدنى {min} SKZ", en: "Minimum {min} SKZ" },
  "withdraw.cta.enterAddr":   { ar: "أدخل عنوان المحفظة", en: "Enter wallet address" },
  "withdraw.cta.invalidAddr": { ar: "عنوان المحفظة غير صحيح", en: "Wallet address is invalid" },
  "withdraw.cta.submit":      { ar: "اسحب {amount} {sym}", en: "Withdraw {amount} {sym}" },
  "withdraw.confirmAlert":    {
    ar: "تم إرسال طلب السحب.\nالمبلغ: {skz} SKZ\nصافي الاستلام: {net} {sym}\nإلى: {addr}\n\nطلبك قيد المراجعة وسيُعالَج خلال {hrs} ساعة كحد أقصى.",
    en: "Withdrawal request submitted.\nAmount: {skz} SKZ\nNet received: {net} {sym}\nTo: {addr}\n\nYour request is under review and will be processed within {hrs}h.",
  },

  // ── Referral ──
  "referral.copied":         { ar: "✓ تم نسخ الرابط!", en: "✓ Link copied!" },
  "referral.title":          { ar: "نظام الإحالة", en: "Referral System" },
  "referral.headerLine":     { ar: "ادعُ أصدقاءك واربح حتى {pct}% من أرباحهم بـ SKZ — مدى الحياة", en: "Invite friends and earn up to {pct}% of their SKZ earnings — for life" },
  "referral.tiers":          { ar: "نسب العمولة", en: "Commission Tiers" },
  "referral.tier.gen1":      { ar: "الجيل 1", en: "Generation 1" },
  "referral.tier.gen2":      { ar: "الجيل 2", en: "Generation 2" },
  "referral.tier.gen3":      { ar: "الجيل 3", en: "Generation 3" },
  "referral.inviteLink":     { ar: "رابط الدعوة الخاص بك", en: "Your Invite Link" },
  "referral.share":          { ar: "مشاركة الرابط", en: "Share Link" },
  "referral.referredBy":     { ar: "تمت دعوتك بواسطة", en: "Referred By" },
  "referral.user":           { ar: "مستخدم #{id}", en: "User #{id}" },
  "referral.direct":         { ar: "تسجيل مباشر", en: "Direct signup" },
  "referral.yourId":         { ar: "معرّفك", en: "Your ID" },
  "referral.friends":        { ar: "أصدقاؤك", en: "Your Friends" },
  "referral.empty":          { ar: "لا توجد إحالات بعد", en: "No referrals yet" },
  "referral.emptyHint":      { ar: "شارك رابطك وابدأ في كسب {pct}% من كل صديق تدعوه", en: "Share your link and start earning {pct}% from every friend you invite" },
  "referral.perGen":         { ar: "{l1}% · {l2}% · {l3}% لكل جيل", en: "{l1}% · {l2}% · {l3}% per generation" },
  "referral.how":            { ar: "كيف يعمل", en: "How It Works" },
  "referral.step1":          { ar: "شارك رابط الإحالة مع أصدقائك.", en: "Share your referral link with friends." },
  "referral.step2":          { ar: "يسجِّلون ويبدأون باستخدام البوتات.", en: "They sign up and start using the bots." },
  "referral.step3":          { ar: "اربح {l1}% من الجيل 1 و{l2}% من الجيل 2 و{l3}% من الجيل 3 — تلقائيًا بـ SKZ.", en: "Earn {l1}% from Gen 1, {l2}% from Gen 2, {l3}% from Gen 3 — automatically in SKZ." },

  // ── Agreement ──
  "agreement.badge":         { ar: "اتفاقية المستخدم — Agreement Form", en: "User Agreement — Agreement Form" },
  "agreement.contractTitle": { ar: "نص الاتفاقية", en: "Agreement text" },
  "agreement.loading":       { ar: "جاري التحميل…", en: "Loading…" },
  "agreement.empty":         { ar: "لا توجد اتفاقية منشورة حاليًا.", en: "No agreement is currently published." },
  "agreement.fullName":      { ar: "الاسم الكامل *", en: "Full name *" },
  "agreement.fullName.ph":   { ar: "مثال: أحمد محمد", en: "e.g. Ahmed Mohammed" },
  "agreement.email":         { ar: "البريد الإلكتروني *", en: "Email *" },
  "agreement.phone":         { ar: "رقم الهاتف", en: "Phone number" },
  "agreement.optional":      { ar: "(اختياري)", en: "(optional)" },
  "agreement.notes":         { ar: "ملاحظات", en: "Notes" },
  "agreement.notes.ph":      { ar: "أي ملاحظة تودّ إضافتها للإدارة", en: "Any note you'd like to add for admins" },
  "agreement.signature":     { ar: "التوقيع بالإصبع *", en: "Signature *" },
  "agreement.clear":         { ar: "مسح", en: "Clear" },
  "agreement.signHint":      { ar: "استخدم إصبعك (أو الفأرة على سطح المكتب) للتوقيع داخل المربع.", en: "Use your finger (or mouse on desktop) to sign inside the box." },
  "agreement.signRequired":  { ar: "الرجاء التوقيع بإصبعك في المربع أدناه", en: "Please sign in the box below" },
  "agreement.submit":        { ar: "إرسال التوقيع — Submit", en: "Submit Signature" },
  "agreement.submitting":    { ar: "جاري الإرسال…", en: "Submitting…" },
  "agreement.submitFailed":  { ar: "فشل الإرسال — حاول مرة أخرى", en: "Submission failed — please try again" },
  "agreement.connFailed":    { ar: "تعذّر الاتصال بالخادم", en: "Could not reach the server" },
  "agreement.done.title":    { ar: "تم استلام توقيعك بنجاح", en: "Your signature was received" },
  "agreement.done.body":     { ar: "شكرًا {name}. تم حفظ الاتفاقية الموقّعة وسيتم التواصل معك عبر بريدك الإلكتروني عند الحاجة.", en: "Thank you, {name}. Your signed agreement has been saved and we'll reach out by email if needed." },
  "agreement.done.verified": { ar: "توقيع موثّق — SOUQRATES SYSTEM", en: "Verified signature — SOUQRATES SYSTEM" },
  "agreement.footer":        { ar: "© SOUQRATES SYSTEM · جميع الحقوق محفوظة", en: "© SOUQRATES SYSTEM · All rights reserved" },

  // ── NotFound ──
  "notfound.title":     { ar: "404 — الصفحة غير موجودة", en: "404 Page Not Found" },
  "notfound.body":      { ar: "هل نسيت إضافة الصفحة إلى الموجِّه؟", en: "Did you forget to add the page to the router?" },

  // ── XP Bar ──
  "xp.title":      { ar: "نظام XP",  en: "XP System" },
  "xp.soon":       { ar: "قريباً",   en: "Coming Soon" },
  "xp.hint":       { ar: "اكسب XP باللعب واستخدام البوتات", en: "Earn XP by playing and using bots" },
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
