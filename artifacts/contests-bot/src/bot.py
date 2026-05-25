"""
SOUQRATES STAGE — Contests bot (Python aiogram).

User flow:
- /start  → welcome + active contest
- 🏆     → live leaderboard
- 🗳     → vote (free or paid)
- 🎟     → packs store (buy with SKZ)
- 💼     → my vote balance + grants + bonus downloads
- 💰     → SKZ wallet balance (delegates top-up to mother-bot)

All financial operations go through the API server. This bot stores nothing
locally; it is a thin presentation layer over the central hub.
"""
import asyncio
import logging
import os
from typing import Optional

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject, CommandStart
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

from client import ContestsBotClient

# ── Configuration ──────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("CONTESTS_BOT_TOKEN")
API_KEY = os.getenv("CONTESTS_BOT_API_KEY", "")
API_URL = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_USERNAME = os.getenv("MOTHER_BOT_USERNAME", "")  # for top-up link
# Public URL of the contests-bot-web mini-app (used for the chat menu button).
# Falls back to the Replit dev domain when REPLIT_DOMAINS is present.
_REPLIT_DOMAIN = (os.getenv("REPLIT_DOMAINS") or "").split(",")[0].strip()
WEB_APP_URL = os.getenv(
    "CONTESTS_WEB_APP_URL",
    f"https://{_REPLIT_DOMAIN}/contests-bot-web/" if _REPLIT_DOMAIN else "",
)

# ── Slash-command menu (single source of truth for /setcommands) ───────────
COMMANDS: list[BotCommand] = [
    BotCommand(command="start",  description="بدء استخدام البوت وفتح القائمة الرئيسية"),
    BotCommand(command="vote",   description="🗳 صَوِّت في المسابقة النشطة"),
    BotCommand(command="board",  description="🏆 لوحة المتسابقين المباشرة"),
    BotCommand(command="packs",  description="🎟 باقات التصويت المدفوعة"),
    BotCommand(command="mybal",  description="💼 رصيد أصواتي ومكافآتي"),
    BotCommand(command="wallet", description="💰 محفظتي بـ SKZ"),
    BotCommand(command="help",   description="عرض المساعدة وقواعد التصويت"),
]

COMMANDS_BY_LANG: dict[str, list[BotCommand]] = {
    "ar": COMMANDS,
    "en": [
        BotCommand(command="start",  description="Start the bot and open the main menu"),
        BotCommand(command="vote",   description="🗳 Vote in the active contest"),
        BotCommand(command="board",  description="🏆 Live leaderboard"),
        BotCommand(command="packs",  description="🎟 Buy vote packs"),
        BotCommand(command="mybal",  description="💼 My votes & bonus files"),
        BotCommand(command="wallet", description="💰 My SKZ wallet"),
        BotCommand(command="help",   description="Help and voting rules"),
    ],
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("contests-bot")

api = ContestsBotClient(api_key=API_KEY, base_url=API_URL)
texts = api.texts("contests-bot", ttl_seconds=60)
router = Router()


# ── Helpers ────────────────────────────────────────────────────────────────
def main_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="🏆 لوحة المتسابقين", callback_data="board")],
        [InlineKeyboardButton(text="🗳 صَوِّت الآن", callback_data="vote_menu")],
        [InlineKeyboardButton(text="🎟 باقات التصويت", callback_data="packs")],
        [InlineKeyboardButton(text="💼 رصيد أصواتي", callback_data="mybal")],
        [InlineKeyboardButton(text="💰 محفظتي (SKZ)", callback_data="wallet")],
    ]
    if MOTHER_BOT_USERNAME:
        rows.append([InlineKeyboardButton(
            text="🏛 SOUQRATES SYSTEM — المحفظة الموحّدة",
            url=f"https://t.me/{MOTHER_BOT_USERNAME}",
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def back_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀ القائمة الرئيسية", callback_data="home")],
    ])


def fmt_skz(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


async def safe_edit(msg: Message, text: str, reply_markup: Optional[InlineKeyboardMarkup] = None):
    try:
        await msg.edit_text(text, reply_markup=reply_markup, disable_web_page_preview=True)
    except Exception:
        await msg.answer(text, reply_markup=reply_markup, disable_web_page_preview=True)


async def render_home(tg_id: str) -> tuple[str, InlineKeyboardMarkup]:
    title = await texts.get("welcome_title", "★ SOUQRATES STAGE")
    subtitle = await texts.get(
        "welcome_subtitle",
        "مسرح المسابقات والتصويت — جزء من منظومة 🏛 SOUQRATES SYSTEM",
    )
    try:
        active = await api.get_active_contest()
    except Exception as e:
        logger.error(f"get_active_contest failed: {e}")
        active = {"contest": None}

    contest = active.get("contest")
    if not contest:
        body = (
            f"<b>{title}</b>\n"
            f"<i>{subtitle}</i>\n\n"
            "🌙 لا توجد مسابقة نشطة حاليًّا.\n"
            "ترقّب المسابقة القادمة قريبًا!"
        )
        return body, back_kb()

    cs = active.get("contestants", []) or []
    top = sorted(cs, key=lambda c: -int(c.get("voteCount") or 0))[:3]
    leaderboard_lines = []
    medals = ["🥇", "🥈", "🥉"]
    for i, c in enumerate(top):
        leaderboard_lines.append(
            f"{medals[i]} <b>{c['name']}</b> — <code>{int(c['voteCount']):,}</code> صوت"
        )
    lb = "\n".join(leaderboard_lines) if leaderboard_lines else "<i>لم يبدأ التصويت بعد</i>"

    body = (
        f"<b>{title}</b>\n"
        f"<i>{subtitle}</i>\n\n"
        f"🎬 <b>المسابقة الحالية:</b> {contest['title']}\n"
        f"{contest.get('description') or ''}\n\n"
        f"🗳 <b>إجمالي الأصوات:</b> <code>{int(contest['totalVotes']):,}</code>\n\n"
        f"<b>المراكز الأولى:</b>\n{lb}\n\n"
        "🎁 لديك <b>صوت مجاني واحد</b> كل يوم — استخدمه لمتسابقك المفضّل!"
    )
    return body, main_kb()


# ── Handlers ───────────────────────────────────────────────────────────────
@router.message(CommandStart(deep_link=True))
async def cmd_start_deeplink(message: Message, command: CommandObject):
    """Handle web-app deep-links: /start vote, packs, vote_<id>, buy_<id>."""
    if message.from_user is None:
        return
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert_user failed: {e}")

    payload = (command.args or "").strip()
    body, kb = await render_home(str(message.from_user.id))
    msg = await message.answer(body, reply_markup=kb, disable_web_page_preview=True)

    if not payload:
        return

    # Reuse the module-level _FauxCb adapter to call inline-handler renderers.
    if payload == "vote":
        await _render_vote_menu(_FauxCb(msg, message.from_user, "vote_menu"))  # type: ignore[arg-type]
    elif payload == "packs":
        await cb_packs(_FauxCb(msg, message.from_user, "packs"))  # type: ignore[arg-type]
    elif payload.startswith("vote_"):
        try:
            cid = int(payload.split("_", 1)[1])
            # Pre-select contestant view by rendering vote menu; user taps to confirm.
            await _render_vote_menu(_FauxCb(msg, message.from_user, f"vote_{cid}"))  # type: ignore[arg-type]
        except (ValueError, IndexError):
            pass
    elif payload.startswith("buy_"):
        try:
            int(payload.split("_", 1)[1])  # validate
            await cb_packs(_FauxCb(msg, message.from_user, "packs"))  # type: ignore[arg-type]
        except (ValueError, IndexError):
            pass


@router.message(CommandStart())
async def cmd_start(message: Message):
    if message.from_user is None:
        return
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert_user failed: {e}")
    body, kb = await render_home(str(message.from_user.id))
    await message.answer(body, reply_markup=kb, disable_web_page_preview=True)


@router.callback_query(F.data == "home")
async def cb_home(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    body, kb = await render_home(str(cb.from_user.id))
    await safe_edit(cb.message, body, kb)
    await cb.answer()


@router.callback_query(F.data == "board")
async def cb_board(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    try:
        active = await api.get_active_contest()
    except Exception:
        active = {"contest": None}
    contest = active.get("contest")
    if not contest:
        await safe_edit(cb.message, "🌙 لا توجد مسابقة نشطة.", back_kb())
        await cb.answer()
        return

    try:
        lb = await api.get_leaderboard(contest["id"])
        contestants = lb.get("contestants", [])
    except Exception:
        contestants = active.get("contestants", []) or []

    contestants = sorted(contestants, key=lambda c: -int(c.get("voteCount") or 0))
    lines = [f"🏆 <b>{contest['title']}</b>\n"]
    total = int(contest.get("totalVotes") or 0) or 1
    for i, c in enumerate(contestants[:20]):
        votes = int(c.get("voteCount") or 0)
        pct = (votes * 100.0) / total
        bar_len = int(pct / 5)  # 20 chars max
        bar = "█" * bar_len + "░" * (20 - bar_len)
        rank = ("🥇 ", "🥈 ", "🥉 ")[i] if i < 3 else f"<code>#{i+1:>2}</code> "
        disq = " ❌" if c.get("isDisqualified") else ""
        lines.append(f"{rank}<b>{c['name']}</b>{disq}")
        lines.append(f"<code>{bar}</code> <b>{votes:,}</b> ({pct:.1f}%)\n")
    if not contestants:
        lines.append("<i>لا يوجد متسابقون بعد.</i>")
    await safe_edit(cb.message, "\n".join(lines), back_kb())
    await cb.answer()


async def _render_vote_menu(cb: CallbackQuery) -> None:
    """Render (or re-render) the vote menu. Does NOT call cb.answer()."""
    if cb.from_user is None or cb.message is None:
        return
    try:
        active = await api.get_active_contest()
    except Exception:
        active = {"contest": None}
    contest = active.get("contest")
    if not contest:
        await safe_edit(cb.message, "🌙 لا توجد مسابقة نشطة للتصويت.", back_kb())
        return

    contestants = [c for c in (active.get("contestants") or []) if not c.get("isDisqualified")]
    if not contestants:
        await safe_edit(cb.message, "لا يوجد متسابقون متاحون للتصويت.", back_kb())
        return

    try:
        bal = await api.my_balance(str(cb.from_user.id))
        free_left = "✅ متاح" if bal.get("freeAvailableToday") else "❌ مستخدم اليوم"
        paid_left = int(bal.get("paidAvailable") or 0)
    except Exception:
        free_left, paid_left = "—", 0

    header = (
        f"🗳 <b>صوِّت في:</b> {contest['title']}\n\n"
        f"🎁 صوتك المجاني: <b>{free_left}</b>\n"
        f"⚡ أصوات مدفوعة متاحة: <b>{paid_left:,}</b>\n\n"
        "اختر المتسابق:"
    )

    rows = []
    for c in sorted(contestants, key=lambda x: -int(x.get("voteCount") or 0)):
        rows.append([InlineKeyboardButton(
            text=f"🗳 {c['name']} ({int(c['voteCount']):,} صوت)",
            callback_data=f"v:{contest['id']}:{c['id']}",
        )])
    rows.append([InlineKeyboardButton(text="◀ رجوع", callback_data="home")])
    await safe_edit(cb.message, header, InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data == "vote_menu")
async def cb_vote_menu(cb: CallbackQuery):
    await _render_vote_menu(cb)
    await cb.answer()


@router.callback_query(F.data.startswith("v:"))
async def cb_vote(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    parts = cb.data.split(":")
    if len(parts) != 3:
        await cb.answer("بيانات غير صالحة", show_alert=True)
        return
    try:
        contest_id = int(parts[1])
        contestant_id = int(parts[2])
    except ValueError:
        await cb.answer("بيانات غير صالحة", show_alert=True)
        return

    try:
        result = await api.cast_vote(str(cb.from_user.id), contest_id, contestant_id, vote_count=1)
        breakdown = result.get("breakdown", [])
        src = breakdown[0]["source"] if breakdown else "?"
        src_label = "مجاني 🎁" if src == "free" else "مدفوع ⚡"
        await cb.answer(f"✅ تم تسجيل صوتك ({src_label})", show_alert=True)
        # Refresh the vote menu to reflect new counts. We've already answered the
        # callback above, so re-render in place instead of calling cb_vote_menu
        # (which would answer the same callback again and trigger a Telegram error).
        await _render_vote_menu(cb)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        try:
            err = e.response.json().get("error", "")
        except Exception:
            err = ""
        if status == 402 or err == "NO_VOTES_AVAILABLE":
            await cb.answer("❌ لا تملك أصواتًا متاحة. اشترِ باقة من 🎟", show_alert=True)
        elif status == 403:
            await cb.answer("❌ تم حظر حسابك من العمليات المالية.", show_alert=True)
        elif status == 409:
            await cb.answer("⚠ تغيّرت حالة المسابقة. أعد المحاولة.", show_alert=True)
        else:
            logger.error(f"vote failed [{status}]: {err}")
            await cb.answer("⚠ تعذّر التصويت. حاول لاحقًا.", show_alert=True)


@router.callback_query(F.data == "packs")
async def cb_packs(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    try:
        packs = await api.list_packs()
    except Exception:
        packs = []
    if not packs:
        await safe_edit(cb.message, "📦 لا توجد باقات متاحة حاليًّا.", back_kb())
        await cb.answer()
        return

    lines = ["🎟 <b>باقات التصويت</b>\n"]
    rows = []
    for p in packs:
        bonus = f" +{p['bonusVotes']} مكافأة" if p.get("bonusVotes") else ""
        file_tag = " 🎁" if p.get("bonusFileUrl") else ""
        lines.append(
            f"• <b>{p['name']}</b>{file_tag}\n"
            f"  <code>{p['votes']}</code> صوت{bonus} — <b>{fmt_skz(p['priceSkz'])} SKZ</b>"
        )
        if p.get("bonusDescription"):
            lines.append(f"  <i>{p['bonusDescription']}</i>")
        rows.append([InlineKeyboardButton(
            text=f"شراء {p['name']} ({fmt_skz(p['priceSkz'])} SKZ)",
            callback_data=f"buy:{p['id']}",
        )])
    rows.append([InlineKeyboardButton(text="◀ رجوع", callback_data="home")])
    await safe_edit(cb.message, "\n".join(lines), InlineKeyboardMarkup(inline_keyboard=rows))
    await cb.answer()


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    try:
        pack_id = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer("بيانات غير صالحة", show_alert=True)
        return

    try:
        result = await api.purchase_pack(str(cb.from_user.id), pack_id)
        votes = int(result.get("votesGranted") or 0)
        new_bal = fmt_skz(result.get("newSkzBalance"))
        msg = (
            f"✅ <b>تمّ الشراء بنجاح!</b>\n\n"
            f"⚡ تمّ إضافة <b>{votes:,}</b> صوت إلى رصيدك.\n"
            f"💰 رصيد SKZ المتبقي: <b>{new_bal}</b>"
        )
        if result.get("hasBonusFile"):
            msg += "\n\n🎁 لديك ملف مكافأة! اضغط 💼 لاسترجاعه."
        await safe_edit(cb.message, msg, back_kb())
        await cb.answer("✅ تم", show_alert=False)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        try:
            err = e.response.json().get("error", "")
        except Exception:
            err = ""
        if status == 402 or "insufficient" in err.lower():
            kb_rows = []
            if MOTHER_BOT_USERNAME:
                kb_rows.append([InlineKeyboardButton(
                    text="💰 شحن SKZ من البوت الأم",
                    url=f"https://t.me/{MOTHER_BOT_USERNAME}",
                )])
            kb_rows.append([InlineKeyboardButton(text="◀ رجوع", callback_data="home")])
            await safe_edit(
                cb.message,
                "❌ رصيد SKZ غير كافٍ لشراء هذه الباقة.\nاشحن محفظتك من البوت الأم ثم عُد.",
                InlineKeyboardMarkup(inline_keyboard=kb_rows),
            )
        elif status == 403:
            await cb.answer("❌ تم حظر حسابك.", show_alert=True)
        else:
            logger.error(f"purchase failed [{status}]: {err}")
            await cb.answer("⚠ تعذّر الشراء. حاول لاحقًا.", show_alert=True)


@router.callback_query(F.data == "mybal")
async def cb_mybal(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    try:
        bal = await api.my_balance(str(cb.from_user.id))
    except Exception as e:
        logger.error(f"my_balance failed: {e}")
        await safe_edit(cb.message, "⚠ تعذّر جلب رصيدك.", back_kb())
        await cb.answer()
        return

    free_left = "✅ متاح" if bal.get("freeAvailableToday") else "❌ استُخدم اليوم"
    paid_left = int(bal.get("paidAvailable") or 0)
    grants = bal.get("grants") or []

    lines = [
        "💼 <b>رصيد أصواتي</b>\n",
        f"🎁 الصوت المجاني اليومي: <b>{free_left}</b>",
        f"⚡ الأصوات المدفوعة المتبقّية: <b>{paid_left:,}</b>",
    ]

    rows = []
    bonus_grants = [g for g in grants if g.get("hasBonusFile")]
    if bonus_grants:
        lines.append("\n🎁 <b>مكافآتك (ملفات قابلة للتنزيل):</b>")
        for g in bonus_grants:
            lines.append(f"• {g.get('bonusFileName') or 'ملف مكافأة'}")
            rows.append([InlineKeyboardButton(
                text=f"📥 تنزيل: {g.get('bonusFileName') or 'ملف'}",
                callback_data=f"dl:{g['id']}",
            )])

    rows.append([InlineKeyboardButton(text="🎟 شراء المزيد", callback_data="packs")])
    rows.append([InlineKeyboardButton(text="◀ القائمة الرئيسية", callback_data="home")])
    await safe_edit(cb.message, "\n".join(lines), InlineKeyboardMarkup(inline_keyboard=rows))
    await cb.answer()


@router.callback_query(F.data.startswith("dl:"))
async def cb_download(cb: CallbackQuery):
    if cb.from_user is None or cb.data is None:
        return
    try:
        grant_id = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer("بيانات غير صالحة", show_alert=True)
        return
    try:
        res = await api.grant_download(str(cb.from_user.id), grant_id)
        url = res.get("downloadUrl")
        if url:
            await cb.answer("🔗 جاهز للتنزيل", show_alert=False)
            await cb.message.answer(
                f"📥 <b>{res.get('fileName') or 'ملف المكافأة'}</b>\n\n<a href=\"{url}\">اضغط هنا للتنزيل</a>",
                disable_web_page_preview=False,
            )
        else:
            await cb.answer("⚠ تعذّر إصدار الرابط.", show_alert=True)
    except httpx.HTTPStatusError as e:
        logger.error(f"grant_download failed: {e}")
        await cb.answer("⚠ تعذّر التنزيل.", show_alert=True)


@router.callback_query(F.data == "wallet")
async def cb_wallet(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    try:
        data = await api.get_wallet(str(cb.from_user.id))
        w = (data or {}).get("wallet") or {}
        skz = fmt_skz(w.get("balanceSkz"))
    except Exception:
        skz = "—"
    rows = []
    if MOTHER_BOT_USERNAME:
        rows.append([InlineKeyboardButton(
            text="💰 شحن من البوت الأم",
            url=f"https://t.me/{MOTHER_BOT_USERNAME}",
        )])
    rows.append([InlineKeyboardButton(text="🎟 شراء باقة", callback_data="packs")])
    rows.append([InlineKeyboardButton(text="◀ القائمة الرئيسية", callback_data="home")])
    await safe_edit(
        cb.message,
        (
            f"💰 <b>محفظتك الموحّدة</b>\n\n"
            f"⚡ رصيد SKZ: <b>{skz}</b>\n\n"
            "محفظتك مُدارة مركزيًّا عبر 🏛 <b>SOUQRATES SYSTEM</b>\n"
            "(نفس الرصيد يعمل في كل بوتات سوقراط).\n\n"
            "استخدم رصيد SKZ لشراء باقات التصويت."
        ),
        InlineKeyboardMarkup(inline_keyboard=rows),
    )
    await cb.answer()


class _FauxCb:
    """Adapter so /slash commands can reuse the callback-query renderers."""
    def __init__(self, m: Message, user, data: str):
        self.message = m
        self.from_user = user
        self.data = data
    async def answer(self, *_a, **_k):
        return None


async def _send_home_then(message: Message, route: str) -> None:
    if message.from_user is None:
        return
    try:
        await api.upsert_user(message.from_user)
    except Exception as e:
        logger.error(f"upsert_user failed: {e}")
    body, kb = await render_home(str(message.from_user.id))
    msg = await message.answer(body, reply_markup=kb, disable_web_page_preview=True)
    cb = _FauxCb(msg, message.from_user, route)  # type: ignore[arg-type]
    if route == "vote_menu":
        await _render_vote_menu(cb)  # type: ignore[arg-type]
    elif route == "board":
        await cb_board(cb)  # type: ignore[arg-type]
    elif route == "packs":
        await cb_packs(cb)  # type: ignore[arg-type]
    elif route == "mybal":
        await cb_mybal(cb)  # type: ignore[arg-type]
    elif route == "wallet":
        await cb_wallet(cb)  # type: ignore[arg-type]


@router.message(Command("vote"))
async def cmd_vote(message: Message):
    await _send_home_then(message, "vote_menu")


@router.message(Command("board"))
async def cmd_board(message: Message):
    await _send_home_then(message, "board")


@router.message(Command("packs"))
async def cmd_packs(message: Message):
    await _send_home_then(message, "packs")


@router.message(Command("mybal"))
async def cmd_mybal(message: Message):
    await _send_home_then(message, "mybal")


@router.message(Command("wallet"))
async def cmd_wallet(message: Message):
    await _send_home_then(message, "wallet")


@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "📖 <b>مساعدة SOUQRATES STAGE</b>\n\n"
        "/start — القائمة الرئيسية\n\n"
        "• <b>صوت مجاني واحد يوميًّا</b> (UTC) لكل مستخدم على المنصّة كلّها.\n"
        "• اشترِ <b>باقات أصوات</b> برصيد SKZ من زر 🎟.\n"
        "• بعض الباقات تتضمّن <b>ملف مكافأة</b> (مثلًا كتاب PDF).\n"
        "• كل المعاملات مالية مُسجّلة وقابلة للتدقيق.",
        reply_markup=back_kb(),
    )


# ── Bootstrap ──────────────────────────────────────────────────────────────
async def main():
    if not BOT_TOKEN:
        logger.error("CONTESTS_BOT_TOKEN env var not set — bot cannot start.")
        return
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    # Publish slash-command menu (Arabic default + per-language overrides).
    try:
        await bot.set_my_commands(COMMANDS, scope=BotCommandScopeDefault())
        logger.info(f"published {len(COMMANDS)} default commands")
        for lang_code, cmds in COMMANDS_BY_LANG.items():
            try:
                await bot.set_my_commands(
                    cmds, scope=BotCommandScopeDefault(), language_code=lang_code,
                )
            except Exception as e:
                logger.warning(f"set_my_commands(lang={lang_code}) failed: {e}")
    except Exception as e:
        logger.warning(f"set_my_commands failed: {e}")

    # Wire the chat menu button to the web mini-app (Telegram Web App).
    # Telegram requires an HTTPS URL; we silently skip when only http://localhost is available.
    if WEB_APP_URL.startswith("https://"):
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="🎭 المسرح",
                    web_app=WebAppInfo(url=WEB_APP_URL),
                ),
            )
            logger.info(f"menu button → web app: {WEB_APP_URL}")
        except Exception as e:
            logger.warning(f"set_chat_menu_button failed: {e}")
    else:
        logger.info("WEB_APP_URL not HTTPS; skipping chat menu button setup")

    logger.info("SOUQRATES STAGE bot starting…")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
