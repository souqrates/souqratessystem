"""Bilingual (ar/en) i18n helper for contests-bot. Mirrors mother-bot/i18n.py."""
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
    "welcome": {
        "ar": ("👋 أهلاً بك في <b>SOUQRATES STAGE</b> ★\n"
                "مسرح المسابقات والتصويت.\n\n"
                "اضغط 🏆 للوحة المتسابقين، 🗳 للتصويت، أو 🎟 لشراء باقات الأصوات."),
        "en": ("👋 Welcome to <b>SOUQRATES STAGE</b> ★\n"
                "The contests &amp; voting arena.\n\n"
                "Tap 🏆 for the leaderboard, 🗳 to vote, or 🎟 to buy vote packs."),
    },
    "btn_leaderboard": {"ar": "🏆 المتسابقون",  "en": "🏆 Leaderboard"},
    "btn_vote":        {"ar": "🗳 صَوِّت",       "en": "🗳 Vote"},
    "btn_packs":       {"ar": "🎟 الباقات",     "en": "🎟 Vote Packs"},
    "btn_mybal":       {"ar": "💼 رصيدي",       "en": "💼 My balance"},
    "btn_wallet":      {"ar": "💰 محفظتي SKZ",  "en": "💰 My SKZ wallet"},
    "btn_help":        {"ar": "ℹ️ مساعدة",      "en": "ℹ️ Help"},
    "btn_back":        {"ar": "🔙 رجوع",        "en": "🔙 Back"},
    "btn_open_stage":  {"ar": "★ افتح مسرح المسابقات", "en": "★ Open Contests Stage"},
    "err_generic":     {"ar": "❌ حدث خطأ، حاول مجدداً.",
                        "en": "❌ Something went wrong, try again."},
    "lang_prompt":     {"ar": "🌐 اختر لغة البوت:\nChoose your bot language:",
                        "en": "🌐 Choose your bot language:\nاختر لغة البوت:"},
    "lang_set_ok":     {"ar": "✅ تم تعيين اللغة إلى العربية.",
                        "en": "✅ Language set to English."},
    "lang_set_fail":   {"ar": "❌ تعذّر حفظ اختيار اللغة. حاول لاحقاً.",
                        "en": "❌ Could not save language preference. Try again later."},

    # ── Home / render_home ────────────────────────────────────────────────
    "home_welcome_title":    {"ar": "★ SOUQRATES STAGE",
                              "en": "★ SOUQRATES STAGE"},
    "home_welcome_subtitle": {"ar": "مسرح المسابقات والتصويت — جزء من منظومة 🏛 SOUQRATES SYSTEM",
                              "en": "Contests &amp; voting arena — part of the 🏛 SOUQRATES SYSTEM"},
    "home_no_active": {
        "ar": "🌙 لا توجد مسابقة نشطة حاليًّا.\nترقّب المسابقة القادمة قريبًا!",
        "en": "🌙 No active contest right now.\nStay tuned for the next one!",
    },
    "home_voting_not_started": {"ar": "<i>لم يبدأ التصويت بعد</i>",
                                "en": "<i>Voting hasn't started yet</i>"},
    "home_lb_line_ar": {"ar": "{medal} <b>{name}</b> — <code>{votes}</code> صوت",
                       "en": "{medal} <b>{name}</b> — <code>{votes}</code> votes"},
    "home_current_contest": {"ar": "🎬 <b>المسابقة الحالية:</b> {title}",
                             "en": "🎬 <b>Current contest:</b> {title}"},
    "home_total_votes":     {"ar": "🗳 <b>إجمالي الأصوات:</b> <code>{total}</code>",
                             "en": "🗳 <b>Total votes:</b> <code>{total}</code>"},
    "home_top_ranks_label": {"ar": "<b>المراكز الأولى:</b>",
                             "en": "<b>Top ranks:</b>"},
    "home_free_vote_daily": {
        "ar": "🎁 لديك <b>صوت مجاني واحد</b> كل يوم — استخدمه لمتسابقك المفضّل!",
        "en": "🎁 You get <b>one free vote</b> every day — spend it on your favorite contestant!",
    },

    # ── Main keyboard ─────────────────────────────────────────────────────
    "btn_main_leaderboard": {"ar": "🏆 لوحة المتسابقين", "en": "🏆 Leaderboard"},
    "btn_main_vote_now":    {"ar": "🗳 صَوِّت الآن",      "en": "🗳 Vote now"},
    "btn_main_packs":       {"ar": "🎟 باقات التصويت",  "en": "🎟 Vote packs"},
    "btn_main_mybal":       {"ar": "💼 رصيد أصواتي",    "en": "💼 My votes"},
    "btn_main_wallet":      {"ar": "💰 محفظتي (SKZ)",   "en": "💰 My wallet (SKZ)"},
    "btn_main_system":      {"ar": "🏛 SOUQRATES SYSTEM — المحفظة الموحّدة",
                             "en": "🏛 SOUQRATES SYSTEM — Unified wallet"},
    "btn_home":             {"ar": "◀ القائمة الرئيسية", "en": "◀ Main menu"},
    "btn_back_short":       {"ar": "◀ رجوع",             "en": "◀ Back"},

    # ── Leaderboard / cb_board ────────────────────────────────────────────
    "board_no_active":      {"ar": "🌙 لا توجد مسابقة نشطة.",
                             "en": "🌙 No active contest."},
    "board_no_contestants": {"ar": "<i>لا يوجد متسابقون بعد.</i>",
                             "en": "<i>No contestants yet.</i>"},

    # ── Vote menu ─────────────────────────────────────────────────────────
    "vote_no_active":       {"ar": "🌙 لا توجد مسابقة نشطة للتصويت.",
                             "en": "🌙 No active contest to vote in."},
    "vote_no_contestants":  {"ar": "لا يوجد متسابقون متاحون للتصويت.",
                             "en": "No contestants available to vote for."},
    "vote_free_available":  {"ar": "✅ متاح",         "en": "✅ Available"},
    "vote_free_used_today": {"ar": "❌ مستخدم اليوم", "en": "❌ Used today"},
    "vote_dash":            {"ar": "—",               "en": "—"},
    "vote_header": {
        "ar": ("🗳 <b>صوِّت في:</b> {title}\n\n"
               "🎁 صوتك المجاني: <b>{free}</b>\n"
               "⚡ أصوات مدفوعة متاحة: <b>{paid}</b>\n\n"
               "اختر المتسابق:"),
        "en": ("🗳 <b>Vote in:</b> {title}\n\n"
               "🎁 Free vote: <b>{free}</b>\n"
               "⚡ Paid votes available: <b>{paid}</b>\n\n"
               "Choose a contestant:"),
    },
    "vote_btn_contestant": {"ar": "🗳 {name} ({votes} صوت)",
                            "en": "🗳 {name} ({votes} votes)"},

    # ── cb_vote outcomes ─────────────────────────────────────────────────
    "err_bad_data":        {"ar": "بيانات غير صالحة", "en": "Invalid data"},
    "vote_src_free":       {"ar": "مجاني 🎁",         "en": "free 🎁"},
    "vote_src_paid":       {"ar": "مدفوع ⚡",         "en": "paid ⚡"},
    "vote_src_unknown":    {"ar": "?",                "en": "?"},
    "vote_success":        {"ar": "✅ تم تسجيل صوتك ({src})",
                            "en": "✅ Vote recorded ({src})"},
    "vote_no_votes":       {"ar": "❌ لا تملك أصواتًا متاحة. اشترِ باقة من 🎟",
                            "en": "❌ No votes available. Buy a pack from 🎟"},
    "err_banned_financial":{"ar": "❌ تم حظر حسابك من العمليات المالية.",
                            "en": "❌ Your account is blocked from financial operations."},
    "err_state_changed":   {"ar": "⚠ تغيّرت حالة المسابقة. أعد المحاولة.",
                            "en": "⚠ Contest state changed. Please retry."},
    "err_vote_generic":    {"ar": "⚠ تعذّر التصويت. حاول لاحقًا.",
                            "en": "⚠ Could not vote. Try again later."},

    # ── Packs / purchase ─────────────────────────────────────────────────
    "packs_none":          {"ar": "📦 لا توجد باقات متاحة حاليًّا.",
                            "en": "📦 No vote packs available right now."},
    "packs_header":        {"ar": "🎟 <b>باقات التصويت</b>\n",
                            "en": "🎟 <b>Vote packs</b>\n"},
    "packs_bonus_suffix":  {"ar": " +{bonus} مكافأة",
                            "en": " +{bonus} bonus"},
    "packs_line":          {"ar": "• <b>{name}</b>{file_tag}\n  <code>{votes}</code> صوت{bonus} — <b>{price} SKZ</b>",
                            "en": "• <b>{name}</b>{file_tag}\n  <code>{votes}</code> votes{bonus} — <b>{price} SKZ</b>"},
    "packs_btn_buy":       {"ar": "شراء {name} ({price} SKZ)",
                            "en": "Buy {name} ({price} SKZ)"},
    "buy_success": {
        "ar": ("✅ <b>تمّ الشراء بنجاح!</b>\n\n"
               "⚡ تمّ إضافة <b>{votes}</b> صوت إلى رصيدك.\n"
               "💰 رصيد SKZ المتبقي: <b>{bal}</b>"),
        "en": ("✅ <b>Purchase successful!</b>\n\n"
               "⚡ <b>{votes}</b> votes added to your balance.\n"
               "💰 Remaining SKZ balance: <b>{bal}</b>"),
    },
    "buy_bonus_file_hint": {"ar": "\n\n🎁 لديك ملف مكافأة! اضغط 💼 لاسترجاعه.",
                            "en": "\n\n🎁 You have a bonus file! Tap 💼 to claim it."},
    "buy_done_toast":      {"ar": "✅ تم", "en": "✅ Done"},
    "buy_btn_topup":       {"ar": "💰 شحن SKZ من البوت الأم",
                            "en": "💰 Top up SKZ via Mother Bot"},
    "buy_insufficient_body": {
        "ar": "❌ رصيد SKZ غير كافٍ لشراء هذه الباقة.\nاشحن محفظتك من البوت الأم ثم عُد.",
        "en": "❌ Insufficient SKZ balance for this pack.\nTop up via the Mother Bot then come back.",
    },
    "err_banned_short":    {"ar": "❌ تم حظر حسابك.",
                            "en": "❌ Your account is blocked."},
    "err_purchase_generic":{"ar": "⚠ تعذّر الشراء. حاول لاحقًا.",
                            "en": "⚠ Could not purchase. Try again later."},

    # ── My balance ───────────────────────────────────────────────────────
    "mybal_fetch_err":     {"ar": "⚠ تعذّر جلب رصيدك.",
                            "en": "⚠ Could not fetch your balance."},
    "mybal_free_used":     {"ar": "❌ استُخدم اليوم",
                            "en": "❌ Used today"},
    "mybal_title":         {"ar": "💼 <b>رصيد أصواتي</b>\n",
                            "en": "💼 <b>My votes</b>\n"},
    "mybal_free_line":     {"ar": "🎁 الصوت المجاني اليومي: <b>{val}</b>",
                            "en": "🎁 Daily free vote: <b>{val}</b>"},
    "mybal_paid_line":     {"ar": "⚡ الأصوات المدفوعة المتبقّية: <b>{val}</b>",
                            "en": "⚡ Remaining paid votes: <b>{val}</b>"},
    "mybal_bonus_section": {"ar": "\n🎁 <b>مكافآتك (ملفات قابلة للتنزيل):</b>",
                            "en": "\n🎁 <b>Your rewards (downloadable files):</b>"},
    "mybal_bonus_default": {"ar": "ملف مكافأة", "en": "Bonus file"},
    "mybal_bonus_short":   {"ar": "ملف",         "en": "file"},
    "mybal_btn_download":  {"ar": "📥 تنزيل: {name}",
                            "en": "📥 Download: {name}"},
    "mybal_btn_buy_more":  {"ar": "🎟 شراء المزيد",
                            "en": "🎟 Buy more"},

    # ── Downloads ────────────────────────────────────────────────────────
    "dl_ready_toast":      {"ar": "🔗 جاهز للتنزيل",
                            "en": "🔗 Ready to download"},
    "dl_file_default":     {"ar": "ملف المكافأة", "en": "Bonus file"},
    "dl_message":          {"ar": "📥 <b>{name}</b>\n\n<a href=\"{url}\">اضغط هنا للتنزيل</a>",
                            "en": "📥 <b>{name}</b>\n\n<a href=\"{url}\">Tap here to download</a>"},
    "dl_err_link":         {"ar": "⚠ تعذّر إصدار الرابط.",
                            "en": "⚠ Could not issue download link."},
    "dl_err_generic":      {"ar": "⚠ تعذّر التنزيل.",
                            "en": "⚠ Could not download."},

    # ── Wallet ───────────────────────────────────────────────────────────
    "wallet_btn_topup":    {"ar": "💰 شحن من البوت الأم",
                            "en": "💰 Top up via Mother Bot"},
    "wallet_btn_buy_pack": {"ar": "🎟 شراء باقة",
                            "en": "🎟 Buy a pack"},
    "wallet_body": {
        "ar": ("💰 <b>محفظتك الموحّدة</b>\n\n"
               "⚡ رصيد SKZ: <b>{skz}</b>\n\n"
               "محفظتك مُدارة مركزيًّا عبر 🏛 <b>SOUQRATES SYSTEM</b>\n"
               "(نفس الرصيد يعمل في كل بوتات سوقراط).\n\n"
               "استخدم رصيد SKZ لشراء باقات التصويت."),
        "en": ("💰 <b>Your unified wallet</b>\n\n"
               "⚡ SKZ balance: <b>{skz}</b>\n\n"
               "Your wallet is managed centrally by 🏛 <b>SOUQRATES SYSTEM</b>\n"
               "(the same balance works across every SOUQRATES bot).\n\n"
               "Use your SKZ balance to buy vote packs."),
    },

    # ── Help ─────────────────────────────────────────────────────────────
    "help_body": {
        "ar": ("📖 <b>مساعدة SOUQRATES STAGE</b>\n\n"
               "/start — القائمة الرئيسية\n\n"
               "• <b>صوت مجاني واحد يوميًّا</b> (UTC) لكل مستخدم على المنصّة كلّها.\n"
               "• اشترِ <b>باقات أصوات</b> برصيد SKZ من زر 🎟.\n"
               "• بعض الباقات تتضمّن <b>ملف مكافأة</b> (مثلًا كتاب PDF).\n"
               "• كل المعاملات مالية مُسجّلة وقابلة للتدقيق."),
        "en": ("📖 <b>SOUQRATES STAGE — Help</b>\n\n"
               "/start — main menu\n\n"
               "• <b>One free vote per day</b> (UTC) per user across the entire platform.\n"
               "• Buy <b>vote packs</b> with your SKZ balance via the 🎟 button.\n"
               "• Some packs include a <b>bonus file</b> (e.g. a PDF book).\n"
               "• Every financial transaction is logged and auditable."),
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
