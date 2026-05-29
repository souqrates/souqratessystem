"""Bilingual (ar/en) i18n helper for sweep-bot. Mirrors contests-bot/i18n.py."""
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

TR: dict[str, dict[str, str]] = {
    # ── Welcome / start ───────────────────────────────────────────────────
    "welcome_title": {
        "ar": "🎰 <b>SOUQRATES SWEEP</b> ★",
        "en": "🎰 <b>SOUQRATES SWEEP</b> ★",
    },
    "welcome_subtitle": {
        "ar": "ألعاب الحظ واليانصيب — جزء من منظومة 🏛 SOUQRATES SYSTEM",
        "en": "Luck games &amp; lottery — part of the 🏛 SOUQRATES SYSTEM",
    },

    # ── Main keyboard buttons ─────────────────────────────────────────────
    "btn_play":        {"ar": "🎰 العب الآن",            "en": "🎰 Play Now"},
    "btn_lotto":       {"ar": "🏆 اللوتو الأسبوعي",      "en": "🏆 Weekly Lotto"},
    "btn_topup":       {"ar": "💳 شحن رصيد",             "en": "💳 Top Up"},
    "btn_balance":     {"ar": "💰 رصيدي",                "en": "💰 My Balance"},
    "btn_tickets":     {"ar": "🎟 تذاكري",               "en": "🎟 My Tickets"},
    "btn_help":        {"ar": "ℹ️ مساعدة",               "en": "ℹ️ Help"},
    "btn_home":        {"ar": "◀ القائمة الرئيسية",      "en": "◀ Main Menu"},
    "btn_back_short":  {"ar": "◀ رجوع",                  "en": "◀ Back"},
    "btn_main_system": {
        "ar": "🏛 SOUQRATES SYSTEM — المحفظة الموحّدة",
        "en": "🏛 SOUQRATES SYSTEM — Unified Wallet",
    },

    # ── Lang ──────────────────────────────────────────────────────────────
    "lang_prompt":   {
        "ar": "🌐 اختر لغة البوت:\nChoose your bot language:",
        "en": "🌐 Choose your bot language:\nاختر لغة البوت:",
    },
    "lang_set_ok":   {"ar": "✅ تم تعيين اللغة إلى العربية.",
                      "en": "✅ Language set to English."},
    "lang_set_fail": {"ar": "❌ تعذّر حفظ اختيار اللغة. حاول لاحقاً.",
                      "en": "❌ Could not save language preference. Try again later."},

    # ── Balance ───────────────────────────────────────────────────────────
    "balance_title": {
        "ar": "💰 <b>رصيدك الموحّد</b>",
        "en": "💰 <b>Your Unified Balance</b>",
    },
    "balance_skz":   {"ar": "⚡ SKZ: <code>{skz}</code>",
                      "en": "⚡ SKZ: <code>{skz}</code>"},
    "balance_usdt":  {"ar": "💵 USDT: <code>{usdt}</code>",
                      "en": "💵 USDT: <code>{usdt}</code>"},
    "balance_stars": {"ar": "⭐ Stars: <code>{stars}</code>",
                      "en": "⭐ Stars: <code>{stars}</code>"},
    "balance_ton":   {"ar": "💎 TON: <code>{ton}</code>",
                      "en": "💎 TON: <code>{ton}</code>"},
    "balance_hint": {
        "ar": "\nمحفظتك مُدارة مركزيًّا — نفس الرصيد في كل بوتات سوقراط.",
        "en": "\nYour wallet is shared across all SOUQRATES bots.",
    },
    "balance_fetch_err": {
        "ar": "⚠ تعذّر جلب الرصيد. حاول مجدداً.",
        "en": "⚠ Could not fetch balance. Please try again.",
    },
    "balance_no_wallet": {
        "ar": "لم نجد حساباً لك. أرسل /start في البوت الأم لإنشاء محفظتك.",
        "en": "No account found. Send /start to the Mother Bot to create your wallet.",
    },

    # ── Tickets ───────────────────────────────────────────────────────────
    "tickets_title":  {"ar": "🎟 <b>آخر تذاكرك</b>",
                       "en": "🎟 <b>Your Recent Tickets</b>"},
    "tickets_empty":  {"ar": "لا توجد تذاكر بعد. العب الآن لتظهر تذاكرك هنا!",
                       "en": "No tickets yet. Play now to see your tickets here!"},
    "tickets_line_win": {
        "ar": "🎉 #{id} — {game} — <b>فزت {amount} SKZ</b> — {date}",
        "en": "🎉 #{id} — {game} — <b>Won {amount} SKZ</b> — {date}",
    },
    "tickets_line_loss": {
        "ar": "🎲 #{id} — {game} — لم تفز — {date}",
        "en": "🎲 #{id} — {game} — No win — {date}",
    },
    "tickets_line_pending": {
        "ar": "⏳ #{id} — {game} — قيد الانتظار — {date}",
        "en": "⏳ #{id} — {game} — Pending — {date}",
    },
    "tickets_fetch_err": {
        "ar": "⚠ تعذّر جلب التذاكر. حاول مجدداً.",
        "en": "⚠ Could not fetch tickets. Please try again.",
    },

    # ── Lotto ─────────────────────────────────────────────────────────────
    "lotto_title":    {"ar": "🏆 <b>اللوتو الأسبوعي</b>",
                       "en": "🏆 <b>Weekly Lotto</b>"},
    "lotto_no_draw":  {
        "ar": "🌙 لا يوجد سحب نشط حالياً.\nترقّب الجولة القادمة قريبًا!",
        "en": "🌙 No active draw right now.\nStay tuned for the next round!",
    },
    "lotto_draw_info": {
        "ar": ("🗓 <b>السحب:</b> {name}\n"
               "💰 <b>الجائزة الكبرى:</b> <code>{jackpot}</code> SKZ\n"
               "🎟 <b>سعر التذكرة:</b> <code>{price}</code> SKZ\n"
               "⏰ <b>ينتهي:</b> {ends}"),
        "en": ("🗓 <b>Draw:</b> {name}\n"
               "💰 <b>Jackpot:</b> <code>{jackpot}</code> SKZ\n"
               "🎟 <b>Ticket price:</b> <code>{price}</code> SKZ\n"
               "⏰ <b>Ends:</b> {ends}"),
    },
    "lotto_my_tickets_header": {
        "ar": "\n\n<b>أرقامك المسجّلة:</b>",
        "en": "\n\n<b>Your registered numbers:</b>",
    },
    "lotto_my_numbers":       {"ar": "🎯 {numbers}", "en": "🎯 {numbers}"},
    "lotto_no_my_tickets":    {
        "ar": "\n\nلم تشترِ تذاكر في هذا السحب بعد.",
        "en": "\n\nYou haven't bought tickets for this draw yet.",
    },
    "lotto_play_hint": {
        "ar": "\n\nاضغط <b>🎰 العب الآن</b> لشراء تذاكر اللوتو.",
        "en": "\n\nTap <b>🎰 Play Now</b> to buy lotto tickets.",
    },
    "lotto_fetch_err": {
        "ar": "⚠ تعذّر جلب بيانات اللوتو. حاول مجدداً.",
        "en": "⚠ Could not fetch lotto data. Please try again.",
    },

    # ── Help / Provably Fair ──────────────────────────────────────────────
    "help_body": {
        "ar": (
            "📖 <b>مساعدة SOUQRATES SWEEP</b>\n\n"
            "<b>الأوامر:</b>\n"
            "/start — القائمة الرئيسية\n"
            "/balance — رصيدك التفصيلي\n"
            "/tickets — آخر 5 تذاكر\n"
            "/lotto — السحب الأسبوعي الحالي\n"
            "/help — هذه الرسالة\n\n"
            "<b>🔐 Provably Fair — التحقق من النزاهة</b>\n\n"
            "كل لعبة في SWEEP تستخدم نظام <b>Provably Fair</b> لضمان نزاهة النتائج:\n\n"
            "1️⃣ <b>Server Seed Hash:</b> قبل كل جولة، يُولِّد السيرفر بذرة عشوائية "
            "ويُخزِّن <i>هاش</i> SHA-256 الخاص بها فقط (مُشفَّر). لا يمكن تغييرها بعد النشر.\n\n"
            "2️⃣ <b>Client Seed:</b> أنت تُزوِّد بذرة خاصة بك (أو تُولَّد تلقائياً). "
            "تُدمَج مع بذرة السيرفر لإنتاج نتيجة فريدة.\n\n"
            "3️⃣ <b>التحقق:</b> بعد انتهاء الجولة، يُكشَف عن بذرة السيرفر الأصلية. "
            "يمكنك مطابقتها بهاشها المنشور والتحقق بنفسك أن النتيجة لم تُلاعَب:\n"
            "<code>HMAC-SHA256(server_seed + nonce, client_seed)</code>\n\n"
            "✅ كل معاملة مالية مُسجَّلة ومدقَّقة في نظام SOUQRATES SYSTEM الموحَّد."
        ),
        "en": (
            "📖 <b>SOUQRATES SWEEP — Help</b>\n\n"
            "<b>Commands:</b>\n"
            "/start — main menu\n"
            "/balance — detailed balance\n"
            "/tickets — last 5 tickets\n"
            "/lotto — current weekly draw\n"
            "/help — this message\n\n"
            "<b>🔐 Provably Fair — Verify Fairness</b>\n\n"
            "Every SWEEP game uses a <b>Provably Fair</b> system to guarantee integrity:\n\n"
            "1️⃣ <b>Server Seed Hash:</b> Before each round the server generates a random seed "
            "and publishes only its SHA-256 <i>hash</i>. It cannot be changed after publication.\n\n"
            "2️⃣ <b>Client Seed:</b> You supply your own seed (or one is generated automatically). "
            "It is combined with the server seed to produce a unique outcome.\n\n"
            "3️⃣ <b>Verification:</b> After the round the original server seed is revealed. "
            "You can match it against the published hash and verify yourself that the outcome "
            "was not tampered with:\n"
            "<code>HMAC-SHA256(server_seed + nonce, client_seed)</code>\n\n"
            "✅ Every financial transaction is logged and auditable in the unified SOUQRATES SYSTEM."
        ),
    },

    # ── Top-up hub ────────────────────────────────────────────────────────
    "btn_topup_stars":           {"ar": "⭐ شحن بـ Stars",        "en": "⭐ Stars Top-up"},
    "btn_topup_crypto":          {"ar": "💎 إيداع TON/USDT",      "en": "💎 Deposit TON/USDT"},
    "topup_hub_body": {
        "ar": ("💳 <b>شحن الرصيد</b>\n\n"
               "اختر طريقة الشحن:\n\n"
               "• <b>⭐ Stars</b> — ادفع داخل تيليغرام فوراً بدون خروج.\n"
               "• <b>💎 TON/USDT</b> — أرسل عملة مشفّرة مباشرة إلى عنوانك الخاص."),
        "en": ("💳 <b>Top Up</b>\n\n"
               "Choose your top-up method:\n\n"
               "• <b>⭐ Stars</b> — pay instantly inside Telegram without leaving.\n"
               "• <b>💎 TON/USDT</b> — send crypto directly to your personal address."),
    },

    # ── Stars payment ─────────────────────────────────────────────────────
    "topup_stars_body": {
        "ar": ("⭐ <b>شحن الرصيد بـ Telegram Stars</b>\n\n"
               "ادفع داخل تيليغرام مباشرة بدون خروج من المحادثة.\n"
               "يُضاف رصيد <b>SKZ</b> فور تأكيد الدفع تلقائياً.\n\n"
               "اختر عدد النجوم:"),
        "en": ("⭐ <b>Top up with Telegram Stars</b>\n\n"
               "Pay inside Telegram without leaving the chat.\n"
               "<b>SKZ</b> is credited automatically as soon as payment confirms.\n\n"
               "Choose the amount of Stars:"),
    },
    "pay_stars_btn":    {"ar": "⭐ ادفع {n} Stars الآن",   "en": "⭐ Pay {n} Stars now"},
    "invoice_ready": {
        "ar": ("⭐ <b>فاتورة شحن جاهزة</b>\n\n"
               "المبلغ: <b>{n}</b> نجمة\n"
               "ستحصل على: <b>{skz}</b> SKZ\n\n"
               "اضغط الزر أدناه لإتمام الدفع داخل تيليغرام.\n"
               "<i>سيُضاف الرصيد فور تأكيد الدفع.</i>"),
        "en": ("⭐ <b>Invoice ready</b>\n\n"
               "Amount: <b>{n}</b> Stars\n"
               "You will receive: <b>{skz}</b> SKZ\n\n"
               "Tap the button below to pay inside Telegram.\n"
               "<i>Balance is credited as soon as payment confirms.</i>"),
    },
    "stars_pay_ok": {
        "ar": ("✅ <b>تم شحن الرصيد بنجاح</b>\n\n"
               "⭐ المدفوع: <b>{stars}</b> Stars\n"
               "⚡ المضاف: <b>{skz}</b> SKZ\n"
               "💰 رصيدك الجديد: <b>{bal}</b> SKZ"),
        "en": ("✅ <b>Top-up successful</b>\n\n"
               "⭐ Paid: <b>{stars}</b> Stars\n"
               "⚡ Credited: <b>{skz}</b> SKZ\n"
               "💰 New balance: <b>{bal}</b> SKZ"),
    },
    "stars_pay_delayed": {
        "ar": "⚠️ تم استلام دفعتك لكن تأخّر تأكيد القيد، سيتم إضافة الرصيد خلال دقائق.",
        "en": "⚠️ Payment received but credit confirmation is delayed; balance will be added in a few minutes.",
    },
    "stars_pay_issue": {
        "ar": "⚠️ تم استلام دفعتك لكن واجه القيد مشكلة — راسل الدعم برقم العملية:\n<code>{ref}</code>",
        "en": "⚠️ Payment received but crediting failed — contact support with this id:\n<code>{ref}</code>",
    },

    # ── TON/USDT deposit ──────────────────────────────────────────────────
    "deposit_hub_body": {
        "ar": ("💎 <b>الإيداع</b>\n\n"
               "اختر الطريقة الأنسب لك:\n\n"
               "• إذا كانت لديك محفظة <b>TON Keeper</b> أو أي محفظة تدعم TON/USDT-Jetton، "
               "اختر <b>«لديّ محفظة رقمية»</b> وأرسل المبلغ مباشرة.\n"
               "• إذا لم تكن لديك محفظة بعد، اختر <b>«أحتاج إنشاء محفظة»</b> "
               "وسنرشدك خطوة بخطوة (لا تستغرق أكثر من <b>5 دقائق</b>)."),
        "en": ("💎 <b>Deposit</b>\n\n"
               "Choose the option that fits you:\n\n"
               "• If you already have a <b>TON Keeper</b> wallet (or any wallet that "
               "supports TON / USDT-Jetton on TON), pick <b>\"I have a wallet\"</b> and send directly.\n"
               "• If you don't have a wallet yet, pick <b>\"I need a wallet\"</b> and we'll "
               "walk you through it (takes less than <b>5 minutes</b>)."),
    },
    "btn_deposit_have_wallet": {"ar": "👛 لديّ محفظة رقمية",     "en": "👛 I have a wallet"},
    "btn_deposit_no_wallet":   {"ar": "🆕 أحتاج إنشاء محفظة",    "en": "🆕 I need a wallet"},
    "deposit_have_body": {
        "ar": ("👛 <b>الإيداع المباشر</b>\n\n"
               "أرسل <b>TON</b> أو <b>USDT</b> (شبكة TON) من محفظتك إلى عنوان البوت، "
               "وسيُحوَّل المبلغ تلقائياً إلى رصيد <b>SKZ</b> بعد تأكيد الشبكة "
               "(عادة 1–5 دقائق).\n\n"
               "اختر العملة والمبلغ لإنشاء عنوان إيداع مخصّص بمذكرة (memo) خاصة بك:"),
        "en": ("👛 <b>Direct deposit</b>\n\n"
               "Send <b>TON</b> or <b>USDT</b> (TON network) from your wallet to the "
               "bot's address — it auto-converts to your <b>SKZ</b> balance once the "
               "network confirms (usually 1–5 minutes).\n\n"
               "Pick a currency and amount to generate a deposit address with your unique memo:"),
    },
    "label_deposit_ton":  {"ar": "💎 TON",  "en": "💎 TON"},
    "label_deposit_usdt": {"ar": "💵 USDT", "en": "💵 USDT"},
    "deposit_ready_ton": {
        "ar": ("💎 <b>إيداع {amt} TON</b>\n\n"
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
               "your wallet, otherwise the deposit won't be linked to your account."),
    },
    "deposit_ready_usdt": {
        "ar": ("💵 <b>إيداع {amt} USDT</b>\n\n"
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
               "your wallet, otherwise the deposit won't be linked to your account."),
    },
    "deposit_intent_err": {
        "ar": "تعذّر إنشاء عنوان الإيداع، حاول لاحقاً.",
        "en": "Could not create deposit address, please try again.",
    },
    "deposit_no_wallet_body": {
        "ar": ("🆕 <b>محفظتك جاهزة في أقل من 5 دقائق</b>\n\n"
               "<b>TON Keeper</b> هي محفظتك الخاصّة بالكامل — لا أحد يملك مفاتيحها غيرك. "
               "تعمل على iPhone و Android.\n\n"
               "<b>الخطوات:</b>\n"
               "1️⃣ نزّل التطبيق من الزر المناسب أدناه.\n"
               "2️⃣ افتح التطبيق ← <b>«إنشاء محفظة جديدة»</b> ← احفظ الكلمات الـ24 في مكان آمن.\n"
               "3️⃣ مَوِّل محفظتك بـ TON أو USDT.\n"
               "4️⃣ اضغط <b>«Send»</b> ← الصق العنوان ← أدخل المبلغ ← الصق الـmemo ← أرسل.\n"
               "5️⃣ ارجع هنا واضغط <b>«لديّ محفظة»</b> لاستلام عنوانك ومذكرتك.\n\n"
               "⏱️ كامل العملية لا تتجاوز <b>5 دقائق</b>."),
        "en": ("🆕 <b>Your wallet — ready in under 5 minutes</b>\n\n"
               "<b>TON Keeper</b> is fully your own wallet — only you hold the keys. "
               "Runs on iPhone and Android.\n\n"
               "<b>Steps:</b>\n"
               "1️⃣ Install the app from the button below.\n"
               "2️⃣ Open the app → <b>\"Create new wallet\"</b> → save the 24 words safely.\n"
               "3️⃣ Fund your wallet with TON or USDT.\n"
               "4️⃣ Tap <b>\"Send\"</b> → paste the address → enter amount → paste the memo → send.\n"
               "5️⃣ Come back here and tap <b>\"I have a wallet\"</b> for your address and memo.\n\n"
               "⏱️ The whole flow takes under <b>5 minutes</b>."),
    },
    "btn_appstore_tonkeeper":  {"ar": "🍏 App Store",    "en": "🍏 App Store"},
    "btn_playstore_tonkeeper": {"ar": "🤖 Google Play",  "en": "🤖 Google Play"},
    "btn_back_deposit":        {"ar": "🔙 رجوع",          "en": "🔙 Back"},
    "btn_back_topup":          {"ar": "🔙 الشحن",         "en": "🔙 Top Up"},

    # ── Error strings ─────────────────────────────────────────────────────
    "err_invalid_amt":  {"ar": "❌ مبلغ غير صالح",
                         "en": "❌ Invalid amount"},
    "err_invoice_fail": {"ar": "❌ تعذّر إنشاء الفاتورة، حاول لاحقاً.",
                         "en": "❌ Could not create the invoice, try again later."},
    "err_invoice_link": {"ar": "❌ لم يتم استلام رابط الفاتورة.",
                         "en": "❌ Invoice link was not returned."},

    # ── Blocked user ──────────────────────────────────────────────────────
    "err_banned": {
        "ar": "❌ تم حظر حسابك من العمليات المالية. تواصل مع الدعم إذا كان هذا خطأً.",
        "en": "❌ Your account has been blocked from financial operations. Contact support if this is an error.",
    },

    # ── Generic errors ────────────────────────────────────────────────────
    "err_generic": {
        "ar": "❌ حدث خطأ. حاول مجدداً.",
        "en": "❌ Something went wrong. Please try again.",
    },
}


def update_translations(extra: dict[str, dict[str, str]]) -> None:
    TR.update(extra)


def t(lang: Optional[str], key: str, **fmt) -> str:
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


_LANG_CACHE: dict[str, tuple[str, float]] = {}
_LANG_TTL = 60.0
_LANG_LOCK = asyncio.Lock()


def invalidate_lang_cache(telegram_id: Optional[str] = None) -> None:
    if telegram_id is None:
        _LANG_CACHE.clear()
    else:
        _LANG_CACHE.pop(telegram_id, None)


async def get_user_lang(telegram_id: str, api_url: str, api_key: str) -> str:
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
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=LANG_NAMES["ar"], callback_data=f"{callback_prefix}:ar")],
        [InlineKeyboardButton(text=LANG_NAMES["en"], callback_data=f"{callback_prefix}:en")],
    ])
