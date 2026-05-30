"""Bilingual (ar/en) i18n helper for scratchy-bot."""
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
        "ar": ("🎰 أهلاً بك في <b>SOUQRATES SCRATCHY</b> ♠\n"
               "ألعاب الحظ والحك واربح!\n\n"
               "اضغط 🎮 للعب الآن، أو 💰 لعرض محفظتك."),
        "en": ("🎰 Welcome to <b>SOUQRATES SCRATCHY</b> ♠\n"
               "Luck games — scratch & win!\n\n"
               "Tap 🎮 to play now, or 💰 to view your wallet."),
    },
    "btn_play":     {"ar": "🎮 العب الآن",       "en": "🎮 Play Now"},
    "btn_wallet":   {"ar": "💰 محفظتي SKZ",      "en": "💰 My SKZ Wallet"},
    "btn_lang":     {"ar": "🌐 اللغة",            "en": "🌐 Language"},
    "btn_help":     {"ar": "❓ مساعدة",           "en": "❓ Help"},
    "btn_home":     {"ar": "🏠 الرئيسية",        "en": "🏠 Home"},
    "btn_back":     {"ar": "◀️ رجوع",             "en": "◀️ Back"},
    "btn_topup":    {"ar": "💳 شحن رصيد",        "en": "💳 Top Up"},
    "lang_prompt":  {"ar": "اختر لغتك:",          "en": "Choose your language:"},
    "lang_set_ok":  {"ar": "✅ تم تغيير اللغة",   "en": "✅ Language changed"},
    "lang_set_fail":{"ar": "❌ فشل تغيير اللغة",  "en": "❌ Failed to change language"},
    "wallet_title": {"ar": "💰 <b>محفظتك</b>",   "en": "💰 <b>Your Wallet</b>"},
    "wallet_body":  {
        "ar": "💰 <b>محفظتك</b>\n\n🪙 رصيد SKZ: <code>{skz}</code>\n\nاضغط شحن رصيد للإيداع عبر البوت الأم.",
        "en": "💰 <b>Your Wallet</b>\n\n🪙 SKZ Balance: <code>{skz}</code>\n\nTap Top Up to deposit via the mother bot.",
    },
    "help_body": {
        "ar": ("❓ <b>كيف تلعب؟</b>\n\n"
               "1️⃣ اضغط <b>العب الآن</b>\n"
               "2️⃣ اختر لعبة من القائمة\n"
               "3️⃣ اختر المستوى (رسوم الدخول)\n"
               "4️⃣ اختر بطاقتك من 1 إلى 100\n"
               "5️⃣ احك واربح! 🎉\n\n"
               "الرصيد يُحسم من محفظة SKZ الموحّدة."),
        "en": ("❓ <b>How to Play?</b>\n\n"
               "1️⃣ Tap <b>Play Now</b>\n"
               "2️⃣ Choose a game\n"
               "3️⃣ Choose your tier (entry fee)\n"
               "4️⃣ Pick a card from 1 to 100\n"
               "5️⃣ Scratch & win! 🎉\n\n"
               "Balance is deducted from your unified SKZ wallet."),
    },
    "err_generic":  {"ar": "❌ حدث خطأ، حاول مجدداً",  "en": "❌ An error occurred, try again"},
    "err_banned":   {"ar": "🚫 حسابك موقوف مؤقتاً",    "en": "🚫 Your account is suspended"},
}


def t(lang: str, key: str, **kwargs: object) -> str:
    entry = TR.get(key, {})
    text = entry.get(lang) or entry.get("ar") or key
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, ValueError):
            pass
    return text


_lang_cache: dict[str, tuple[str, float]] = {}
_LANG_TTL = 300.0


def invalidate_lang_cache(tg_id: str) -> None:
    _lang_cache.pop(tg_id, None)


async def get_user_lang(tg_id: str, api_url: str, api_key: str) -> str:
    cached = _lang_cache.get(tg_id)
    if cached and time.time() - cached[1] < _LANG_TTL:
        return cached[0]
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{api_url}/users/{tg_id}",
                headers={"X-Bot-Api-Key": api_key},
                timeout=5.0,
            )
            if resp.status_code == 200:
                lang = (resp.json().get("user") or {}).get("languageCode") or DEFAULT_LANG
                if lang not in LANGS:
                    lang = DEFAULT_LANG
                _lang_cache[tg_id] = (lang, time.time())
                return lang
    except Exception:
        pass
    return DEFAULT_LANG


async def set_user_lang(
    tg_id: str, lang: str, api_url: str, api_key: str,
    first_name: str = "User", username: Optional[str] = None,
) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{api_url}/internal/users/upsert",
                json={
                    "telegramId": tg_id,
                    "firstName": first_name,
                    "username": username,
                    "languageCode": lang,
                },
                headers={"X-Bot-Api-Key": api_key, "Content-Type": "application/json"},
                timeout=8.0,
            )
            return resp.status_code == 200
    except Exception:
        return False


def lang_keyboard(prefix: str = "lang") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=name, callback_data=f"{prefix}:{code}")]
        for code, name in LANG_NAMES.items()
    ])
