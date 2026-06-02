"""
SOUQRATES SCRATCHY — Scratch & win Telegram bot (Python aiogram).

User flow:
- /start  → welcome + open mini app button
- 🎮     → open the scratchy web mini-app
- 💰     → SKZ wallet balance
- ❓     → help
- 🌐     → change language

All financial operations (charge-entry / credit-reward) happen inside
the web mini-app (artifacts/bot-demo). This bot is a thin shell that:
  1. Registers/upserts users on /start
  2. Surfaces the mini-app via a WebApp button
  3. Shows wallet balance on request
"""
import asyncio
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scratchy-bot")

from sentry_init import init_sentry
init_sentry("scratchy-bot")

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    BotCommandScopeDefault,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)
from aiogram.exceptions import TelegramBadRequest

from client import ScratchyBotClient
from i18n import (
    t,
    get_user_lang,
    set_user_lang,
    lang_keyboard,
    invalidate_lang_cache,
    DEFAULT_LANG,
    LANGS,
)

# ── Configuration ──────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("SCRATCHY_BOT_TOKEN")
API_URL   = os.getenv("MOTHER_API_URL", "http://localhost:80/api")

def _resolve_api_key() -> str:
    """
    Resolve the scratchy-bot internal API key.

    Priority:
    1. SCRATCHY_BOT_API_KEY env var — accepted only if it looks like a valid
       hex API key (no colon, length ≥ 20). A Telegram token always contains
       a colon ("1234567890:AAG...") so that pattern is explicitly rejected.
    2. HTTP fallback via GET /api/superadmin/bots/scratchy-bot/api-key with
       ADMIN_TOKEN bearer auth — pure stdlib urllib, no third-party deps.
       Retries 5× with exponential back-off (3 s → 5 s → 8 s → 12 s) to
       survive the race condition where bots start before the API server is up.
    """
    import urllib.request as _ureq
    import json as _json
    import time as _time

    env_key = os.getenv("SCRATCHY_BOT_API_KEY", "").strip()
    if env_key and ":" not in env_key and len(env_key) >= 20:
        logger.info("SCRATCHY_BOT_API_KEY loaded from environment")
        return env_key

    if env_key and ":" in env_key:
        logger.warning(
            "SCRATCHY_BOT_API_KEY looks like a Telegram bot token (contains ':') — "
            "it must be the internal API key, NOT the bot token. "
            "Trying HTTP fallback via /api/superadmin/bots"
        )
    elif env_key:
        logger.warning(
            "SCRATCHY_BOT_API_KEY is too short or otherwise invalid — "
            "trying HTTP fallback via /api/superadmin/bots"
        )
    else:
        logger.warning(
            "SCRATCHY_BOT_API_KEY is not set — "
            "trying HTTP fallback via /api/superadmin/bots"
        )

    # HTTP fallback: fetch the raw API key from the superadmin endpoint.
    # ADMIN_TOKEN must be present (always is in production and Replit secrets).
    # Retries handle the race where this bot starts before the API server is ready.
    admin_token = os.getenv("ADMIN_TOKEN", "").strip()
    api_url = os.getenv("MOTHER_API_URL", "http://localhost:80/api").rstrip("/")
    _endpoint = f"{api_url}/superadmin/bots/scratchy-bot/api-key"

    if not admin_token:
        logger.warning(
            "ADMIN_TOKEN is not set — HTTP fallback for SCRATCHY_BOT_API_KEY "
            "cannot proceed. Set ADMIN_TOKEN in the environment."
        )
    else:
        # Exponential back-off: 3 s, 5 s, 8 s, 12 s between attempts
        _sleeps = [3, 5, 8, 12]
        _max_attempts = len(_sleeps) + 1  # 5 total attempts
        for _attempt in range(1, _max_attempts + 1):
            try:
                logger.info(
                    "HTTP fallback attempt %d/%d → %s",
                    _attempt, _max_attempts, _endpoint,
                )
                _request = _ureq.Request(
                    _endpoint,
                    headers={"Authorization": f"Bearer {admin_token}"},
                )
                with _ureq.urlopen(_request, timeout=10) as _resp:
                    _data = _json.loads(_resp.read())
                    _key = (_data.get("apiKey") or "").strip()
                    if _key and ":" not in _key and len(_key) >= 20:
                        logger.info(
                            "SCRATCHY_BOT_API_KEY resolved via HTTP fallback "
                            "(attempt %d/%d)",
                            _attempt, _max_attempts,
                        )
                        return _key
                    logger.warning(
                        "HTTP fallback attempt %d/%d: endpoint returned unexpected "
                        "key shape (len=%d, has_colon=%s)",
                        _attempt, _max_attempts, len(_key), ":" in _key,
                    )
            except Exception as _exc:
                logger.warning(
                    "HTTP fallback attempt %d/%d failed: %s",
                    _attempt, _max_attempts, _exc,
                )
            if _attempt < _max_attempts:
                _sleep = _sleeps[_attempt - 1]
                logger.info("Waiting %ds before next attempt…", _sleep)
                _time.sleep(_sleep)

    if not env_key:
        raise RuntimeError(
            "SCRATCHY_BOT_API_KEY is not set and HTTP fallback failed.\n"
            "Fix: set SCRATCHY_BOT_API_KEY to the api_key from the bots table "
            "(slug='scratchy-bot') in the Replit Secrets panel.\n"
            "The api_key is a hex string with no colons — find it in the "
            "superadmin panel under Bots → scratchy-bot → API Key."
        )
    raise RuntimeError(
        "SCRATCHY_BOT_API_KEY is invalid (contains ':' — looks like a Telegram "
        "bot token) and the HTTP fallback via ADMIN_TOKEN also failed.\n"
        "Fix: set SCRATCHY_BOT_API_KEY to the api_key from the bots table "
        "(slug='scratchy-bot'), NOT the bot token from BotFather.\n"
        "The api_key is a hex string with no colons — find it in the "
        "superadmin panel under Bots → scratchy-bot → API Key."
    )

MOTHER_BOT_USERNAME = os.getenv("MOTHER_BOT_USERNAME", "souqrates_system_bot")


def _resolve_web_app_url() -> str:
    explicit = (os.getenv("SCRATCHY_WEB_APP_URL") or "").strip()
    if explicit:
        return explicit
    public = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if public:
        return f"{public}/scratchy-bot-web/"
    rds = (os.getenv("REPLIT_DOMAINS") or "").split(",")[0].strip()
    if rds:
        return f"https://{rds}/scratchy-bot-web/"
    dev = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
    if dev:
        return f"https://{dev}/scratchy-bot-web/"
    return "https://souqrates.com/scratchy-bot-web/"


WEB_APP_URL = _resolve_web_app_url()

def _resolve_mother_app_url() -> str:
    explicit = (os.getenv("MOTHER_APP_URL") or "").strip()
    if explicit:
        return explicit
    public = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if public:
        return f"{public}/"
    rds = (os.getenv("REPLIT_DOMAINS") or "").split(",")[0].strip()
    if rds:
        return f"https://{rds}/"
    dev = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
    if dev:
        return f"https://{dev}/"
    return "https://souqrates.com/"
MOTHER_APP_URL = _resolve_mother_app_url()

# ── Commands menu ──────────────────────────────────────────────────────────
COMMANDS: list[BotCommand] = [
    BotCommand(command="start",  description="🎰 ابدأ وافتح القائمة الرئيسية"),
    BotCommand(command="play",   description="🎮 افتح ألعاب الحك واربح"),
    BotCommand(command="wallet", description="💰 عرض رصيد SKZ"),
    BotCommand(command="lang",   description="🌐 تغيير اللغة"),
    BotCommand(command="help",   description="❓ مساعدة وقواعد اللعب"),
]

COMMANDS_EN: list[BotCommand] = [
    BotCommand(command="start",  description="🎰 Start and open main menu"),
    BotCommand(command="play",   description="🎮 Open scratch & win games"),
    BotCommand(command="wallet", description="💰 Show SKZ balance"),
    BotCommand(command="lang",   description="🌐 Change language"),
    BotCommand(command="help",   description="❓ Help & game rules"),
]

API_KEY = _resolve_api_key()
api = ScratchyBotClient(api_key=API_KEY, base_url=API_URL)
router = Router()


# ── Keyboards ──────────────────────────────────────────────────────────────
def main_kb(lang: str) -> InlineKeyboardMarkup:
    rows = []
    if WEB_APP_URL.startswith("https://"):
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_play"),
            web_app=WebAppInfo(url=WEB_APP_URL),
        )])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_wallet"),  callback_data="wallet")])
    rows.append([
        InlineKeyboardButton(text=t(lang, "btn_help"), callback_data="help"),
        InlineKeyboardButton(text=t(lang, "btn_lang"), callback_data="lang_menu"),
    ])
    if MOTHER_APP_URL:
        rows.append([InlineKeyboardButton(
            text="◆ SOUQRATES SYSTEM",
            web_app=WebAppInfo(url=MOTHER_APP_URL),
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def back_kb(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_home"), callback_data="home")],
    ])


def fmt_skz(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


async def safe_edit(msg: Message, text: str, kb=None):
    try:
        await msg.edit_text(text, reply_markup=kb, disable_web_page_preview=True)
    except Exception:
        await msg.answer(text, reply_markup=kb, disable_web_page_preview=True)


# ── Handlers ───────────────────────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    if message.from_user is None:
        return
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert_user failed: {e}")
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await message.answer(t(lang, "welcome"), reply_markup=main_kb(lang))


@router.message(Command("play"))
async def cmd_play(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    if WEB_APP_URL.startswith("https://"):
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text=t(lang, "btn_play"), web_app=WebAppInfo(url=WEB_APP_URL))
        ]])
        await message.answer(t(lang, "welcome"), reply_markup=kb)
    else:
        await message.answer(t(lang, "welcome"), reply_markup=main_kb(lang))


@router.message(Command("wallet"))
async def cmd_wallet_msg(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await _show_wallet(str(message.from_user.id), lang, message, send_new=True)


@router.message(Command("lang"))
async def cmd_lang(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))


@router.message(Command("help"))
async def cmd_help(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await message.answer(t(lang, "help_body"), reply_markup=back_kb(lang))


# ── Callbacks ──────────────────────────────────────────────────────────────
@router.callback_query(F.data == "home")
async def cb_home(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    await safe_edit(cb.message, t(lang, "welcome"), main_kb(lang))
    await cb.answer()


@router.callback_query(F.data == "wallet")
async def cb_wallet(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    await _show_wallet(str(cb.from_user.id), lang, cb.message)
    await cb.answer()


async def _show_wallet(tg_id: str, lang: str, msg: Message, send_new: bool = False):
    try:
        data = await api.get_wallet(tg_id)
        w = (data or {}).get("wallet") or {}
        skz = fmt_skz(w.get("balanceSkz") or 0)
    except Exception:
        skz = "—"

    rows = []
    if MOTHER_APP_URL:
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_topup"),
            web_app=WebAppInfo(url=MOTHER_APP_URL),
        )])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_home"), callback_data="home")])
    kb = InlineKeyboardMarkup(inline_keyboard=rows)
    body = t(lang, "wallet_body", skz=skz)
    if send_new:
        await msg.answer(body, reply_markup=kb)
    else:
        await safe_edit(msg, body, kb)


@router.callback_query(F.data == "help")
async def cb_help(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    await safe_edit(cb.message, t(lang, "help_body"), back_kb(lang))
    await cb.answer()


@router.callback_query(F.data == "lang_menu")
async def cb_lang_menu(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        await cb.message.edit_text(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))
    except TelegramBadRequest:
        await cb.message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))
    await cb.answer()


@router.callback_query(F.data.startswith("lang:"))
async def cb_lang_set(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    _parts = cb.data.split(":", 1)
    new_lang = _parts[1] if len(_parts) == 2 else ""
    if not new_lang or new_lang not in LANGS:
        await cb.answer("❌", show_alert=False)
        return
    tg_id = str(cb.from_user.id)
    ok = await set_user_lang(
        tg_id, new_lang, API_URL, API_KEY,
        first_name=cb.from_user.first_name or "User",
        username=cb.from_user.username,
    )
    if not ok:
        await cb.answer(t(new_lang, "lang_set_fail"), show_alert=True)
        return
    invalidate_lang_cache(tg_id)
    await cb.answer(t(new_lang, "lang_set_ok"), show_alert=False)
    try:
        await cb.message.edit_text(t(new_lang, "welcome"), reply_markup=main_kb(new_lang))
    except TelegramBadRequest:
        pass


# ── Bootstrap ──────────────────────────────────────────────────────────────
async def main():
    if not BOT_TOKEN:
        logger.error("SCRATCHY_BOT_TOKEN not set — cannot start.")
        return
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    try:
        await bot.set_my_commands(COMMANDS, scope=BotCommandScopeDefault())
        await bot.set_my_commands(COMMANDS_EN, scope=BotCommandScopeDefault(), language_code="en")
        await bot.set_my_commands(COMMANDS, scope=BotCommandScopeDefault(), language_code="ar")
        logger.info(f"published {len(COMMANDS)} commands")
    except Exception as e:
        logger.warning(f"set_my_commands failed: {e}")

    # Only set in production (USE_WEBHOOK=1). Polling / dev mode must NOT touch
    # the global menu button — it would overwrite Contabo's production URL.
    if WEB_APP_URL.startswith("https://") and os.getenv("USE_WEBHOOK"):
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="🎰 SCRATCHY",
                    web_app=WebAppInfo(url=WEB_APP_URL),
                ),
            )
            logger.info(f"menu button → {WEB_APP_URL}")
        except Exception as e:
            logger.warning(f"set_chat_menu_button failed: {e}")

    # Global safety net: any unhandled exception inside any handler (malformed
    # callback data, network failure on an API call, int parse error,
    # None-dereference, etc.) is caught here so a single bad update can never
    # crash the bot. The user gets a friendly notice; the traceback is logged.
    from aiogram.types import ErrorEvent

    async def _on_error(event: ErrorEvent) -> bool:
        logger.exception(f"unhandled handler error: {event.exception!r}")
        upd = event.update
        try:
            if upd.callback_query is not None:
                await upd.callback_query.answer(
                    "⚠️ حدث خطأ مؤقت. حاول مرة أخرى.", show_alert=True
                )
            elif upd.message is not None:
                await upd.message.answer("⚠️ حدث خطأ مؤقت. حاول مرة أخرى لاحقاً.")
        except Exception:
            pass
        return True

    dp.errors.register(_on_error)

    api.start_heartbeat(interval_seconds=30, version="2.0-scratchy")

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "scratchy-bot")


if __name__ == "__main__":
    asyncio.run(main())
