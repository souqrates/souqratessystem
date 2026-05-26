"""
Contests-bot copy of the MotherBotClient SDK.

Mirrors `artifacts/mother-bot/src/client.py` so this bot can talk to the
central financial hub (X-Bot-Api-Key auth, BotTexts cache, upsert/credit/debit
plus the contests-specific endpoints under /internal/contests/*).
"""
import asyncio
import time
from typing import Optional

import httpx


class BotTexts:
    """In-process cache of /superadmin-published bot copy (60s TTL by default)."""

    def __init__(self, client: "ContestsBotClient", bot_slug: str, ttl_seconds: int = 60):
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


class ContestsBotClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:80/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

    def texts(self, bot_slug: str = "contests-bot", ttl_seconds: int = 60) -> BotTexts:
        return BotTexts(self, bot_slug=bot_slug, ttl_seconds=ttl_seconds)

    async def upsert_user(self, user) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/internal/users/upsert",
                # No `languageCode` — preserves the user's explicit /lang
                # choice across routine upserts. set_user_lang() in i18n.py
                # is the only path that should write it.
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

    # ── Contests public ─────────────────────────────────────────────────
    async def get_active_contest(self) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/contests/active", timeout=10.0)
            r.raise_for_status()
            return r.json()

    async def get_leaderboard(self, contest_id: int) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/contests/{contest_id}/leaderboard", timeout=10.0)
            r.raise_for_status()
            return r.json()

    async def list_packs(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/contests/packs", timeout=10.0)
            r.raise_for_status()
            return r.json()

    # ── Contests internal (require API key) ────────────────────────────
    async def cast_vote(self, telegram_id: str, contest_id: int, contestant_id: int,
                        vote_count: int = 1) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/internal/contests/vote",
                json={
                    "telegramId": str(telegram_id),
                    "contestId": contest_id,
                    "contestantId": contestant_id,
                    "votes": vote_count,
                },
                headers=self.headers,
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()

    async def purchase_pack(self, telegram_id: str, pack_id: int) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/internal/contests/purchase-pack",
                json={"telegramId": str(telegram_id), "packId": pack_id},
                headers=self.headers,
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()

    async def my_balance(self, telegram_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/internal/contests/my",
                params={"telegramId": str(telegram_id)},
                headers=self.headers,
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json()

    async def grant_download(self, telegram_id: str, grant_id: int) -> dict:
        """Backend responds with HTTP 302 → Location: <signed file URL>.

        We disable auto-follow so we can extract the URL and surface it to the
        user as a clickable link instead of streaming the file through the bot.
        """
        async with httpx.AsyncClient(follow_redirects=False) as client:
            r = await client.get(
                f"{self.base_url}/internal/contests/grants/{grant_id}/download",
                params={"telegramId": str(telegram_id)},
                headers=self.headers,
                timeout=10.0,
            )
            if r.status_code in (301, 302, 303, 307, 308):
                loc = r.headers.get("location")
                if not loc:
                    raise httpx.HTTPStatusError(
                        "Redirect without Location header", request=r.request, response=r,
                    )
                return {"downloadUrl": loc}
            r.raise_for_status()
            # Defensive: backend might still return JSON in some edge cases.
            try:
                return r.json()
            except Exception:
                return {"downloadUrl": None}
