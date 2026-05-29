"""
Sweep-bot copy of the MotherBotClient SDK.

Mirrors `artifacts/mother-bot/src/client.py` so this bot can talk to the
central financial hub (X-Bot-Api-Key auth, BotTexts cache, upsert/credit/debit
plus sweep-specific endpoints under /internal/sweep/*).
"""
import asyncio
import time
from typing import Optional

import httpx


class BotTexts:
    """In-process cache of /superadmin-published bot copy (60s TTL by default)."""

    def __init__(self, client: "SweepBotClient", bot_slug: str, ttl_seconds: int = 60):
        self._client = client
        self._bot_slug = bot_slug
        self._ttl = ttl_seconds
        self._cache: dict[str, str] = {}
        self._fetched_at: float = 0.0
        self._lock = asyncio.Lock()

    async def _refresh(self) -> None:
        try:
            async with httpx.AsyncClient() as http:
                resp = await http.get(
                    f"{self._client.base_url}/internal/bot-texts",
                    params={"botSlug": self._bot_slug},
                    headers=self._client.headers,
                    timeout=5.0,
                )
                resp.raise_for_status()
                self._cache = (resp.json() or {}).get("texts", {}) or {}
                self._fetched_at = time.time()
        except Exception:
            # Keep last good cache; bump timestamp so we don't hammer the API.
            self._fetched_at = time.time()

    async def get(self, key: str, default: str = "") -> str:
        if time.time() - self._fetched_at > self._ttl:
            async with self._lock:
                if time.time() - self._fetched_at > self._ttl:
                    await self._refresh()
        return self._cache.get(key, default)

    def invalidate(self) -> None:
        self._fetched_at = 0.0


class SweepBotClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:80/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

    def texts(self, bot_slug: str = "sweep-bot", ttl_seconds: int = 60) -> BotTexts:
        return BotTexts(self, bot_slug=bot_slug, ttl_seconds=ttl_seconds)

    async def upsert_user(self, user) -> dict:
        """Register or update a user. Call on every /start interaction.

        Does NOT send languageCode — preserves the user's explicit /lang choice.
        set_user_lang() in i18n.py is the only path that should write it.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/users/upsert",
                json={
                    "telegramId": str(user.id),
                    "username": user.username,
                    "firstName": user.first_name or "User",
                    "lastName": user.last_name,
                    "isPremium": bool(getattr(user, "is_premium", False)),
                },
                headers=self.headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_wallet(self, telegram_id: str) -> Optional[dict]:
        """Return user info + wallet. Returns None on 404."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/users/{telegram_id}",
                headers=self.headers,
                timeout=10.0,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    # ── Stars payment flow ─────────────────────────────────────────────────

    async def stars_invoice(self, telegram_id: str, amount_stars: int) -> dict:
        """
        POST /internal/stars-invoice
        Creates a Telegram Stars invoice.
        Returns {invoiceLink, expectedSkz, referenceId}.
        Raises httpx.HTTPStatusError on 4xx/5xx (including 403 for blocked users).
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/stars-invoice",
                json={"telegramId": str(telegram_id), "amountStars": amount_stars},
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def stars_confirm(
        self,
        telegram_id: str,
        payload: str,
        amount_stars: int,
        telegram_charge_id: str,
        provider_charge_id: str,
    ) -> dict:
        """
        POST /internal/stars-confirm
        Confirm a successful_payment event and credit the user's wallet.
        Idempotent — safe to retry if the network hiccups.
        Returns {creditedSkz, newSkzBalance}.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/stars-confirm",
                json={
                    "telegramId": str(telegram_id),
                    "payload": payload,
                    "amountStars": amount_stars,
                    "telegramChargeId": telegram_charge_id,
                    "providerChargeId": provider_charge_id,
                },
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    # ── TON / USDT on-chain deposit intent ────────────────────────────────

    async def ton_deposit_intent(self, telegram_id: str, amount_ton: float) -> Optional[dict]:
        """
        POST /internal/ton-deposit-intent
        Reserve a unique deposit address + memo for `amount_ton` TON.
        Returns {depositAddress, memo, amount, expectedSkz} or None on failure.
        Raises httpx.HTTPStatusError on 403 (blocked user).
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/ton-deposit-intent",
                json={"telegramId": str(telegram_id), "amountTon": amount_ton},
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def usdt_deposit_intent(self, telegram_id: str, amount_usdt: float) -> Optional[dict]:
        """
        POST /internal/usdt-deposit-intent
        Reserve a unique deposit address + memo for `amount_usdt` USDT.
        Returns {depositAddress, memo, amount, expectedSkz} or None on failure.
        Raises httpx.HTTPStatusError on 403 (blocked user).
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/usdt-deposit-intent",
                json={"telegramId": str(telegram_id), "amountUsdt": amount_usdt},
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    # ── Sweep-specific endpoints ───────────────────────────────────────────

    async def get_current_lotto(self) -> Optional[dict]:
        """
        GET /internal/sweep/lotto/current
        Returns the active lotto draw or None if none active.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/internal/sweep/lotto/current",
                headers=self.headers,
                timeout=10.0,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    async def get_my_tickets(
        self,
        telegram_id: str,
        limit: int = 5,
        draw_id: Optional[int] = None,
    ) -> list[dict]:
        """
        GET /internal/sweep/my-tickets
        Returns the user's most recent game tickets with results.
        """
        params: dict = {"telegramId": str(telegram_id), "limit": limit}
        if draw_id is not None:
            params["drawId"] = draw_id
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/internal/sweep/my-tickets",
                params=params,
                headers=self.headers,
                timeout=10.0,
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return data.get("tickets", [])
