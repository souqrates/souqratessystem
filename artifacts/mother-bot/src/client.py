"""
Mother Bot API Client
Used by child bots to interact with the central financial hub.
Copy this file to each child bot project.
"""
import httpx
import os
from typing import Optional


class MotherBotClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:80/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

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
