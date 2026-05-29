"""
SOUQRATES SWEEP — child Telegram bot (aiogram 3).

User flow:
  /start    → balance + main keyboard (🎰 Play, 🏆 Lotto, 💳 Top Up)
  /balance  → detailed multi-currency balance
  /tickets  → last 5 tickets with results
  /lotto    → current weekly draw + user's registered numbers
  /help     → Provably Fair explanation + command list

Top-up flow (matches mother-bot):
  💳 Top Up  → hub: ⭐ Stars  |  💎 TON/USDT
  Stars path → preset grid → invoice link (pay inside Telegram)
               → Telegram fires pre_checkout_query (always approve)
               → Telegram fires successful_payment → stars-confirm → credit wallet
  Crypto path → has wallet? → preset amounts → deposit-intent → address + memo
               → no wallet?  → TON Keeper install guide

All financial mutations flow through the mother-bot API (X-Bot-Api-Key);
the server applies getEffectiveCommissionRate + rejectIfBlocked server-side.
This bot maps every 403 response to the localized "err_banned" message.
"""
import asyncio
import logging
import os

# Sentry must init before any business-logic import — captures bootstrap errors.
from sentry_init import init_sentry
init_sentry("sweep-bot")

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    CallbackQuery,
    PreCheckoutQuery,
    WebAppInfo,
)
from aiogram.exceptions import TelegramBadRequest
from dotenv import load_dotenv

from client import SweepBotClient
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
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sweep-bot")

# ── Configuration ─────────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("SWEEP_BOT_TOKEN", "")
API_KEY = os.getenv("SWEEP_BOT_API_KEY", "")
API_URL = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_USERNAME = os.getenv("MOTHER_BOT_USERNAME", "")

# Stars preset amounts mirroring the mother-bot
TOPUP_PRESETS_STARS = [50, 100, 250, 500, 1000, 2500]

# TON / USDT preset deposit amounts
DEPOSIT_TON_PRESETS  = [0.5, 1, 2, 5, 10, 20]
DEPOSIT_USDT_PRESETS = [1, 5, 10, 25, 50, 100]

# TON Keeper download URLs (official, brand-stable)
TONKEEPER_APPSTORE_URL  = "https://apps.apple.com/app/tonkeeper/id1587742107"
TONKEEPER_PLAYSTORE_URL = "https://play.google.com/store/apps/details?id=com.ton_keeper"


def _resolve_web_app_url() -> str:
    """
    Resolution order (same image runs unchanged on Replit dev AND Contabo):
      1) SWEEP_WEB_APP_URL   — explicit override
      2) PUBLIC_BASE_URL     — production base for Contabo / souqrates.com
      3) REPLIT_DOMAINS      — Replit published deploy
      4) REPLIT_DEV_DOMAIN   — Replit dev preview
    """
    explicit = (os.getenv("SWEEP_WEB_APP_URL") or "").strip()
    if explicit:
        return explicit
    public = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if public:
        return f"{public}/sweep-bot-web/"
    rds = (os.getenv("REPLIT_DOMAINS") or "").split(",")[0].strip()
    if rds:
        return f"https://{rds}/sweep-bot-web/"
    dev = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
    if dev:
        return f"https://{dev}/sweep-bot-web/"
    return ""


WEB_APP_URL = _resolve_web_app_url()

api = SweepBotClient(api_key=API_KEY, base_url=API_URL)
texts = api.texts("sweep-bot", ttl_seconds=60)
router = Router()


# ── Slash-command menu ─────────────────────────────────────────────────────────
COMMANDS: list[BotCommand] = [
    BotCommand(command="start",   description="بدء استخدام البوت وفتح القائمة الرئيسية"),
    BotCommand(command="balance", description="💰 رصيدي التفصيلي"),
    BotCommand(command="tickets", description="🎟 آخر 5 تذاكر ونتائجها"),
    BotCommand(command="lotto",   description="🏆 السحب الأسبوعي الحالي"),
    BotCommand(command="lang",    description="🌐 تغيير اللغة (عربي / إنجليزي)"),
    BotCommand(command="help",    description="ℹ️ مساعدة + شرح Provably Fair"),
]

COMMANDS_BY_LANG: dict[str, list[BotCommand]] = {
    "ar": COMMANDS,
    "en": [
        BotCommand(command="start",   description="Start the bot and open the main menu"),
        BotCommand(command="balance", description="💰 My detailed balance"),
        BotCommand(command="tickets", description="🎟 Last 5 tickets & results"),
        BotCommand(command="lotto",   description="🏆 Current weekly draw"),
        BotCommand(command="lang",    description="🌐 Change language (Arabic / English)"),
        BotCommand(command="help",    description="ℹ️ Help + Provably Fair explanation"),
    ],
}


# ── Keyboards ──────────────────────────────────────────────────────────────────
def main_kb(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []

    # "Play Now" opens the Mini App (WebApp button) — primary CTA
    if WEB_APP_URL:
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_play"),
            web_app=WebAppInfo(url=WEB_APP_URL),
        )])
    else:
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_play"),
            callback_data="play_no_url",
        )])

    rows.append([
        InlineKeyboardButton(text=t(lang, "btn_lotto"),   callback_data="lotto"),
        InlineKeyboardButton(text=t(lang, "btn_balance"), callback_data="balance"),
    ])
    rows.append([
        InlineKeyboardButton(text=t(lang, "btn_tickets"), callback_data="tickets"),
        InlineKeyboardButton(text=t(lang, "btn_topup"),   callback_data="topup"),
    ])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_help"), callback_data="help")])

    if MOTHER_BOT_USERNAME:
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_main_system"),
            url=f"https://t.me/{MOTHER_BOT_USERNAME}",
        )])

    return InlineKeyboardMarkup(inline_keyboard=rows)


def back_home_kb(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_home"), callback_data="home")],
    ])


def back_topup_kb(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_back_topup"), callback_data="topup")],
        [InlineKeyboardButton(text=t(lang, "btn_home"),       callback_data="home")],
    ])


def topup_stars_kb(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for chunk_start in range(0, len(TOPUP_PRESETS_STARS), 3):
        rows.append([
            InlineKeyboardButton(text=f"⭐ {n}", callback_data=f"topup_stars_amt:{n}")
            for n in TOPUP_PRESETS_STARS[chunk_start:chunk_start + 3]
        ])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back_topup"), callback_data="topup")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ── Helpers ────────────────────────────────────────────────────────────────────
def fmt_skz(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _is_blocked(exc: httpx.HTTPStatusError) -> bool:
    return exc.response.status_code == 403


async def safe_edit(
    msg: Message,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> None:
    try:
        await msg.edit_text(
            text,
            reply_markup=reply_markup,
            disable_web_page_preview=True,
            parse_mode="HTML",
        )
    except TelegramBadRequest:
        await msg.answer(
            text,
            reply_markup=reply_markup,
            disable_web_page_preview=True,
            parse_mode="HTML",
        )


async def render_home(tg_id: str) -> tuple[str, InlineKeyboardMarkup]:
    lang = await get_user_lang(tg_id, API_URL, API_KEY)
    title = await texts.get("welcome_title", t(lang, "welcome_title"))
    subtitle = await texts.get("welcome_subtitle", t(lang, "welcome_subtitle"))

    # Fetch current balance for the start screen
    try:
        data = await api.get_wallet(tg_id)
        wallet = (data or {}).get("wallet") or {}
        skz = fmt_skz(wallet.get("balanceSkz", "0"))
        bal_line = f"\n⚡ <b>SKZ:</b> <code>{skz}</code>"
    except Exception:
        bal_line = ""

    body = f"{title}\n<i>{subtitle}</i>{bal_line}"
    return body, main_kb(lang)


# ── /start ─────────────────────────────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    if message.from_user is None:
        return
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert_user failed: {e}")

    body, kb = await render_home(str(message.from_user.id))
    await message.answer(body, reply_markup=kb, parse_mode="HTML",
                         disable_web_page_preview=True)


# ── /lang ──────────────────────────────────────────────────────────────────────
@router.message(Command("lang"))
async def cmd_lang(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))


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
    parts = cb.data.split(":", 1)
    new_lang = parts[1] if len(parts) == 2 else ""
    if not new_lang or new_lang not in LANGS:
        await cb.answer("❌", show_alert=False)
        return
    tg_id = str(cb.from_user.id)
    ok = await set_user_lang(
        tg_id, new_lang,
        API_URL, API_KEY,
        first_name=cb.from_user.first_name or "User",
        username=cb.from_user.username,
    )
    if not ok:
        await cb.answer(t(new_lang, "lang_set_fail"), show_alert=True)
        return
    invalidate_lang_cache(tg_id)
    await cb.answer(t(new_lang, "lang_set_ok"), show_alert=False)
    try:
        body, kb = await render_home(tg_id)
        await cb.message.edit_text(body, reply_markup=kb, parse_mode="HTML",
                                   disable_web_page_preview=True)
    except TelegramBadRequest:
        pass


# ── Home callback ──────────────────────────────────────────────────────────────
@router.callback_query(F.data == "home")
async def cb_home(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    body, kb = await render_home(str(cb.from_user.id))
    await safe_edit(cb.message, body, kb)
    await cb.answer()


# ── /balance ───────────────────────────────────────────────────────────────────
@router.message(Command("balance"))
async def cmd_balance(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    txt, kb = await _build_balance_view(str(message.from_user.id), lang)
    await message.answer(txt, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "balance")
async def cb_balance(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    txt, kb = await _build_balance_view(str(cb.from_user.id), lang)
    await safe_edit(cb.message, txt, kb)
    await cb.answer()


async def _build_balance_view(tg_id: str, lang: str) -> tuple[str, InlineKeyboardMarkup]:
    try:
        data = await api.get_wallet(tg_id)
    except Exception:
        return t(lang, "balance_fetch_err"), back_home_kb(lang)

    if not data:
        return t(lang, "balance_no_wallet"), back_home_kb(lang)

    wallet = data.get("wallet") or {}

    def _num(key: str) -> float:
        try:
            return float(wallet.get(key, "0") or 0)
        except (TypeError, ValueError):
            return 0.0

    skz   = _num("balanceSkz")
    usdt  = _num("balanceUsdt")
    stars = int(_num("balanceStars"))
    ton   = _num("balanceTon")

    lines = [
        t(lang, "balance_title"),
        "",
        t(lang, "balance_skz",   skz=f"{skz:,.2f}"),
        t(lang, "balance_usdt",  usdt=f"{usdt:,.4f}"),
        t(lang, "balance_stars", stars=f"{stars:,}"),
        t(lang, "balance_ton",   ton=f"{ton:,.4f}"),
        t(lang, "balance_hint"),
    ]
    return "\n".join(lines), back_home_kb(lang)


# ── /tickets ───────────────────────────────────────────────────────────────────
@router.message(Command("tickets"))
async def cmd_tickets(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    txt, kb = await _build_tickets_view(str(message.from_user.id), lang)
    await message.answer(txt, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "tickets")
async def cb_tickets(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    txt, kb = await _build_tickets_view(str(cb.from_user.id), lang)
    await safe_edit(cb.message, txt, kb)
    await cb.answer()


async def _build_tickets_view(tg_id: str, lang: str) -> tuple[str, InlineKeyboardMarkup]:
    try:
        tickets = await api.get_my_tickets(tg_id, limit=5)
    except Exception:
        return t(lang, "tickets_fetch_err"), back_home_kb(lang)

    lines = [t(lang, "tickets_title"), ""]

    if not tickets:
        lines.append(t(lang, "tickets_empty"))
        return "\n".join(lines), back_home_kb(lang)

    for ticket in tickets:
        tid = ticket.get("id", "?")
        game = ticket.get("gameName") or ticket.get("game") or "—"
        date = (ticket.get("createdAt") or "")[:10]
        status = ticket.get("status") or "pending"
        payout = float(ticket.get("payoutAmount") or ticket.get("payout") or 0)

        if status == "win" or payout > 0:
            lines.append(t(lang, "tickets_line_win",
                           id=tid, game=game,
                           amount=f"{payout:,.2f}", date=date))
        elif status in ("loss", "lose", "completed"):
            lines.append(t(lang, "tickets_line_loss",
                           id=tid, game=game, date=date))
        else:
            lines.append(t(lang, "tickets_line_pending",
                           id=tid, game=game, date=date))

    return "\n".join(lines), back_home_kb(lang)


# ── /lotto ─────────────────────────────────────────────────────────────────────
@router.message(Command("lotto"))
async def cmd_lotto(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    txt, kb = await _build_lotto_view(str(message.from_user.id), lang)
    await message.answer(txt, reply_markup=kb, parse_mode="HTML",
                         disable_web_page_preview=True)


@router.callback_query(F.data == "lotto")
async def cb_lotto(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    txt, kb = await _build_lotto_view(str(cb.from_user.id), lang)
    await safe_edit(cb.message, txt, kb)
    await cb.answer()


async def _build_lotto_view(tg_id: str, lang: str) -> tuple[str, InlineKeyboardMarkup]:
    try:
        draw = await api.get_current_lotto()
    except Exception:
        return t(lang, "lotto_fetch_err"), back_home_kb(lang)

    lines = [t(lang, "lotto_title"), ""]

    if not draw:
        lines.append(t(lang, "lotto_no_draw"))
        return "\n".join(lines), back_home_kb(lang)

    name = draw.get("name") or draw.get("title") or "—"
    jackpot = fmt_skz(draw.get("jackpot") or draw.get("prizePool") or 0)
    price = fmt_skz(draw.get("ticketPrice") or draw.get("price") or 0)
    ends = (draw.get("endsAt") or draw.get("drawDate") or "")[:16].replace("T", " ")

    lines.append(t(lang, "lotto_draw_info",
                   name=name, jackpot=jackpot, price=price, ends=ends))

    draw_id = draw.get("id")
    try:
        my_tickets = await api.get_my_tickets(tg_id, limit=50, draw_id=draw_id)
    except Exception:
        my_tickets = []

    if my_tickets:
        lines.append(t(lang, "lotto_my_tickets_header"))
        for ticket in my_tickets[:10]:
            numbers = ticket.get("numbers") or ticket.get("picks") or []
            if isinstance(numbers, list):
                nums_str = ", ".join(str(n) for n in numbers)
            else:
                nums_str = str(numbers)
            if nums_str:
                lines.append(t(lang, "lotto_my_numbers", numbers=nums_str))
    else:
        lines.append(t(lang, "lotto_no_my_tickets"))

    lines.append(t(lang, "lotto_play_hint"))
    return "\n".join(lines), back_home_kb(lang)


# ── /help ──────────────────────────────────────────────────────────────────────
@router.message(Command("help"))
async def cmd_help(message: Message):
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await message.answer(t(lang, "help_body"), parse_mode="HTML",
                         reply_markup=back_home_kb(lang))


@router.callback_query(F.data == "help")
async def cb_help(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    await safe_edit(cb.message, t(lang, "help_body"), back_home_kb(lang))
    await cb.answer()


# ── Top-up hub ─────────────────────────────────────────────────────────────────
@router.callback_query(F.data == "topup")
async def cb_topup(cb: CallbackQuery):
    """Top-up hub: Stars vs USDT/TON."""
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_topup_stars"),  callback_data="topup_stars")],
        [InlineKeyboardButton(text=t(lang, "btn_topup_crypto"), callback_data="topup_crypto")],
        [InlineKeyboardButton(text=t(lang, "btn_home"),         callback_data="home")],
    ])
    await safe_edit(cb.message, t(lang, "topup_hub_body"), kb)
    await cb.answer()


# ── Stars top-up ────────────────────────────────────────────────────────────────
@router.callback_query(F.data == "topup_stars")
async def cb_topup_stars(cb: CallbackQuery):
    """Show Stars preset grid."""
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    await safe_edit(cb.message, t(lang, "topup_stars_body"), topup_stars_kb(lang))
    await cb.answer()


@router.callback_query(F.data.startswith("topup_stars_amt:"))
async def cb_topup_stars_amt(cb: CallbackQuery):
    """Create Stars invoice and DM the pay button."""
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        amount_stars = int(cb.data.split(":", 1)[1])
    except (ValueError, IndexError):
        await cb.answer(t(lang, "err_invalid_amt"), show_alert=True)
        return

    try:
        data = await api.stars_invoice(str(cb.from_user.id), amount_stars)
    except httpx.HTTPStatusError as e:
        if _is_blocked(e):
            await cb.answer(t(lang, "err_banned"), show_alert=True)
        else:
            logger.warning(f"stars-invoice failed [{e.response.status_code}]: {e.response.text[:200]}")
            await cb.answer(t(lang, "err_invoice_fail"), show_alert=True)
        return
    except httpx.HTTPError as e:
        logger.warning(f"stars-invoice network error: {e}")
        await cb.answer(t(lang, "err_invoice_fail"), show_alert=True)
        return

    invoice_link = data.get("invoiceLink")
    expected_skz = data.get("expectedSkz", "?")
    if not invoice_link:
        await cb.answer(t(lang, "err_invoice_link"), show_alert=True)
        return

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=t(lang, "pay_stars_btn", n=amount_stars),
            url=invoice_link,
        )],
        [InlineKeyboardButton(text=t(lang, "btn_back_topup"), callback_data="topup_stars")],
    ])
    # Send as a new message so the pay button is fresh and dismissable.
    await cb.message.answer(
        t(lang, "invoice_ready", n=amount_stars, skz=expected_skz),
        parse_mode="HTML",
        reply_markup=kb,
    )
    await cb.answer()


@router.pre_checkout_query()
async def pre_checkout_handler(pcq: PreCheckoutQuery):
    """Telegram requires we answer pre_checkout_query within 10 seconds.
    The server already validated user + amount at invoice creation time;
    the user can only pay what they were shown — always approve here.
    Final credit happens in msg_successful_payment."""
    try:
        await pcq.answer(ok=True)
    except Exception as e:
        logger.error(f"pre_checkout answer failed: {e}")


@router.message(F.successful_payment)
async def msg_successful_payment(message: Message):
    """Credit the user's wallet once Telegram has charged the Stars.
    Idempotent server-side (telegramChargeId is unique per payment) —
    retries and duplicate updates are safe."""
    sp = message.successful_payment
    if not sp or message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    payload       = sp.invoice_payload
    amount_stars  = int(sp.total_amount)
    tg_charge_id  = sp.telegram_payment_charge_id
    prov_charge_id = sp.provider_payment_charge_id

    try:
        data = await api.stars_confirm(
            str(message.from_user.id),
            payload,
            amount_stars,
            tg_charge_id,
            prov_charge_id,
        )
    except httpx.HTTPError as e:
        logger.error(f"stars-confirm network error: {e}")
        # Payment was received — balance will be reconciled manually.
        await message.answer(t(lang, "stars_pay_delayed"), parse_mode="HTML")
        return

    if not isinstance(data, dict) or not data.get("creditedSkz"):
        # Non-200 raises above; this catches unexpected empty payloads.
        await message.answer(
            t(lang, "stars_pay_issue", ref=tg_charge_id),
            parse_mode="HTML",
        )
        return

    credited = data.get("creditedSkz", "?")
    new_bal  = data.get("newSkzBalance", "?")
    await message.answer(
        t(lang, "stars_pay_ok", stars=amount_stars, skz=credited, bal=new_bal),
        parse_mode="HTML",
    )


# ── TON / USDT deposit flow ────────────────────────────────────────────────────
@router.callback_query(F.data == "topup_crypto")
async def cb_topup_crypto(cb: CallbackQuery):
    """Deposit hub — splits into has-wallet vs needs-wallet paths."""
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=t(lang, "btn_deposit_have_wallet"),
            callback_data="deposit_have",
        )],
        [InlineKeyboardButton(
            text=t(lang, "btn_deposit_no_wallet"),
            callback_data="deposit_nowallet",
        )],
        [InlineKeyboardButton(text=t(lang, "btn_back_topup"), callback_data="topup")],
    ])
    await safe_edit(cb.message, t(lang, "deposit_hub_body"), kb)
    await cb.answer()


@router.callback_query(F.data == "deposit_have")
async def cb_deposit_have(cb: CallbackQuery):
    """Show TON / USDT preset amounts. Choosing one creates a deposit intent."""
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    ton_btns  = [InlineKeyboardButton(text=f"💎 {a} TON",  callback_data=f"deposit_ton:{a}")
                 for a in DEPOSIT_TON_PRESETS]
    usdt_btns = [InlineKeyboardButton(text=f"💵 {a} USDT", callback_data=f"deposit_usdt:{a}")
                 for a in DEPOSIT_USDT_PRESETS]
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton(text=t(lang, "label_deposit_ton"),  callback_data="noop")],
        ton_btns[0:3],
        ton_btns[3:6],
        [InlineKeyboardButton(text=t(lang, "label_deposit_usdt"), callback_data="noop")],
        usdt_btns[0:3],
        usdt_btns[3:6],
        [InlineKeyboardButton(text=t(lang, "btn_back_deposit"), callback_data="topup_crypto")],
    ]
    await safe_edit(cb.message, t(lang, "deposit_have_body"),
                    InlineKeyboardMarkup(inline_keyboard=rows))
    await cb.answer()


@router.callback_query(F.data == "noop")
async def cb_noop(cb: CallbackQuery):
    """Section-header buttons are not interactive — swallow taps silently."""
    await cb.answer()


@router.callback_query(F.data.startswith("deposit_ton:") | F.data.startswith("deposit_usdt:"))
async def cb_deposit_amount(cb: CallbackQuery):
    """Create a deposit intent and show the unique address + memo."""
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        prefix, raw_amt = cb.data.split(":", 1)
        amount = float(raw_amt)
    except (ValueError, IndexError):
        await cb.answer(t(lang, "err_invalid_amt"), show_alert=True)
        return

    currency = "ton" if prefix == "deposit_ton" else "usdt"
    try:
        try:
            if currency == "ton":
                data = await api.ton_deposit_intent(str(cb.from_user.id), amount)
            else:
                data = await api.usdt_deposit_intent(str(cb.from_user.id), amount)
        except httpx.HTTPStatusError as e:
            if _is_blocked(e):
                await cb.answer(t(lang, "err_banned"), show_alert=True)
            else:
                logger.warning(f"deposit-intent failed [{e.response.status_code}]")
                await cb.answer(t(lang, "deposit_intent_err"), show_alert=True)
            return
        except httpx.HTTPError as e:
            logger.warning(f"deposit-intent network error: {e}")
            await cb.answer(t(lang, "deposit_intent_err"), show_alert=True)
            return

        if not data or not data.get("depositAddress") or not data.get("memo"):
            await cb.answer(t(lang, "deposit_intent_err"), show_alert=True)
            return

        addr = data["depositAddress"]
        memo = data["memo"]
        skz  = data.get("expectedSkz", "?")
        amt_str = f"{amount:g}"
        body_key = "deposit_ready_ton" if currency == "ton" else "deposit_ready_usdt"
        text = t(lang, body_key, amt=amt_str, addr=addr, memo=memo, skz=skz)

        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=t(lang, "btn_back_deposit"), callback_data="deposit_have")],
            [InlineKeyboardButton(text=t(lang, "btn_home"),         callback_data="home")],
        ])
        await safe_edit(cb.message, text, kb)
    except Exception:
        logger.exception("cb_deposit_amount unexpected error")
        try:
            await cb.answer(t(lang, "deposit_intent_err"), show_alert=True)
            return
        except Exception:
            pass
    finally:
        # Safe to call twice — Telegram tolerates a no-op second ack.
        try:
            await cb.answer()
        except Exception:
            pass


@router.callback_query(F.data == "deposit_nowallet")
async def cb_deposit_nowallet(cb: CallbackQuery):
    """TON Keeper install guide for users without a crypto wallet."""
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=t(lang, "btn_appstore_tonkeeper"),  url=TONKEEPER_APPSTORE_URL),
            InlineKeyboardButton(text=t(lang, "btn_playstore_tonkeeper"), url=TONKEEPER_PLAYSTORE_URL),
        ],
        [InlineKeyboardButton(text=t(lang, "btn_deposit_have_wallet"), callback_data="deposit_have")],
        [InlineKeyboardButton(text=t(lang, "btn_back_deposit"),        callback_data="topup_crypto")],
    ])
    await safe_edit(cb.message, t(lang, "deposit_no_wallet_body"), kb)
    await cb.answer()


# ── Play (no URL fallback) ─────────────────────────────────────────────────────
@router.callback_query(F.data == "play_no_url")
async def cb_play_no_url(cb: CallbackQuery):
    if cb.from_user is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    await cb.answer(
        "🔧 Mini App غير متاح في هذه البيئة." if lang == "ar"
        else "🔧 Mini App is not available in this environment.",
        show_alert=True,
    )


# ── Main ───────────────────────────────────────────────────────────────────────
async def main():
    if not BOT_TOKEN:
        raise RuntimeError("SWEEP_BOT_TOKEN is not set")

    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    # Publish the default command menu (Arabic)
    try:
        from aiogram.types import BotCommandScopeDefault
        await bot.set_my_commands(COMMANDS, scope=BotCommandScopeDefault())
    except Exception as e:
        logger.warning(f"set_my_commands failed: {e}")

    # Wire the chat menu button to the Mini App (if URL is known)
    if WEB_APP_URL:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="🎰 SWEEP",
                    web_app=WebAppInfo(url=WEB_APP_URL),
                )
            )
            logger.info(f"sweep-bot: mini app menu button → {WEB_APP_URL}")
        except Exception as e:
            logger.warning(f"set_chat_menu_button failed: {e}")

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "sweep-bot")


if __name__ == "__main__":
    asyncio.run(main())
