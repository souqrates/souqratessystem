"""Bilingual (ar/en) i18n helper for books-bot. Mirrors the mother-bot module
so per-bot helpers stay consistent. See artifacts/mother-bot/src/i18n.py for
the design notes."""
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
    # Welcome
    "welcome": {
        "ar": ("👋 أهلاً بك في <b>SOUQRATES SOUQ</b>\n"
                "كتب ومنتجات رقمية بثمن SKZ.\n\n"
                "اضغط <b>📚 تصفح</b> لاستكشاف الفئات أو <b>📤 نشر</b> لرفع كتاب جديد."),
        "en": ("👋 Welcome to <b>SOUQRATES SOUQ</b>\n"
                "Books and digital products priced in SKZ.\n\n"
                "Tap <b>📚 Browse</b> to explore categories or <b>📤 Publish</b> to upload a new book."),
    },
    # Main keyboard
    "btn_browse":     {"ar": "📚 تصفح",        "en": "📚 Browse"},
    "btn_publish":    {"ar": "📤 نشر",         "en": "📤 Publish"},
    "btn_library":    {"ar": "📂 مكتبتي",      "en": "📂 My library"},
    "btn_wallet":     {"ar": "💰 محفظتي",      "en": "💰 My wallet"},
    "btn_help":       {"ar": "ℹ️ مساعدة",      "en": "ℹ️ Help"},
    "btn_back":       {"ar": "🔙 رجوع",        "en": "🔙 Back"},
    "btn_topup_here": {"ar": "💳 اشحن من البوت الأم", "en": "💳 Top up from Mother Bot"},
    # Common errors
    "err_no_wallet":  {"ar": "❌ لم يتم العثور على محفظتك. أرسل /start أولاً.",
                       "en": "❌ Wallet not found. Send /start first."},
    "err_generic":    {"ar": "❌ حدث خطأ، حاول مجدداً.",
                       "en": "❌ Something went wrong, try again."},
    # /lang
    "lang_prompt":    {"ar": "🌐 اختر لغة البوت:\nChoose your bot language:",
                       "en": "🌐 Choose your bot language:\nاختر لغة البوت:"},
    "lang_set_ok":    {"ar": "✅ تم تعيين اللغة إلى العربية.",
                       "en": "✅ Language set to English."},
    "lang_set_fail":  {"ar": "❌ تعذّر حفظ اختيار اللغة. حاول لاحقاً.",
                       "en": "❌ Could not save language preference. Try again later."},
    # Main menu / help
    "menu_title": {
        "ar": "❖ <b>SOUQRATES SOUQ</b>\n\nاختر إجراءً:",
        "en": "❖ <b>SOUQRATES SOUQ</b>\n\nChoose an action:",
    },
    "help_body": {
        "ar": ("<b>مساعدة — SOUQRATES SOUQ</b>\n\n"
               "الأوامر المتاحة:\n"
               "/start — القائمة الرئيسية\n"
               "/browse — تصفّح الكتب حسب التصنيف\n"
               "/publish — نشر كتاب جديد للمراجعة\n"
               "/library — مكتبتي (مشترياتي وإصداراتي)\n"
               "/wallet — رصيد محفظتي بـ SKZ\n"
               "/help — عرض هذه القائمة\n"),
        "en": ("<b>Help — SOUQRATES SOUQ</b>\n\n"
               "Available commands:\n"
               "/start — Main menu\n"
               "/browse — Browse books by category\n"
               "/publish — Submit a new book for review\n"
               "/library — My library (purchases & publications)\n"
               "/wallet — My SKZ wallet balance\n"
               "/help — Show this list\n"),
    },
    # Browse
    "browse_title":        {"ar": "📚 <b>اختر تصنيفًا</b>", "en": "📚 <b>Choose a category</b>"},
    "browse_bestsellers":  {"ar": "🔥 الأكثر مبيعًا",       "en": "🔥 Best sellers"},
    "browse_btn_back_cats":{"ar": "🔙 التصنيفات",            "en": "🔙 Categories"},
    "browse_empty":        {"ar": "📭 لا توجد كتب في هذا التصنيف بعد.",
                            "en": "📭 No books in this category yet."},
    "books_header":        {"ar": "📚 <b>الكتب</b> ({total})\n",
                            "en": "📚 <b>Books</b> ({total})\n"},
    # Library
    "lib_title":              {"ar": "📂 <b>مكتبتي</b>\n", "en": "📂 <b>My Library</b>\n"},
    "lib_purchases_header":   {"ar": "🛒 <b>مشترياتي:</b>",  "en": "🛒 <b>My purchases:</b>"},
    "lib_no_purchases":       {"ar": "لم تشترِ أي كتاب بعد.\n",
                               "en": "You haven't purchased any books yet.\n"},
    "lib_published_header":   {"ar": "📤 <b>إصداراتي:</b>",   "en": "📤 <b>My publications:</b>"},
    "lib_published_line":     {"ar": "{icon} <b>{title}</b> — مبيعات: {sales}",
                               "en": "{icon} <b>{title}</b> — Sales: {sales}"},
    # Wallet
    "wallet_text": {
        "ar": ("💰 <b>رصيدك</b>\n\n"
               "⚡ SKZ: <code>{skz}</code>\n"
               "💵 USDT (تقديري): <code>{usdt}</code>"),
        "en": ("💰 <b>Your Balance</b>\n\n"
               "⚡ SKZ: <code>{skz}</code>\n"
               "💵 USDT (estimated): <code>{usdt}</code>"),
    },
    "err_wallet_alert":  {"ar": "❌ لم يتم العثور على المحفظة", "en": "❌ Wallet not found"},
    # Publish FSM
    "pub_ask_title":      {"ar": "📝 أرسل <b>عنوان</b> الكتاب:", "en": "📝 Send the book <b>title</b>:"},
    "pub_ask_desc":       {"ar": "📄 أرسل <b>وصف</b> الكتاب:",   "en": "📄 Send the book <b>description</b>:"},
    "pub_ask_cat":        {"ar": "🏷️ اختر تصنيفًا:",              "en": "🏷️ Choose a category:"},
    "pub_ask_price":      {"ar": "💰 أرسل السعر بـ SKZ (رقم فقط، مثال: <code>50</code>):",
                           "en": "💰 Send the price in SKZ (number only, e.g. <code>50</code>):"},
    "pub_invalid_price":  {"ar": "❌ سعر غير صالح. أرسل رقمًا فقط.",
                           "en": "❌ Invalid price. Send a number only."},
    "pub_ask_cover": {
        "ar": ("🖼️ أرسل <b>صورة الغلاف</b> الآن:\n\n"
               "• الصيغ المسموحة: <b>JPG / PNG / WEBP</b>\n"
               "• الحد الأقصى للحجم: <b>{mb} MB</b>\n"
               "• المقاس المفضّل: 800×1200 (نسبة 2:3)\n\n"
               "أرسل الصورة كصورة (📷) أو ملف (📎). اكتب <code>تخطّى</code> لتركها فارغة."),
        "en": ("🖼️ Send the <b>cover image</b> now:\n\n"
               "• Allowed formats: <b>JPG / PNG / WEBP</b>\n"
               "• Maximum size: <b>{mb} MB</b>\n"
               "• Preferred dimensions: 800×1200 (2:3 ratio)\n\n"
               "Send as photo (📷) or file (📎). Type <code>skip</code> to leave it empty."),
    },
    "pub_cover_busy":         {"ar": "⏳ جاري معالجة الصورة السابقة… انتظر لحظة.",
                               "en": "⏳ Processing previous image… please wait."},
    "pub_cover_bad_mime":     {"ar": "❌ صيغة الغلاف غير مسموحة. أرسل صورة <b>JPG / PNG / WEBP</b> فقط.",
                               "en": "❌ Cover format not allowed. Send only <b>JPG / PNG / WEBP</b>."},
    "pub_cover_too_large":    {"ar": "❌ حجم الصورة يتجاوز {mb} MB.",
                               "en": "❌ Image exceeds {mb} MB."},
    "pub_cover_uploading":    {"ar": "⏳ جاري رفع الغلاف…", "en": "⏳ Uploading cover…"},
    "pub_cover_uploaded":     {"ar": "✅ تم رفع الغلاف.",    "en": "✅ Cover uploaded."},
    "pub_cover_fail_default": {"ar": "تعذّر رفع الغلاف",     "en": "Cover upload failed"},
    "pub_cover_fail":         {"ar": "❌ فشل الرفع: {err}",  "en": "❌ Upload failed: {err}"},
    "pub_cover_fallback":     {"ar": ("❌ أرسل <b>صورة</b> فعلية (📷 أو 📎)، لا روابط.\n"
                                      "أو اكتب <code>تخطّى</code> لتجاوز الغلاف."),
                               "en": ("❌ Send an actual <b>image</b> (📷 or 📎), not a link.\n"
                                      "Or type <code>skip</code> to skip the cover.")},
    "pub_ask_file": {
        "ar": ("📎 أرسل <b>ملف الكتاب</b> الآن:\n\n"
               "• الصيغ المسموحة: <b>PDF / EPUB / ZIP / MP3</b>\n"
               "• الحد الأقصى للحجم: <b>{mb} MB</b>\n\n"
               "أرسله كملف مرفق (📎). الملف مطلوب لإكمال النشر."),
        "en": ("📎 Send the <b>book file</b> now:\n\n"
               "• Allowed formats: <b>PDF / EPUB / ZIP / MP3</b>\n"
               "• Maximum size: <b>{mb} MB</b>\n\n"
               "Send it as an attachment (📎). The file is required to complete publishing."),
    },
    "pub_file_busy":         {"ar": "⏳ جاري معالجة الملف السابق… انتظر لحظة.",
                              "en": "⏳ Processing previous file… please wait."},
    "pub_file_bad_mime":     {"ar": "❌ صيغة الملف غير مسموحة. الصيغ المقبولة: <b>PDF / EPUB / ZIP / MP3</b>.",
                              "en": "❌ File format not allowed. Accepted: <b>PDF / EPUB / ZIP / MP3</b>."},
    "pub_file_too_large":    {"ar": ("❌ حجم الملف يتجاوز {mb} MB.\n"
                                     "يمكنك ضغطه أو رفعه عبر الموقع للملفات الأكبر."),
                              "en": ("❌ File exceeds {mb} MB.\n"
                                     "You can compress it or upload via the web for larger files.")},
    "pub_file_uploading":    {"ar": "⏳ جاري رفع الملف…", "en": "⏳ Uploading file…"},
    "pub_file_uploaded":     {"ar": "✅ تم رفع الملف.",    "en": "✅ File uploaded."},
    "pub_file_fail_default": {"ar": "تعذّر رفع الملف",     "en": "File upload failed"},
    "pub_file_fail":         {"ar": "❌ فشل الرفع: {err}", "en": "❌ Upload failed: {err}"},
    "pub_file_fallback":     {"ar": "❌ أرسل <b>ملفًا مرفقًا</b> (📎) — لا روابط ولا صور.",
                              "en": "❌ Send an <b>attached file</b> (📎) — no links or images."},
    "pub_summary": {
        "ar": ("📤 <b>تأكيد النشر</b>\n\n"
               "📖 العنوان: <b>{title}</b>\n"
               "💰 السعر: <code>{price}</code> SKZ\n"
               "🏷️ التصنيف: #{cat}\n"
               "🖼️ الغلاف: {cover}\n"
               "📎 الملف: <code>{fname}</code> ({kb} KB)\n"
               "📄 الوصف: {desc}…\n\n"
               "بعد الإرسال سيخضع الكتاب لمراجعة إدارية قبل النشر، وسيصلك إشعار فور الموافقة."),
        "en": ("📤 <b>Confirm Publication</b>\n\n"
               "📖 Title: <b>{title}</b>\n"
               "💰 Price: <code>{price}</code> SKZ\n"
               "🏷️ Category: #{cat}\n"
               "🖼️ Cover: {cover}\n"
               "📎 File: <code>{fname}</code> ({kb} KB)\n"
               "📄 Description: {desc}…\n\n"
               "After submission, the book will undergo admin review before publishing. You'll be notified upon approval."),
    },
    "pub_cover_yes":   {"ar": "مرفق ✓",   "en": "attached ✓"},
    "pub_cover_no":    {"ar": "لا يوجد",  "en": "none"},
    "pub_btn_submit": {"ar": "✅ إرسال للمراجعة", "en": "✅ Submit for review"},
    "pub_btn_cancel": {"ar": "❌ إلغاء",          "en": "❌ Cancel"},
    "pub_submitted":  {"ar": "✅ تم استلام الكتاب بنجاح (#{id}). سنراجعه قريبًا.",
                       "en": "✅ Book received successfully (#{id}). We'll review it shortly."},
    # Product detail / purchase
    "product_detail": {
        "ar": ("📖 <b>{title}</b>\n\n"
               "{desc}\n\n"
               "💰 السعر: <code>{price}</code> SKZ\n"
               "🛒 المبيعات: {sales}  ⭐ {rating} ({rcount})"),
        "en": ("📖 <b>{title}</b>\n\n"
               "{desc}\n\n"
               "💰 Price: <code>{price}</code> SKZ\n"
               "🛒 Sales: {sales}  ⭐ {rating} ({rcount})"),
    },
    "product_short": {
        "ar": ("📖 <b>{title}</b>\n\n"
               "{desc}\n\n"
               "💰 السعر: <code>{price}</code> SKZ"),
        "en": ("📖 <b>{title}</b>\n\n"
               "{desc}\n\n"
               "💰 Price: <code>{price}</code> SKZ"),
    },
    "product_not_found": {"ar": "❌ المنتج غير موجود", "en": "Product not found"},
    "btn_buy":           {"ar": "🛒 شراء بـ {price} SKZ", "en": "🛒 Buy for {price} SKZ"},
    "btn_back_menu":     {"ar": "🔙 القائمة",             "en": "🔙 Menu"},
    "btn_back_browse":   {"ar": "🔙 رجوع",                "en": "🔙 Back"},
    "btn_back_arrow":    {"ar": "⬅️ رجوع",                "en": "⬅️ Back"},
    "buy_insufficient": {
        "ar": ("❌ <b>رصيد SKZ غير كافٍ</b>\n\n"
               "اشحن محفظتك من البوت الأم — يدعم Telegram Stars و USDT/TON.\n"
               "بعد الشحن ارجع وأكمل الشراء."),
        "en": ("❌ <b>Insufficient SKZ balance</b>\n\n"
               "Top up your wallet from the Mother Bot — supports Telegram Stars and USDT/TON.\n"
               "Return after topping up to complete your purchase."),
    },
    "btn_topup_wallet":  {"ar": "💳 شحن المحفظة (Stars / TON)",
                          "en": "💳 Top up wallet (Stars / TON)"},
    "buy_receipt": {
        "ar": ("✅ <b>تم الشراء بنجاح</b>\n\n"
               "📖 {title}\n"
               "💰 المدفوع: <code>{paid}</code> SKZ\n"
               "💵 الرصيد الجديد: <code>{balance}</code> SKZ"),
        "en": ("✅ <b>Purchase successful</b>\n\n"
               "📖 {title}\n"
               "💰 Paid: <code>{paid}</code> SKZ\n"
               "💵 New balance: <code>{balance}</code> SKZ"),
    },
    "buy_doc_caption":   {"ar": "📖 <b>{title}</b>\n⏱ الرابط صالح 7 أيام.",
                          "en": "📖 <b>{title}</b>\n⏱ Link valid for 7 days."},
    "buy_doc_failed":    {"ar": ("⚠️ تعذّر إرسال الملف مباشرة داخل Telegram (قد يكون حجمه كبيرًا أو الرابط من سيرفر خارجي).\n"
                                 "اضغط الزر التالي لتنزيله من المتصفح:"),
                          "en": ("⚠️ Couldn't send the file directly in Telegram (it may be too large or hosted externally).\n"
                                 "Tap the button below to download it via browser:")},
    "btn_download_book": {"ar": "📥 تنزيل الكتاب", "en": "📥 Download book"},
    "buy_answer_ok":     {"ar": "تم الشراء ✅",    "en": "Purchase complete ✅"},
    "buy_err_alert":     {"ar": "❌ {msg}",        "en": "❌ {msg}"},
    "buy_default_title": {"ar": "كتاب",            "en": "book"},
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
