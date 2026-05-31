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

# Sentry must init before any business-logic import — captures bootstrap errors.
from sentry_init import init_sentry
init_sentry("contests-bot")

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

from aiogram.exceptions import TelegramBadRequest
from client import ContestsBotClient
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
BOT_TOKEN = os.getenv("CONTESTS_BOT_TOKEN")
API_KEY = os.getenv("CONTESTS_BOT_API_KEY", "")
API_URL = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_USERNAME = os.getenv("MOTHER_BOT_USERNAME", "")  # for top-up link
# Public URL of the contests-bot-web mini-app (used for the chat menu button).
# Resolution order (so the same image runs unchanged on Replit dev AND Contabo):
#   1) CONTESTS_WEB_APP_URL — explicit override
#   2) PUBLIC_BASE_URL      — production base for Contabo / souqrates.com
#   3) REPLIT_DOMAINS       — Replit published deploy
#   4) REPLIT_DEV_DOMAIN    — Replit dev preview
def _resolve_contests_web_app_url() -> str:
    explicit = (os.getenv("CONTESTS_WEB_APP_URL") or "").strip()
    if explicit:
        return explicit
    public = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if public:
        return f"{public}/contests-bot-web/"
    rds = (os.getenv("REPLIT_DOMAINS") or "").split(",")[0].strip()
    if rds:
        return f"https://{rds}/contests-bot-web/"
    dev = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
    if dev:
        return f"https://{dev}/contests-bot-web/"
    return ""
WEB_APP_URL = _resolve_contests_web_app_url()

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
    return ""
MOTHER_APP_URL = _resolve_mother_app_url()

# ── Slash-command menu (single source of truth for /setcommands) ───────────
COMMANDS: list[BotCommand] = [
    BotCommand(command="start",  description="بدء استخدام البوت وفتح القائمة الرئيسية"),
    BotCommand(command="vote",   description="🗳 صَوِّت في المسابقة النشطة"),
    BotCommand(command="board",  description="🏆 لوحة المتسابقين المباشرة"),
    BotCommand(command="packs",  description="🎟 باقات التصويت المدفوعة"),
    BotCommand(command="mybal",  description="💼 رصيد أصواتي ومكافآتي"),
    BotCommand(command="wallet", description="💰 محفظتي بـ SKZ"),
    BotCommand(command="lang",   description="🌐 تغيير اللغة (عربي / إنجليزي)"),
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
        BotCommand(command="lang",   description="🌐 Change language (Arabic / English)"),
        BotCommand(command="help",   description="Help and voting rules"),
    ],
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("contests-bot")

api = ContestsBotClient(api_key=API_KEY, base_url=API_URL)
texts = api.texts("contests-bot", ttl_seconds=60)
router = Router()


# ── Helpers ────────────────────────────────────────────────────────────────
def main_kb(lang: str) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=t(lang, "btn_main_leaderboard"), callback_data="board")],
        [InlineKeyboardButton(text=t(lang, "btn_main_vote_now"),    callback_data="vote_menu")],
        [InlineKeyboardButton(text=t(lang, "btn_main_packs"),       callback_data="packs")],
        [InlineKeyboardButton(text=t(lang, "btn_main_mybal"),       callback_data="mybal")],
        [InlineKeyboardButton(text=t(lang, "btn_main_wallet"),      callback_data="wallet")],
    ]
    if MOTHER_APP_URL:
        rows.append([InlineKeyboardButton(
            text=t(lang, "btn_main_system"),
            web_app=WebAppInfo(url=MOTHER_APP_URL),
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


async def safe_edit(msg: Message, text: str, reply_markup: Optional[InlineKeyboardMarkup] = None):
    try:
        await msg.edit_text(text, reply_markup=reply_markup, disable_web_page_preview=True)
    except Exception:
        await msg.answer(text, reply_markup=reply_markup, disable_web_page_preview=True)


async def render_home(tg_id: str) -> tuple[str, InlineKeyboardMarkup]:
    lang = await get_user_lang(tg_id, API_URL, API_KEY)
    title = await texts.get("welcome_title", t(lang, "home_welcome_title"))
    subtitle = await texts.get(
        "welcome_subtitle",
        t(lang, "home_welcome_subtitle"),
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
            f"{t(lang, 'home_no_active')}"
        )
        return body, back_kb(lang)

    cs = active.get("contestants", []) or []
    top = sorted(cs, key=lambda c: -int(c.get("voteCount") or 0))[:3]
    leaderboard_lines = []
    medals = ["🥇", "🥈", "🥉"]
    for i, c in enumerate(top):
        leaderboard_lines.append(
            t(lang, "home_lb_line_ar",
              medal=medals[i], name=c['name'], votes=f"{int(c['voteCount']):,}")
        )
    lb = "\n".join(leaderboard_lines) if leaderboard_lines else t(lang, "home_voting_not_started")

    total_votes_str = f"{int(contest['totalVotes']):,}"
    body = (
        f"<b>{title}</b>\n"
        f"<i>{subtitle}</i>\n\n"
        f"{t(lang, 'home_current_contest', title=contest['title'])}\n"
        f"{contest.get('description') or ''}\n\n"
        f"{t(lang, 'home_total_votes', total=total_votes_str)}\n\n"
        f"{t(lang, 'home_top_ranks_label')}\n{lb}\n\n"
        f"{t(lang, 'home_free_vote_daily')}"
    )
    return body, main_kb(lang)


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


# ── /lang — let the user pick Arabic / English ────────────────────────────
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
    # Re-render home in the new language so the change is visible immediately.
    try:
        body, kb = await render_home(tg_id)
        await cb.message.edit_text(body, reply_markup=kb, disable_web_page_preview=True)
    except TelegramBadRequest:
        pass


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
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        active = await api.get_active_contest()
    except Exception:
        active = {"contest": None}
    contest = active.get("contest")
    if not contest:
        await safe_edit(cb.message, t(lang, "board_no_active"), back_kb(lang))
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
        lines.append(t(lang, "board_no_contestants"))
    await safe_edit(cb.message, "\n".join(lines), back_kb(lang))
    await cb.answer()


async def _render_vote_menu(cb: CallbackQuery) -> None:
    """Render (or re-render) the vote menu. Does NOT call cb.answer()."""
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        active = await api.get_active_contest()
    except Exception:
        active = {"contest": None}
    contest = active.get("contest")
    if not contest:
        await safe_edit(cb.message, t(lang, "vote_no_active"), back_kb(lang))
        return

    contestants = [c for c in (active.get("contestants") or []) if not c.get("isDisqualified")]
    if not contestants:
        await safe_edit(cb.message, t(lang, "vote_no_contestants"), back_kb(lang))
        return

    try:
        bal = await api.my_balance(str(cb.from_user.id))
        free_left = t(lang, "vote_free_available") if bal.get("freeAvailableToday") else t(lang, "vote_free_used_today")
        paid_left = int(bal.get("paidAvailable") or 0)
    except Exception:
        free_left, paid_left = t(lang, "vote_dash"), 0

    header = t(
        lang, "vote_header",
        title=contest['title'],
        free=free_left,
        paid=f"{paid_left:,}",
    )

    rows = []
    for c in sorted(contestants, key=lambda x: -int(x.get("voteCount") or 0)):
        rows.append([InlineKeyboardButton(
            text=t(lang, "vote_btn_contestant", name=c['name'], votes=f"{int(c['voteCount']):,}"),
            callback_data=f"v:{contest['id']}:{c['id']}",
        )])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back_short"), callback_data="home")])
    await safe_edit(cb.message, header, InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data == "vote_menu")
async def cb_vote_menu(cb: CallbackQuery):
    await _render_vote_menu(cb)
    await cb.answer()


@router.callback_query(F.data.startswith("v:"))
async def cb_vote(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    parts = cb.data.split(":")
    if len(parts) != 3:
        await cb.answer(t(lang, "err_bad_data"), show_alert=True)
        return
    try:
        contest_id = int(parts[1])
        contestant_id = int(parts[2])
    except ValueError:
        await cb.answer(t(lang, "err_bad_data"), show_alert=True)
        return

    try:
        result = await api.cast_vote(str(cb.from_user.id), contest_id, contestant_id, vote_count=1)
        breakdown = result.get("breakdown", [])
        src = breakdown[0]["source"] if breakdown else "?"
        if src == "free":
            src_label = t(lang, "vote_src_free")
        elif src == "?":
            src_label = t(lang, "vote_src_unknown")
        else:
            src_label = t(lang, "vote_src_paid")
        await cb.answer(t(lang, "vote_success", src=src_label), show_alert=True)
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
            await cb.answer(t(lang, "vote_no_votes"), show_alert=True)
        elif status == 403:
            await cb.answer(t(lang, "err_banned_financial"), show_alert=True)
        elif status == 409:
            await cb.answer(t(lang, "err_state_changed"), show_alert=True)
        else:
            logger.error(f"vote failed [{status}]: {err}")
            await cb.answer(t(lang, "err_vote_generic"), show_alert=True)


@router.callback_query(F.data == "packs")
async def cb_packs(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        packs = await api.list_packs()
    except Exception:
        packs = []
    if not packs:
        await safe_edit(cb.message, t(lang, "packs_none"), back_kb(lang))
        await cb.answer()
        return

    lines = [t(lang, "packs_header")]
    rows = []
    for p in packs:
        bonus = t(lang, "packs_bonus_suffix", bonus=p['bonusVotes']) if p.get("bonusVotes") else ""
        file_tag = " 🎁" if p.get("bonusFileUrl") else ""
        lines.append(t(
            lang, "packs_line",
            name=p['name'], file_tag=file_tag,
            votes=p['votes'], bonus=bonus,
            price=fmt_skz(p['priceSkz']),
        ))
        if p.get("bonusDescription"):
            lines.append(f"  <i>{p['bonusDescription']}</i>")
        rows.append([InlineKeyboardButton(
            text=t(lang, "packs_btn_buy", name=p['name'], price=fmt_skz(p['priceSkz'])),
            callback_data=f"buy:{p['id']}",
        )])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_back_short"), callback_data="home")])
    await safe_edit(cb.message, "\n".join(lines), InlineKeyboardMarkup(inline_keyboard=rows))
    await cb.answer()


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None or cb.data is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        pack_id = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer(t(lang, "err_bad_data"), show_alert=True)
        return

    try:
        result = await api.purchase_pack(str(cb.from_user.id), pack_id)
        votes = int(result.get("votesGranted") or 0)
        new_bal = fmt_skz(result.get("newSkzBalance"))
        msg = t(lang, "buy_success", votes=f"{votes:,}", bal=new_bal)
        if result.get("hasBonusFile"):
            msg += t(lang, "buy_bonus_file_hint")
        await safe_edit(cb.message, msg, back_kb(lang))
        await cb.answer(t(lang, "buy_done_toast"), show_alert=False)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        try:
            err = e.response.json().get("error", "")
        except Exception:
            err = ""
        if status == 402 or "insufficient" in err.lower():
            kb_rows = []
            if MOTHER_APP_URL:
                kb_rows.append([InlineKeyboardButton(
                    text=t(lang, "buy_btn_topup"),
                    web_app=WebAppInfo(url=MOTHER_APP_URL),
                )])
            kb_rows.append([InlineKeyboardButton(text=t(lang, "btn_back_short"), callback_data="home")])
            await safe_edit(
                cb.message,
                t(lang, "buy_insufficient_body"),
                InlineKeyboardMarkup(inline_keyboard=kb_rows),
            )
        elif status == 403:
            await cb.answer(t(lang, "err_banned_short"), show_alert=True)
        else:
            logger.error(f"purchase failed [{status}]: {err}")
            await cb.answer(t(lang, "err_purchase_generic"), show_alert=True)


@router.callback_query(F.data == "mybal")
async def cb_mybal(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        bal = await api.my_balance(str(cb.from_user.id))
    except Exception as e:
        logger.error(f"my_balance failed: {e}")
        await safe_edit(cb.message, t(lang, "mybal_fetch_err"), back_kb(lang))
        await cb.answer()
        return

    free_left = t(lang, "vote_free_available") if bal.get("freeAvailableToday") else t(lang, "mybal_free_used")
    paid_left = int(bal.get("paidAvailable") or 0)
    grants = bal.get("grants") or []

    lines = [
        t(lang, "mybal_title"),
        t(lang, "mybal_free_line", val=free_left),
        t(lang, "mybal_paid_line", val=f"{paid_left:,}"),
    ]

    rows = []
    bonus_grants = [g for g in grants if g.get("hasBonusFile")]
    if bonus_grants:
        lines.append(t(lang, "mybal_bonus_section"))
        for g in bonus_grants:
            lines.append(f"• {g.get('bonusFileName') or t(lang, 'mybal_bonus_default')}")
            rows.append([InlineKeyboardButton(
                text=t(lang, "mybal_btn_download",
                       name=g.get('bonusFileName') or t(lang, 'mybal_bonus_short')),
                callback_data=f"dl:{g['id']}",
            )])

    rows.append([InlineKeyboardButton(text=t(lang, "mybal_btn_buy_more"), callback_data="packs")])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_home"), callback_data="home")])
    await safe_edit(cb.message, "\n".join(lines), InlineKeyboardMarkup(inline_keyboard=rows))
    await cb.answer()


@router.callback_query(F.data.startswith("dl:"))
async def cb_download(cb: CallbackQuery):
    if cb.from_user is None or cb.data is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        grant_id = int(cb.data.split(":")[1])
    except (ValueError, IndexError):
        await cb.answer(t(lang, "err_bad_data"), show_alert=True)
        return
    try:
        res = await api.grant_download(str(cb.from_user.id), grant_id)
        url = res.get("downloadUrl")
        if url:
            await cb.answer(t(lang, "dl_ready_toast"), show_alert=False)
            await cb.message.answer(
                t(lang, "dl_message",
                  name=res.get('fileName') or t(lang, 'dl_file_default'),
                  url=url),
                disable_web_page_preview=False,
            )
        else:
            await cb.answer(t(lang, "dl_err_link"), show_alert=True)
    except httpx.HTTPStatusError as e:
        logger.error(f"grant_download failed: {e}")
        await cb.answer(t(lang, "dl_err_generic"), show_alert=True)


@router.callback_query(F.data == "wallet")
async def cb_wallet(cb: CallbackQuery):
    if cb.from_user is None or cb.message is None:
        return
    lang = await get_user_lang(str(cb.from_user.id), API_URL, API_KEY)
    try:
        data = await api.get_wallet(str(cb.from_user.id))
        w = (data or {}).get("wallet") or {}
        skz = fmt_skz(w.get("balanceSkz"))
    except Exception:
        skz = "—"
    rows = []
    if MOTHER_APP_URL:
        rows.append([InlineKeyboardButton(
            text=t(lang, "wallet_btn_topup"),
            web_app=WebAppInfo(url=MOTHER_APP_URL),
        )])
    rows.append([InlineKeyboardButton(text=t(lang, "wallet_btn_buy_pack"), callback_data="packs")])
    rows.append([InlineKeyboardButton(text=t(lang, "btn_home"), callback_data="home")])
    await safe_edit(
        cb.message,
        t(lang, "wallet_body", skz=skz),
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
    if message.from_user is None:
        return
    lang = await get_user_lang(str(message.from_user.id), API_URL, API_KEY)
    await message.answer(
        t(lang, "help_body"),
        reply_markup=back_kb(lang),
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
    # Only set in production (USE_WEBHOOK=1). In dev / polling mode the Replit
    # instance would overwrite the production menu button set by Contabo with a
    # temporary replit.dev URL, breaking the button for all users globally.
    if WEB_APP_URL.startswith("https://") and os.getenv("USE_WEBHOOK"):
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
        logger.info("WEB_APP_URL not HTTPS or not in webhook mode; skipping chat menu button setup")

    from webhook_runtime import run_bot
    await run_bot(bot, dp, "contests-bot")


if __name__ == "__main__":
    asyncio.run(main())
