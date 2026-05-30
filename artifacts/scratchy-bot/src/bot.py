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
    1. SCRATCHY_BOT_API_KEY env var — accepted only if it contains no colon
       (a Telegram token always has "1234567890:AAG..." format).
    2. HTTP fallback via GET /api/bots + ADMIN_TOKEN — pure-Python urllib,
       no external driver needed.  Works in Replit and on Contabo alike.
    """
    env_key = os.getenv("SCRATCHY_BOT_API_KEY", "").strip()
    if env_key and ":" not in env_key and len(env_key) >= 20:
        return env_key

    if env_key and ":" in env_key:
        logger.warning(
            "SCRATCHY_BOT_API_KEY looks like a Telegram bot token — "
            "falling back to /api/bots lookup"
        )

    # HTTP fallback — GET /api/bots/scratchy-bot/api-key (admin-only endpoint)
    admin_token = os.getenv("ADMIN_TOKEN", "").strip()
    api_url = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
    if admin_token:
        try:
            import urllib.request as _req
            import json as _json
            req = _req.Request(
                f"{api_url}/bots/scratchy-bot/api-key",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            with _req.urlopen(req, timeout=5) as resp:
                data = _json.loads(resp.read())
            key = data.get("apiKey", "")
            if key:
                logger.info("scratchy-bot: API key loaded from /api/bots/scratchy-bot/api-key")
                return key
            logger.warning("scratchy-bot: /api/bots/scratchy-bot/api-key returned empty key")
        except Exception as exc:
            logger.warning(f"scratchy-bot: api-key endpoint fallback failed: {exc}")

    if not env_key:
        logger.warning("SCRATCHY_BOT_API_KEY not set — API calls will fail auth")
    return env_key

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
    return ""


WEB_APP_URL = _resolve_web_app_url()

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

api = ScratchyBotClient(api_key=_resolve_api_key(), base_url=API_URL)
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
    if MOTHER_BOT_USERNAME:
        rows.append([InlineKeyboardButton(
            text="◆ SOUQRATES SYSTEM",
            url=f"https://t.me/{MOTHER_BOT_USERNAME}",
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
    if MOTHER_BOT_USERNAME:
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_topup"),
            url=f"https://t.me/{MOTHER_BOT_USERNAME}",
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
    new_lang = cb.data.split(":", 1)[1]
    if new_lang not in LANGS:
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

    if WEB_APP_URL.startswith("https://"):
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

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "scratchy-bot")


if __name__ == "__main__":
    asyncio.run(main())
