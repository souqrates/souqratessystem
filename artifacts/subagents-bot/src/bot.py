"""
SOUQRATES SUB-AGENTS — Partner/wholesale bot (Python aiogram).

Public flow:
  /start → check status via /api/subagents/me
    - not_applied → CTA opening the Mini App at /subagents/apply
    - pending     → "Your application is under review"
    - rejected    → show reason + button to re-apply
    - approved    → CTA opening the dashboard at /subagents/dashboard
    - suspended   → "Your account is suspended — contact admin"

All Mini App routes live INSIDE the mother-bot's bot-demo Mini App so the
agent gets the unified wallet/i18n/agreement chrome for free.
"""
import asyncio
import logging
import os

from sentry_init import init_sentry
init_sentry("subagents-bot")

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)

from client import MotherBotClient

BOT_TOKEN = os.getenv("SUBAGENTS_BOT_TOKEN", "")
API_KEY   = os.getenv("SUBAGENTS_BOT_API_KEY", "")
API_URL   = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_USERNAME = os.getenv("MOTHER_BOT_USERNAME", "")

def _resolve_base() -> str:
    explicit = (os.getenv("PUBLIC_BASE_URL") or "").strip()
    if explicit:
        return explicit.rstrip("/")
    rds = (os.getenv("REPLIT_DOMAINS") or "").strip()
    if rds:
        first = rds.split(",")[0].strip()
        if first:
            return f"https://{first}".rstrip("/")
    dev = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
    if dev:
        return f"https://{dev}".rstrip("/")
    return "https://souqrates.com"

BASE = _resolve_base()
# subagents-bot-web is the dedicated Mini App artifact, mounted at /subagents-bot-web/.
APPLY_URL     = f"{BASE}/subagents-bot-web/apply"
DASHBOARD_URL = f"{BASE}/subagents-bot-web/dashboard"
STATUS_URL    = f"{BASE}/subagents-bot-web/pending"
LANDING_URL   = f"{BASE}/subagents-bot-web/"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("subagents-bot")

api = MotherBotClient(api_key=API_KEY, base_url=API_URL)
router = Router()

COMMANDS: list[BotCommand] = [
    BotCommand(command="start",     description="ابدأ + لوحة الشريك"),
    BotCommand(command="status",    description="حالة طلبي"),
    BotCommand(command="dashboard", description="لوحة التحكم (للوكلاء المعتمدين)"),
    BotCommand(command="help",      description="كيف يعمل البرنامج؟"),
]


async def fetch_status(telegram_id: int) -> dict:
    """Read application/agent status from the server (bot API key auth)."""
    try:
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{API_URL}/internal/subagent-status",
                params={"telegramId": str(telegram_id)},
                headers={"X-Bot-Api-Key": API_KEY},
                timeout=5.0,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning(f"subagent-status fetch failed: {e}")
    return {"status": "not_applied"}


def kb_apply() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="♛ قدّم طلبك الآن", web_app=WebAppInfo(url=APPLY_URL))],
        [InlineKeyboardButton(text="ℹ️ كيف يعمل البرنامج؟", callback_data="help")],
    ])


def kb_dashboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="♛ افتح لوحة الشريك", web_app=WebAppInfo(url=DASHBOARD_URL))],
        [InlineKeyboardButton(text="💰 محفظتي", url=f"https://t.me/{MOTHER_BOT_USERNAME}" if MOTHER_BOT_USERNAME else BASE)],
    ])


def kb_pending() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 تفقّد الحالة", web_app=WebAppInfo(url=STATUS_URL))],
    ])


def kb_reapply() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ إعادة التقديم", web_app=WebAppInfo(url=APPLY_URL))],
    ])


WELCOME = (
    "♛ <b>SOUQRATES SUB-AGENTS</b>\n"
    "<i>برنامج الشركاء والموزّعين</i>\n\n"
    "كن وكيلاً معتمداً في منصة SOUQRATES:\n"
    "• اشترِ SKZ بالجملة بأسعار خصومات\n"
    "• بِع لعملائك مباشرة من لوحتك\n"
    "• ارتقِ في 7 مراتب — كلّما زادت مبيعاتك زاد خصمك\n\n"
    "للبدء، قدّم طلب اعتماد مع وثيقة هوية."
)


@router.message(CommandStart())
async def cmd_start(message: Message):
    if message.from_user is None:
        return
    try:
        await api.upsert_user(
            telegram_id=str(message.from_user.id),
            first_name=message.from_user.first_name or "User",
            username=message.from_user.username,
            last_name=message.from_user.last_name,
        )
    except Exception as e:
        logger.warning(f"upsert_user failed: {e}")

    data = await fetch_status(message.from_user.id)
    status = data.get("status", "not_applied")

    if status == "approved":
        tier = data.get("tier") or {}
        tier_name = tier.get("name") or "Bronze"
        sales = data.get("agent", {}).get("totalSalesSkz", "0")
        customers = data.get("agent", {}).get("totalCustomers", 0)
        body = (
            f"♛ <b>مرحباً أيها الشريك المعتمد!</b>\n\n"
            f"المرتبة الحالية: <b>{tier_name}</b>\n"
            f"إجمالي المبيعات: <b>{sales}</b> SKZ\n"
            f"عدد العملاء: <b>{customers}</b>\n\n"
            f"افتح لوحتك لإدارة المبيعات."
        )
        await message.answer(body, reply_markup=kb_dashboard(), disable_web_page_preview=True)
    elif status == "pending":
        await message.answer(
            "⏳ <b>طلبك قيد المراجعة</b>\n\nسيتم إعلامك فور الموافقة من فريقنا.",
            reply_markup=kb_pending(), disable_web_page_preview=True,
        )
    elif status == "rejected":
        reason = (data.get("agent") or {}).get("rejectedReason") or "غير محدد"
        await message.answer(
            f"❌ <b>لم يتم قبول طلبك</b>\n\nالسبب: <i>{reason}</i>\n\nيمكنك تحديث بياناتك وإعادة التقديم.",
            reply_markup=kb_reapply(), disable_web_page_preview=True,
        )
    elif status == "suspended":
        await message.answer(
            "🚫 <b>حسابك معلّق حالياً</b>\n\nيرجى التواصل مع فريق الدعم لمزيد من التفاصيل.",
        )
    else:
        await message.answer(WELCOME, reply_markup=kb_apply(), disable_web_page_preview=True)


@router.message(Command("status"))
async def cmd_status(message: Message):
    if message.from_user is None:
        return
    await cmd_start(message)


@router.message(Command("dashboard"))
async def cmd_dashboard(message: Message):
    if message.from_user is None:
        return
    data = await fetch_status(message.from_user.id)
    if data.get("status") == "approved":
        await message.answer("افتح لوحة الشريك:", reply_markup=kb_dashboard())
    else:
        await message.answer(
            "اللوحة متاحة بعد الموافقة على طلبك. قدّم طلب اعتماد للبدء.",
            reply_markup=kb_apply(),
        )


@router.message(Command("help"))
@router.callback_query(F.data == "help")
async def cmd_help(ev):
    text = (
        "ℹ️ <b>كيف يعمل برنامج SOUQRATES SUB-AGENTS؟</b>\n\n"
        "1. تقدّم طلب اعتماد مع وثيقة هوية وبياناتك.\n"
        "2. فريقنا يراجع طلبك خلال 24-48 ساعة.\n"
        "3. بعد الموافقة، تحصل على لوحة شريك معتمد.\n"
        "4. تبيع SKZ لعملائك مباشرة من اللوحة.\n"
        "5. كلما زادت مبيعاتك ارتقيت في 7 مراتب من Bronze حتى Sovereign.\n"
        "6. كل مرتبة تمنحك خصماً أعلى عند شراء SKZ من المنصة.\n\n"
        "✦ جميع المعاملات تتم عبر المحفظة الموحّدة للمنصة."
    )
    if isinstance(ev, CallbackQuery):
        if ev.message:
            await ev.message.answer(text, disable_web_page_preview=True)
        await ev.answer()
    else:
        await ev.answer(text, disable_web_page_preview=True)


async def main() -> None:
    if not BOT_TOKEN:
        logger.error("SUBAGENTS_BOT_TOKEN not set — aborting")
        return
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    try:
        await bot.set_my_commands(COMMANDS)
    except Exception as e:
        logger.warning(f"set_my_commands failed: {e}")
    # Only set in production (USE_WEBHOOK=1). Polling / dev mode must NOT touch
    # the global menu button — it would overwrite Contabo's production URL.
    if os.getenv("USE_WEBHOOK"):
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(text="♛ Sub-Agents", web_app=WebAppInfo(url=LANDING_URL)),
            )
        except Exception as e:
            logger.warning(f"set_chat_menu_button failed: {e}")

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "subagents-bot")


if __name__ == "__main__":
    asyncio.run(main())
