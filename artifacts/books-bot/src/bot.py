"""
souqrates books — child Telegram bot (aiogram 3).

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

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from dotenv import load_dotenv

from client import BooksBotClient

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("books-bot")

BOT_TOKEN = os.getenv("BOOKS_BOT_TOKEN", "")
MOTHER_API_URL = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
BOOKS_BOT_API_KEY = os.getenv("BOOKS_BOT_API_KEY", "")
WEB_URL = os.getenv("BOOKS_WEB_URL", "https://souqrates.com/books-bot/")

api = BooksBotClient(api_key=BOOKS_BOT_API_KEY, base_url=MOTHER_API_URL)
texts = api.texts("books-bot", ttl_seconds=60)
router = Router()


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
def main_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📚 تصفح الكتب", callback_data="browse")],
        [InlineKeyboardButton(text="📤 نشر كتاب", callback_data="pub_start"),
         InlineKeyboardButton(text="📂 مكتبتي", callback_data="my_lib")],
        [InlineKeyboardButton(text="💰 رصيدي", callback_data="wallet"),
         InlineKeyboardButton(text="🌐 المتجر", url=WEB_URL)],
    ])


def back_kb(cb: str = "menu") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 رجوع", callback_data=cb)]])


# ── /start ──────────────────────────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert failed: {e}")

    title = await texts.get("welcome_title", "📚 أهلًا بك في souqrates books")
    body = await texts.get(
        "welcome_body",
        "متجر الكتب والمنتجات الرقمية على تيليجرام.\n"
        "اشترِ ما يلهمك، أو انشر إبداعك واربح بكل بيع.\n\n"
        "العملة الموحدة: <b>SKZ</b> ⚡",
    )
    await message.answer(f"{title}\n\n{body}", parse_mode="HTML", reply_markup=main_kb())


@router.callback_query(F.data == "menu")
async def cb_menu(cb: CallbackQuery, state: FSMContext):
    await state.clear()
    await cb.message.edit_text("📚 <b>souqrates books</b>\n\nاختر إجراءً:", parse_mode="HTML", reply_markup=main_kb())
    await cb.answer()


# ── Wallet quick view ───────────────────────────────────────────────────────
@router.callback_query(F.data == "wallet")
async def cb_wallet(cb: CallbackQuery):
    data = await api.get_wallet(str(cb.from_user.id))
    if not data:
        await cb.answer("❌ Wallet not found", show_alert=True)
        return
    w = data["wallet"]
    skz = int(float(w.get("balanceSkz", "0")))
    txt = (
        f"💰 <b>رصيدك</b>\n\n"
        f"⚡ SKZ: <code>{skz:,}</code>\n"
        f"💵 USDT (تقديري): <code>{float(w.get('balanceUsdt','0')):.4f}</code>"
    )
    await cb.message.edit_text(txt, parse_mode="HTML", reply_markup=back_kb())
    await cb.answer()


# ── Browse: categories → list → detail → buy ────────────────────────────────
@router.callback_query(F.data == "browse")
async def cb_browse(cb: CallbackQuery):
    cats = await api.list_categories()
    rows = []
    row: list[InlineKeyboardButton] = []
    for c in cats:
        row.append(InlineKeyboardButton(text=f"{c['icon']} {c['nameAr']}", callback_data=f"cat:{c['id']}:0"))
        if len(row) == 2:
            rows.append(row); row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text="🔥 الأكثر مبيعًا", callback_data="cat:0:0")])
    rows.append([InlineKeyboardButton(text="🔙 رجوع", callback_data="menu")])
    await cb.message.edit_text("📚 <b>اختر تصنيفًا</b>", parse_mode="HTML",
                                reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    await cb.answer()


PAGE_SIZE = 5


@router.callback_query(F.data.startswith("cat:"))
async def cb_cat(cb: CallbackQuery):
    _, cid_s, page_s = cb.data.split(":")
    cid = int(cid_s) or None
    page = int(page_s)
    resp = await api.list_products(category_id=cid, limit=PAGE_SIZE, offset=page * PAGE_SIZE)
    rows = resp.get("data", [])
    total = resp.get("total", 0)

    if not rows:
        await cb.message.edit_text("📭 لا توجد كتب في هذا التصنيف بعد.", reply_markup=back_kb("browse"))
        await cb.answer(); return

    lines = [f"📚 <b>الكتب</b> ({total})\n"]
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
    btns.append([InlineKeyboardButton(text="🔙 التصنيفات", callback_data="browse")])

    await cb.message.edit_text("\n".join(lines), parse_mode="HTML",
                                reply_markup=InlineKeyboardMarkup(inline_keyboard=btns))
    await cb.answer()


@router.callback_query(F.data.startswith("prd:"))
async def cb_product(cb: CallbackQuery):
    pid = int(cb.data.split(":")[1])
    p = await api.get_product(pid)
    if not p:
        await cb.answer("Product not found", show_alert=True); return

    price = float(p["priceUsdt"])
    txt = (
        f"📖 <b>{p['title']}</b>\n\n"
        f"{p['description'] or '—'}\n\n"
        f"💰 السعر: <code>{price:.2f}</code> SKZ\n"
        f"🛒 المبيعات: {p['salesCount']}  ⭐ {float(p['rating']):.1f} ({p['ratingCount']})"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"🛒 شراء بـ {price:.2f} SKZ", callback_data=f"buy:{pid}")],
        [InlineKeyboardButton(text="🔙 رجوع", callback_data="browse")],
    ])
    await cb.message.edit_text(txt, parse_mode="HTML", reply_markup=kb)
    await cb.answer()


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery):
    pid = int(cb.data.split(":")[1])
    try:
        r = await api.purchase(str(cb.from_user.id), pid)
    except Exception as e:
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
                [InlineKeyboardButton(text="💳 شحن المحفظة (Stars / TON)", url=f"https://t.me/{mother}?start=deposit")],
                [InlineKeyboardButton(text="⬅️ رجوع", callback_data="home")],
            ])
            await cb.message.edit_text(
                "❌ <b>رصيد SKZ غير كافٍ</b>\n\n"
                "اشحن محفظتك من البوت الأم — يدعم Telegram Stars و USDT/TON.\n"
                "بعد الشحن ارجع وأكمل الشراء.",
                parse_mode="HTML",
                reply_markup=topup_kb,
            )
            await cb.answer()
            return
        await cb.answer(f"❌ {msg[:180]}", show_alert=True)
        return

    dl = await api.resolve_download(r["downloadToken"])
    txt = (
        f"✅ <b>تم الشراء بنجاح</b>\n\n"
        f"💰 المدفوع: <code>{r['pricePaid']}</code> SKZ\n"
        f"💵 الرصيد الجديد: <code>{r['newBalance']}</code> SKZ\n\n"
        f"📥 <a href=\"{dl['fileUrl']}\">اضغط للتنزيل</a>\n"
        f"⏱ الرابط صالح لمدة 7 أيام."
    )
    await cb.message.edit_text(txt, parse_mode="HTML", reply_markup=back_kb(), disable_web_page_preview=True)
    await cb.answer("تم الشراء ✅")


# ── My library ──────────────────────────────────────────────────────────────
@router.callback_query(F.data == "my_lib")
async def cb_my_lib(cb: CallbackQuery):
    data = await api.my_library(str(cb.from_user.id))
    purchases = data.get("purchases", [])
    published = data.get("published", [])

    lines = ["📂 <b>مكتبتي</b>\n"]
    if purchases:
        lines.append("🛒 <b>مشترياتي:</b>")
        for p in purchases[:10]:
            url = p.get("downloadUrl") or f"/api/internal/books/products/download/{p['downloadToken']}"
            lines.append(f"• <a href=\"{url}\">{p['title']}</a>")
        lines.append("")
    else:
        lines.append("لم تشترِ أي كتاب بعد.\n")

    if published:
        lines.append("📤 <b>إصداراتي:</b>")
        for p in published[:10]:
            status_icon = {"approved": "✅", "pending": "⏳", "rejected": "❌", "disabled": "⏸️"}.get(p["status"], "•")
            lines.append(f"{status_icon} <b>{p['title']}</b> — مبيعات: {p['salesCount']}")
    await cb.message.edit_text("\n".join(lines), parse_mode="HTML",
                                reply_markup=back_kb(), disable_web_page_preview=True)
    await cb.answer()


# ── Publish FSM ─────────────────────────────────────────────────────────────
@router.callback_query(F.data == "pub_start")
async def cb_pub_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Publish.title)
    await cb.message.edit_text("📝 أرسل <b>عنوان</b> الكتاب:", parse_mode="HTML", reply_markup=back_kb())
    await cb.answer()


@router.message(Publish.title)
async def pub_title(m: Message, state: FSMContext):
    await state.update_data(title=m.text.strip()[:200])
    await state.set_state(Publish.description)
    await m.answer("📄 أرسل <b>وصف</b> الكتاب:", parse_mode="HTML")


@router.message(Publish.description)
async def pub_desc(m: Message, state: FSMContext):
    await state.update_data(description=m.text.strip()[:4000])
    cats = await api.list_categories()
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=f"{c['icon']} {c['nameAr']}",
                                                                       callback_data=f"pubcat:{c['id']}")]
                                                  for c in cats])
    await state.set_state(Publish.category)
    await m.answer("🏷️ اختر تصنيفًا:", reply_markup=kb)


@router.callback_query(F.data.startswith("pubcat:"), Publish.category)
async def pub_cat(cb: CallbackQuery, state: FSMContext):
    cid = int(cb.data.split(":")[1])
    await state.update_data(categoryId=cid)
    await state.set_state(Publish.price)
    await cb.message.edit_text("💰 أرسل السعر بـ SKZ (رقم فقط، مثال: <code>50</code>):", parse_mode="HTML")
    await cb.answer()


@router.message(Publish.price)
async def pub_price(m: Message, state: FSMContext):
    try:
        price = float(m.text.strip())
        if price < 0:
            raise ValueError
    except Exception:
        await m.answer("❌ سعر غير صالح. أرسل رقمًا فقط.")
        return
    await state.update_data(price=price)
    await state.set_state(Publish.cover)
    await m.answer("🖼️ أرسل رابط <b>صورة الغلاف</b> (أو اكتب <code>تخطّى</code>):", parse_mode="HTML")


@router.message(Publish.cover)
async def pub_cover(m: Message, state: FSMContext):
    cover = None if m.text.strip() in ("تخطّى", "تخطى", "skip") else m.text.strip()
    await state.update_data(coverUrl=cover)
    await state.set_state(Publish.file)
    await m.answer("📎 أرسل رابط <b>ملف الكتاب</b> (PDF/EPUB/MP3...):", parse_mode="HTML")


@router.message(Publish.file)
async def pub_file(m: Message, state: FSMContext):
    file_url = m.text.strip()
    if not file_url.startswith(("http://", "https://")):
        await m.answer("❌ يجب أن يكون رابطًا يبدأ بـ http(s)://")
        return
    await state.update_data(fileUrl=file_url)
    d = await state.get_data()
    summary = (
        f"📤 <b>تأكيد النشر</b>\n\n"
        f"📖 العنوان: <b>{d['title']}</b>\n"
        f"💰 السعر: <code>{d['price']:.2f}</code> SKZ\n"
        f"🏷️ التصنيف: #{d['categoryId']}\n"
        f"📄 الوصف: {d['description'][:120]}…\n\n"
        f"بعد الإرسال سيخضع الكتاب لمراجعة إدارية قبل النشر."
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ إرسال للمراجعة", callback_data="pub_confirm")],
        [InlineKeyboardButton(text="❌ إلغاء", callback_data="menu")],
    ])
    await state.set_state(Publish.confirm)
    await m.answer(summary, parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data == "pub_confirm", Publish.confirm)
async def pub_confirm(cb: CallbackQuery, state: FSMContext):
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
            f"✅ تم استلام الكتاب بنجاح (#{row['id']}). سنراجعه قريبًا.",
            reply_markup=back_kb(),
        )
    except Exception as e:
        msg = str(e)
        if hasattr(e, "response") and e.response is not None:  # type: ignore[attr-defined]
            try:
                msg = e.response.json().get("error", msg)  # type: ignore[attr-defined]
            except Exception:
                pass
        await cb.answer(f"❌ {msg[:180]}", show_alert=True)
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
    dp.include_router(router)
    logger.info("books-bot polling…")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
