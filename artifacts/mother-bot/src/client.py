"""
Mother Bot API Client
Used by child bots to interact with the central financial hub.
Copy this file to each child bot project.
"""
import httpx
import os
import time
import asyncio
from typing import Optional


class BotTexts:
    """
    In-process cache of published bot copy from the super-admin panel.

    Usage:
        texts = BotTexts(client, bot_slug="mother", ttl_seconds=60)
        msg = await texts.get("welcome_message", default="مرحباً بك 👋")

    The cache refreshes lazily on first call after TTL expires, so any text
    published from /superadmin shows up in the bot within ~60 seconds without
    a restart. Network errors fall back to the previous cache (or the inline
    `default`) so the bot never crashes because the API is briefly down.

    Refreshes are serialized with an asyncio.Lock + double-checked TTL so a
    burst of concurrent get() calls only triggers ONE HTTP request, even
    under heavy update load (avoids thundering-herd against the API server).
    """

    def __init__(self, client: "MotherBotClient", bot_slug: str, ttl_seconds: int = 60):
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
                data = resp.json()
                # Only overwrite the cache once we've fully parsed the new
                # payload, so a mid-flight failure can never leave garbage.
                fresh = data.get("texts", {}) or {}
                self._cache = fresh
                self._fetched_at = time.time()
        except Exception:
            # Keep last good cache on failure; do not raise — bot must keep running.
            # Bump fetched_at so we don't hammer the API during an outage.
            self._fetched_at = time.time()

    async def get(self, key: str, default: str = "") -> str:
        """Return the published text for `key`, or `default` if not set."""
        if time.time() - self._fetched_at > self._ttl:
            async with self._lock:
                # Double-check inside the lock: another coroutine may have
                # refreshed while we were waiting.
                if time.time() - self._fetched_at > self._ttl:
                    await self._refresh()
        return self._cache.get(key, default)

    def invalidate(self) -> None:
        """Force the next get() to re-fetch (useful after a manual publish)."""
        self._fetched_at = 0.0


class MotherBotClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:80/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

    def texts(self, bot_slug: str, ttl_seconds: int = 60) -> "BotTexts":
        """
        Build a cached text bundle for the given bot slug. Reuse one instance
        for the lifetime of the bot — the cache is in-process and the TTL
        determines how quickly panel edits propagate.
        """
        return BotTexts(self, bot_slug=bot_slug, ttl_seconds=ttl_seconds)

    async def upsert_user(
        self,
        telegram_id: str,
        first_name: str,
        username: Optional[str] = None,
        last_name: Optional[str] = None,
        language_code: str = "ar",
        is_premium: bool = False,
        referrer_telegram_id: Optional[str] = None,
    ) -> dict:
        """Register or update a user. Call this every time a user interacts with your bot."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/users/upsert",
                json={
                    "telegramId": telegram_id,
                    "firstName": first_name,
                    "username": username,
                    "lastName": last_name,
                    "languageCode": language_code,
                    "isPremium": is_premium,
                    "referrerTelegramId": referrer_telegram_id,
                },
                headers=self.headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def credit(
        self,
        telegram_id: str,
        currency: str,  # "usdt", "stars", or "ton"
        amount: float,
        description: str,
        reference_id: Optional[str] = None,
    ) -> dict:
        """
        Credit a user's wallet. Commission is automatically deducted.
        Returns: {success, transactionId, newBalance, commissionDeducted}
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/credit",
                json={
                    "telegramId": telegram_id,
                    "currency": currency,
                    "amount": str(amount),
                    "description": description,
                    "referenceId": reference_id,
                },
                headers=self.headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def debit(
        self,
        telegram_id: str,
        currency: str,  # "usdt", "stars", or "ton"
        amount: float,
        description: str,
        reference_id: Optional[str] = None,
    ) -> dict:
        """
        Debit a user's wallet for purchases.
        Returns: {success, transactionId, newBalance}
        Raises: httpx.HTTPStatusError with 400 if insufficient balance
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/debit",
                json={
                    "telegramId": telegram_id,
                    "currency": currency,
                    "amount": str(amount),
                    "description": description,
                    "referenceId": reference_id,
                },
                headers=self.headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_user(self, telegram_id: str) -> Optional[dict]:
        """Get user info and wallet balance."""
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


# Usage example for child bots:
#
# from client import MotherBotClient
#
# client = MotherBotClient(
#     api_key=os.getenv("MOTHER_BOT_API_KEY"),
#     base_url=os.getenv("MOTHER_API_URL", "http://localhost:80/api")
# )
#
# # When user starts your bot:
# await client.upsert_user(str(user.id), user.first_name, user.username)
#
# # When user earns money in your bot:
# result = await client.credit(
#     telegram_id=str(user.id),
#     currency="usdt",
#     amount=5.0,
#     description="مكافأة مشاهدة إعلان",
#     reference_id=f"video_{video_id}"
# )
# print(f"New balance: {result['newBalance']}, Commission: {result['commissionDeducted']}")
#
# # When user buys something in your bot:
# try:
#     result = await client.debit(str(user.id), "usdt", 10.0, "شراء اشتراك")
# except httpx.HTTPStatusError as e:
#     if e.response.status_code == 400:
#         print("Insufficient balance!")
