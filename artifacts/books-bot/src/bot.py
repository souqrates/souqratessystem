"""
SOUQRATES SOUQ — Simplified marketplace bot for books and physical products (cups / كوسات).
Browse products by category, buy with SKZ. No publishing, no digital downloads.
"""
import asyncio
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("books-bot")

from sentry_init import init_sentry
init_sentry("books-bot")

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command
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

from client import BooksBotClient
from i18n import (
    t,
    get_user_lang,
    set_user_lang,
    lang_keyboard,
    invalidate_lang_cache,
    DEFAULT_LANG,
    LANGS,
    update_translations,
)

# ── Config ─────────────────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("BOOKS_BOT_TOKEN")
API_URL   = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
PAGE_SIZE = 6


def _resolve_web_app_url() -> str:
    """Return the Mini App URL for this bot.
    Priority:
      1. BOOKS_WEB_APP_URL — explicit override (set on production server)
      2. REPLIT_DOMAINS   — auto-derive from Replit dev domain
    """
    explicit = (os.getenv("BOOKS_WEB_APP_URL") or "").strip()
    if explicit.startswith("https://"):
        return explicit
    replit_domains = (os.getenv("REPLIT_DOMAINS") or "").strip()
    if replit_domains:
        first = replit_domains.split(",")[0].strip()
        return f"https://{first}/books-bot-web/"
    return ""


WEB_APP_URL = _resolve_web_app_url()

# ── Shop strings (extend i18n) ─────────────────────────────────────────────────
update_translations({
    "welcome": {
        "ar": ("👋 أهلاً بك في <b>SOUQRATES SOUQ</b>\n\n"
               "تصفّح كتبنا وكوساتنا المميزة وادفع بـ SKZ.\n\n"
               "اضغط <b>📚 تصفح</b> للبدء."),
        "en": ("👋 Welcome to <b>SOUQRATES SOUQ</b>\n\n"
               "Browse our books and cups and pay with SKZ.\n\n"
               "Tap <b>📚 Browse</b> to get started."),
    },
    "shop_categories": {
        "ar": "📚 <b>اختر التصنيف:</b>",
        "en": "📚 <b>Choose a category:</b>",
    },
    "shop_product_list": {
        "ar": "🛍️ <b>{name}</b> — {total} منتج\n\nاختر منتجًا:",
        "en": "🛍️ <b>{name}</b> — {total} item(s)\n\nChoose a product:",
    },
    "shop_empty": {
        "ar": "📭 لا توجد منتجات في هذا التصنيف بعد.",
        "en": "📭 No products in this category yet.",
    },
    "shop_product_detail": {
        "ar": "🛍️ <b>{name}</b>\n\n{desc}\n\n💰 السعر: <code>{price}</code> SKZ",
        "en": "🛍️ <b>{name}</b>\n\n{desc}\n\n💰 Price: <code>{price}</code> SKZ",
    },
    "shop_confirm": {
        "ar": ("🛒 <b>تأكيد الشراء</b>\n\n"
               "📦 {name}\n"
               "💰 السعر: <code>{price}</code> SKZ\n\n"
               "هل تريد المتابعة؟"),
        "en": ("🛒 <b>Confirm Purchase</b>\n\n"
               "📦 {name}\n"
               "💰 Price: <code>{price}</code> SKZ\n\n"
               "Do you want to proceed?"),
    },
    "buy_success": {
        "ar": ("✅ <b>تمت عملية الشراء بنجاح!</b>\n\n"
               "📦 {name}\n"
               "💰 المدفوع: <code>{price}</code> SKZ\n"
               "💵 الرصيد المتبقي: <code>{balance}</code> SKZ\n\n"
               "سيتواصل معك الفريق لإتمام التسليم. شكرًا لك! 🎉"),
        "en": ("✅ <b>Purchase successful!</b>\n\n"
               "📦 {name}\n"
               "💰 Paid: <code>{price}</code> SKZ\n"
               "💵 Remaining balance: <code>{balance}</code> SKZ\n\n"
               "Our team will contact you for delivery. Thank you! 🎉"),
    },
    "btn_confirm": {"ar": "✅ تأكيد الشراء", "en": "✅ Confirm Purchase"},
    "btn_cancel":  {"ar": "❌ إلغاء",         "en": "❌ Cancel"},
    "btn_prev":    {"ar": "◀️ السابق",        "en": "◀️ Prev"},
    "btn_next":    {"ar": "التالي ▶️",        "en": "Next ▶️"},
    "help_body": {
        "ar": ("<b>مساعدة — SOUQRATES SOUQ</b>\n\n"
               "/start — القائمة الرئيسية\n"
               "/wallet — رصيد محفظتي\n"
               "/help — عرض هذه المساعدة\n\n"
               "• اضغط <b>📚 تصفح</b> لاستعراض الكتب والكوسات.\n"
               "• الدفع بـ SKZ فقط — اشحن محفظتك من <b>SOUQRATES SYSTEM</b>."),
        "en": ("<b>Help — SOUQRATES SOUQ</b>\n\n"
               "/start — Main menu\n"
               "/wallet — Wallet balance\n"
               "/help — Show this help\n\n"
               "• Tap <b>📚 Browse</b> to explore books and cups.\n"
               "• Payment is SKZ only — top up from <b>SOUQRATES SYSTEM</b>."),
    },
})

# ── Product categories ─────────────────────────────────────────────────────────
CATEGORIES = [
    {"slug": "books", "ar": "📚 كتب",   "en": "📚 Books"},
    {"slug": "cups",  "ar": "☕ كوسات", "en": "☕ Cups"},
]


def _cat_label(cat: dict, lang: str) -> str:
    return cat["ar"] if lang == "ar" else cat["en"]


def _cat_by_slug(slug: str) -> dict | None:
    return next((c for c in CATEGORIES if c["slug"] == slug), None)


# ── Keyboards ──────────────────────────────────────────────────────────────────
def main_kb(lang: str) -> InlineKeyboardMarkup:
    ar = lang == "ar"
    rows = []
    if WEB_APP_URL.startswith("https://"):
        rows.append([InlineKeyboardButton(
            text="❖ " + ("افتح متجر SOUQRATES SOUQ" if ar else "Open SOUQRATES SOUQ Store"),
            web_app=WebAppInfo(url=WEB_APP_URL),
        )])
    rows += [
        [InlineKeyboardButton(text=t(lang, "btn_browse"), callback_data="browse")],
        [
            InlineKeyboardButton(text=t(lang, "btn_wallet"), callback_data="wallet"),
            InlineKeyboardButton(text=t(lang, "btn_help"),   callback_data="help"),
        ],
        [InlineKeyboardButton(
            text="🌐 " + ("اللغة" if ar else "Language"),
            callback_data="langmenu",
        )],
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def categories_kb(lang: str) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=_cat_label(c, lang), callback_data=f"cat:{c['slug']}:0")]
        for c in CATEGORIES
    ]
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back_menu"), callback_data="menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def products_kb(
    products: list[dict], lang: str, cat_slug: str, offset: int, total: int,
) -> InlineKeyboardMarkup:
    rows = []
    for p in products:
        name  = p.get("nameAr") if lang == "ar" else (p.get("nameEn") or p.get("nameAr") or "")
        price = float(p.get("priceSkz", 0))
        rows.append([InlineKeyboardButton(
            text=f"{name} — {price:g} SKZ",
            callback_data=f"prod:{p['id']}",
        )])
    nav: list[InlineKeyboardButton] = []
    if offset > 0:
        nav.append(InlineKeyboardButton(
            text=t(lang, "btn_prev"),
            callback_data=f"cat:{cat_slug}:{max(0, offset - PAGE_SIZE)}",
        ))
    if offset + PAGE_SIZE < total:
        nav.append(InlineKeyboardButton(
            text=t(lang, "btn_next"),
            callback_data=f"cat:{cat_slug}:{offset + PAGE_SIZE}",
        ))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="browse")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def product_detail_kb(lang: str, product_id: int, price: float) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=t(lang, "btn_buy", price=f"{price:g}"),
            callback_data=f"buy:{product_id}",
        )],
        [InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="browse")],
    ])


def confirm_kb(lang: str, product_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=t(lang, "btn_confirm"), callback_data=f"buyok:{product_id}"),
            InlineKeyboardButton(text=t(lang, "btn_cancel"),  callback_data="browse"),
        ],
    ])


def back_menu_kb(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_back_menu"), callback_data="menu")]
    ])


# ── Shared state ───────────────────────────────────────────────────────────────
_client: BooksBotClient


async def _lang(tg_id: int) -> str:
    return await get_user_lang(str(tg_id), API_URL, _client.api_key)


async def _safe_edit(msg: Message, text: str, kb: InlineKeyboardMarkup | None = None) -> None:
    try:
        await msg.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except TelegramBadRequest:
        pass


# ── Command handlers ───────────────────────────────────────────────────────────
router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    tg = message.from_user
    lang = await _lang(tg.id)
    try:
        await _client.upsert_user(tg)
    except Exception as e:
        logger.warning("upsert_user error: %s", e)
    await message.answer(t(lang, "welcome"), parse_mode="HTML", reply_markup=main_kb(lang))


@router.message(Command("wallet"))
async def cmd_wallet_msg(message: Message) -> None:
    lang = await _lang(message.from_user.id)
    await _show_wallet(str(message.from_user.id), lang, message, send_new=True)


@router.message(Command("help"))
async def cmd_help_msg(message: Message) -> None:
    lang = await _lang(message.from_user.id)
    await message.answer(t(lang, "help_body"), parse_mode="HTML", reply_markup=main_kb(lang))


# ── Callback handlers ──────────────────────────────────────────────────────────

@router.callback_query(F.data == "menu")
async def cb_menu(cb: CallbackQuery) -> None:
    lang = await _lang(cb.from_user.id)
    await _safe_edit(cb.message, t(lang, "welcome"), main_kb(lang))
    await cb.answer()


@router.callback_query(F.data == "browse")
async def cb_browse(cb: CallbackQuery) -> None:
    lang = await _lang(cb.from_user.id)
    await _safe_edit(cb.message, t(lang, "shop_categories"), categories_kb(lang))
    await cb.answer()


@router.callback_query(F.data.startswith("cat:"))
async def cb_cat(cb: CallbackQuery) -> None:
    parts = cb.data.split(":")
    if len(parts) < 3:
        await cb.answer()
        return
    cat_slug = parts[1]
    offset   = max(0, int(parts[2]))
    lang     = await _lang(cb.from_user.id)

    cat_obj     = _cat_by_slug(cat_slug)
    cat_display = _cat_label(cat_obj, lang) if cat_obj else cat_slug

    try:
        data = await _client.list_shop(category=cat_slug, limit=PAGE_SIZE, offset=offset)
    except Exception as e:
        logger.error("list_shop error: %s", e)
        await cb.answer(t(lang, "err_generic"), show_alert=True)
        return

    products = data.get("data", [])
    total    = data.get("total", 0)

    if not products and offset == 0:
        await _safe_edit(cb.message, t(lang, "shop_empty"), InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="browse")]
        ]))
        await cb.answer()
        return

    text = t(lang, "shop_product_list", name=cat_display, total=total)
    await _safe_edit(cb.message, text, products_kb(products, lang, cat_slug, offset, total))
    await cb.answer()


@router.callback_query(F.data.startswith("prod:"))
async def cb_prod(cb: CallbackQuery) -> None:
    product_id = int(cb.data.split(":")[1])
    lang       = await _lang(cb.from_user.id)

    try:
        p = await _client.get_shop_product(product_id)
    except Exception as e:
        logger.error("get_shop_product error: %s", e)
        await cb.answer(t(lang, "err_generic"), show_alert=True)
        return
    if not p:
        await cb.answer(t(lang, "product_not_found"), show_alert=True)
        return

    name  = p.get("nameAr") if lang == "ar" else (p.get("nameEn") or p.get("nameAr") or "")
    desc  = p.get("descriptionAr") if lang == "ar" else (p.get("descriptionEn") or p.get("descriptionAr") or "")
    price = float(p.get("priceSkz", 0))

    text = t(lang, "shop_product_detail", name=name, desc=desc or "—", price=f"{price:g}")
    await _safe_edit(cb.message, text, product_detail_kb(lang, product_id, price))
    await cb.answer()


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery) -> None:
    product_id = int(cb.data.split(":")[1])
    lang       = await _lang(cb.from_user.id)

    try:
        p = await _client.get_shop_product(product_id)
    except Exception:
        await cb.answer(t(lang, "err_generic"), show_alert=True)
        return
    if not p:
        await cb.answer(t(lang, "product_not_found"), show_alert=True)
        return

    name  = p.get("nameAr") if lang == "ar" else (p.get("nameEn") or p.get("nameAr") or "")
    price = float(p.get("priceSkz", 0))
    await _safe_edit(cb.message, t(lang, "shop_confirm", name=name, price=f"{price:g}"), confirm_kb(lang, product_id))
    await cb.answer()


@router.callback_query(F.data.startswith("buyok:"))
async def cb_buyok(cb: CallbackQuery) -> None:
    product_id = int(cb.data.split(":")[1])
    lang       = await _lang(cb.from_user.id)
    tg_id      = str(cb.from_user.id)

    try:
        p = await _client.get_shop_product(product_id)
    except Exception:
        await cb.answer(t(lang, "err_generic"), show_alert=True)
        return
    if not p:
        await cb.answer(t(lang, "product_not_found"), show_alert=True)
        return

    name  = p.get("nameAr") if lang == "ar" else (p.get("nameEn") or p.get("nameAr") or "")
    price = float(p.get("priceSkz", 0))

    try:
        result = await _client.purchase_shop(tg_id, product_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 402:
            await _safe_edit(cb.message, t(lang, "buy_insufficient"), back_menu_kb(lang))
        else:
            body: dict = {}
            try:
                body = e.response.json()
            except Exception:
                pass
            await cb.answer(t(lang, "buy_err_alert", msg=body.get("error", str(e))), show_alert=True)
        await cb.answer()
        return
    except Exception as e:
        logger.error("purchase_shop error: %s", e)
        await cb.answer(t(lang, "err_generic"), show_alert=True)
        return

    new_balance = result.get("newBalance", 0)
    text = t(lang, "buy_success", name=name, price=f"{price:g}", balance=f"{new_balance:g}")
    await _safe_edit(cb.message, text, back_menu_kb(lang))
    await cb.answer(t(lang, "buy_answer_ok"), show_alert=False)


@router.callback_query(F.data == "wallet")
async def cb_wallet(cb: CallbackQuery) -> None:
    lang = await _lang(cb.from_user.id)
    await _show_wallet(str(cb.from_user.id), lang, cb.message)
    await cb.answer()


@router.callback_query(F.data == "help")
async def cb_help(cb: CallbackQuery) -> None:
    lang = await _lang(cb.from_user.id)
    await _safe_edit(cb.message, t(lang, "help_body"), back_menu_kb(lang))
    await cb.answer()


@router.callback_query(F.data == "langmenu")
async def cb_langmenu(cb: CallbackQuery) -> None:
    lang = await _lang(cb.from_user.id)
    await _safe_edit(cb.message, t(lang, "lang_prompt"), lang_keyboard("setlang"))
    await cb.answer()


@router.callback_query(F.data.startswith("setlang:"))
async def cb_setlang(cb: CallbackQuery) -> None:
    new_lang = cb.data.split(":")[1]
    if new_lang not in LANGS:
        await cb.answer()
        return
    tg = cb.from_user
    ok = await set_user_lang(
        str(tg.id), new_lang, API_URL, _client.api_key,
        first_name=tg.first_name or "User", username=tg.username,
    )
    if ok:
        invalidate_lang_cache(str(tg.id))
    await _safe_edit(cb.message, t(new_lang, "welcome"), main_kb(new_lang))
    await cb.answer(t(new_lang, "lang_set_ok") if ok else t(new_lang, "lang_set_fail"))


# ── Wallet helper ──────────────────────────────────────────────────────────────

async def _show_wallet(
    tg_id: str, lang: str, msg: Message, send_new: bool = False,
) -> None:
    try:
        data = await _client.get_wallet(tg_id)
    except Exception:
        data = None
    if not data:
        text = t(lang, "err_no_wallet")
        if send_new:
            await msg.answer(text, parse_mode="HTML", reply_markup=back_menu_kb(lang))
        else:
            await _safe_edit(msg, text, back_menu_kb(lang))
        return

    wallet = data.get("wallet", {}) or {}
    skz    = float(wallet.get("balanceSkz",  0))
    usdt   = float(wallet.get("balanceUsdt", 0))
    text   = t(lang, "wallet_text", skz=f"{skz:g}", usdt=f"{usdt:.4f}")
    if send_new:
        await msg.answer(text, parse_mode="HTML", reply_markup=back_menu_kb(lang))
    else:
        await _safe_edit(msg, text, back_menu_kb(lang))


# ── Entry point ────────────────────────────────────────────────────────────────

async def main() -> None:
    global _client

    if not BOT_TOKEN:
        raise RuntimeError("BOOKS_BOT_TOKEN is not set")

    api_key = os.getenv("BOOKS_BOT_API_KEY", "").strip()
    if not api_key or ":" in api_key or len(api_key) < 20:
        raise RuntimeError("BOOKS_BOT_API_KEY is not configured")

    _client = BooksBotClient(api_key=api_key, base_url=API_URL)

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp  = Dispatcher()
    dp.include_router(router)

    await bot.set_my_commands(
        [
            BotCommand(command="start",  description="القائمة الرئيسية / Main menu"),
            BotCommand(command="wallet", description="رصيد محفظتي / My wallet"),
            BotCommand(command="help",   description="مساعدة / Help"),
        ],
        scope=BotCommandScopeDefault(),
    )

    _client.start_heartbeat(interval_seconds=30, version="2.0-shop")

    if WEB_APP_URL.startswith("https://") and os.getenv("USE_WEBHOOK"):
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(text="❖ SOUQRATES SOUQ", web_app=WebAppInfo(url=WEB_APP_URL))
            )
            logger.info("books-bot: menu button set to WebApp → %s", WEB_APP_URL)
        except Exception as e:
            logger.warning("books-bot: set_chat_menu_button failed: %s", e)

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "books-bot")


if __name__ == "__main__":
    asyncio.run(main())
