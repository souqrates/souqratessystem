"""
SDK client for scratchy-bot to communicate with the central API server.
Mirrors the pattern used by contests-bot/client.py.
"""
import asyncio
import time
from typing import Optional

import httpx


class BotTexts:
    def __init__(self, client: "ScratchyBotClient", bot_slug: str, ttl_seconds: int = 60):
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
            self._fetched_at = time.time()

    async def get(self, key: str, default: str = "") -> str:
        if time.time() - self._fetched_at > self._ttl:
            async with self._lock:
                if time.time() - self._fetched_at > self._ttl:
                    await self._refresh()
        return self._cache.get(key, default)


class ScratchyBotClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:80/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

    def texts(self, bot_slug: str = "scratchy-bot", ttl_seconds: int = 60) -> BotTexts:
        return BotTexts(self, bot_slug=bot_slug, ttl_seconds=ttl_seconds)

    async def upsert_user(self, user) -> dict:
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

    async def charge_entry(
        self,
        telegram_id: str,
        game_id: str,
        entry_fee: float,
        card_num: int,
    ) -> dict:
        """Debit SKZ for a scratch card entry. Returns tx info."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/game/charge-entry",
                json={
                    "telegramId": telegram_id,
                    "gameId": game_id,
                    "entryFee": entry_fee,
                    "metadata": {"cardNum": card_num, "bot": "scratchy-bot"},
                },
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def validate_result(
        self,
        telegram_id: str,
        game_id: str,
        entry_tx_id: int,
        prize: float,
        won: bool,
    ) -> dict:
        """Validate game result and get a signed resultToken."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/game/validate-result",
                json={
                    "telegramId": telegram_id,
                    "gameId": game_id,
                    "entryTxId": entry_tx_id,
                    "prize": prize,
                    "won": won,
                },
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def credit_reward(
        self,
        telegram_id: str,
        game_id: str,
        result_token: str,
    ) -> dict:
        """Credit the prize to user wallet using the signed resultToken."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/game/credit-reward",
                json={
                    "telegramId": telegram_id,
                    "gameId": game_id,
                    "resultToken": result_token,
                },
                headers=self.headers,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def refund_entry(self, entry_tx_id: int, telegram_id: str) -> dict:
        """Refund an entry fee if the game failed unexpectedly."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/game/refund-entry",
                json={"entryTxId": entry_tx_id, "telegramId": telegram_id},
                headers=self.headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()
