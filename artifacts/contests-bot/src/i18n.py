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
    _LANG_CACHE[telegram_id] = (lang, time.time())
    return ok


def lang_keyboard(callback_prefix: str = "lang") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=LANG_NAMES["ar"], callback_data=f"{callback_prefix}:ar")],
        [InlineKeyboardButton(text=LANG_NAMES["en"], callback_data=f"{callback_prefix}:en")],
    ])
