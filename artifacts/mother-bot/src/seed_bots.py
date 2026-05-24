"""
Script to seed the 6 child bots in the database.
Run this once after setting up the server.
"""
import asyncio
import httpx

API_URL = "http://localhost:80/api"

BOTS = [
    {
        "slug": "games-bot",
        "name": "SOUQRATES SKILLZ",
        "description": "ألعاب المهارات مع رهانات ومكافآت",
        "commissionRate": "0.0800",
    },
    {
        "slug": "books-bot",
        "name": "SOUQRATES SOUQ",
        "description": "متجر الكتب والمنتجات الرقمية مع لوحة نشر للمؤلفين",
        "commissionRate": "0.1000",
    },
    {
        "slug": "video-bot",
        "name": "SOUQRATES SCENE",
        "description": "منصة فيديو قصير مع أرباح للمنشئين",
        "commissionRate": "0.1000",
    },
    {
        "slug": "voice-bot",
        "name": "SOUQRATES STREAM",
        "description": "غرف صوتية مدفوعة ومجانية",
        "commissionRate": "0.1000",
    },
    {
        "slug": "ai-bot",
        "name": "SOUQRATES SIGNAL",
        "description": "توليد نصوص وصور وفيديوهات بالذكاء الاصطناعي",
        "commissionRate": "0.1200",
    },
    {
        "slug": "contests-bot",
        "name": "SOUQRATES STAGE",
        "description": "مسابقات وتصويت وجوائز",
        "commissionRate": "0.0800",
    },
]


async def seed():
    async with httpx.AsyncClient() as client:
        for bot in BOTS:
            try:
                resp = await client.post(
                    f"{API_URL}/bots",
                    json=bot,
                    timeout=10.0,
                )
                if resp.status_code == 201:
                    data = resp.json()
                    print(f"✅ {bot['name']}")
                    print(f"   Slug: {data['slug']}")
                    print(f"   API Key: {data['apiKey']}")
                    print()
                else:
                    print(f"⚠️  {bot['name']}: {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"❌ {bot['name']}: {e}")


if __name__ == "__main__":
    asyncio.run(seed())
