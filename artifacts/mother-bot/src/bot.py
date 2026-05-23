import asyncio
import os
import logging
from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    LabeledPrice,
    PreCheckoutQuery,
)
from aiogram.filters import CommandStart, Command
from aiogram.fsm.storage.memory import MemoryStorage
import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("MOTHER_BOT_TOKEN", "")
MOTHER_API_URL = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_API_KEY = os.getenv("MOTHER_BOT_API_KEY", "")
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()]

router = Router()


async def api_upsert_user(user) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MOTHER_API_URL}/internal/users/upsert",
            json={
                "telegramId": str(user.id),
                "username": user.username,
                "firstName": user.first_name or "User",
                "lastName": user.last_name,
                "languageCode": user.language_code or "ar",
                "isPremium": getattr(user, "is_premium", False),
            },
            headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()


async def api_get_wallet(telegram_id: str) -> dict:
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


def wallet_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="💰 رصيدي", callback_data="wallet"),
            InlineKeyboardButton(text="📊 معاملاتي", callback_data="transactions"),
        ],
        [
            InlineKeyboardButton(text="💸 سحب", callback_data="withdraw"),
            InlineKeyboardButton(text="🤝 إحالة", callback_data="referral"),
        ],
        [
            InlineKeyboardButton(text="ℹ️ مساعدة", callback_data="help"),
        ],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 رجوع", callback_data="menu")]
    ])


@router.message(CommandStart())
async def cmd_start(message: Message):
    try:
        data = await api_upsert_user(message.from_user)
        user = data["user"]
        wallet = data["wallet"]
    except Exception as e:
        logger.error(f"Error upserting user: {e}")
        user = {"firstName": message.from_user.first_name}
        wallet = None

    balance_usdt = float(wallet["balanceUsdt"]) if wallet else 0
    balance_stars = float(wallet["balanceStars"]) if wallet else 0

    text = (
        f"👋 مرحباً <b>{user['firstName']}</b>!\n\n"
        f"🏦 <b>محفظتك الرئيسية:</b>\n"
        f"├ 💵 USDT: <code>{balance_usdt:.4f}</code>\n"
        f"├ ⭐ Stars: <code>{int(balance_stars)}</code>\n\n"
        f"هذا البوت الأم يربط جميع البوتات الأخرى.\n"
        f"يمكنك إدارة أموالك وسحب أرباحك من هنا."
    )

    await message.answer(text, parse_mode="HTML", reply_markup=wallet_keyboard())


@router.callback_query(F.data == "menu")
async def cb_menu(callback: CallbackQuery):
    try:
        data = await api_get_wallet(str(callback.from_user.id))
    except Exception:
        data = None

    wallet = data["wallet"] if data else None
    user_name = callback.from_user.first_name

    balance_usdt = float(wallet["balanceUsdt"]) if wallet else 0
    balance_stars = float(wallet["balanceStars"]) if wallet else 0

    text = (
        f"👋 مرحباً <b>{user_name}</b>!\n\n"
        f"🏦 <b>محفظتك الرئيسية:</b>\n"
        f"├ 💵 USDT: <code>{balance_usdt:.4f}</code>\n"
        f"├ ⭐ Stars: <code>{int(balance_stars)}</code>\n\n"
        f"هذا البوت الأم يربط جميع البوتات الأخرى.\n"
        f"يمكنك إدارة أموالك وسحب أرباحك من هنا."
    )

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=wallet_keyboard())
    await callback.answer()


@router.callback_query(F.data == "wallet")
async def cb_wallet(callback: CallbackQuery):
    try:
        data = await api_get_wallet(str(callback.from_user.id))
    except Exception as e:
        await callback.answer("❌ خطأ في جلب البيانات", show_alert=True)
        return

    if not data:
        await callback.answer("❌ لم يتم العثور على محفظة", show_alert=True)
        return

    wallet = data["wallet"]
    balance_usdt = float(wallet["balanceUsdt"])
    balance_stars = float(wallet["balanceStars"])
    balance_ton = float(wallet["balanceTon"])
    total_earned = float(wallet["totalEarned"])
    total_withdrawn = float(wallet["totalWithdrawn"])

    text = (
        f"💰 <b>محفظتك الرئيسية</b>\n\n"
        f"<b>الأرصدة الحالية:</b>\n"
        f"├ 💵 USDT: <code>{balance_usdt:.6f}</code>\n"
        f"├ ⭐ Stars: <code>{int(balance_stars)}</code>\n"
        f"└ 💎 TON: <code>{balance_ton:.9f}</code>\n\n"
        f"<b>إجمالي الأرباح:</b> <code>{total_earned:.6f}</code> USDT\n"
        f"<b>إجمالي المسحوبات:</b> <code>{total_withdrawn:.6f}</code> USDT"
    )

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "transactions")
async def cb_transactions(callback: CallbackQuery):
    try:
        data = await api_get_wallet(str(callback.from_user.id))
        if not data:
            await callback.answer("❌ لا توجد بيانات", show_alert=True)
            return

        user_id = data["user"]["id"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MOTHER_API_URL}/transactions",
                params={"userId": user_id, "limit": 10},
                timeout=10.0,
            )
            transactions = resp.json()["data"]
    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        await callback.answer("❌ خطأ في جلب المعاملات", show_alert=True)
        return

    if not transactions:
        text = "📊 <b>سجل المعاملات</b>\n\nلا توجد معاملات بعد."
    else:
        lines = ["📊 <b>آخر 10 معاملات:</b>\n"]
        for tx in transactions:
            icon = "📥" if tx["type"] == "credit" else "📤"
            amount = float(tx["amount"])
            sign = "+" if amount > 0 else ""
            lines.append(
                f"{icon} <code>{sign}{amount:.4f}</code> {tx['currency'].upper()} "
                f"— {tx.get('description', '')[:30]}"
            )
        text = "\n".join(lines)

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "withdraw")
async def cb_withdraw(callback: CallbackQuery):
    text = (
        "💸 <b>سحب الأرباح</b>\n\n"
        "لسحب أرباحك، يرجى التواصل مع الإدارة.\n\n"
        "📌 <b>الحد الأدنى للسحب:</b>\n"
        "├ 💵 USDT: 10\n"
        "├ ⭐ Stars: 1000\n"
        "└ 💎 TON: 5\n\n"
        "⚠️ رسوم السحب: 1%\n\n"
        "لإرسال طلب سحب يدوي، تواصل مع @admin"
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "referral")
async def cb_referral(callback: CallbackQuery):
    user_id = callback.from_user.id
    bot_info = await callback.bot.get_me()
    referral_link = f"https://t.me/{bot_info.username}?start=ref{user_id}"

    text = (
        f"🤝 <b>نظام الإحالة</b>\n\n"
        f"شارك رابطك الخاص واكسب مكافآت!\n\n"
        f"🔗 <b>رابطك:</b>\n"
        f"<code>{referral_link}</code>\n\n"
        f"💡 كل من ينضم عبر رابطك تحصل على جزء من أرباحه!"
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "help")
async def cb_help(callback: CallbackQuery):
    text = (
        "ℹ️ <b>مساعدة</b>\n\n"
        "البوت الأم هو المركز المالي لجميع البوتات.\n\n"
        "<b>البوتات المتصلة:</b>\n"
        "🎮 بوت الألعاب\n"
        "🎬 بوت الفيديو\n"
        "🎤 بوت الغرف الصوتية\n"
        "🤖 بوت الذكاء الاصطناعي\n"
        "🛒 المتجر الرقمي\n"
        "🏆 بوت المسابقات\n\n"
        "جميع أرباحك من هذه البوتات تُجمع في محفظتك الرئيسية هنا."
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.message(Command("balance"))
async def cmd_balance(message: Message):
    try:
        data = await api_get_wallet(str(message.from_user.id))
        if not data:
            await message.answer("❌ لا توجد محفظة لهذا المستخدم")
            return
        wallet = data["wallet"]
        await message.answer(
            f"💰 رصيدك:\n"
            f"USDT: {float(wallet['balanceUsdt']):.6f}\n"
            f"Stars: {int(float(wallet['balanceStars']))}\n"
            f"TON: {float(wallet['balanceTon']):.9f}"
        )
    except Exception as e:
        await message.answer("❌ خطأ في جلب الرصيد")


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ ليس لديك صلاحية")
        return

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{MOTHER_API_URL}/stats/overview", timeout=10.0)
        stats = resp.json()

    text = (
        f"📊 <b>إحصاءات المنصة</b>\n\n"
        f"👥 إجمالي المستخدمين: <code>{stats['totalUsers']}</code>\n"
        f"💵 إجمالي الحجم: <code>{float(stats['totalVolumeUsdt']):.2f}</code> USDT\n"
        f"💰 إجمالي العمولات: <code>{float(stats['totalCommissionsUsdt']):.2f}</code> USDT\n"
        f"⏳ طلبات السحب: <code>{stats['pendingWithdrawals']}</code>\n"
        f"🤖 البوتات النشطة: <code>{stats['activeBots']}</code>\n"
        f"📈 معاملات اليوم: <code>{stats['todayTransactions']}</code>\n"
        f"💹 حجم اليوم: <code>{float(stats['todayVolumeUsdt']):.2f}</code> USDT"
    )
    await message.answer(text, parse_mode="HTML")


async def main():
    if not BOT_TOKEN:
        logger.error("MOTHER_BOT_TOKEN is not set!")
        return

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    logger.info("Starting mother bot...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
