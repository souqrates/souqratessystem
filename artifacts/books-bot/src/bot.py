"""
SOUQRATES SOUQ — child Telegram bot (aiogram 3).

Mirrors the structure of artifacts/mother-bot/src/bot.py but is purpose-built
for the digital-products marketplace:
  - /start           browse categories + featured books
  - 📚 Browse        list books by category, paginate, view detail, BUY (SKZ)
  - 📤 Publish       walk a publisher through submitting a new book (FSM)
  - 📂 My library    list bought books with signed download links + my submissions

All financial mutations flow through the mother-bot API (X-Bot-Api-Key),
which applies getEffectiveCommissionRate('books-bot',…) + rejectIfBlocked
server-side. This bot never touches wallet balances directly.
"""
import asyncio
import logging
import os

# Sentry must init before any business-logic import — captures bootstrap errors.
from sentry_init import init_sentry
init_sentry("books-bot")

import httpx
from aiogram import Bot, BaseMiddleware, Dispatcher, F, Router
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
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
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from dotenv import load_dotenv

from i18n import (
    t,
    get_user_lang,
    set_user_lang,
    lang_keyboard,
    invalidate_lang_cache,
    DEFAULT_LANG,
    LANGS,
)

# ── Upload limits (must mirror api-server /internal/books/upload-url) ────────
COVER_MAX_BYTES = 5 * 1024 * 1024     # 5 MB
COVER_MIME = {"image/jpeg", "image/png", "image/webp"}
COVER_EXT_TO_MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
FILE_MAX_BYTES = 20 * 1024 * 1024     # 20 MB (Telegram Bot API hard limit)
FILE_MIME = {"application/pdf", "application/epub+zip", "application/zip", "audio/mpeg", "audio/mp3"}
FILE_EXT_TO_MIME = {
    "pdf": "application/pdf",
    "epub": "application/epub+zip",
    "zip": "application/zip",
    "mp3": "audio/mpeg",
}


def _guess_mime(file_name: str | None, declared: str | None) -> str | None:
    """Prefer the client-declared MIME; fall back to extension. Telegram
    sometimes omits mime_type for documents — we don't want to reject those."""
    if declared:
        return declared.lower().split(";")[0].strip()
    if file_name and "." in file_name:
        ext = file_name.rsplit(".", 1)[-1].lower()
        return COVER_EXT_TO_MIME.get(ext) or FILE_EXT_TO_MIME.get(ext)
    return None


async def _upload_to_signed_url(upload_url: str, content_type: str, data: bytes) -> None:
    """PUT raw bytes to a GCS signed URL. The api-server validated the
    Content-Type before signing — we must echo it exactly."""
    async with httpx.AsyncClient() as http:
        r = await http.put(
            upload_url,
            content=data,
            headers={"Content-Type": content_type},
            timeout=60.0,
        )
        r.raise_for_status()


async def _download_from_telegram(bot: Bot, file_id: str) -> bytes:
    """Download a Telegram-hosted file (photo/document) into memory.
    Capped server-side by Telegram's 20 MB Bot API limit — we surface a
    user-friendly error if the file is larger."""
    tg_file = await bot.get_file(file_id)
    buf = bytearray()
    await bot.download(tg_file, destination=buf)
    return bytes(buf)

from client import BooksBotClient

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("books-bot")

BOT_TOKEN = os.getenv("BOOKS_BOT_TOKEN", "")
MOTHER_API_URL = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
BOOKS_BOT_API_KEY = os.getenv("BOOKS_BOT_API_KEY", "")
# Public URL of the books-bot-web mini-app (used for the chat menu button).
# Resolution order (same logic as contests-bot so the bot runs on Replit dev AND Contabo):
#   1) BOOKS_WEB_APP_URL   — explicit override
#   2) PUBLIC_BASE_URL     — production base for Contabo / souqrates.com
#   3) REPLIT_DOMAINS      — Replit published deploy
#   4) REPLIT_DEV_DOMAIN   — Replit dev preview
def _resolve_books_web_app_url() -> str:
    explicit = (os.getenv("BOOKS_WEB_APP_URL") or "").strip()
    if explicit:
        return explicit
    public = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if public:
        return f"{public}/books-bot-web/"
    rds = (os.getenv("REPLIT_DOMAINS") or "").split(",")[0].strip()
    if rds:
        return f"https://{rds}/books-bot-web/"
    dev = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
    if dev:
        return f"https://{dev}/books-bot-web/"
    return "https://souqrates.com/books-bot-web/"
WEB_APP_URL = _resolve_books_web_app_url()

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

api = BooksBotClient(api_key=BOOKS_BOT_API_KEY, base_url=MOTHER_API_URL)
texts = api.texts("books-bot", ttl_seconds=60)
router = Router()


# ── Safe edit helper ─────────────────────────────────────────────────────────
async def _safe_edit(msg, text: str, reply_markup=None, **kw) -> None:
    """Wrapper for edit_text that falls back to answer() when the message was
    deleted or is too old to edit (TelegramBadRequest).  Any other exception is
    swallowed to keep callback handlers from crashing the dispatcher."""
    try:
        await msg.edit_text(text, reply_markup=reply_markup, **kw)
    except TelegramBadRequest:
        try:
            await msg.answer(text, reply_markup=reply_markup, **kw)
        except Exception:
            pass
    except Exception:
        pass


# ── FSM for publishing ──────────────────────────────────────────────────────
class Publish(StatesGroup):
    title = State()
    description = State()
    category = State()
    price = State()
    cover = State()
    file = State()
    confirm = State()


# ── Keyboards ───────────────────────────────────────────────────────────────
def main_kb(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_browse"),  callback_data="browse")],
        [InlineKeyboardButton(text=t(lang, "btn_publish"), callback_data="pub_start"),
         InlineKeyboardButton(text=t(lang, "btn_library"), callback_data="my_lib")],
        [InlineKeyboardButton(text=t(lang, "btn_wallet"),  callback_data="wallet"),
         *(
             [InlineKeyboardButton(text="🛍 SOUQ Web", web_app=WebAppInfo(url=WEB_APP_URL))]
             if WEB_APP_URL.startswith("https://")
             else []
         )],
        [InlineKeyboardButton(text="🌐 Language / اللغة", callback_data="lang_menu")],
    ])


def back_kb(cb: str = "menu", lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_back"), callback_data=cb)]
    ])


# ── Bot command menu (single source of truth for /setcommands) ──────────────
# Mirrors the @router.message(Command(...)) handlers below; published to
# Telegram at startup via bot.set_my_commands() so BotFather /setcommands is
# no longer required. Add a new entry here whenever you add a new Command()
# handler so the menu stays in sync.
COMMANDS: list[BotCommand] = [
    BotCommand(command="start",   description="بدء استخدام البوت وفتح القائمة الرئيسية"),
    BotCommand(command="browse",  description="تصفّح الكتب حسب التصنيف"),
    BotCommand(command="publish", description="نشر كتاب جديد للمراجعة"),
    BotCommand(command="library", description="مكتبتي (مشترياتي وإصداراتي)"),
    BotCommand(command="wallet",  description="رصيد محفظتي بـ SKZ"),
    BotCommand(command="lang",    description="🌐 تغيير اللغة (عربي / إنجليزي)"),
    BotCommand(command="cancel",  description="إلغاء العملية الجارية والعودة للقائمة"),
    BotCommand(command="help",    description="عرض قائمة الأوامر والمساعدة"),
]

# Per-language translations of the menu. Telegram picks the closest match to
# the user's Telegram UI language (`language_code`), falling back to the
# default (no language_code) menu — which we keep as Arabic since this bot's
# primary audience is Arabic-speaking. Add a new language here to publish a
# localized menu automatically at startup; no handler changes are needed
# because slash-command names stay identical across languages.
COMMANDS_BY_LANG: dict[str, list[BotCommand]] = {
    "ar": COMMANDS,
    "en": [
        BotCommand(command="start",   description="Start the bot and open the main menu"),
        BotCommand(command="browse",  description="Browse books by category"),
        BotCommand(command="publish", description="Submit a new book for review"),
        BotCommand(command="library", description="My library (purchases & publications)"),
        BotCommand(command="wallet",  description="My SKZ wallet balance"),
        BotCommand(command="lang",    description="🌐 Change language (Arabic / English)"),
        BotCommand(command="cancel",  description="Cancel current operation and return to menu"),
        BotCommand(command="help",    description="Show commands list and help"),
    ],
    "ru": [
        BotCommand(command="start",   description="Запустить бота и открыть главное меню"),
        BotCommand(command="browse",  description="Просмотр книг по категориям"),
        BotCommand(command="publish", description="Отправить новую книгу на проверку"),
        BotCommand(command="library", description="Моя библиотека (покупки и публикации)"),
        BotCommand(command="wallet",  description="Баланс кошелька SKZ"),
        BotCommand(command="help",    description="Список команд и помощь"),
    ],
    "es": [
        BotCommand(command="start",   description="Iniciar el bot y abrir el menú principal"),
        BotCommand(command="browse",  description="Explorar libros por categoría"),
        BotCommand(command="publish", description="Enviar un nuevo libro para revisión"),
        BotCommand(command="library", description="Mi biblioteca (compras y publicaciones)"),
        BotCommand(command="wallet",  description="Saldo de mi cartera SKZ"),
        BotCommand(command="help",    description="Mostrar lista de comandos y ayuda"),
    ],
    "fr": [
        BotCommand(command="start",   description="Démarrer le bot et ouvrir le menu principal"),
        BotCommand(command="browse",  description="Parcourir les livres par catégorie"),
        BotCommand(command="publish", description="Soumettre un nouveau livre pour révision"),
        BotCommand(command="library", description="Ma bibliothèque (achats et publications)"),
        BotCommand(command="wallet",  description="Solde de mon portefeuille SKZ"),
        BotCommand(command="help",    description="Afficher la liste des commandes et l'aide"),
    ],
    "tr": [
        BotCommand(command="start",   description="Botu başlat ve ana menüyü aç"),
        BotCommand(command="browse",  description="Kitaplara kategoriye göre göz at"),
        BotCommand(command="publish", description="İnceleme için yeni kitap gönder"),
        BotCommand(command="library", description="Kütüphanem (satın alımlar ve yayınlar)"),
        BotCommand(command="wallet",  description="SKZ cüzdan bakiyem"),
        BotCommand(command="help",    description="Komut listesini ve yardımı göster"),
    ],
    "fa": [
        BotCommand(command="start",   description="شروع ربات و باز کردن منوی اصلی"),
        BotCommand(command="browse",  description="مرور کتاب‌ها بر اساس دسته‌بندی"),
        BotCommand(command="publish", description="ارسال کتاب جدید برای بررسی"),
        BotCommand(command="library", description="کتابخانه من (خریدها و انتشارات)"),
        BotCommand(command="wallet",  description="موجودی کیف پول SKZ من"),
        BotCommand(command="help",    description="نمایش فهرست دستورات و راهنما"),
    ],
}


# ── /start ──────────────────────────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert failed: {e}")

    # Deep-link payload routing: /start <payload>
    # Web CTAs send `?start=publish` or `?start=buy_<numeric_id>`.
    parts = (message.text or "").split(maxsplit=1)
    payload = parts[1].strip() if len(parts) > 1 else ""
    lang = await get_user_lang(str(message.from_user.id), MOTHER_API_URL, BOOKS_BOT_API_KEY)
    if payload == "publish":
        await state.set_state(Publish.title)
        await message.answer(t(lang, "pub_ask_title"), parse_mode="HTML", reply_markup=back_kb("menu", lang))
        return
    if payload.startswith("buy_"):
        raw = payload[4:]
        if raw.isdigit():
            pid = int(raw)
            p = await api.get_product(pid)
            if p:
                price = float(p["priceUsdt"])
                txt = t(lang, "product_short",
                        title=p["title"], desc=p["description"] or "—", price=f"{price:.2f}")
                kb = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text=t(lang, "btn_buy", price=f"{price:.2f}"), callback_data=f"buy:{pid}")],
                    [InlineKeyboardButton(text=t(lang, "btn_back_menu"), callback_data="menu")],
                ])
                await message.answer(txt, parse_mode="HTML", reply_markup=kb)
                return

    # English speakers get the static bilingual welcome (no admin override yet).
    # Arabic continues to use admin-editable copy via the texts cache so panel
    # tweaks still propagate without a code change.
    if lang == "en":
        await message.answer(t("en", "welcome"), parse_mode="HTML", reply_markup=main_kb(lang))
    else:
        title = await texts.get("welcome_title", "❖ أهلًا بك في SOUQRATES SOUQ")
        body = await texts.get(
            "welcome_body",
            "متجر الكتب والمنتجات الرقمية على تيليجرام.\n"
            "اشترِ ما يلهمك، أو انشر إبداعك واربح بكل بيع.\n\n"
            "العملة الموحدة: <b>SKZ</b> ⚡",
        )
        await message.answer(f"{title}\n\n{body}", parse_mode="HTML", reply_markup=main_kb(lang))


# ── /lang — let the user pick Arabic / English ────────────────────────────
@router.message(Command("lang"))
async def cmd_lang(message: Message, state: FSMContext):
    await state.clear()
    lang = await get_user_lang(str(message.from_user.id), MOTHER_API_URL, BOOKS_BOT_API_KEY)
    await message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))


async def _get_lang(user_id) -> str:
    return await get_user_lang(str(user_id), MOTHER_API_URL, BOOKS_BOT_API_KEY)


@router.callback_query(F.data == "lang_menu")
async def cb_lang_menu(cb: CallbackQuery):
    lang = await get_user_lang(str(cb.from_user.id), MOTHER_API_URL, BOOKS_BOT_API_KEY)
    try:
        await cb.message.edit_text(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))
    except TelegramBadRequest:
        await cb.message.answer(t(lang, "lang_prompt"), reply_markup=lang_keyboard("lang"))
    await cb.answer()


@router.callback_query(F.data.startswith("lang:"))
async def cb_lang_set(cb: CallbackQuery):
    parts = (cb.data or "").split(":", 1)
    new_lang = parts[1] if len(parts) == 2 else ""
    if not new_lang or new_lang not in LANGS:
        await cb.answer("❌", show_alert=False)
        return
    tg_id = str(cb.from_user.id)
    ok = await set_user_lang(
        tg_id, new_lang,
        MOTHER_API_URL, BOOKS_BOT_API_KEY,
        first_name=cb.from_user.first_name or "User",
        username=cb.from_user.username,
    )
    if not ok:
        await cb.answer(t(new_lang, "lang_set_fail"), show_alert=True)
        return
    invalidate_lang_cache(tg_id)
    await cb.answer(t(new_lang, "lang_set_ok"), show_alert=False)
    try:
        await cb.message.edit_text(
            t(new_lang, "welcome") if new_lang == "en" else
            "❖ <b>SOUQRATES SOUQ</b>\n\nاختر إجراءً:",
            parse_mode="HTML",
            reply_markup=main_kb(new_lang),
        )
    except TelegramBadRequest:
        pass


@router.callback_query(F.data == "menu")
async def cb_menu(cb: CallbackQuery, state: FSMContext):
    await state.clear()
    lang = await _get_lang(cb.from_user.id)
    await cb.message.edit_text(t(lang, "menu_title"), parse_mode="HTML", reply_markup=main_kb(lang))
    await cb.answer()


# ── Slash-command shortcuts (mirrored in BotFather /setcommands) ────────────
@router.message(Command("help"))
async def cmd_help(message: Message, state: FSMContext):
    await state.clear()
    lang = await _get_lang(message.from_user.id)
    await message.answer(t(lang, "help_body"), parse_mode="HTML", reply_markup=main_kb(lang))


@router.message(Command("cancel"))
async def cmd_cancel(message: Message, state: FSMContext):
    """Cancel any active FSM operation (e.g. mid-publish flow) and return to main menu."""
    lang = await _get_lang(message.from_user.id)
    current_state = await state.get_state()
    if current_state is None:
        await message.answer(
            "لا توجد عملية جارية حالياً.\n<i>No active operation.</i>",
            parse_mode="HTML",
            reply_markup=main_kb(lang),
        )
        return
    await state.clear()
    await message.answer(
        "✅ تم إلغاء العملية.\n<i>Operation cancelled.</i>",
        parse_mode="HTML",
        reply_markup=main_kb(lang),
    )


@router.message(Command("browse"))
async def cmd_browse(message: Message, state: FSMContext):
    await state.clear()
    lang = await _get_lang(message.from_user.id)
    txt, kb = await _build_browse_view(lang)
    await message.answer(txt, parse_mode="HTML", reply_markup=kb)


@router.message(Command("library"))
async def cmd_library(message: Message, state: FSMContext):
    await state.clear()
    lang = await _get_lang(message.from_user.id)
    txt, kb = await _build_my_lib_view(str(message.from_user.id), lang)
    await message.answer(txt, parse_mode="HTML", reply_markup=kb, disable_web_page_preview=True)


@router.message(Command("wallet"))
async def cmd_wallet(message: Message, state: FSMContext):
    await state.clear()
    lang = await _get_lang(message.from_user.id)
    view = await _build_wallet_view(str(message.from_user.id), lang)
    if view is None:
        await message.answer(t(lang, "err_no_wallet"))
        return
    txt, kb = view
    await message.answer(txt, parse_mode="HTML", reply_markup=kb)


@router.message(Command("publish"))
async def cmd_publish(message: Message, state: FSMContext):
    lang = await _get_lang(message.from_user.id)
    await state.set_state(Publish.title)
    await message.answer(t(lang, "pub_ask_title"), parse_mode="HTML", reply_markup=back_kb("menu", lang))


# ── Shared view builders (reused by both commands and callbacks) ────────────
async def _build_wallet_view(telegram_id: str, lang: str = DEFAULT_LANG) -> tuple[str, InlineKeyboardMarkup] | None:
    data = await api.get_wallet(telegram_id)
    if not data:
        return None
    w = data["wallet"]
    skz = float(w.get("balanceSkz", "0"))
    usdt = float(w.get("balanceUsdt", "0"))
    txt = t(lang, "wallet_text", skz=f"{skz:,.2f}", usdt=f"{usdt:.4f}")
    return txt, back_kb("menu", lang)


async def _build_browse_view(lang: str = DEFAULT_LANG) -> tuple[str, InlineKeyboardMarkup]:
    cats = await api.list_categories()
    rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for c in cats:
        row.append(InlineKeyboardButton(text=f"{c['icon']} {c['nameAr']}", callback_data=f"cat:{c['id']}:0"))
        if len(row) == 2:
            rows.append(row); row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text=t(lang, "browse_bestsellers"), callback_data="cat:0:0")])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back"), callback_data="menu")])
    return t(lang, "browse_title"), InlineKeyboardMarkup(inline_keyboard=rows)


async def _build_my_lib_view(telegram_id: str, lang: str = DEFAULT_LANG) -> tuple[str, InlineKeyboardMarkup]:
    data = await api.my_library(telegram_id)
    purchases = data.get("purchases", [])
    published = data.get("published", [])
    lines = [t(lang, "lib_title")]
    if purchases:
        lines.append(t(lang, "lib_purchases_header"))
        for p in purchases[:10]:
            url = p.get("downloadUrl") or f"/api/internal/books/products/download/{p['downloadToken']}"
            lines.append(f"• <a href=\"{url}\">{p['title']}</a>")
        lines.append("")
    else:
        lines.append(t(lang, "lib_no_purchases"))
    if published:
        lines.append(t(lang, "lib_published_header"))
        for p in published[:10]:
            status_icon = {"approved": "✅", "pending": "⏳", "rejected": "❌", "disabled": "⏸️"}.get(p["status"], "•")
            lines.append(t(lang, "lib_published_line",
                           icon=status_icon, title=p["title"], sales=p["salesCount"]))
    return "\n".join(lines), back_kb("menu", lang)


# ── Wallet quick view ───────────────────────────────────────────────────────
@router.callback_query(F.data == "wallet")
async def cb_wallet(cb: CallbackQuery):
    lang = await _get_lang(cb.from_user.id)
    view = await _build_wallet_view(str(cb.from_user.id), lang)
    if view is None:
        await cb.answer(t(lang, "err_wallet_alert"), show_alert=True)
        return
    txt, kb = view
    await cb.message.edit_text(txt, parse_mode="HTML", reply_markup=kb)
    await cb.answer()


# ── Browse: categories → list → detail → buy ────────────────────────────────
@router.callback_query(F.data == "browse")
async def cb_browse(cb: CallbackQuery):
    lang = await _get_lang(cb.from_user.id)
    txt, kb = await _build_browse_view(lang)
    await cb.message.edit_text(txt, parse_mode="HTML", reply_markup=kb)
    await cb.answer()


PAGE_SIZE = 5


@router.callback_query(F.data.startswith("cat:"))
async def cb_cat(cb: CallbackQuery):
    lang = await _get_lang(cb.from_user.id)
    try:
        _, cid_s, page_s = cb.data.split(":")
        cid = int(cid_s) or None
        page = int(page_s)
    except (ValueError, IndexError):
        await cb.answer()
        return
    try:
        resp = await api.list_products(category_id=cid, limit=PAGE_SIZE, offset=page * PAGE_SIZE)
    except Exception:
        await cb.answer("⚠️ خطأ في الاتصال بالخادم، حاول مجدداً", show_alert=True)
        return
    rows = resp.get("data", [])
    total = resp.get("total", 0)

    if not rows:
        await _safe_edit(cb.message, t(lang, "browse_empty"), reply_markup=back_kb("browse", lang))
        await cb.answer(); return

    lines = [t(lang, "books_header", total=total)]
    btns: list[list[InlineKeyboardButton]] = []
    for p in rows:
        price = float(p["priceUsdt"])
        lines.append(f"• <b>{p['title']}</b> — <code>{price:.2f}</code> SKZ  ⭐ {float(p['rating']):.1f}")
        btns.append([InlineKeyboardButton(text=f"👁️ {p['title'][:30]}", callback_data=f"prd:{p['id']}")])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="◀️", callback_data=f"cat:{cid or 0}:{page - 1}"))
    if (page + 1) * PAGE_SIZE < total:
        nav.append(InlineKeyboardButton(text="▶️", callback_data=f"cat:{cid or 0}:{page + 1}"))
    if nav:
        btns.append(nav)
    btns.append([InlineKeyboardButton(text=t(lang, "browse_btn_back_cats"), callback_data="browse")])

    await _safe_edit(cb.message, "\n".join(lines), parse_mode="HTML",
                     reply_markup=InlineKeyboardMarkup(inline_keyboard=btns))
    await cb.answer()


@router.callback_query(F.data.startswith("prd:"))
async def cb_product(cb: CallbackQuery):
    lang = await _get_lang(cb.from_user.id)
    try:
        pid = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer()
        return
    try:
        p = await api.get_product(pid)
    except Exception:
        await cb.answer("⚠️ خطأ في الاتصال بالخادم، حاول مجدداً", show_alert=True)
        return
    if not p:
        await cb.answer(t(lang, "product_not_found"), show_alert=True); return

    price = float(p["priceUsdt"])
    txt = t(lang, "product_detail",
            title=p["title"], desc=p["description"] or "—",
            price=f"{price:.2f}", sales=p["salesCount"],
            rating=f"{float(p['rating']):.1f}", rcount=p["ratingCount"])
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "btn_buy", price=f"{price:.2f}"), callback_data=f"buy:{pid}")],
        [InlineKeyboardButton(text=t(lang, "btn_back_browse"), callback_data="browse")],
    ])
    await _safe_edit(cb.message, txt, parse_mode="HTML", reply_markup=kb)
    await cb.answer()


# Per (user_id, product_id) in-flight guard — prevents double-tap purchase
_buy_in_flight: set[tuple[int, int]] = set()

@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery):
    lang = await _get_lang(cb.from_user.id)
    try:
        pid = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer("⚠️ بيانات غير صحيحة", show_alert=True)
        return
    _bkey = (cb.from_user.id, pid)
    if _bkey in _buy_in_flight:
        await cb.answer("جاري المعالجة… يرجى الانتظار", show_alert=True)
        return
    _buy_in_flight.add(_bkey)
    try:
        r = await api.purchase(str(cb.from_user.id), pid)
    except Exception as e:
        _buy_in_flight.discard(_bkey)
        # Surface server reason if HTTPStatusError.
        msg = str(e)
        if hasattr(e, "response") and e.response is not None:  # type: ignore[attr-defined]
            try:
                msg = e.response.json().get("error", msg)  # type: ignore[attr-defined]
            except Exception:
                pass
        # Insufficient balance → guide user to top-up via mother bot.
        if "غير كافٍ" in msg or "insufficient" in msg.lower():
            mother = os.getenv("MOTHER_BOT_USERNAME", "souqrates_system_bot")
            topup_kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text=t(lang, "btn_topup_wallet"), **{"web_app": WebAppInfo(url=MOTHER_APP_URL)} if MOTHER_APP_URL else {"url": f"https://t.me/{mother}?start=deposit"})],
                [InlineKeyboardButton(text=t(lang, "btn_back_arrow"), callback_data="menu")],
            ])
            await cb.message.edit_text(
                t(lang, "buy_insufficient"),
                parse_mode="HTML",
                reply_markup=topup_kb,
            )
            await cb.answer()
            return
        await cb.answer(t(lang, "buy_err_alert", msg=msg[:180]), show_alert=True)
        return

    dl = await api.resolve_download(r["downloadToken"])
    file_url = dl["fileUrl"]
    title = dl.get("title", t(lang, "buy_default_title"))
    receipt = t(lang, "buy_receipt",
                title=title, paid=r["pricePaid"], balance=r["newBalance"])
    # Always show the receipt first so the user has a record even if delivery fails.
    await cb.message.edit_text(receipt, parse_mode="HTML", reply_markup=back_kb("menu", lang), disable_web_page_preview=True)

    # Deliver the file as an in-chat Telegram document so it lands in the chat
    # like any other attachment (no browser detour). Passing the URL as a string
    # lets Telegram fetch and forward the bytes (≤ 20 MB). If Telegram cannot
    # reach the URL (placeholder/private host/too large), fall back to a
    # tap-to-download link button so the user still has access.
    try:
        await cb.message.answer_document(
            document=file_url,
            caption=t(lang, "buy_doc_caption", title=title),
            parse_mode="HTML",
        )
    except (TelegramForbiddenError, TelegramBadRequest, Exception) as e:
        logger.warning(f"sendDocument failed for purchase {r.get('purchaseId')}: {e}")
        link_kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=t(lang, "btn_download_book"), url=file_url)],
            [InlineKeyboardButton(text=t(lang, "btn_back_arrow"), callback_data="menu")],
        ])
        try:
            await cb.message.answer(
                t(lang, "buy_doc_failed"),
                reply_markup=link_kb,
            )
        except (TelegramForbiddenError, TelegramBadRequest):
            pass
    _buy_in_flight.discard(_bkey)
    await cb.answer(t(lang, "buy_answer_ok"))


# ── My library ──────────────────────────────────────────────────────────────
@router.callback_query(F.data == "my_lib")
async def cb_my_lib(cb: CallbackQuery):
    lang = await _get_lang(cb.from_user.id)
    txt, kb = await _build_my_lib_view(str(cb.from_user.id), lang)
    await cb.message.edit_text(txt, parse_mode="HTML",
                                reply_markup=kb, disable_web_page_preview=True)
    await cb.answer()


# ── Publish FSM ─────────────────────────────────────────────────────────────
@router.callback_query(F.data == "pub_start")
async def cb_pub_start(cb: CallbackQuery, state: FSMContext):
    lang = await _get_lang(cb.from_user.id)
    await state.set_state(Publish.title)
    await cb.message.edit_text(t(lang, "pub_ask_title"), parse_mode="HTML", reply_markup=back_kb("menu", lang))
    await cb.answer()


@router.message(Publish.title)
async def pub_title(m: Message, state: FSMContext):
    lang = await _get_lang(m.from_user.id)
    await state.update_data(title=m.text.strip()[:200])
    await state.set_state(Publish.description)
    await m.answer(t(lang, "pub_ask_desc"), parse_mode="HTML")


@router.message(Publish.description)
async def pub_desc(m: Message, state: FSMContext):
    lang = await _get_lang(m.from_user.id)
    await state.update_data(description=m.text.strip()[:4000])
    cats = await api.list_categories()
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=f"{c['icon']} {c['nameAr']}",
                                                                       callback_data=f"pubcat:{c['id']}")]
                                                  for c in cats])
    await state.set_state(Publish.category)
    await m.answer(t(lang, "pub_ask_cat"), reply_markup=kb)


@router.callback_query(F.data.startswith("pubcat:"), Publish.category)
async def pub_cat(cb: CallbackQuery, state: FSMContext):
    lang = await _get_lang(cb.from_user.id)
    try:
        cid = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer("⚠️ بيانات غير صحيحة", show_alert=True)
        return
    await state.update_data(categoryId=cid)
    await state.set_state(Publish.price)
    await cb.message.edit_text(t(lang, "pub_ask_price"), parse_mode="HTML")
    await cb.answer()


@router.message(Publish.price)
async def pub_price(m: Message, state: FSMContext):
    lang = await _get_lang(m.from_user.id)
    try:
        price = float(m.text.strip())
        if price < 0:
            raise ValueError
    except Exception:
        await m.answer(t(lang, "pub_invalid_price"))
        return
    await state.update_data(price=price)
    await state.set_state(Publish.cover)
    await m.answer(
        t(lang, "pub_ask_cover", mb=COVER_MAX_BYTES // (1024*1024)),
        parse_mode="HTML",
    )


# ── Cover handlers ──────────────────────────────────────────────────────────
@router.message(Publish.cover, F.text.func(lambda t: bool(t) and t.strip() in ("تخطّى", "تخطى", "skip")))
async def pub_cover_skip(m: Message, state: FSMContext):
    await state.update_data(coverUrl=None)
    await _ask_for_file(m, state)


@router.message(Publish.cover, F.photo | F.document)
async def pub_cover_media(m: Message, state: FSMContext):
    # Idempotency lock: if a previous upload is still in flight, silently drop
    # the new one. Prevents a user who spams photos from triggering parallel
    # downloads + duplicate GCS uploads (orphan objects, confused state).
    lang = await _get_lang(m.from_user.id)
    d = await state.get_data()
    if d.get("_uploading"):
        await m.answer(t(lang, "pub_cover_busy"))
        return
    await state.update_data(_uploading=True)
    try:
        await _pub_cover_media_impl(m, state, lang)
    finally:
        await state.update_data(_uploading=False)


async def _pub_cover_media_impl(m: Message, state: FSMContext, lang: str):
    # Telegram sends either a compressed photo (m.photo[-1] = highest res) or a
    # raw document. Both routes resolve to (file_id, size, mime) here.
    if m.photo:
        photo = m.photo[-1]
        file_id = photo.file_id
        size = photo.file_size or 0
        mime = "image/jpeg"  # Telegram always re-encodes inline photos to JPEG
        file_name = None
    else:
        doc = m.document
        file_id = doc.file_id
        size = doc.file_size or 0
        file_name = doc.file_name
        mime = _guess_mime(file_name, doc.mime_type) or ""

    if mime not in COVER_MIME:
        await m.answer(t(lang, "pub_cover_bad_mime"), parse_mode="HTML")
        return
    if size <= 0 or size > COVER_MAX_BYTES:
        await m.answer(t(lang, "pub_cover_too_large", mb=COVER_MAX_BYTES // (1024*1024)))
        return

    status_msg = await m.answer(t(lang, "pub_cover_uploading"))
    try:
        upload = await api.request_upload_url(kind="cover", content_type=mime, size_bytes=size)
        data = await _download_from_telegram(m.bot, file_id)
        await _upload_to_signed_url(upload["uploadUrl"], mime, data)
        await state.update_data(coverUrl=upload["objectPath"])
        await status_msg.edit_text(t(lang, "pub_cover_uploaded"))
    except httpx.HTTPStatusError as e:
        msg = t(lang, "pub_cover_fail_default")
        try:
            msg = e.response.json().get("error", msg)
        except Exception:
            pass
        await status_msg.edit_text(f"❌ {msg}")
        return
    except Exception as e:
        logger.exception("cover upload failed")
        await status_msg.edit_text(t(lang, "pub_cover_fail", err=str(e)[:120]))
        return

    await _ask_for_file(m, state)


@router.message(Publish.cover)
async def pub_cover_fallback(m: Message, state: FSMContext):
    # Catches plain text / unsupported types in the cover step.
    lang = await _get_lang(m.from_user.id)
    await m.answer(t(lang, "pub_cover_fallback"), parse_mode="HTML")


async def _ask_for_file(m: Message, state: FSMContext) -> None:
    lang = await _get_lang(m.from_user.id)
    await state.set_state(Publish.file)
    await m.answer(
        t(lang, "pub_ask_file", mb=FILE_MAX_BYTES // (1024*1024)),
        parse_mode="HTML",
    )


# ── File handlers ───────────────────────────────────────────────────────────
@router.message(Publish.file, F.document)
async def pub_file_doc(m: Message, state: FSMContext):
    lang = await _get_lang(m.from_user.id)
    d0 = await state.get_data()
    if d0.get("_uploading"):
        await m.answer(t(lang, "pub_file_busy"))
        return
    await state.update_data(_uploading=True)
    try:
        await _pub_file_doc_impl(m, state, lang)
    finally:
        await state.update_data(_uploading=False)


async def _pub_file_doc_impl(m: Message, state: FSMContext, lang: str):
    doc = m.document
    file_id = doc.file_id
    size = doc.file_size or 0
    file_name = doc.file_name or "book"
    mime = _guess_mime(file_name, doc.mime_type) or ""

    if mime not in FILE_MIME:
        await m.answer(t(lang, "pub_file_bad_mime"), parse_mode="HTML")
        return
    if size <= 0 or size > FILE_MAX_BYTES:
        await m.answer(t(lang, "pub_file_too_large", mb=FILE_MAX_BYTES // (1024*1024)))
        return

    status_msg = await m.answer(t(lang, "pub_file_uploading"))
    try:
        upload = await api.request_upload_url(kind="file", content_type=mime, size_bytes=size)
        data = await _download_from_telegram(m.bot, file_id)
        await _upload_to_signed_url(upload["uploadUrl"], mime, data)
        await state.update_data(fileUrl=upload["objectPath"], fileSize=size, fileName=file_name)
        await status_msg.edit_text(t(lang, "pub_file_uploaded"))
    except httpx.HTTPStatusError as e:
        msg = t(lang, "pub_file_fail_default")
        try:
            msg = e.response.json().get("error", msg)
        except Exception:
            pass
        await status_msg.edit_text(f"❌ {msg}")
        return
    except Exception as e:
        logger.exception("file upload failed")
        await status_msg.edit_text(t(lang, "pub_file_fail", err=str(e)[:120]))
        return

    d = await state.get_data()
    summary = t(lang, "pub_summary",
                title=d["title"],
                price=f"{d['price']:.2f}",
                cat=d["categoryId"],
                cover=t(lang, "pub_cover_yes") if d.get("coverUrl") else t(lang, "pub_cover_no"),
                fname=file_name,
                kb=size // 1024,
                desc=d["description"][:120])
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(lang, "pub_btn_submit"), callback_data="pub_confirm")],
        [InlineKeyboardButton(text=t(lang, "pub_btn_cancel"), callback_data="menu")],
    ])
    await state.set_state(Publish.confirm)
    await m.answer(summary, parse_mode="HTML", reply_markup=kb)


@router.message(Publish.file)
async def pub_file_fallback(m: Message, state: FSMContext):
    lang = await _get_lang(m.from_user.id)
    await m.answer(t(lang, "pub_file_fallback"), parse_mode="HTML")


@router.callback_query(F.data == "pub_confirm", Publish.confirm)
async def pub_confirm(cb: CallbackQuery, state: FSMContext):
    lang = await _get_lang(cb.from_user.id)
    d = await state.get_data()
    try:
        row = await api.submit_product(
            telegram_id=str(cb.from_user.id),
            title=d["title"],
            description=d["description"],
            cover_url=d.get("coverUrl"),
            file_url=d["fileUrl"],
            price_usdt=d["price"],
            category_id=d.get("categoryId"),
        )
        await state.clear()
        await cb.message.edit_text(
            t(lang, "pub_submitted", id=row["id"]),
            reply_markup=back_kb("menu", lang),
        )
    except Exception as e:
        msg = str(e)
        if hasattr(e, "response") and e.response is not None:  # type: ignore[attr-defined]
            try:
                msg = e.response.json().get("error", msg)  # type: ignore[attr-defined]
            except Exception:
                pass
        await cb.answer(t(lang, "buy_err_alert", msg=msg[:180]), show_alert=True)
        return
    await cb.answer()


# ── Entrypoint ──────────────────────────────────────────────────────────────
async def main():
    if not BOT_TOKEN:
        logger.error("BOOKS_BOT_TOKEN is not set; idle.")
        # Keep process alive so workflows don't crash-loop in dev when the
        # operator hasn't seeded the token yet.
        while True:
            await asyncio.sleep(60)
    if not BOOKS_BOT_API_KEY:
        logger.warning("BOOKS_BOT_API_KEY missing — financial calls will 401.")

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    # Auto-upsert middleware: every message/callback ensures the user row
    # exists in the central wallet before handlers run. Without this,
    # entry via /publish, /browse, etc. (any path other than /start)
    # would 404 on the first financial call.
    class UpsertMiddleware(BaseMiddleware):
        async def __call__(self, handler, event, data):
            user = getattr(event, "from_user", None)
            if user is not None:
                try:
                    await api.upsert_user(user)
                except Exception as e:
                    logger.warning(f"upsert middleware failed for {user.id}: {e}")
            return await handler(event, data)

    mw = UpsertMiddleware()
    dp.message.middleware(mw)
    dp.callback_query.middleware(mw)
    dp.include_router(router)

    # Publish slash-command menu to Telegram so the menu button stays in sync
    # with the Command() handlers in this file. Non-fatal on failure.
    # Publish a default menu (no language_code) plus one per supported
    # language. Telegram serves each user the closest match to their
    # Telegram UI `language_code`, falling back to the default. Per-language
    # failures are non-fatal so one bad locale never blocks the others.
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
    except Exception as e:
        logger.warning(f"set_my_commands failed: {e}")

    # Wire the chat menu button to the books-bot-web mini-app.
    # Only set in production (USE_WEBHOOK=1). In dev / polling mode the Replit
    # instance would overwrite the production menu button set by Contabo with a
    # temporary replit.dev URL, breaking the button for all users globally.
    if WEB_APP_URL.startswith("https://") and os.getenv("USE_WEBHOOK"):
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="🛍 SOUQ",
                    web_app=WebAppInfo(url=WEB_APP_URL),
                ),
            )
            logger.info(f"menu button → web app: {WEB_APP_URL}")
        except Exception as e:
            logger.warning(f"set_chat_menu_button failed: {e}")
    else:
        logger.info("WEB_APP_URL not HTTPS or not in webhook mode; skipping chat menu button setup")

    # Global safety net: any unhandled exception inside any handler (malformed
    # callback data, network failure on an API call, int/float parse error,
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

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "books-bot")


if __name__ == "__main__":
    asyncio.run(main())
