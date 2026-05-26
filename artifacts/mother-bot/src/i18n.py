"""Bilingual (Arabic + English) i18n helper for the mother-bot.

Strings are organised as TR[key][lang] = string. Bot handlers call `t(lang, key, **fmt)`
to resolve a localised string. Per-user language is stored in `users.languageCode`
on the central DB; this module caches lookups for 60s to keep request volume low.

Adding a new locale: extend LANGS, LANG_NAMES, and populate the new column in TR.
Adding a new string: add a key to TR with at least 'ar' and 'en' values. Unknown
keys return the key itself, so a partially-translated handler still works.
"""
import asyncio
import time
from typing import Optional

import httpx
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

LANGS: tuple[str, ...] = ("ar", "en")
DEFAULT_LANG = "ar"

LANG_NAMES: dict[str, str] = {
    "ar": "🇸🇦 العربية",
    "en": "🇬🇧 English",
}

# ── Mother-bot string table ────────────────────────────────────────────────
TR: dict[str, dict[str, str]] = {
    # Welcome / main menu
    "welcome": {
        "ar": (
            "👋 أهلاً بك يا <b>{name}</b>!\n\n"
            "🏦 <b>محفظتك في SKZ</b>\n"
            "├ ⚡ SKZ: <code>{skz}</code>\n"
            "└ 💵 ≈ <code>${usdt}</code> USDT\n\n"
            "اضغط <b>افتح منصة SKZ</b> للوصول إلى لوحتك الكاملة، إدارة الأرصدة، "
            "ولعب الألعاب."
        ),
        "en": (
            "👋 Welcome, <b>{name}</b>!\n\n"
            "🏦 <b>Your SKZ Wallet</b>\n"
            "├ ⚡ SKZ: <code>{skz}</code>\n"
            "└ 💵 ≈ <code>${usdt}</code> USDT\n\n"
            "Tap <b>Open SKZ Platform</b> to access your full dashboard, "
            "manage balances, play games, and more."
        ),
    },
    "welcome_back": {
        "ar": (
            "👋 أهلاً بعودتك يا <b>{name}</b>!\n\n"
            "🏦 <b>محفظتك في SKZ</b>\n"
            "├ ⚡ SKZ: <code>{skz}</code>\n"
            "└ 💵 ≈ <code>${usdt}</code> USDT\n\n"
            "اضغط <b>افتح منصة SKZ</b> للوصول إلى التطبيق الكامل."
        ),
        "en": (
            "👋 Welcome back, <b>{name}</b>!\n\n"
            "🏦 <b>Your SKZ Wallet</b>\n"
            "├ ⚡ SKZ: <code>{skz}</code>\n"
            "└ 💵 ≈ <code>${usdt}</code> USDT\n\n"
            "Tap <b>Open SKZ Platform</b> to access the full app."
        ),
    },
    # Buttons
    "btn_open_platform": {"ar": "🚀 افتح منصة SKZ",      "en": "🚀 Open SKZ Platform"},
    "btn_play_games":    {"ar": "🎮 الألعاب",            "en": "🎮 Play Games"},
    "btn_balance":       {"ar": "💰 الرصيد",             "en": "💰 Balance"},
    "btn_transactions":  {"ar": "📊 المعاملات",          "en": "📊 Transactions"},
    "btn_withdraw":      {"ar": "💸 سحب",               "en": "💸 Withdraw"},
    "btn_referral":      {"ar": "🤝 الإحالة",            "en": "🤝 Referral"},
    "btn_help":          {"ar": "ℹ️ مساعدة",            "en": "ℹ️ Help"},
    "btn_more":          {"ar": "☰ المزيد",             "en": "☰ More"},
    "btn_back":          {"ar": "🔙 رجوع",              "en": "🔙 Back"},
    "btn_back_main":     {"ar": "🏠 الرئيسية",          "en": "🏠 Main menu"},
    "btn_back_menu":     {"ar": "◀ القائمة",            "en": "◀ Menu"},
    "btn_open_app":      {"ar": "🚀 افتح التطبيق",      "en": "🚀 Open App"},
    "btn_policies":      {"ar": "📜 السياسات",          "en": "📜 Policies"},
    "btn_rules":         {"ar": "⚖️ القوانين",          "en": "⚖️ Rules"},
    "btn_contact":       {"ar": "✉️ تواصل معنا",        "en": "✉️ Contact us"},
    "btn_lang":          {"ar": "🌐 اللغة",              "en": "🌐 Language"},
    # Wallet view
    "wallet_title":      {"ar": "💰 <b>محفظتك</b>",     "en": "💰 <b>Your Wallet</b>"},
    "balances_label":    {"ar": "<b>الأرصدة:</b>",      "en": "<b>Balances:</b>"},
    "label_skz":         {"ar": "⚡ SKZ",               "en": "⚡ SKZ"},
    "label_referral":    {"ar": "🤝 الإحالة",            "en": "🤝 Referral"},
    "label_usdt":        {"ar": "💵 USDT",              "en": "💵 USDT"},
    "label_stars":       {"ar": "⭐ Stars",             "en": "⭐ Stars"},
    "label_ton":         {"ar": "💎 TON",               "en": "💎 TON"},
    "profile_line":      {"ar": "<b>🎮 الملف:</b>  المستوى <b>{level}</b> · <code>{xp}</code> XP",
                          "en": "<b>🎮 Profile:</b>  Level <b>{level}</b> · <code>{xp}</code> XP"},
    "games_line":        {"ar": "<b>🎯 الألعاب:</b>   {won}/{played} فوز",
                          "en": "<b>🎯 Games:</b>   {won}/{played} won"},
    "total_earned":      {"ar": "<b>إجمالي الأرباح:</b>     <code>{n}</code> SKZ",
                          "en": "<b>Total Earned:</b>    <code>{n}</code> SKZ"},
    "total_withdrawn":   {"ar": "<b>إجمالي السحوبات:</b>  <code>{n}</code> SKZ",
                          "en": "<b>Total Withdrawn:</b> <code>{n}</code> SKZ"},
    "btn_topup_card":    {"ar": "💎 إيداع TON/USDT",    "en": "💎 Deposit TON/USDT"},
    "btn_topup_stars":   {"ar": "⭐ شحن بـ Stars",       "en": "⭐ Stars Top-up"},
    # Errors / common toasts
    "err_fetch_data":    {"ar": "❌ خطأ في جلب البيانات", "en": "❌ Error fetching data"},
    "err_no_wallet":     {"ar": "❌ لم يتم العثور على المحفظة", "en": "❌ Wallet not found"},
    "err_no_data":       {"ar": "❌ لا توجد بيانات",     "en": "❌ No data found"},
    "err_no_tx":         {"ar": "❌ خطأ في جلب المعاملات", "en": "❌ Error fetching transactions"},
    "err_invalid_amt":   {"ar": "❌ مبلغ غير صالح",     "en": "❌ Invalid amount"},
    "err_invoice_fail":  {"ar": "❌ تعذّر إنشاء الفاتورة، حاول لاحقاً.",
                          "en": "❌ Could not create the invoice, try again later."},
    "err_invoice_link":  {"ar": "❌ لم يتم استلام رابط الفاتورة.",
                          "en": "❌ Invoice link was not returned."},
    "stars_pay_delayed": {"ar": "⚠️ تم استلام دفعتك لكن تأخّر تأكيد القيد، سيتم إضافة الرصيد خلال دقائق.",
                          "en": "⚠️ Payment received but credit confirmation is delayed; balance will be added in a few minutes."},
    "stars_pay_issue":   {"ar": "⚠️ تم استلام دفعتك لكن واجه القيد مشكلة — راسل الدعم برقم العملية:\n<code>{ref}</code>",
                          "en": "⚠️ Payment received but crediting failed — contact support with this id:\n<code>{ref}</code>"},
    "stars_pay_ok":      {"ar": ("✅ <b>تم شحن الرصيد بنجاح</b>\n\n"
                                  "⭐ المدفوع: <b>{stars}</b> Stars\n"
                                  "⚡ المضاف: <b>{skz}</b> SKZ\n"
                                  "💰 رصيدك الجديد: <b>{bal}</b> SKZ"),
                          "en": ("✅ <b>Top-up successful</b>\n\n"
                                  "⭐ Paid: <b>{stars}</b> Stars\n"
                                  "⚡ Credited: <b>{skz}</b> SKZ\n"
                                  "💰 New balance: <b>{bal}</b> SKZ")},
    # ── Deposit hub (split flow: has-wallet vs needs-wallet) ────────────
    "btn_topup_card_label": {"ar": "💎 إيداع TON/USDT", "en": "💎 Deposit TON/USDT"},
    "deposit_hub_body":  {"ar": ("💎 <b>الإيداع</b>\n\n"
                                  "اختر الطريقة الأنسب لك:\n\n"
                                  "• إذا كانت لديك محفظة <b>TON Keeper</b> أو أي محفظة تدعم TON/USDT-Jetton، "
                                  "اختر <b>«لديّ محفظة رقمية»</b> وأرسل المبلغ مباشرة.\n"
                                  "• إذا لم تكن لديك محفظة بعد، اختر <b>«أحتاج إنشاء محفظة»</b> "
                                  "وسنرشدك خطوة بخطوة (لا تستغرق أكثر من <b>5 دقائق</b>)."),
                          "en": ("💎 <b>Deposit</b>\n\n"
                                  "Choose the option that fits you:\n\n"
                                  "• If you already have a <b>TON Keeper</b> wallet (or any wallet that "
                                  "supports TON / USDT-Jetton on TON), pick <b>“I have a wallet”</b> and "
                                  "send directly.\n"
                                  "• If you don't have a wallet yet, pick <b>“I need a wallet”</b> and we'll "
                                  "walk you through it (takes less than <b>5 minutes</b>).")},
    "btn_deposit_have_wallet": {"ar": "👛 لديّ محفظة رقمية", "en": "👛 I have a wallet"},
    "btn_deposit_no_wallet":   {"ar": "🆕 أحتاج إنشاء محفظة", "en": "🆕 I need a wallet"},

    # Section 1 — direct deposit (presets)
    "deposit_have_body": {"ar": ("👛 <b>الإيداع المباشر</b>\n\n"
                                  "أرسل <b>TON</b> أو <b>USDT</b> (شبكة TON) من محفظتك إلى عنوان البوت، "
                                  "وسيُحوَّل المبلغ تلقائياً إلى رصيد <b>SKZ</b> بعد تأكيد الشبكة "
                                  "(عادة 1–5 دقائق).\n\n"
                                  "اختر العملة والمبلغ لإنشاء عنوان إيداع مخصّص بمذكرة (memo) خاصة بك:"),
                          "en": ("👛 <b>Direct deposit</b>\n\n"
                                  "Send <b>TON</b> or <b>USDT</b> (TON network) from your wallet to the "
                                  "bot's address — it auto-converts to your <b>SKZ</b> balance once the "
                                  "network confirms (usually 1–5 minutes).\n\n"
                                  "Pick a currency and amount to generate a deposit address with your "
                                  "unique memo:")},
    "label_deposit_ton":   {"ar": "💎 TON",  "en": "💎 TON"},
    "label_deposit_usdt":  {"ar": "💵 USDT", "en": "💵 USDT"},
    "deposit_ready_ton":  {"ar": ("💎 <b>إيداع {amt} TON</b>\n\n"
                                  "أرسل بالضبط <b>{amt} TON</b> إلى:\n\n"
                                  "📬 <b>العنوان:</b>\n<code>{addr}</code>\n\n"
                                  "📝 <b>المذكرة (memo / comment):</b>\n<code>{memo}</code>\n\n"
                                  "⚡ ستحصل على ~ <b>{skz} SKZ</b> فور تأكيد الشبكة.\n\n"
                                  "⚠️ <b>إلزامي:</b> ضع الـmemo في حقل الرسالة/التعليق داخل محفظتك، "
                                  "وإلا لن يُربط الإيداع بحسابك."),
                          "en": ("💎 <b>Deposit {amt} TON</b>\n\n"
                                  "Send exactly <b>{amt} TON</b> to:\n\n"
                                  "📬 <b>Address:</b>\n<code>{addr}</code>\n\n"
                                  "📝 <b>Memo (comment):</b>\n<code>{memo}</code>\n\n"
                                  "⚡ You'll receive ~ <b>{skz} SKZ</b> once the network confirms.\n\n"
                                  "⚠️ <b>Required:</b> set the memo in the message/comment field inside "
                                  "your wallet, otherwise the deposit won't be linked to your account.")},
    "deposit_ready_usdt": {"ar": ("💵 <b>إيداع {amt} USDT</b>\n\n"
                                  "أرسل بالضبط <b>{amt} USDT</b> (شبكة TON / Jetton) إلى:\n\n"
                                  "📬 <b>العنوان:</b>\n<code>{addr}</code>\n\n"
                                  "📝 <b>المذكرة (memo / comment):</b>\n<code>{memo}</code>\n\n"
                                  "⚡ ستحصل على ~ <b>{skz} SKZ</b> فور تأكيد الشبكة.\n\n"
                                  "⚠️ <b>إلزامي:</b> ضع الـmemo في حقل الرسالة/التعليق داخل محفظتك، "
                                  "وإلا لن يُربط الإيداع بحسابك."),
                          "en": ("💵 <b>Deposit {amt} USDT</b>\n\n"
                                  "Send exactly <b>{amt} USDT</b> (TON network / Jetton) to:\n\n"
                                  "📬 <b>Address:</b>\n<code>{addr}</code>\n\n"
                                  "📝 <b>Memo (comment):</b>\n<code>{memo}</code>\n\n"
                                  "⚡ You'll receive ~ <b>{skz} SKZ</b> once the network confirms.\n\n"
                                  "⚠️ <b>Required:</b> set the memo in the message/comment field inside "
                                  "your wallet, otherwise the deposit won't be linked to your account.")},
    "deposit_intent_err": {"ar": "تعذّر إنشاء عنوان الإيداع، حاول لاحقاً.",
                          "en": "Could not create deposit address, please try again."},

    # Section 2 — install TON Keeper guide (sent as photo caption, must
    # stay under Telegram's 1024-char caption limit per language).
    "deposit_no_wallet_body": {"ar": ("🆕 <b>محفظتك جاهزة في أقل من 5 دقائق</b>\n\n"
                                  "<b>TON Keeper</b> هي محفظتك الخاصّة بالكامل — لا أحد يملك مفاتيحها غيرك. "
                                  "تعمل على iPhone و Android.\n\n"
                                  "<b>الخطوات:</b>\n"
                                  "1️⃣ نزّل التطبيق من الزر المناسب أدناه.\n"
                                  "2️⃣ افتح التطبيق ← <b>«إنشاء محفظة جديدة»</b> ← احفظ الكلمات الـ24 "
                                  "في مكان آمن جداً.\n"
                                  "3️⃣ مَوِّل محفظتك بـ <b>TON</b> أو <b>USDT</b> بأي طريقة تناسبك.\n"
                                  "4️⃣ من شاشة محفظتك اضغط <b>«Send»</b> ← الصق عنوان البوت ← أدخل المبلغ "
                                  "← الصق <b>الـmemo</b> ← أرسل.\n"
                                  "5️⃣ ارجع هنا واضغط <b>«لديّ محفظة»</b> لاستلام العنوان والـmemo الخاصَّين بك.\n\n"
                                  "⏱️ كامل العملية لا تتجاوز <b>5 دقائق</b>.\n\n"
                                  "💎 <b>مهم:</b> كل أرباحك المستقبلية من المنصّة ستُحوَّل مباشرة إلى محفظتك "
                                  "في TON Keeper — لذا وجودها شرط أساسي لاستلام مكافآتك."),
                          "en": ("🆕 <b>Your wallet — ready in under 5 minutes</b>\n\n"
                                  "<b>TON Keeper</b> is fully your own wallet — only you hold the keys. "
                                  "Runs on iPhone and Android.\n\n"
                                  "<b>Steps:</b>\n"
                                  "1️⃣ Install the app from the appropriate button below.\n"
                                  "2️⃣ Open the app → <b>“Create new wallet”</b> → save the 24 words "
                                  "somewhere very safe.\n"
                                  "3️⃣ Fund your wallet with <b>TON</b> or <b>USDT</b> in any way that suits you.\n"
                                  "4️⃣ From your wallet screen tap <b>“Send”</b> → paste the bot's address "
                                  "→ enter the amount → paste the <b>memo</b> → send.\n"
                                  "5️⃣ Come back here and tap <b>“I have a wallet”</b> to get your own "
                                  "address and memo.\n\n"
                                  "⏱️ The whole flow takes under <b>5 minutes</b>.\n\n"
                                  "💎 <b>Important:</b> all your future earnings from the platform will be "
                                  "sent directly to your TON Keeper wallet — having one is essential to "
                                  "receive your rewards.")},
    "btn_appstore_tonkeeper": {"ar": "🍏 App Store", "en": "🍏 App Store"},
    "btn_playstore_tonkeeper": {"ar": "🤖 Google Play", "en": "🤖 Google Play"},

    "btn_open_wallet":   {"ar": "💳 افتح @wallet للشراء بالبطاقة",
                          "en": "💳 Open @wallet to buy with card"},
    "btn_open_deposit":  {"ar": "💸 افتح صفحة الإيداع",
                          "en": "💸 Open deposit page"},
    "btn_back_wallet":   {"ar": "🔙 المحفظة",            "en": "🔙 Wallet"},
    "btn_back_deposit":  {"ar": "🔙 رجوع",               "en": "🔙 Back"},
    "topup_stars_body":  {"ar": ("⭐ <b>شحن الرصيد بـ Telegram Stars</b>\n\n"
                                  "ادفع داخل تيليغرام مباشرة بدون خروج من المحادثة.\n"
                                  "يُضاف رصيد <b>SKZ</b> فور تأكيد الدفع تلقائياً.\n\n"
                                  "اختر عدد النجوم:"),
                          "en": ("⭐ <b>Top up with Telegram Stars</b>\n\n"
                                  "Pay inside Telegram without leaving the chat.\n"
                                  "<b>SKZ</b> is credited automatically as soon as payment confirms.\n\n"
                                  "Choose the amount of Stars:")},
    "pay_stars_btn":     {"ar": "⭐ ادفع {n} Stars الآن",
                          "en": "⭐ Pay {n} Stars now"},
    "invoice_ready":     {"ar": ("⭐ <b>فاتورة شحن جاهزة</b>\n\n"
                                  "المبلغ: <b>{n}</b> نجمة\n"
                                  "ستحصل على: <b>{skz}</b> SKZ\n\n"
                                  "اضغط الزر أدناه لإتمام الدفع داخل تيليغرام.\n"
                                  "<i>سيُضاف الرصيد فور تأكيد الدفع.</i>"),
                          "en": ("⭐ <b>Invoice ready</b>\n\n"
                                  "Amount: <b>{n}</b> Stars\n"
                                  "You will receive: <b>{skz}</b> SKZ\n\n"
                                  "Tap the button below to pay inside Telegram.\n"
                                  "<i>Balance is credited as soon as payment confirms.</i>")},
    # Withdraw
    "withdraw_body":     {"ar": ("💸 <b>سحب الأرباح</b>\n\n"
                                  "استخدم زر <b>افتح التطبيق</b> للسحب مباشرة من المنصة.\n\n"
                                  "📌 <b>الحد الأدنى:</b>\n"
                                  "├ 💵 USDT: 5\n"
                                  "└ 💎 TON: 1\n\n"
                                  "⚡ تُحوَّل تلقائياً من رصيد SKZ."),
                          "en": ("💸 <b>Withdraw Earnings</b>\n\n"
                                  "Use the <b>Open App</b> button to withdraw directly from the platform.\n\n"
                                  "📌 <b>Minimums:</b>\n"
                                  "├ 💵 USDT: 5\n"
                                  "└ 💎 TON: 1\n\n"
                                  "⚡ Converted from your SKZ balance automatically.")},
    # Help
    "help_body":         {"ar": ("ℹ️ <b>حول SOUQRATES SYSTEM</b>\n\n"
                                  "SKZ هي محفظتك المالية الموحَّدة عبر منظومة SOUQRATES:\n\n"
                                  "▲ <b>SOUQRATES SKILLZ</b> — ألعاب مهارة بجوائز\n"
                                  "❖ <b>SOUQRATES SOUQ</b>   — كتب ومنتجات رقمية\n"
                                  "▶ <b>SOUQRATES SCENE</b>  — فيديوهات قصيرة، اربح من المشاهدة\n"
                                  "◉ <b>SOUQRATES STREAM</b> — غرف صوتية مدفوعة\n"
                                  "✦ <b>SOUQRATES SIGNAL</b> — توليد نص/صور/فيديو بالذكاء الاصطناعي\n"
                                  "★ <b>SOUQRATES STAGE</b>  — مسابقات وجوائز التصويت\n\n"
                                  "كل الأرباح من كل فصل تتدفّق إلى محفظة SKZ واحدة هنا — في SOUQRATES SYSTEM."),
                          "en": ("ℹ️ <b>About SOUQRATES SYSTEM</b>\n\n"
                                  "SKZ is your unified financial hub across the SOUQRATES ecosystem:\n\n"
                                  "▲ <b>SOUQRATES SKILLZ</b> — skill games with prizes\n"
                                  "❖ <b>SOUQRATES SOUQ</b>   — books &amp; digital products\n"
                                  "▶ <b>SOUQRATES SCENE</b>  — short video, earn from watching\n"
                                  "◉ <b>SOUQRATES STREAM</b> — paid voice rooms\n"
                                  "✦ <b>SOUQRATES SIGNAL</b> — AI text/image/video generation\n"
                                  "★ <b>SOUQRATES STAGE</b>  — contests &amp; voting prizes\n\n"
                                  "All earnings across every chapter flow into one SKZ wallet here — in SOUQRATES SYSTEM.")},
    # Referral
    "referral_body":     {"ar": ("🤝 <b>برنامج الإحالة</b>\n\n"
                                  "ادعُ أصدقاءك واربح <b>حتى 15%</b> من أرباحهم بـ SKZ — مدى الحياة!\n\n"
                                  "💼 <b>محفظة الإحالة:</b>\n"
                                  "├ المتاح:    <code>{avail}</code> SKZ\n"
                                  "└ الإجمالي:   <code>{total}</code> SKZ\n\n"
                                  "🔗 <b>رابطك:</b>\n<code>{link}</code>\n\n"
                                  "المستويات: L1 → 10% · L2 → 3% · L3 → 2%\n\n"
                                  "💡 حوِّل أرباح الإحالة إلى محفظتك الرئيسية لسحبها."),
                          "en": ("🤝 <b>Referral Program</b>\n\n"
                                  "Invite friends and earn <b>up to 15%</b> of their SKZ earnings — for life!\n\n"
                                  "💼 <b>Referral Wallet:</b>\n"
                                  "├ Available:    <code>{avail}</code> SKZ\n"
                                  "└ Lifetime:     <code>{total}</code> SKZ\n\n"
                                  "🔗 <b>Your link:</b>\n<code>{link}</code>\n\n"
                                  "Tiers: L1 → 10% · L2 → 3% · L3 → 2%\n\n"
                                  "💡 Transfer your referral earnings to your main wallet to withdraw them.")},
    "btn_transfer_ref":  {"ar": "💸 حوِّل {n} SKZ إلى المحفظة الرئيسية",
                          "en": "💸 Transfer {n} SKZ → Main Wallet"},
    "ref_transfer_ok":   {"ar": "✅ تم تحويل {n} SKZ إلى محفظتك الرئيسية",
                          "en": "✅ Transferred {n} SKZ to your main wallet"},
    "err_transfer":      {"ar": "❌ خطأ في التحويل",   "en": "❌ Transfer error"},
    "transfer_failed":   {"ar": "فشل التحويل",         "en": "Transfer failed"},
    # /lang
    "lang_prompt":       {"ar": "🌐 اختر لغة البوت:\nChoose your bot language:",
                          "en": "🌐 Choose your bot language:\nاختر لغة البوت:"},
    "lang_set_ok":       {"ar": "✅ تم تعيين اللغة إلى العربية.",
                          "en": "✅ Language set to English."},
    "lang_set_fail":     {"ar": "❌ تعذّر حفظ اختيار اللغة. حاول لاحقاً.",
                          "en": "❌ Could not save language preference. Try again later."},
    # Transactions
    "tx_title":          {"ar": "📊 <b>سجل المعاملات</b>",
                          "en": "📊 <b>Transaction History</b>"},
    "tx_empty":          {"ar": "📊 <b>سجل المعاملات</b>\n\nلا توجد معاملات بعد.",
                          "en": "📊 <b>Transaction History</b>\n\nNo transactions yet."},
    "tx_last_10":        {"ar": "📊 <b>آخر 10 معاملات:</b>\n",
                          "en": "📊 <b>Last 10 Transactions:</b>\n"},
    # Info menu
    "info_menu_prompt":  {"ar": "☰ <b>المزيد</b>\n\nاختر ما تريد الاطلاع عليه:",
                          "en": "☰ <b>More</b>\n\nChoose what you'd like to view:"},
    # /balance
    "btn_open_full_app": {"ar": "🚀 افتح التطبيق الكامل",
                          "en": "🚀 Open Full App"},
    "err_no_wallet_start": {"ar": "❌ لا توجد محفظة. أرسل /start أولاً.",
                            "en": "❌ No wallet found. Use /start first."},
    "err_balance_fetch": {"ar": "❌ خطأ في جلب الرصيد.",
                          "en": "❌ Error fetching balance."},
    # /admin (non-admin reply)
    "err_no_permission": {"ar": "❌ ليست لديك الصلاحية.",
                          "en": "❌ No permission."},
}


def update_translations(extra: dict[str, dict[str, str]]) -> None:
    """Merge extra strings (e.g. per-handler) into the global TR table."""
    TR.update(extra)


def t(lang: Optional[str], key: str, **fmt) -> str:
    """Resolve a localised string. Falls back: lang → DEFAULT_LANG → 'en' → key."""
    entry = TR.get(key)
    if not entry:
        return key
    lang_norm = lang if lang in LANGS else DEFAULT_LANG
    s = entry.get(lang_norm) or entry.get(DEFAULT_LANG) or entry.get("en") or key
    if fmt:
        try:
            return s.format(**fmt)
        except (KeyError, IndexError, ValueError):
            return s
    return s


# ── Per-user language cache ────────────────────────────────────────────────
# Avoids hitting the API on every keypress. 60s TTL matches the BotTexts cache.
_LANG_CACHE: dict[str, tuple[str, float]] = {}
_LANG_TTL = 60.0
_LANG_LOCK = asyncio.Lock()


def invalidate_lang_cache(telegram_id: Optional[str] = None) -> None:
    if telegram_id is None:
        _LANG_CACHE.clear()
    else:
        _LANG_CACHE.pop(telegram_id, None)


async def get_user_lang(telegram_id: str, api_url: str, api_key: str) -> str:
    """Returns the user's persisted language from the mother-bot API, with a
    60s in-process cache. Returns DEFAULT_LANG on any error/miss — never raises."""
    now = time.time()
    hit = _LANG_CACHE.get(telegram_id)
    if hit and (now - hit[1] < _LANG_TTL):
        return hit[0]
    async with _LANG_LOCK:
        hit = _LANG_CACHE.get(telegram_id)
        if hit and (now - hit[1] < _LANG_TTL):
            return hit[0]
        lang = DEFAULT_LANG
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(
                    f"{api_url}/users/{telegram_id}",
                    headers={"X-Bot-Api-Key": api_key},
                    timeout=5.0,
                )
                if r.status_code == 200:
                    code = ((r.json() or {}).get("user") or {}).get("languageCode")
                    if code in LANGS:
                        lang = code
        except Exception:
            pass
        _LANG_CACHE[telegram_id] = (lang, now)
        return lang


async def set_user_lang(
    telegram_id: str,
    lang: str,
    api_url: str,
    api_key: str,
    *,
    first_name: str = "User",
    username: Optional[str] = None,
) -> bool:
    """Persist the user's language via the existing /internal/users/upsert
    endpoint (its onConflictDoUpdate accepts an optional languageCode override).
    Updates the local cache immediately so the next handler sees the new value."""
    if lang not in LANGS:
        return False
    ok = False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(
                f"{api_url}/internal/users/upsert",
                json={
                    "telegramId": telegram_id,
                    "firstName": first_name,
                    "username": username,
                    "languageCode": lang,
                },
                headers={"X-Bot-Api-Key": api_key},
                timeout=5.0,
            )
            ok = r.status_code == 200
    except Exception:
        pass
    if ok:
        _LANG_CACHE[telegram_id] = (lang, time.time())
    else:
        _LANG_CACHE.pop(telegram_id, None)
    return ok


def lang_keyboard(callback_prefix: str = "lang") -> InlineKeyboardMarkup:
    """Two-button language picker. callback_data: '<prefix>:<lang>'."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=LANG_NAMES["ar"], callback_data=f"{callback_prefix}:ar")],
        [InlineKeyboardButton(text=LANG_NAMES["en"], callback_data=f"{callback_prefix}:en")],
    ])
