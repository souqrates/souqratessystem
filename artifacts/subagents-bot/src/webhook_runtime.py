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


def _is_production_webhook(url: str, replit_domain: str) -> bool:
    """Return True if *url* belongs to a production host, not this Replit dev instance.

    On Replit, REPLIT_DEV_DOMAIN is set to the dev proxy host (e.g.
    ``abc123-username.replit.dev``). Any webhook whose URL does NOT start with
    ``https://<replit_domain>`` is considered a production/foreign webhook that
    this polling instance must NOT touch.
    """
    if not replit_domain:
        return False
    return not url.startswith(f"https://{replit_domain}")


async def _keep_webhook_deleted(bot: Any, slug: str, replit_domain: str) -> None:
    """Background task: re-delete webhook every 45 s in polling mode.

    **IMPORTANT — dev-only guard.**
    This coroutine is only ever started from the ``not USE_WEBHOOK`` branch of
    ``run_bot``, so it never runs in production (where ``USE_WEBHOOK=1``).

    Production-safe: if the detected webhook URL points to a non-Replit host
    (detected via REPLIT_DEV_DOMAIN), this task logs a warning and skips
    deletion — it will NOT destroy the production webhook.
    """
    while True:
        await asyncio.sleep(45)
        try:
            info = await bot.get_webhook_info()
            if info.url:
                if _is_production_webhook(info.url, replit_domain):
                    logger.warning(
                        "%s: production webhook detected (%r) — skipping deletion "
                        "to protect production. Stop this Replit workflow to end the conflict.",
                        slug, info.url,
                    )
                else:
                    logger.warning(
                        "%s: stale dev webhook detected (%r) — re-deleting to restore polling",
                        slug, info.url,
                    )
                    await bot.delete_webhook(drop_pending_updates=False)
        except Exception as exc:
            logger.debug("%s: keep_webhook_deleted check error: %s", slug, exc)


async def _heartbeat_loop(slug: str, interval: int = 30) -> None:
    """Best-effort liveness ping to the central hub.

    Posts to ``/internal/heartbeat`` every ``interval`` seconds so the
    super-admin panel can show this out-of-process Python bot as online /
    offline. Self-contained (no client import) so all five bot copies of this
    file stay byte-identical. Never raises — a flaky network must never kill
    the bot.

    The API key is read from ``<SLUG>_API_KEY`` (e.g. ``MOTHER_BOT_API_KEY``)
    derived from the slug, matching the secret each bot already uses.
    """
    import httpx

    env_key = slug.upper().replace("-", "_") + "_API_KEY"
    api_key = (os.getenv(env_key) or "").strip()
    if not api_key:
        logger.warning("%s: %s not set — heartbeat disabled", slug, env_key)
        return
    base = (os.getenv("MOTHER_API_URL") or "http://localhost:80/api").rstrip("/")
    url = f"{base}/internal/heartbeat"
    headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}
    while True:
        try:
            async with httpx.AsyncClient() as http:
                await http.post(url, json={"status": "online"}, headers=headers, timeout=5.0)
        except Exception as exc:
            logger.debug("%s: heartbeat failed: %s", slug, exc)
        await asyncio.sleep(interval)


async def run_bot(bot: Any, dp: Any, slug: str) -> None:
    """Run `bot` under `dp` either as polling or webhook.

    Returns only when the bot is shut down (Ctrl-C / SIGTERM).
    """
    allowed = dp.resolve_used_update_types()

    # Liveness heartbeat — runs in both polling and webhook modes.
    asyncio.ensure_future(_heartbeat_loop(slug))

    if not _truthy(os.getenv("USE_WEBHOOK")):
        replit_domain = (os.getenv("REPLIT_DEV_DOMAIN") or "").strip()
        logger.info(f"{slug}: starting polling (USE_WEBHOOK not set)")

        # Check for an active webhook BEFORE wiping it.
        # If it points to a production host, abort polling so we don't break prod.
        try:
            info = await bot.get_webhook_info()
            if info.url and _is_production_webhook(info.url, replit_domain):
                logger.error(
                    "%s: ABORT POLLING — production webhook is active (%r). "
                    "Running polling alongside a live production webhook would destroy it. "
                    "Stop this Replit workflow, or deploy with USE_WEBHOOK=1.",
                    slug, info.url,
                )
                return
            if info.url:
                await bot.delete_webhook(drop_pending_updates=False)
        except Exception as e:
            logger.warning(f"{slug}: pre-poll webhook check failed: {e}")

        asyncio.ensure_future(_keep_webhook_deleted(bot, slug, replit_domain))
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
