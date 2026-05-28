"""
Polling/webhook runtime switch shared by all four Python bots.

Each bot ships its own copy of this file (kept byte-identical) so it can be
imported with `from webhook_runtime import run_bot` without a workspace
library — the bots are independent Python artifacts.

Behavior:
- If `USE_WEBHOOK` is falsy (default), fall back to long polling. Used in
  dev/Replit where there is no public HTTPS path per bot.
- If `USE_WEBHOOK` is truthy, start a small aiohttp server and register an
  aiogram webhook handler at `/telegram-webhook/<slug>`. Telegram is told to
  POST updates to `<WEBHOOK_BASE_URL>/telegram-webhook/<slug>` and to sign
  every request with `WEBHOOK_SECRET` (passed via the
  `X-Telegram-Bot-Api-Secret-Token` header — aiogram verifies it).

Env (production / Contabo):
  USE_WEBHOOK=1
  WEBHOOK_BASE_URL=https://souqrates.com         # the public host
  WEBHOOK_SECRET=<random 32+ chars, same on bot.set_webhook>
  WEBHOOK_PORT=<unique per bot: e.g. 8101 mother, 8102 books, …>
  WEBHOOK_HOST=127.0.0.1                          # default

The reverse proxy on the VPS routes
  POST  /telegram-webhook/<slug>  →  127.0.0.1:<WEBHOOK_PORT>
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "on")


async def run_bot(bot: Any, dp: Any, slug: str) -> None:
    """Run `bot` under `dp` either as polling or webhook.

    Returns only when the bot is shut down (Ctrl-C / SIGTERM).
    """
    allowed = dp.resolve_used_update_types()

    if not _truthy(os.getenv("USE_WEBHOOK")):
        logger.info(f"{slug}: starting polling (USE_WEBHOOK not set)")
        # Wipe any prior webhook so Telegram delivers via getUpdates again.
        try:
            await bot.delete_webhook(drop_pending_updates=False)
        except Exception as e:
            logger.warning(f"{slug}: delete_webhook before polling failed: {e}")
        await dp.start_polling(bot, allowed_updates=allowed)
        return

    # --- webhook mode ---
    base = (os.getenv("WEBHOOK_BASE_URL") or "").strip().rstrip("/")
    if not base or not base.startswith("https://"):
        raise RuntimeError(
            f"{slug}: USE_WEBHOOK is set but WEBHOOK_BASE_URL is missing or "
            f"not https:// (got {base!r}). Telegram requires HTTPS."
        )
    secret = (os.getenv("WEBHOOK_SECRET") or "").strip()
    if not secret or len(secret) < 16:
        raise RuntimeError(
            f"{slug}: WEBHOOK_SECRET must be set to at least 16 chars"
        )
    host = (os.getenv("WEBHOOK_HOST") or "127.0.0.1").strip()
    try:
        port = int((os.getenv("WEBHOOK_PORT") or "0").strip())
    except ValueError:
        port = 0
    if port <= 0:
        raise RuntimeError(f"{slug}: WEBHOOK_PORT must be a positive int")

    path = f"/telegram-webhook/{slug}"
    url = f"{base}{path}"

    # Imported lazily so polling-only environments don't need aiohttp.
    from aiohttp import web
    from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application

    # Register webhook with Telegram. drop_pending_updates avoids replaying
    # a queue of stale polling-era updates on first cutover.
    await bot.set_webhook(
        url=url,
        secret_token=secret,
        allowed_updates=allowed,
        drop_pending_updates=True,
    )
    logger.info(f"{slug}: webhook registered with Telegram → {url}")

    app = web.Application()
    SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=secret,
    ).register(app, path=path)
    setup_application(app, dp, bot=bot)

    # Lightweight liveness probe for the reverse proxy / uptime monitor.
    async def _health(_req: web.Request) -> web.Response:
        return web.Response(text=f"ok {slug}\n")

    app.router.add_get(f"/telegram-webhook/{slug}/healthz", _health)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logger.info(f"{slug}: webhook server listening on {host}:{port}{path}")

    # Block forever; aiogram's setup_application wires graceful shutdown of
    # the dispatcher/bot session into the aiohttp app lifecycle.
    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()
