import asyncio
import os
import logging
import time
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
from aiogram.fsm.storage.memory import MemoryStorage
import httpx
from dotenv import load_dotenv
from client import MotherBotClient

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN        = os.getenv("MOTHER_BOT_TOKEN", "")
MOTHER_API_URL   = os.getenv("MOTHER_API_URL", "http://localhost:80/api")
MOTHER_BOT_API_KEY = os.getenv("MOTHER_BOT_API_KEY", "")
MASTER_ADMIN_CODE  = os.getenv("MASTER_ADMIN_CODE", "")
_BASE_MINI_APP_URL  = os.getenv("MINI_APP_URL", "https://souqrates.com/")
_BASE_GAMES_APP_URL = os.getenv("GAMES_APP_URL", "https://souqrates.com/games-bot/")
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
        # ②.5 Launch Books (jumps user into the books child bot via deep-link)
        [
            InlineKeyboardButton(
                text="❖ SOUQRATES SOUQ",
                url=f"https://t.me/{BOOKS_BOT_USERNAME}?start=from_mother",
            )
        ],
        # ②.6 Launch Contests / Voting (jumps user into the contests child bot)
        [
            InlineKeyboardButton(
                text="★ SOUQRATES STAGE",
                url=f"https://t.me/{CONTESTS_BOT_USERNAME}?start=from_mother",
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
            InlineKeyboardButton(text="☰ المزيد",        callback_data="info_menu"),
        ],
    ])


def info_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📜 السياسات",       callback_data="info_policies")],
        [InlineKeyboardButton(text="⚖️ القوانين",       callback_data="info_rules")],
        [InlineKeyboardButton(text="✉️ تواصل معنا",     callback_data="info_contact")],
        [InlineKeyboardButton(text="🔙 رجوع",           callback_data="menu")],
    ])


def info_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀ القائمة",        callback_data="info_menu")],
        [InlineKeyboardButton(text="🏠 الرئيسية",      callback_data="menu")],
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
    first_name = message.from_user.first_name or "User"

    # 1. Upsert — registers / updates the user record. Fire regardless of wallet.
    try:
        upsert_data = await api_upsert_user(message.from_user)
        first_name  = upsert_data.get("user", {}).get("firstName", first_name)
    except Exception as e:
        logger.error(f"Upsert failed: {e}")

    # 2. Always fetch balance fresh — ensures any admin credit/debit is visible.
    skz_bal  = 0
    usdt_bal = 0.0
    try:
        wallet_data = await api_get_wallet(str(message.from_user.id))
        if wallet_data:
            w        = wallet_data.get("wallet") or {}
            skz_bal  = float(w.get("balanceSkz",  "0"))
            usdt_bal = float(w.get("balanceUsdt", "0"))
    except Exception as e:
        logger.error(f"Balance fetch failed: {e}")

    text = (
        f"👋 Welcome, <b>{first_name}</b>!\n\n"
        f"🏦 <b>Your SKZ Wallet</b>\n"
        f"├ ⚡ SKZ: <code>{skz_bal:,.2f}</code>\n"
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
    skz_bal   = float(wallet["balanceSkz"])  if wallet else 0.0
    usdt_bal  = float(wallet["balanceUsdt"])  if wallet else 0.0

    text = (
        f"👋 Welcome back, <b>{callback.from_user.first_name}</b>!\n\n"
        f"🏦 <b>Your SKZ Wallet</b>\n"
        f"├ ⚡ SKZ: <code>{skz_bal:,.2f}</code>\n"
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
        f"💰 <b>Your Wallet</b>\n\n"
        f"<b>Balances:</b>\n"
        f"├ ⚡ SKZ:        <code>{skz:,.2f}</code>\n"
        f"├ 🤝 Referral:  <code>{ref_skz:,.2f}</code> SKZ\n"
        f"├ 💵 USDT:      <code>{usdt:.4f}</code>\n"
        f"├ ⭐ Stars:      <code>{stars:,}</code>\n"
        f"└ 💎 TON:       <code>{ton:.4f}</code>\n\n"
        f"<b>🎮 Profile:</b>  Level <b>{level}</b> · <code>{xp:,}</code> XP\n"
        f"<b>🎯 Games:</b>   {won}/{played} won\n\n"
        f"<b>Total Earned:</b>    <code>{earned:,.2f}</code> SKZ\n"
        f"<b>Total Withdrawn:</b> <code>{withdrawn:,.2f}</code> SKZ"
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
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
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

    ref_balance = 0.0
    total_ref_earned = 0.0
    try:
        data = await api_get_wallet(str(callback.from_user.id))
        w = (data or {}).get("wallet") or {}
        ref_balance      = float(w.get("referralBalanceSkz", "0"))
        total_ref_earned = float(w.get("totalEarnedFromReferralsSkz", "0"))
    except Exception:
        pass

    text = (
        f"🤝 <b>Referral Program</b>\n\n"
        f"Invite friends and earn <b>up to 15%</b> of their SKZ earnings — for life!\n\n"
        f"💼 <b>Referral Wallet:</b>\n"
        f"├ Available:    <code>{ref_balance:,.2f}</code> SKZ\n"
        f"└ Lifetime:     <code>{total_ref_earned:,.2f}</code> SKZ\n\n"
        f"🔗 <b>Your link:</b>\n"
        f"<code>{ref_link}</code>\n\n"
        f"Tiers: L1 → 10% · L2 → 3% · L3 → 2%\n\n"
        f"💡 Transfer your referral earnings to your main wallet to withdraw them."
    )
    kb_rows = []
    if ref_balance > 0:
        kb_rows.append([InlineKeyboardButton(
            text=f"💸 Transfer {ref_balance:,.2f} SKZ → Main Wallet",
            callback_data="referral_transfer",
        )])
    kb_rows.append([InlineKeyboardButton(text="⬅️ Back", callback_data="menu")])
    await callback.message.edit_text(
        text, parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb_rows),
    )
    await callback.answer()


@router.callback_query(F.data == "referral_transfer")
async def cb_referral_transfer(callback: CallbackQuery):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MOTHER_API_URL}/internal/wallets/transfer-referral",
                json={"telegramId": str(callback.from_user.id)},
                headers={"X-Bot-Api-Key": MOTHER_BOT_API_KEY},
                timeout=10.0,
            )
        if resp.status_code != 200:
            err = (resp.json() or {}).get("error", "Transfer failed")
            await callback.answer(f"❌ {err}", show_alert=True)
            return
        body = resp.json()
        await callback.answer(
            f"✅ Transferred {body.get('transferred', '0')} SKZ to your main wallet",
            show_alert=True,
        )
    except Exception as e:
        logger.error(f"Referral transfer failed: {e}")
        await callback.answer("❌ Transfer error", show_alert=True)
        return

    # Re-render referral view so balance updates immediately
    await cb_referral(callback)


@router.callback_query(F.data == "help")
async def cb_help(callback: CallbackQuery):
    text = (
        "ℹ️ <b>About SOUQRATES SYSTEM</b>\n\n"
        "SKZ is your unified financial hub across the SOUQRATES ecosystem:\n\n"
        "▲ <b>SOUQRATES SKILLZ</b> — skill games with prizes\n"
        "❖ <b>SOUQRATES SOUQ</b>   — books &amp; digital products\n"
        "▶ <b>SOUQRATES SCENE</b>  — short video, earn from watching\n"
        "◉ <b>SOUQRATES STREAM</b> — paid voice rooms\n"
        "✦ <b>SOUQRATES SIGNAL</b> — AI text/image/video generation\n"
        "★ <b>SOUQRATES STAGE</b>  — contests &amp; voting prizes\n\n"
        "All earnings across every chapter flow into one SKZ wallet here — in SOUQRATES SYSTEM."
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=back_keyboard())
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
    text = (
        "☰ <b>المزيد</b>\n\n"
        "اختر ما تريد الاطلاع عليه:"
    )
    await _safe_edit(callback, text, info_menu_keyboard())
    await callback.answer()


@router.callback_query(F.data.in_({"info_policies", "info_rules", "info_contact"}))
async def cb_info_page(callback: CallbackQuery):
    key = callback.data
    _, default_body = INFO_DEFAULTS.get(key, ("", "—"))
    body = await texts.get(key, default=default_body)
    await _safe_edit(callback, body, info_back_keyboard())
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
            f"⚡ SKZ: {float(w['balanceSkz']):,.2f}\n"
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
