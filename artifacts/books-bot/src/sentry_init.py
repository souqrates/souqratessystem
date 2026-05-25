"""
Sentry bootstrap shared by all Python bots.

Reads DSN from the API's /internal/runtime/sentry endpoint so the admin
only has to paste the DSN once in /integrations — no duplicate env vars
across 3 bot processes. Silent no-op if Sentry isn't enabled, so dev
environments without Sentry still work.

Usage: call init_sentry(bot_name="mother-bot") at the very top of bot.py,
BEFORE importing any module that might raise.
"""
import os
import logging

import httpx
import sentry_sdk

logger = logging.getLogger(__name__)


def init_sentry(bot_name: str) -> bool:
    """
    Init Sentry from the API integrations panel.
    Returns True if successfully initialised, False otherwise.
    Never raises — Sentry must never break the bot.
    """
    api_url = os.getenv("MOTHER_API_URL", "http://localhost:80/api").rstrip("/")
    api_key = os.getenv(f"{bot_name.upper().replace('-', '_')}_API_KEY") \
              or os.getenv("MOTHER_BOT_API_KEY", "")
    if not api_key:
        logger.info("Sentry init skipped: no bot API key in env")
        return False
    try:
        resp = httpx.get(
            f"{api_url}/internal/runtime/sentry",
            headers={"X-Bot-Api-Key": api_key},
            timeout=5.0,
        )
        if resp.status_code != 200:
            logger.info("Sentry init skipped: API returned %d", resp.status_code)
            return False
        data = resp.json()
        if not data.get("enabled"):
            logger.info("Sentry not enabled in admin panel — skipping")
            return False
        dsn = data.get("dsn")
        if not dsn:
            return False
        sentry_sdk.init(
            dsn=dsn,
            environment=data.get("environment", "production"),
            traces_sample_rate=float(data.get("traces_sample_rate", 0) or 0),
            # Tag every event with which bot raised it.
            release=bot_name,
            before_send=_scrub,
        )
        sentry_sdk.set_tag("bot", bot_name)
        logger.info("Sentry initialised for %s", bot_name)
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning("Sentry init failed (non-fatal): %s", e)
        return False


def _scrub(event, hint):  # type: ignore[no-untyped-def]
    """Strip auth headers before sending to Sentry."""
    req = event.get("request") or {}
    headers = req.get("headers") or {}
    for h in ("authorization", "x-bot-api-key", "cookie"):
        headers.pop(h, None)
        headers.pop(h.title(), None)
    return event
