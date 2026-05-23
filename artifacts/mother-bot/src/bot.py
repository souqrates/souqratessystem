import asyncio
import os
import logging
from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    PreCheckoutQuery,
)
from aiogram.filters import CommandStart, Command
from aiogram.fsm.storage.memory import MemoryStorage
import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN        = os.getenv("MOTHER_BOT_TOKEN", "")
MOTHER_API_URL   = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_API_KEY = os.getenv("MOTHER_BOT_API_KEY", "")
MINI_APP_URL     = os.getenv("MINI_APP_URL", "https://souqrates.com/")
GAMES_APP_URL    = os.getenv("GAMES_APP_URL", "https://souqrates.com/games-bot/")
ADMIN_IDS        = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()]

router = Router()


# ── API helpers ──────────────────────────────────────────────────────────────

async def api_upsert_user(user) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MOTHER_API_URL}/internal/users/upsert",
            json={
                "telegramId": str(user.id),
                "username": user.username,
                "firstName": user.first_name or "User",
                "lastName": user.last_name,
                "languageCode": user.language_code or "en",
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

def main_keyboard() -> InlineKeyboardMarkup:
    """Main menu — big open-app button on top, quick actions below."""
    return InlineKeyboardMarkup(inline_keyboard=[
        # ① Launch the full Mini App
        [
            InlineKeyboardButton(
                text="🚀 Open SKZ Platform",
                web_app=WebAppInfo(url=MINI_APP_URL),
            )
        ],
        # ② Launch Games
        [
            InlineKeyboardButton(
                text="🎮 Play Games",
                web_app=WebAppInfo(url=GAMES_APP_URL),
            )
        ],
        # ③ Quick text shortcuts
        [
            InlineKeyboardButton(text="💰 Balance",      callback_data="wallet"),
            InlineKeyboardButton(text="📊 Transactions", callback_data="transactions"),
        ],
        [
            InlineKeyboardButton(text="💸 Withdraw",     callback_data="withdraw"),
            InlineKeyboardButton(text="🤝 Referral",     callback_data="referral"),
        ],
        [
            InlineKeyboardButton(text="ℹ️ Help",         callback_data="help"),
        ],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="🚀 Open App",
                web_app=WebAppInfo(url=MINI_APP_URL),
            ),
            InlineKeyboardButton(text="🔙 Back", callback_data="menu"),
        ]
    ])


# ── Handlers ─────────────────────────────────────────────────────────────────

@router.message(CommandStart())
async def cmd_start(message: Message):
    try:
        data = await api_upsert_user(message.from_user)
        user   = data["user"]
        wallet = data.get("wallet")
    except Exception as e:
        logger.error(f"Error upserting user: {e}")
        user   = {"firstName": message.from_user.first_name}
        wallet = None

    skz_bal   = int(float(wallet["balanceSkz"]))   if wallet else 0
    usdt_bal  = float(wallet["balanceUsdt"])        if wallet else 0

    text = (
        f"👋 Welcome, <b>{user['firstName']}</b>!\n\n"
        f"🏦 <b>Your SKZ Wallet</b>\n"
        f"├ ⚡ SKZ: <code>{skz_bal:,}</code>\n"
        f"└ 💵 ≈ <code>${usdt_bal:.2f}</code> USDT\n\n"
        f"Tap <b>Open SKZ Platform</b> to access your full dashboard, "
        f"manage balances, play games, and more."
    )

    await message.answer(text, parse_mode="HTML", reply_markup=main_keyboard())


@router.callback_query(F.data == "menu")
async def cb_menu(callback: CallbackQuery):
    try:
        data = await api_get_wallet(str(callback.from_user.id))
    except Exception:
        data = None

    wallet    = (data or {}).get("wallet") if isinstance(data, dict) else None
    skz_bal   = int(float(wallet["balanceSkz"]))  if wallet else 0
    usdt_bal  = float(wallet["balanceUsdt"])       if wallet else 0

    text = (
        f"👋 Welcome back, <b>{callback.from_user.first_name}</b>!\n\n"
        f"🏦 <b>Your SKZ Wallet</b>\n"
        f"├ ⚡ SKZ: <code>{skz_bal:,}</code>\n"
        f"└ 💵 ≈ <code>${usdt_bal:.2f}</code> USDT\n\n"
        f"Tap <b>Open SKZ Platform</b> to access the full app."
    )

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=main_keyboard())
    await callback.answer()


@router.callback_query(F.data == "wallet")
async def cb_wallet(callback: CallbackQuery):
    try:
        data = await api_get_wallet(str(callback.from_user.id))
    except Exception:
        await callback.answer("❌ Error fetching data", show_alert=True)
        return

    if not data:
        await callback.answer("❌ Wallet not found", show_alert=True)
        return

    wallet = data["wallet"]
    skz   = int(float(wallet["balanceSkz"]))
    usdt  = float(wallet["balanceUsdt"])
    stars = int(float(wallet["balanceStars"]))
    ton   = float(wallet["balanceTon"])
    earned    = int(float(wallet["totalEarned"]))
    withdrawn = int(float(wallet["totalWithdrawn"]))

    text = (
        f"💰 <b>Your Wallet</b>\n\n"
        f"<b>Balances:</b>\n"
        f"├ ⚡ SKZ:   <code>{skz:,}</code>\n"
        f"├ 💵 USDT:  <code>{usdt:.4f}</code>\n"
        f"├ ⭐ Stars:  <code>{stars:,}</code>\n"
        f"└ 💎 TON:   <code>{ton:.4f}</code>\n\n"
        f"<b>Total Earned:</b>    <code>{earned:,}</code> SKZ\n"
        f"<b>Total Withdrawn:</b> <code>{withdrawn:,}</code> SKZ"
    )

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "transactions")
async def cb_transactions(callback: CallbackQuery):
    try:
        data = await api_get_wallet(str(callback.from_user.id))
        if not data:
            await callback.answer("❌ No data found", show_alert=True)
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
        await callback.answer("❌ Error fetching transactions", show_alert=True)
        return

    if not transactions:
        text = "📊 <b>Transaction History</b>\n\nNo transactions yet."
    else:
        lines = ["📊 <b>Last 10 Transactions:</b>\n"]
        for tx in transactions:
            icon   = "📥" if tx["type"] == "credit" else "📤"
            amount = float(tx["amount"])
            sign   = "+" if tx["type"] == "credit" else "-"
            lines.append(
                f"{icon} <code>{sign}{abs(amount):.0f}</code> {tx['currency'].upper()} "
                f"— {tx.get('description', '')[:28]}"
            )
        text = "\n".join(lines)

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "withdraw")
async def cb_withdraw(callback: CallbackQuery):
    text = (
        "💸 <b>Withdraw Earnings</b>\n\n"
        "Use the <b>Open App</b> button to withdraw directly from the platform.\n\n"
        "📌 <b>Minimums:</b>\n"
        "├ 💵 USDT: 5\n"
        "├ 💎 TON: 1\n\n"
        "⚡ Converted from your SKZ balance automatically."
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "referral")
async def cb_referral(callback: CallbackQuery):
    bot_info = await callback.bot.get_me()
    ref_link = f"https://t.me/{bot_info.username}?start=ref{callback.from_user.id}"

    text = (
        f"🤝 <b>Referral Program</b>\n\n"
        f"Invite friends and earn <b>up to 15%</b> of their SKZ earnings — for life!\n\n"
        f"🔗 <b>Your link:</b>\n"
        f"<code>{ref_link}</code>\n\n"
        f"Tiers: L1 → 10% · L2 → 3% · L3 → 2%"
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.callback_query(F.data == "help")
async def cb_help(callback: CallbackQuery):
    text = (
        "ℹ️ <b>About SKZ Platform</b>\n\n"
        "SKZ is your unified financial hub across 6 bots:\n\n"
        "🎮 <b>Games Bot</b> — skill games with prizes\n"
        "🎬 <b>Video Bot</b> — earn from watching\n"
        "🎤 <b>Voice Bot</b> — paid voice rooms\n"
        "🤖 <b>AI Bot</b> — text/image generation\n"
        "🛒 <b>Store Bot</b> — digital products\n"
        "🏆 <b>Contests Bot</b> — competitions & prizes\n\n"
        "All earnings across every bot flow into one SKZ wallet here."
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
    await callback.answer()


@router.message(Command("balance"))
async def cmd_balance(message: Message):
    try:
        data = await api_get_wallet(str(message.from_user.id))
        if not data:
            await message.answer("❌ No wallet found. Use /start first.")
            return
        w = data["wallet"]
        await message.answer(
            f"⚡ SKZ: {int(float(w['balanceSkz'])):,}\n"
            f"💵 USDT: {float(w['balanceUsdt']):.4f}\n"
            f"⭐ Stars: {int(float(w['balanceStars'])):,}\n"
            f"💎 TON: {float(w['balanceTon']):.4f}",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="🚀 Open Full App", web_app=WebAppInfo(url=MINI_APP_URL))
            ]])
        )
    except Exception:
        await message.answer("❌ Error fetching balance.")


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ No permission.")
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

    logger.info("Starting mother bot polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
