# البوت الأم - Mother Bot

البوت الأم هو المركز المالي الذي يربط جميع البوتات الأخرى.

## المتطلبات

```bash
pip install -r requirements.txt
```

## المتغيرات البيئية

أضف هذه المتغيرات في Replit Secrets:

| المتغير | الوصف |
|---------|-------|
| `MOTHER_BOT_TOKEN` | توكن البوت الأم من @BotFather |
| `MOTHER_API_URL` | رابط الـ API (مثال: `https://your-domain.replit.app/api`) |
| `MOTHER_BOT_API_KEY` | مفتاح API الخاص بالبوت الأم (يُنشأ عند تسجيل البوت) |
| `ADMIN_IDS` | معرفات المشرفين مفصولة بفاصلة (مثال: `123456789,987654321`) |

## تشغيل البوت

```bash
python src/bot.py
```

## تسجيل البوت في النظام

بعد تشغيل الخادم، استخدم API لتسجيل البوت الأم وتوليد مفتاح API:

```bash
curl -X POST http://localhost:80/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "mother-bot",
    "name": "البوت الأم",
    "description": "المركز المالي الرئيسي",
    "commissionRate": "0.0500"
  }'
```

احفظ الـ `apiKey` من الرد واستخدمه كـ `MOTHER_BOT_API_KEY`.

## ربط البوتات الأخرى

انسخ ملف `src/client.py` إلى كل بوت فرعي واستخدمه:

```python
from client import MotherBotClient

mother = MotherBotClient(
    api_key="API_KEY_من_لوحة_التحكم",
    base_url="https://your-domain.replit.app/api"
)

# عند بدء المستخدم البوت
await mother.upsert_user(str(user.id), user.first_name, user.username)

# عند ربح المستخدم
result = await mother.credit(str(user.id), "usdt", 5.0, "مكافأة")

# عند شراء المستخدم
await mother.debit(str(user.id), "usdt", 10.0, "شراء اشتراك")
```

## هيكل البوتات

```
البوت الأم (هذا البوت)
├── بوت الألعاب       → slug: games-bot
├── بوت الفيديو       → slug: video-bot  
├── بوت الغرف الصوتية → slug: voice-bot
├── بوت الذكاء الاصطناعي → slug: ai-bot
├── المتجر الرقمي    → slug: store-bot
└── بوت المسابقات    → slug: contests-bot
```

## نظام العمولة

كل معاملة `credit` تخصم عمولة تلقائياً:
- المعدل الافتراضي: 10% (قابل للضبط لكل بوت)
- المستخدم يستلم: المبلغ - العمولة
- العمولة تُسجل في جدول `commissions`
