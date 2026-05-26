"""
Books-bot copy of the MotherBotClient SDK.

Mirrors `artifacts/mother-bot/src/client.py` so this bot can talk to the
central financial hub (X-Bot-Api-Key auth, BotTexts cache, upsert/credit/debit
plus the books-specific endpoints under /internal/books/*).
"""
import asyncio
import os
import time
from typing import Optional

import httpx


class BotTexts:
    """In-process cache of /superadmin-published bot copy (60s TTL by default)."""

    def __init__(self, client: "BooksBotClient", bot_slug: str, ttl_seconds: int = 60):
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


class BooksBotClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:80/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

    def texts(self, bot_slug: str = "books-bot", ttl_seconds: int = 60) -> BotTexts:
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

    # ── Books-specific ──────────────────────────────────────────────────
    async def list_categories(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/books/categories", timeout=10.0)
            r.raise_for_status()
            return r.json().get("data", [])

    async def list_products(self, category_id: Optional[int] = None, q: Optional[str] = None,
                            limit: int = 10, offset: int = 0) -> dict:
        params: dict = {"limit": limit, "offset": offset}
        if category_id is not None:
            params["categoryId"] = category_id
        if q:
            params["q"] = q
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/books/products", params=params, timeout=10.0)
            r.raise_for_status()
            return r.json()

    async def get_product(self, product_id: int) -> Optional[dict]:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/books/products/{product_id}", timeout=10.0)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()

    async def request_upload_url(self, kind: str, content_type: str, size_bytes: int) -> dict:
        """Ask the api-server for a one-time signed GCS PUT URL + the persistent
        /objects/<id> path to store. `kind` is 'cover' or 'file'. The server
        validates MIME + size before issuing the URL, so a 4xx here means the
        upload would have been rejected anyway."""
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/internal/books/upload-url",
                json={"kind": kind, "contentType": content_type, "sizeBytes": size_bytes},
                headers=self.headers,
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json()

    async def submit_product(self, telegram_id: str, title: str, file_url: str, price_usdt: float,
                              description: str = "", cover_url: Optional[str] = None,
                              category_id: Optional[int] = None, file_size: int = 0) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/internal/books/products/submit",
                json={
                    "telegramId": str(telegram_id),
                    "title": title,
                    "description": description,
                    "coverUrl": cover_url,
                    "fileUrl": file_url,
                    "fileSize": file_size,
                    "priceUsdt": str(price_usdt),
                    "categoryId": category_id,
                },
                headers=self.headers,
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()

    async def purchase(self, telegram_id: str, product_id: int) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/internal/books/products/purchase",
                json={"telegramId": str(telegram_id), "productId": product_id},
                headers=self.headers,
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()

    async def my_library(self, telegram_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/internal/books/products/my",
                params={"telegramId": str(telegram_id)},
                headers=self.headers,
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json()

    async def resolve_download(self, token: str) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/internal/books/products/download/{token}",
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json()
