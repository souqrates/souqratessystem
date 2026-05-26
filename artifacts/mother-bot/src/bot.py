import asyncio
import os
import logging
import time

# Sentry must be initialised before any aiogram/business-logic import so it
# can capture even bootstrap failures. Silent no-op if not enabled in panel.
from sentry_init import init_sentry
init_sentry("mother-bot")

from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    PreCheckoutQuery,
    BotCommand,
    BotCommandScopeDefault,
    BotCommandScopeChat,
)
from aiogram.filters import CommandStart, Command
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
import httpx
from dotenv import load_dotenv
from client import MotherBotClient
from i18n import (
    t,
    get_user_lang,
    set_user_lang,
    lang_keyboard,
    invalidate_lang_cache,
    DEFAULT_LANG,
    LANGS,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN        = os.getenv("MOTHER_BOT_TOKEN", "")
MOTHER_API_URL   = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_API_KEY = os.getenv("MOTHER_BOT_API_KEY", "")
MASTER_ADMIN_CODE  = os.getenv("MASTER_ADMIN_CODE", "")
# Public base URL for Telegram WebApp buttons. Order of precedence:
#   1) Explicit MINI_APP_URL / GAMES_APP_URL / CONTESTS_APP_URL env vars
#   2) PUBLIC_BASE_URL env var (single override for all three)
#   3) https://<first of REPLIT_DOMAINS>  (the canonical published-deploy
#      domain; always serves the freshest dist that was deployed)
#   4) https://$REPLIT_DEV_DOMAIN          (dev preview, auto-set in dev)
#   5) https://souqrates.com               (custom brand domain — last
#      resort, because if its DNS is pinned to an older host the user
#      will see a stale build and missing games/features)
def _resolve_default_base() -> str:
    explicit = os.getenv("PUBLIC_BASE_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    replit_domains = os.getenv("REPLIT_DOMAINS", "").strip()
    if replit_domains:
        first = replit_domains.split(",")[0].strip()
        if first:
            return f"https://{first}".rstrip("/")
    dev = os.getenv("REPLIT_DEV_DOMAIN", "").strip()
    if dev:
        return f"https://{dev}".rstrip("/")
    return "https://souqrates.com"

_DEV_DOMAIN = os.getenv("REPLIT_DEV_DOMAIN", "").strip()
_DEFAULT_BASE = _resolve_default_base()
# IMPORTANT: do NOT honor per-artifact env vars (MINI_APP_URL etc.) anymore.
# `.replit` ships with MINI_APP_URL = "https://souqrates.com/" pinned to the
# brand domain, whose DNS currently points at a stale build (missing newer
# games, wrong tier labels). Always derive from the resolved base; the
# single supported override is PUBLIC_BASE_URL (set as a Replit secret).
_BASE_MINI_APP_URL     = f"{_DEFAULT_BASE}/"
_BASE_GAMES_APP_URL    = f"{_DEFAULT_BASE}/games-bot/"
_BASE_CONTESTS_APP_URL = f"{_DEFAULT_BASE}/contests-bot-web/"
BOOKS_BOT_USERNAME    = os.getenv("BOOKS_BOT_USERNAME",    "Souqrates_souq_bot")
CONTESTS_BOT_USERNAME = os.getenv("CONTESTS_BOT_USERNAME", "Souqrates_stage_bot")

# ── WebApp URL stability (CRITICAL) ──────────────────────────────────────────
# DO NOT append a per-restart cache-buster (e.g. ?v=<timestamp>) to WebApp URLs.
# Telegram caches its "Cannot open game / domain" validation decision PER URL.
# When the bot process restarts, the timestamp changes, the URL changes, and
# old keyboard buttons sent before the restart now point at a "stale" URL that
# Telegram tries to re-validate. If validation hiccups even once, Telegram
# blacklists THAT URL for ~minutes → user sees "Cannot open game" until they
# fully restart the Telegram app. Fresh state works briefly, then re-poisons.
#
# Cache-busting of the front-end bundle is already handled by:
#   1) Vite's content-hashed asset filenames (assets/main-<hash>.js)
#   2) Stale-chunk auto-reload in artifacts/games-bot/src/main.jsx (catches
#      `vite:preloadError` + script load errors → one-shot hard reload)
# So URLs MUST stay byte-identical across bot restarts.
MINI_APP_URL  = _BASE_MINI_APP_URL
GAMES_APP_URL = _BASE_GAMES_APP_URL
CONTESTS_APP_URL = _BASE_CONTESTS_APP_URL
ADMIN_IDS        = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()]

router = Router()


# ── Bot command menu (single source of truth for /setcommands) ──────────────
# Mirrors the @router.message(Command(...)) / CommandStart() handlers below;
# published to Telegram at startup via bot.set_my_commands() so BotFather
# /setcommands is no longer required. Add a new entry here whenever you add
# a new Command() handler so the menu stays in sync.
COMMANDS: list[BotCommand] = [
    BotCommand(command="start",   description="Open the main menu and your wallet"),
    BotCommand(command="balance", description="Show SKZ / USDT / Stars / TON balances"),
    BotCommand(command="lang",    description="🌐 Change language (Arabic / English)"),
]

# Extra commands published only to admin chats (scope=BotCommandScopeChat per
# admin id), so non-admins don't see /admin in their menu.
ADMIN_COMMANDS: list[BotCommand] = COMMANDS + [
    BotCommand(command="admin", description="Platform stats (admins only)"),
]

# Per-language translations. Telegram serves each user the closest match to
# their Telegram UI `language_code`, falling back to the default (no
# language_code) menu above. Add a new locale here to publish a localized
# menu automatically at startup; slash-command names stay identical across
# languages so handlers don't need changes.
COMMANDS_BY_LANG: dict[str, list[BotCommand]] = {
    "en": COMMANDS,
    "ar": [
        BotCommand(command="start",   description="فتح القائمة الرئيسية والمحفظة"),
        BotCommand(command="balance", description="عرض أرصدة SKZ / USDT / Stars / TON"),
        BotCommand(command="lang",    description="🌐 تغيير اللغة (عربي / إنجليزي)"),
    ],
    "ru": [
        BotCommand(command="start",   description="Открыть главное меню и кошелёк"),
        BotCommand(command="balance", description="Баланс SKZ / USDT / Stars / TON"),
    ],
    "es": [
        BotCommand(command="start",   description="Abrir el menú principal y la cartera"),
        BotCommand(command="balance", description="Saldo de SKZ / USDT / Stars / TON"),
    ],
    "fr": [
        BotCommand(command="start",   description="Ouvrir le menu principal et le portefeuille"),
        BotCommand(command="balance", description="Solde SKZ / USDT / Stars / TON"),
    ],
    "tr": [
        BotCommand(command="start",   description="Ana menüyü ve cüzdanı aç"),
        BotCommand(command="balance", description="SKZ / USDT / Stars / TON bakiyesi"),
    ],
    "fa": [
        BotCommand(command="start",   description="باز کردن منوی اصلی و کیف پول"),
        BotCommand(command="balance", description="موجودی SKZ / USDT / Stars / TON"),
    ],
}

ADMIN_COMMANDS_BY_LANG: dict[str, list[BotCommand]] = {
    lang: cmds + [
        {
            "en": BotCommand(command="admin", description="Platform stats (admins only)"),
            "ar": BotCommand(command="admin", description="إحصاءات المنصة (للمشرفين فقط)"),
            "ru": BotCommand(command="admin", description="Статистика платформы (только админы)"),
            "es": BotCommand(command="admin", description="Estadísticas de la plataforma (solo admins)"),
            "fr": BotCommand(command="admin", description="Statistiques de la plateforme (admins uniquement)"),
            "tr": BotCommand(command="admin", description="Platform istatistikleri (yalnızca yöneticiler)"),
            "fa": BotCommand(command="admin", description="آمار پلتفرم (فقط مدیران)"),
        }[lang]
    ]
    for lang, cmds in COMMANDS_BY_LANG.items()
}


# ── API helpers ──────────────────────────────────────────────────────────────

async def api_upsert_user(user) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MOTHER_API_URL}/internal/users/upsert",
            # NOTE: We deliberately do NOT send `languageCode` here.
            # `/internal/users/upsert` only overwrites it when the caller
            # passes one explicitly, so routine upserts on /start preserve
            # any explicit `/lang` choice the user made earlier. The only
            # path that should ever set `languageCode` is `set_user_lang()`
            # in i18n.py.
            json={
                "telegramId": str(user.id),
                "username": user.username,
                "firstName": user.first_name or "User",
                "lastName": user.last_name,
                "isPremium": getattr(user, "is_premium", False),
            },
            headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()


async def api_get_wallet(telegram_id: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{MOTHER_API_URL}/users/{telegram_id}",
            headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
            timeout=10.0,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


# ── Keyboards ────────────────────────────────────────────────────────────────

def main_keyboard(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    """Main menu — big open-app button on top, quick actions below.
    Labels are localised by the caller-provided `lang` (ar/en)."""
    return InlineKeyboardMarkup(inline_keyboard=[
        # ① Launch the full Mini App
        [InlineKeyboardButton(text=t(lang, "btn_open_platform"),
                              web_app=WebAppInfo(url=MINI_APP_URL))],
        # ② Launch Games
        [InlineKeyboardButton(text=t(lang, "btn_play_games"),
                              web_app=WebAppInfo(url=GAMES_APP_URL))],
        # ②.5 Launch Books (jumps user into the books child bot via deep-link)
        [InlineKeyboardButton(text="❖ SOUQRATES SOUQ",
                              url=f"https://t.me/{BOOKS_BOT_USERNAME}?start=from_mother")],
        # ②.6 Launch Contests / Voting Mini App inline
        [InlineKeyboardButton(text="★ SOUQRATES STAGE",
                              web_app=WebAppInfo(url=CONTESTS_APP_URL))],
        # ③ Quick text shortcuts (localised)
        [
            InlineKeyboardButton(text=t(lang, "btn_balance"),      callback_data="wallet"),
            InlineKeyboardButton(text=t(lang, "btn_transactions"), callback_data="transactions"),
        ],
        [
            InlineKeyboardButton(text=t(lang, "btn_withdraw"), callback_data="withdraw"),
            InlineKeyboardButton(text=t(lang, "btn_referral"), callback_data="referral"),
        ],
        [
            InlineKeyboardButton(text=t(lang, "btn_help"), callback_data="help"),
            InlineKeyboardButton(text=t(lang, "btn_lang"), callback_data="lang_menu"),
        ],
        [
            InlineKeyboardButton(text=t(lang, "btn_more"), callback_data="info_menu"),
        ],
    ])


def info_menu_keyboard(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_policies"), callback_data="info_policies")],
        [InlineKeyboardButton(text=t(lang, "btn_rules"),    callback_data="info_rules")],
        [InlineKeyboardButton(text=t(lang, "btn_contact"),  callback_data="info_contact")],
        [InlineKeyboardButton(text=t(lang, "btn_back"),     callback_data="menu")],
    ])


def info_back_keyboard(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_back_menu"), callback_data="info_menu")],
        [InlineKeyboardButton(text=t(lang, "btn_back_main"), callback_data="menu")],
    ])


def back_keyboard(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=t(lang, "btn_open_app"),
                web_app=WebAppInfo(url=MINI_APP_URL),
            ),
            InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="menu"),
        ]
    ])


# ── Handlers ─────────────────────────────────────────────────────────────────

@router.message(CommandStart())
async def cmd_start(message: Message):
    first_name = message.from_user.first_name or "User"
    tg_id = str(message.from_user.id)

    # 1. Upsert — registers / updates the user record. Fire regardless of wallet.
    try:
        upsert_data = await api_upsert_user(message.from_user)
        first_name  = upsert_data.get("user", {}).get("firstName", first_name)
    except Exception as e:
        logger.error(f"Upsert failed: {e}")

    # 2. Always fetch balance fresh — ensures any admin credit/debit is visible.
    skz_bal  = 0.0
    usdt_bal = 0.0
    try:
        wallet_data = await api_get_wallet(tg_id)
        if wallet_data:
            w        = wallet_data.get("wallet") or {}
            skz_bal  = float(w.get("balanceSkz",  "0"))
            usdt_bal = float(w.get("balanceUsdt", "0"))
    except Exception as e:
        logger.error(f"Balance fetch failed: {e}")

    lang = await get_user_lang(tg_id, MOTHER_API_URL, MOTHER_BOT_API_KEY)
    text = t(
        lang, "welcome",
        name=first_name,
        skz=f"{skz_bal:,.2f}",
        usdt=f"{usdt_bal:.2f}",
    )
    await message.answer(text, parse_mode="HTML", reply_markup=main_keyboard(lang))


@router.callback_query(F.data == "menu")
async def cb_menu(callback: CallbackQuery):
    tg_id = str(callback.from_user.id)
    try:
        data = await api_get_wallet(tg_id)
    except Exception:
        data = None

    wallet    = (data or {}).get("wallet") if isinstance(data, dict) else None
    skz_bal   = float(wallet["balanceSkz"])  if wallet else 0.0
    usdt_bal  = float(wallet["balanceUsdt"])  if wallet else 0.0

    lang = await get_user_lang(tg_id, MOTHER_API_URL, MOTHER_BOT_API_KEY)
    text = t(
        lang, "welcome_back",
        name=callback.from_user.first_name or "User",
        skz=f"{skz_bal:,.2f}",
        usdt=f"{usdt_bal:.2f}",
    )

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=main_keyboard(lang))
    await callback.answer()


# ── /lang — let the user pick Arabic / English ────────────────────────────
@router.message(Command("lang"))
async def cmd_lang(message: Message):
    lang = await get_user_lang(str(message.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    await message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))


@router.callback_query(F.data == "lang_menu")
async def cb_lang_menu(callback: CallbackQuery):
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        await callback.message.edit_text(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))
    except TelegramBadRequest:
        await callback.message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))
    await callback.answer()


@router.callback_query(F.data.startswith("lang:"))
async def cb_lang_set(callback: CallbackQuery):
    # Defensive: callback data is filtered by `startswith("lang:")` so the
    # split is guaranteed to produce 2 elements, but guard anyway against
    # any future filter change so a malformed payload can never raise an
    # uncaught IndexError that bypasses `cb.answer()`.
    parts = (callback.data or "").split(":", 1)
    new_lang = parts[1] if len(parts) == 2 else ""
    if not new_lang or new_lang not in LANGS:
        await callback.answer("❌", show_alert=False)
        return
    tg_id = str(callback.from_user.id)
    ok = await set_user_lang(
        tg_id, new_lang,
        MOTHER_API_URL, MOTHER_BOT_API_KEY,
        first_name=callback.from_user.first_name or "User",
        username=callback.from_user.username,
    )
    if not ok:
        await callback.answer(t(new_lang, "lang_set_fail"), show_alert=True)
        return
    invalidate_lang_cache(tg_id)
    await callback.answer(t(new_lang, "lang_set_ok"), show_alert=False)
    # Re-render main menu in the new language so the user sees the effect instantly.
    try:
        # Refresh wallet for fresh balances in the welcome card.
        data = await api_get_wallet(tg_id)
        w = (data or {}).get("wallet") or {}
        skz_bal  = float(w.get("balanceSkz",  "0"))
        usdt_bal = float(w.get("balanceUsdt", "0"))
    except Exception:
        skz_bal, usdt_bal = 0.0, 0.0
    text = t(
        new_lang, "welcome_back",
        name=callback.from_user.first_name or "User",
        skz=f"{skz_bal:,.2f}",
        usdt=f"{usdt_bal:.2f}",
    )
    try:
        await callback.message.edit_text(text, parse_mode="HTML",
                                          reply_markup=main_keyboard(new_lang))
    except TelegramBadRequest:
        await callback.message.answer(text, parse_mode="HTML",
                                       reply_markup=main_keyboard(new_lang))


@router.callback_query(F.data == "wallet")
async def cb_wallet(callback: CallbackQuery):
    tg_id = str(callback.from_user.id)
    lang = await get_user_lang(tg_id, MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        data = await api_get_wallet(tg_id)
    except Exception:
        await callback.answer(t(lang, "err_fetch_data"), show_alert=True)
        return

    if not data:
        await callback.answer(t(lang, "err_no_wallet"), show_alert=True)
        return

    wallet = data["wallet"]
    user_obj = data.get("user") or {}
    skz       = float(wallet["balanceSkz"])
    ref_skz   = float(wallet.get("referralBalanceSkz", "0"))
    usdt      = float(wallet["balanceUsdt"])
    stars     = int(float(wallet["balanceStars"]))
    ton       = float(wallet["balanceTon"])
    earned    = float(wallet["totalEarned"])
    withdrawn = float(wallet["totalWithdrawn"])
    xp        = int(user_obj.get("xp", 0))
    level     = int(user_obj.get("level", 1))
    played    = int(user_obj.get("totalGamesPlayed", 0))
    won       = int(user_obj.get("totalGamesWon", 0))

    text = (
        f"{t(lang, 'wallet_title')}\n\n"
        f"{t(lang, 'balances_label')}\n"
        f"├ {t(lang, 'label_skz')}:        <code>{skz:,.2f}</code>\n"
        f"├ {t(lang, 'label_referral')}:  <code>{ref_skz:,.2f}</code> SKZ\n"
        f"├ {t(lang, 'label_usdt')}:      <code>{usdt:.4f}</code>\n"
        f"├ {t(lang, 'label_stars')}:      <code>{stars:,}</code>\n"
        f"└ {t(lang, 'label_ton')}:       <code>{ton:.4f}</code>\n\n"
        f"{t(lang, 'profile_line', level=level, xp=f'{xp:,}')}\n"
        f"{t(lang, 'games_line', won=won, played=played)}\n\n"
        f"{t(lang, 'total_earned', n=f'{earned:,.2f}')}\n"
        f"{t(lang, 'total_withdrawn', n=f'{withdrawn:,.2f}')}"
    )

    # Wallet view gets its own keyboard with the card top-up button so
    # users don't need to leave the wallet to add funds.
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=t(lang, "btn_topup_card"),  callback_data="topup_card"),
            InlineKeyboardButton(text=t(lang, "btn_topup_stars"), callback_data="topup_stars"),
        ],
        [
            InlineKeyboardButton(text=t(lang, "btn_open_app"), web_app=WebAppInfo(url=MINI_APP_URL)),
            InlineKeyboardButton(text=t(lang, "btn_back"),     callback_data="menu"),
        ],
    ])
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    await callback.answer()


# ── Card top-up via @wallet ─────────────────────────────────────────────────
# Cryptomus was removed (content restrictions on the platform). The card
# button now routes users to Telegram's official @wallet bot, where they
# buy USDT/TON with Visa/Mastercard, then send the crypto to our deposit
# addresses (shown in the Mini App → Deposit page). No invoices, no
# webhooks — the existing USDT/TON on-chain deposit watcher credits SKZ
# automatically.
TOPUP_PRESETS_STARS = [50, 100, 250, 500, 1000, 2500]


def topup_stars_keyboard(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    """Stars-only top-up keyboard. Telegram processes payment in-app via the
    invoice link — user never leaves the chat."""
    rows = []
    for chunk_start in range(0, len(TOPUP_PRESETS_STARS), 3):
        rows.append([
            InlineKeyboardButton(text=f"⭐ {n}", callback_data=f"topup_stars_amt:{n}")
            for n in TOPUP_PRESETS_STARS[chunk_start:chunk_start + 3]
        ])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="wallet")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data == "topup_card")
async def cb_topup_card(callback: CallbackQuery, state: FSMContext):
    """Deposit hub — splits into two clear paths so users with an existing
    wallet aren't forced through onboarding, and users without a wallet
    get a real install guide instead of being dropped at a raw address."""
    await state.clear()
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_deposit_have_wallet"), callback_data="deposit_have")],
        [InlineKeyboardButton(text=t(lang, "btn_deposit_no_wallet"),   callback_data="deposit_nowallet")],
        [InlineKeyboardButton(text=t(lang, "btn_back_wallet"),         callback_data="wallet")],
    ])
    await _safe_edit(callback, t(lang, "deposit_hub_body"), kb)
    await callback.answer()


# Deposit preset amounts (kept small + sane — large amounts should be split).
DEPOSIT_TON_PRESETS  = [0.5, 1, 2, 5, 10, 20]
DEPOSIT_USDT_PRESETS = [1, 5, 10, 25, 50, 100]


@router.callback_query(F.data == "deposit_have")
async def cb_deposit_have(callback: CallbackQuery, state: FSMContext):
    """Section 1: user already has a TON/USDT wallet → show preset
    amounts. Picking one calls the deposit-intent endpoint which assigns
    a unique memo so the on-chain watcher can credit the user's SKZ
    balance automatically."""
    await state.clear()
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    # Two rows of buttons per currency. cb data encodes currency + amount.
    ton_btns = [InlineKeyboardButton(text=f"💎 {a} TON",
                                     callback_data=f"deposit_ton:{a}")
                for a in DEPOSIT_TON_PRESETS]
    usdt_btns = [InlineKeyboardButton(text=f"💵 {a} USDT",
                                      callback_data=f"deposit_usdt:{a}")
                 for a in DEPOSIT_USDT_PRESETS]
    rows = [
        [InlineKeyboardButton(text=t(lang, "label_deposit_ton"), callback_data="noop")],
        ton_btns[0:3],
        ton_btns[3:6],
        [InlineKeyboardButton(text=t(lang, "label_deposit_usdt"), callback_data="noop")],
        usdt_btns[0:3],
        usdt_btns[3:6],
        [InlineKeyboardButton(text=t(lang, "btn_back_deposit"), callback_data="topup_card")],
    ]
    await _safe_edit(callback, t(lang, "deposit_have_body"),
                     InlineKeyboardMarkup(inline_keyboard=rows))
    await callback.answer()


@router.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery):
    """Section headers are buttons (Telegram doesn't have inline labels);
    swallow taps silently."""
    await callback.answer()


async def _create_deposit_intent(
    tg_id: str, currency: str, amount: float
) -> dict | None:
    """Call the API's deposit-intent endpoint. Returns
    {depositAddress, memo, amount, expectedSkz} or None on failure."""
    path = "ton-deposit-intent" if currency == "ton" else "usdt-deposit-intent"
    body_key = "amountTon" if currency == "ton" else "amountUsdt"
    async with httpx.AsyncClient() as http:
        try:
            resp = await http.post(
                f"{MOTHER_API_URL}/internal/{path}",
                json={"telegramId": tg_id, body_key: amount},
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
                timeout=15.0,
            )
        except httpx.HTTPError as e:
            logger.warning(f"{path} network error: {e}")
            return None
    if resp.status_code != 200:
        logger.warning(f"{path} failed: {resp.status_code} {resp.text[:200]}")
        return None
    return resp.json()


@router.callback_query(F.data.startswith("deposit_ton:") | F.data.startswith("deposit_usdt:"))
async def cb_deposit_amount(callback: CallbackQuery, state: FSMContext):
    """Generate the per-user deposit intent and show the address + memo
    + amount. The memo is what links the on-chain transfer back to this
    user; we surface it as <code> so Telegram makes it tap-to-copy."""
    await state.clear()
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        prefix, raw_amt = callback.data.split(":", 1)
        amount = float(raw_amt)
    except (ValueError, IndexError):
        await callback.answer(t(lang, "err_invalid_amt"), show_alert=True)
        return
    currency = "ton" if prefix == "deposit_ton" else "usdt"

    # Belt-and-braces: any unexpected exception below (malformed JSON, missing
    # keys, render error) must NOT leave the Telegram callback spinner stuck.
    # We always ack the callback in `finally`.
    try:
        data = await _create_deposit_intent(str(callback.from_user.id), currency, amount)
        if not data or not data.get("depositAddress") or not data.get("memo"):
            await callback.answer(t(lang, "deposit_intent_err"), show_alert=True)
            return

        addr = data["depositAddress"]
        memo = data["memo"]
        skz = data.get("expectedSkz", "?")
        body_key = "deposit_ready_ton" if currency == "ton" else "deposit_ready_usdt"
        amt_str = f"{amount:g}"  # 1.0 → "1", 0.5 → "0.5"
        text = t(lang, body_key, amt=amt_str, addr=addr, memo=memo, skz=skz)

        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=t(lang, "btn_back_deposit"), callback_data="deposit_have")],
            [InlineKeyboardButton(text=t(lang, "btn_back_wallet"),  callback_data="wallet")],
        ])
        await _safe_edit(callback, text, kb)
    except Exception:
        logger.exception("cb_deposit_amount failed")
        try:
            await callback.answer(t(lang, "deposit_intent_err"), show_alert=True)
            return
        except Exception:
            pass
    finally:
        # Safe to call twice — Telegram tolerates a no-op second answer.
        try:
            await callback.answer()
        except Exception:
            pass


# Public TON Keeper download URLs (official, verified). Hard-coded
# rather than env vars because they're brand-stable.
TONKEEPER_APPSTORE_URL  = "https://apps.apple.com/app/tonkeeper/id1587742107"
TONKEEPER_PLAYSTORE_URL = "https://play.google.com/store/apps/details?id=com.ton_keeper"


@router.callback_query(F.data == "deposit_nowallet")
async def cb_deposit_nowallet(callback: CallbackQuery, state: FSMContext):
    """Section 2: user has no crypto wallet → install + Visa top-up
    guide for TON Keeper. The small-print line about future earnings
    going to this wallet is part of the body, not a separate message,
    so users see it before they finish onboarding."""
    await state.clear()
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=t(lang, "btn_appstore_tonkeeper"),  url=TONKEEPER_APPSTORE_URL),
            InlineKeyboardButton(text=t(lang, "btn_playstore_tonkeeper"), url=TONKEEPER_PLAYSTORE_URL),
        ],
        [InlineKeyboardButton(text=t(lang, "btn_deposit_have_wallet"), callback_data="deposit_have")],
        [InlineKeyboardButton(text=t(lang, "btn_back_deposit"),        callback_data="topup_card")],
    ])
    await _safe_edit(callback, t(lang, "deposit_no_wallet_body"), kb)
    await callback.answer()


@router.callback_query(F.data == "topup_stars")
async def cb_topup_stars(callback: CallbackQuery, state: FSMContext):
    """Show the Stars preset grid. Stars are charged inside Telegram (no
    redirect, no card form) — fastest possible deposit UX."""
    await state.clear()
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    await _safe_edit(callback, t(lang, "topup_stars_body"), topup_stars_keyboard(lang))
    await callback.answer()


@router.callback_query(F.data.startswith("topup_stars_amt:"))
async def cb_topup_stars_amt(callback: CallbackQuery, state: FSMContext):
    """Create a Stars invoice link via the API and DM it as a single-tap
    pay button. Telegram will then POST a `successful_payment` update that
    `msg_successful_payment` below picks up and credits the wallet."""
    await state.clear()
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        amount_stars = int(callback.data.split(":", 1)[1])
    except (ValueError, IndexError):
        await callback.answer(t(lang, "err_invalid_amt"), show_alert=True)
        return

    async with httpx.AsyncClient() as http:
        try:
            resp = await http.post(
                f"{MOTHER_API_URL}/internal/stars-invoice",
                json={"telegramId": str(callback.from_user.id), "amountStars": amount_stars},
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
                timeout=15.0,
            )
        except httpx.HTTPError as e:
            logger.warning(f"stars-invoice network error: {e}")
            await callback.answer(t(lang, "err_invoice_fail"), show_alert=True)
            return

    if resp.status_code != 200:
        logger.warning(f"stars-invoice failed: {resp.status_code} {resp.text[:200]}")
        await callback.answer(t(lang, "err_invoice_fail"), show_alert=True)
        return

    data = resp.json()
    invoice_link = data.get("invoiceLink")
    expected_skz = data.get("expectedSkz", "?")
    if not invoice_link:
        await callback.answer(t(lang, "err_invoice_link"), show_alert=True)
        return

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "pay_stars_btn", n=amount_stars), url=invoice_link)],
        [InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="wallet")],
    ])
    await callback.message.answer(
        t(lang, "invoice_ready", n=amount_stars, skz=expected_skz),
        parse_mode="HTML",
        reply_markup=kb,
    )
    await callback.answer()


@router.pre_checkout_query()
async def pre_checkout_handler(pcq: PreCheckoutQuery):
    """Telegram requires we answer pre_checkout_query within 10 seconds or
    the charge is cancelled. Server already validated the user + amount when
    creating the invoice, and the user can only pay what they were shown, so
    we always approve here. Final credit happens in successful_payment."""
    try:
        await pcq.answer(ok=True)
    except Exception as e:
        logger.error(f"pre_checkout answer failed: {e}")


@router.message(F.successful_payment)
async def msg_successful_payment(message: Message):
    """Credit the user's wallet once Telegram has actually charged the
    Stars. Idempotent on the server side (telegramChargeId is unique per
    payment), so retries/duplicate updates are safe."""
    sp = message.successful_payment
    if not sp:
        return
    lang = await get_user_lang(str(message.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    payload = sp.invoice_payload  # = `stars_dep_{userId}_{ts}` we set server-side
    amount_stars = int(sp.total_amount)  # Stars uses 1 unit = 1 Star
    tg_charge_id = sp.telegram_payment_charge_id
    prov_charge_id = sp.provider_payment_charge_id

    async with httpx.AsyncClient() as http:
        try:
            resp = await http.post(
                f"{MOTHER_API_URL}/internal/stars-confirm",
                json={
                    "telegramId": str(message.from_user.id),
                    "payload": payload,
                    "amountStars": amount_stars,
                    "telegramChargeId": tg_charge_id,
                    "providerChargeId": prov_charge_id,
                },
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
                timeout=15.0,
            )
        except httpx.HTTPError as e:
            logger.error(f"stars-confirm network error: {e}")
            # The pending tx stays in DB — admin can reconcile manually.
            await message.answer(t(lang, "stars_pay_delayed"))
            return

    if resp.status_code != 200:
        logger.error(f"stars-confirm failed: {resp.status_code} {resp.text[:300]}")
        await message.answer(
            t(lang, "stars_pay_issue", ref=tg_charge_id),
            parse_mode="HTML",
        )
        return

    data = resp.json()
    credited = data.get("creditedSkz", "?")
    new_bal = data.get("newSkzBalance", "?")
    await message.answer(
        t(lang, "stars_pay_ok", stars=amount_stars, skz=credited, bal=new_bal),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "transactions")
async def cb_transactions(callback: CallbackQuery):
    tg_id = str(callback.from_user.id)
    lang = await get_user_lang(tg_id, MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        data = await api_get_wallet(tg_id)
        if not data:
            await callback.answer(t(lang, "err_no_data"), show_alert=True)
            return

        user_id = data["user"]["id"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MOTHER_API_URL}/transactions",
                params={"userId": user_id, "limit": 10},
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
                timeout=10.0,
            )
            transactions = resp.json()["data"]
    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        await callback.answer(t(lang, "err_no_tx"), show_alert=True)
        return

    if not transactions:
        text = t(lang, "tx_empty")
    else:
        lines = [t(lang, "tx_last_10")]
        for tx in transactions:
            icon   = "📥" if tx["type"] == "credit" else "📤"
            amount = float(tx["amount"])
            sign   = "+" if tx["type"] == "credit" else "-"
            lines.append(
                f"{icon} <code>{sign}{abs(amount):.0f}</code> {tx['currency'].upper()} "
                f"— {tx.get('description', '')[:28]}"
            )
        text = "\n".join(lines)

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard(lang))
    await callback.answer()


@router.callback_query(F.data == "withdraw")
async def cb_withdraw(callback: CallbackQuery):
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    await callback.message.edit_text(
        t(lang, "withdraw_body"), parse_mode="HTML",
        reply_markup=back_keyboard(lang),
    )
    await callback.answer()


@router.callback_query(F.data == "referral")
async def cb_referral(callback: CallbackQuery):
    tg_id = str(callback.from_user.id)
    lang = await get_user_lang(tg_id, MOTHER_API_URL, MOTHER_BOT_API_KEY)
    bot_info = await callback.bot.get_me()
    ref_link = f"https://t.me/{bot_info.username}?start=ref{callback.from_user.id}"

    ref_balance = 0.0
    total_ref_earned = 0.0
    try:
        data = await api_get_wallet(tg_id)
        w = (data or {}).get("wallet") or {}
        ref_balance      = float(w.get("referralBalanceSkz", "0"))
        total_ref_earned = float(w.get("totalEarnedFromReferralsSkz", "0"))
    except Exception:
        pass

    text = t(
        lang, "referral_body",
        avail=f"{ref_balance:,.2f}",
        total=f"{total_ref_earned:,.2f}",
        link=ref_link,
    )
    kb_rows = []
    if ref_balance > 0:
        kb_rows.append([InlineKeyboardButton(
            text=t(lang, "btn_transfer_ref", n=f"{ref_balance:,.2f}"),
            callback_data="referral_transfer",
        )])
    kb_rows.append([InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="menu")])
    await callback.message.edit_text(
        text, parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb_rows),
    )
    await callback.answer()


@router.callback_query(F.data == "referral_transfer")
async def cb_referral_transfer(callback: CallbackQuery):
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MOTHER_API_URL}/internal/wallets/transfer-referral",
                json={"telegramId": str(callback.from_user.id)},
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
                timeout=10.0,
            )
        if resp.status_code != 200:
            err = (resp.json() or {}).get("error") or t(lang, "transfer_failed")
            await callback.answer(f"❌ {err}", show_alert=True)
            return
        body = resp.json()
        await callback.answer(
            t(lang, "ref_transfer_ok", n=body.get("transferred", "0")),
            show_alert=True,
        )
    except Exception as e:
        logger.error(f"Referral transfer failed: {e}")
        await callback.answer(t(lang, "err_transfer"), show_alert=True)
        return

    # Re-render referral view so balance updates immediately
    await cb_referral(callback)


@router.callback_query(F.data == "help")
async def cb_help(callback: CallbackQuery):
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    await callback.message.edit_text(
        t(lang, "help_body"), parse_mode="HTML",
        reply_markup=back_keyboard(lang),
    )
    await callback.answer()


# ── Info menu (policies / rules / contact) — copy editable in superadmin ────
# Bot copy is fetched from the published `bot-texts` for slug "mother-bot" via
# the BotTexts TTL cache so any panel edit propagates in ~60s without restart.
# Default values below are seeded on startup (idempotent) if the rows are
# missing, so first-time installs already render real content.

_mother_client = MotherBotClient(
    api_key=MOTHER_BOT_API_KEY,
    base_url=MOTHER_API_URL,
)
texts = _mother_client.texts(bot_slug="mother-bot", ttl_seconds=60)

INFO_DEFAULTS: dict[str, tuple[str, str]] = {
    "info_policies": (
        "السياسات",
        "📜 <b>سياسة الاستخدام</b>\n\n"
        "• جميع المعاملات المالية في منظومة SOUQRATES SYSTEM موحّدة عبر محفظة SKZ.\n"
        "• الإيداع والسحب يتمّان عبر القنوات المعتمدة فقط (Stars / USDT / TON).\n"
        "• حماية بياناتك أولوية — لا نشارك معلوماتك مع أطراف ثالثة.\n"
        "• استخدام البوت يعني موافقتك على هذه السياسة.\n\n"
        "آخر تحديث: 2026"
    ),
    "info_rules": (
        "القوانين",
        "⚖️ <b>قوانين المنصة</b>\n\n"
        "1. ممنوع التحايل على نظام الإحالة أو إنشاء حسابات وهمية.\n"
        "2. يحقّ للإدارة تجميد أي رصيد ناتج عن نشاط مشبوه.\n"
        "3. الحد الأدنى للسحب: 5 USDT أو 1 TON.\n"
        "4. العمولات تُخصم تلقائياً وفق نسب البوت الفرعي.\n"
        "5. أي مخالفة قد تؤدي لإيقاف الحساب نهائياً.\n\n"
        "للاستفسار: استخدم زر «تواصل معنا»."
    ),
    "info_contact": (
        "تواصل معنا",
        "✉️ <b>قنوات التواصل الرسمية</b>\n\n"
        "• الدعم الفني: @souqrates_support\n"
        "• القناة الرسمية: @souqrates_official\n"
        "• البريد: support@souqrates.com\n\n"
        "نردّ خلال 24 ساعة كحد أقصى."
    ),
}


async def _seed_info_texts_if_missing() -> None:
    """Idempotent: POSTs the three info_* keys to superadmin/bot-texts.

    The POST endpoint uses ON CONFLICT DO UPDATE on (botSlug, key) so this
    is safe to call on every startup. We only set the draftValue — the
    super-admin must explicitly hit "نشر" before users see the content,
    matching the existing publish workflow.

    No-op when MASTER_ADMIN_CODE is unset (e.g. local dev without super-admin),
    so the bot still boots cleanly.
    """
    if not MASTER_ADMIN_CODE or len(MASTER_ADMIN_CODE) < 8:
        logger.warning("MASTER_ADMIN_CODE not set — skipping info-texts seed")
        return
    headers = {"Authorization": f"Bearer {MASTER_ADMIN_CODE}"}
    async with httpx.AsyncClient() as http:
        # Map existing rows by key so we can detect both:
        #   (a) row missing entirely → upsert + publish
        #   (b) row exists but never published (publishedAt is null AND
        #       publishedValue is empty) → re-publish so users finally see it
        # We never touch a key whose admin already published or customised
        # the draft — admin edits are sacred.
        existing_by_key: dict[str, dict] = {}
        try:
            resp = await http.get(
                f"{MOTHER_API_URL}/superadmin/bot-texts",
                params={"botSlug": "mother-bot"},
                headers=headers,
                timeout=10.0,
            )
            if resp.status_code == 200:
                for row in (resp.json().get("data") or []):
                    existing_by_key[row["key"]] = row
        except Exception as e:
            logger.warning(f"info-texts seed: list failed: {e}")

        for key, (label, default_value) in INFO_DEFAULTS.items():
            existing = existing_by_key.get(key)
            row_id: int | None = None
            try:
                if existing is None:
                    # Brand-new key: upsert with default draft
                    r = await http.post(
                        f"{MOTHER_API_URL}/superadmin/bot-texts",
                        json={"botSlug": "mother-bot", "key": key, "label": label, "draftValue": default_value},
                        headers=headers,
                        timeout=10.0,
                    )
                    if r.status_code >= 400:
                        logger.warning(f"seed {key}: HTTP {r.status_code} {r.text[:120]}")
                        continue
                    row_id = r.json().get("id")
                    logger.info(f"seeded default info-text: {key}")
                else:
                    # Row exists. Only auto-publish if admin hasn't done anything yet:
                    # publishedAt is null AND publishedValue is empty. Otherwise leave it alone.
                    if existing.get("publishedAt") or (existing.get("publishedValue") or "").strip():
                        continue
                    row_id = existing.get("id")

                if row_id:
                    pr = await http.post(
                        f"{MOTHER_API_URL}/superadmin/bot-texts/{row_id}/publish",
                        headers=headers, timeout=10.0,
                    )
                    if pr.status_code >= 400:
                        logger.warning(f"publish {key}: HTTP {pr.status_code} {pr.text[:120]}")
                    else:
                        logger.info(f"published info-text: {key}")
            except Exception as e:
                logger.warning(f"seed {key} failed: {e}")


async def _safe_edit(callback: CallbackQuery, text: str, kb: InlineKeyboardMarkup) -> None:
    """edit_text that swallows Telegram's "message is not modified" 400 so a
    user double-tap doesn't surface as a stuck loading spinner."""
    try:
        await callback.message.edit_text(
            text, parse_mode="HTML", reply_markup=kb, disable_web_page_preview=True,
        )
    except TelegramBadRequest as e:
        if "message is not modified" not in str(e).lower():
            raise


@router.callback_query(F.data == "info_menu")
async def cb_info_menu(callback: CallbackQuery):
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    await _safe_edit(callback, t(lang, "info_menu_prompt"), info_menu_keyboard(lang))
    await callback.answer()


@router.callback_query(F.data.in_({"info_policies", "info_rules", "info_contact"}))
async def cb_info_page(callback: CallbackQuery):
    lang = await get_user_lang(str(callback.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
    key = callback.data
    _, default_body = INFO_DEFAULTS.get(key, ("", "—"))
    body = await texts.get(key, default=default_body)
    await _safe_edit(callback, body, info_back_keyboard(lang))
    await callback.answer()


@router.message(Command("balance"))
async def cmd_balance(message: Message):
    tg_id = str(message.from_user.id)
    lang = await get_user_lang(tg_id, MOTHER_API_URL, MOTHER_BOT_API_KEY)
    try:
        data = await api_get_wallet(tg_id)
        if not data:
            await message.answer(t(lang, "err_no_wallet_start"))
            return
        w = data["wallet"]
        await message.answer(
            f"⚡ SKZ: {float(w['balanceSkz']):,.2f}\n"
            f"💵 USDT: {float(w['balanceUsdt']):.4f}\n"
            f"⭐ Stars: {int(float(w['balanceStars'])):,}\n"
            f"💎 TON: {float(w['balanceTon']):.4f}",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text=t(lang, "btn_open_full_app"), web_app=WebAppInfo(url=MINI_APP_URL))
            ]])
        )
    except Exception:
        await message.answer(t(lang, "err_balance_fetch"))


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        lang = await get_user_lang(str(message.from_user.id), MOTHER_API_URL, MOTHER_BOT_API_KEY)
        await message.answer(t(lang, "err_no_permission"))
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{MOTHER_API_URL}/stats/overview", timeout=10.0)
            stats = resp.json()

        text = (
            f"📊 <b>Platform Stats</b>\n\n"
            f"👥 Total Users:      <code>{stats['totalUsers']}</code>\n"
            f"💵 Total Volume:     <code>${float(stats['totalVolumeUsdt']):.2f}</code> USDT\n"
            f"💰 Total Commission: <code>${float(stats['totalCommissionsUsdt']):.2f}</code> USDT\n"
            f"⏳ Pending Withdrawals: <code>{stats['pendingWithdrawals']}</code>\n"
            f"🤖 Active Bots:      <code>{stats['activeBots']}</code>\n"
            f"📈 Today's Txns:     <code>{stats['todayTransactions']}</code>\n"
            f"💹 Today's Volume:   <code>${float(stats['todayVolumeUsdt']):.2f}</code> USDT"
        )
        await message.answer(text, parse_mode="HTML")
    except Exception as e:
        await message.answer(f"❌ Error: {e}")


async def main():
    if not BOT_TOKEN:
        logger.error("MOTHER_BOT_TOKEN is not set!")
        return

    logger.info(f"Mini App URL: {MINI_APP_URL}")
    bot = Bot(token=BOT_TOKEN)
    dp  = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    # Publish slash-command menu to Telegram so the menu button stays in sync
    # with the Command() handlers in this file. Default scope for everyone,
    # plus per-admin chat scope so /admin only appears for admins. Non-fatal
    # on failure.
    # Publish the default menu (no language_code) plus one per supported
    # language for both the public scope and each admin's chat scope.
    # Telegram serves each user the closest match to their Telegram UI
    # language_code, falling back to the default. Per-language failures are
    # non-fatal so one bad locale never blocks the others.
    try:
        await bot.set_my_commands(COMMANDS, scope=BotCommandScopeDefault())
        logger.info(f"published {len(COMMANDS)} default commands to BotFather menu")
        for lang_code, cmds in COMMANDS_BY_LANG.items():
            try:
                await bot.set_my_commands(
                    cmds, scope=BotCommandScopeDefault(), language_code=lang_code,
                )
                logger.info(f"published {len(cmds)} commands for language={lang_code}")
            except Exception as e:
                logger.warning(f"set_my_commands(language={lang_code}) failed: {e}")
        for admin_id in ADMIN_IDS:
            try:
                await bot.set_my_commands(ADMIN_COMMANDS, scope=BotCommandScopeChat(chat_id=admin_id))
                for lang_code, cmds in ADMIN_COMMANDS_BY_LANG.items():
                    try:
                        await bot.set_my_commands(
                            cmds,
                            scope=BotCommandScopeChat(chat_id=admin_id),
                            language_code=lang_code,
                        )
                    except Exception as e:
                        logger.warning(
                            f"set_my_commands(admin={admin_id}, language={lang_code}) failed: {e}"
                        )
            except Exception as e:
                logger.warning(f"set_my_commands(admin={admin_id}) failed: {e}")
    except Exception as e:
        logger.warning(f"set_my_commands failed: {e}")

    # Seed default info-texts (policies / rules / contact) — idempotent.
    try:
        await _seed_info_texts_if_missing()
    except Exception as e:
        logger.warning(f"info-texts seed step failed (non-fatal): {e}")

    logger.info("Starting mother bot polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
