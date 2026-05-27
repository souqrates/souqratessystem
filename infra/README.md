# 🚀 دليل النشر على Contabo VPS

دليل خطوة بخطوة لرفع SOUQRATES SYSTEM على سيرفر Contabo Cloud VPS 20 جديد.
كل أمر تقدر تنسخه وتلصقه. اتبع الترتيب — لا تقفز خطوات.

---

## 📋 ما يجب أن يكون جاهزاً قبل أن نبدأ

| العنصر | كيف تحضّره |
|---|---|
| ✅ سيرفر Contabo Cloud VPS 20 | مشترَك. نظام **Ubuntu 24.04** (لو غيره: لوحة Contabo → Reinstall) |
| ✅ IP السيرفر + كلمة مرور root | وصلتك من Contabo بالإيميل |
| ⬜ دومين (souqrates.com مثلاً) | لو ما عندك: اشتر من Cloudflare Registrar (الأرخص) |
| ⬜ حساب Cloudflare | افتح على cloudflare.com (مجاناً) ونقل DNS الدومين إليه |
| ⬜ حساب Neon | افتح على neon.tech (مجاناً) → أنشئ Project باسم `souqrates` في **Frankfurt (eu-central-1)** |
| ⬜ R2 Bucket على Cloudflare | dash.cloudflare.com → R2 → Create bucket → `souqrates-prod` → R2 Tokens → Create API token (Object Read & Write) |

---

## الخطوة 1️⃣ — تجهيز السيرفر (10 دقائق، تشغّل مرة واحدة)

من جهازك (Mac / Windows PowerShell / Linux Terminal):

```bash
# انسخ سكربت التجهيز إلى السيرفر وشغّله
scp infra/setup-server.sh root@YOUR_SERVER_IP:/tmp/
ssh root@YOUR_SERVER_IP "bash /tmp/setup-server.sh"
```

السكربت يثبّت تلقائياً:
- Docker + Docker Compose
- جدار حماية ufw (يفتح 22, 80, 443 فقط)
- fail2ban (حماية SSH)
- مستخدم نشر اسمه `souq` (لا تستخدم root بعد الآن)
- swap 4GB
- تحديثات أمنية تلقائية

✅ **تأكيد النجاح:** آخر سطر يجب أن يكون `✅ Server ready`.

---

## الخطوة 2️⃣ — إعداد DNS على Cloudflare (5 دقائق)

في dash.cloudflare.com → الدومين → DNS → Add record:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `api` | `YOUR_SERVER_IP` | 🟠 Proxied |
| A | `admin` | `YOUR_SERVER_IP` | 🟠 Proxied |
| A | `books` | `YOUR_SERVER_IP` | 🟠 Proxied |
| A | `contests` | `YOUR_SERVER_IP` | 🟠 Proxied |
| A | `games` | `YOUR_SERVER_IP` | 🟠 Proxied |
| A | `subagents` | `YOUR_SERVER_IP` | 🟠 Proxied |
| A | `tg` | `YOUR_SERVER_IP` | ⚪ DNS only |

> 🟠 = Proxy مفعّل (يخفي IP السيرفر + يعطي CDN/DDoS).
> ⚪ = DNS only لـ `tg` لأن Telegram يحتاج وصول مباشر للـ webhook.

ثم: SSL/TLS → Overview → اختر **Full (strict)**.

---

## الخطوة 3️⃣ — نقل قاعدة البيانات إلى Neon (15 دقيقة)

### 3.1 أخذ snapshot من Replit

من Replit Shell:
```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl --clean --if-exists > /tmp/souqrates_snapshot.sql
```

نزّل الملف إلى جهازك (Files panel → /tmp/souqrates_snapshot.sql → Download).

### 3.2 إنشاء قاعدة Neon

1. neon.tech → New Project → اسم `souqrates`، Region: **eu-central-1 (Frankfurt)**.
2. انسخ Connection string (الـ **pooled**) من Dashboard.
3. ارفع الـ snapshot:

```bash
psql "postgresql://USER:PASS@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require" < souqrates_snapshot.sql
```

---

## الخطوة 4️⃣ — رفع المشروع وتشغيله (10 دقائق)

### 4.1 من جهازك المحلي (أو من Replit Shell):

```bash
# ادخل كمستخدم souq (ليس root)
ssh souq@YOUR_SERVER_IP

# على السيرفر:
sudo chown souq:souq /opt/souqrates
exit
```

### 4.2 ارفع الكود من Replit:

```bash
# من جذر المستودع
rsync -avz --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
  --exclude '__pycache__' --exclude '.local' --exclude '.agents' \
  ./ souq@YOUR_SERVER_IP:/opt/souqrates/
```

### 4.3 جهّز ملف .env على السيرفر:

```bash
ssh souq@YOUR_SERVER_IP
cd /opt/souqrates/infra
cp .env.example .env
nano .env       # املأ كل القيم — انسخها من Replit Secrets
```

✋ **مهم جداً:** انسخ `MOTHER_BOT_TOKEN`, `*_API_KEY`, `SESSION_SECRET`, `ADMIN_TOKEN` **بنفس القيم** من Replit Secrets. تغييرها = كسر البوت.

### 4.4 شغّل كل شيء:

```bash
cd /opt/souqrates/infra
docker compose up -d --build
```

أوّل مرة تأخذ ~10 دقائق (يبني 6 صور). الصور التالية أسرع بكثير.

### 4.5 تحقّق:

```bash
docker compose ps           # كل الخدمات يجب أن تكون "running"
docker compose logs -f api  # لا errors
curl https://api.souqrates.com/api/healthz   # يجب يرجع {"ok":true}
```

---

## الخطوة 5️⃣ — التحوّل النهائي للبوت (5 دقائق downtime فقط)

> هذا الجزء يجب تنفيذه عند جاهزيتك الكاملة. قبل التنفيذ تأكد أن كل شيء يعمل على Hetzner من فحص يدوي.

### 5.1 على Replit: أوقف البوتات
```bash
# في Replit Shell
curl -X POST "https://api.telegram.org/bot$MOTHER_BOT_TOKEN/deleteWebhook"
# كرّر لكل بوت
```

### 5.2 على Contabo: فعّل الـ webhooks
```bash
ssh souq@YOUR_SERVER_IP
cd /opt/souqrates/infra
# هذا السكربت (سنكتبه في المرحلة B) يضبط webhooks تلقائياً
./scripts/set-webhooks.sh
```

### 5.3 تأكّد:
- أرسل رسالة للبوت الأم: يجب أن يرد فوراً.
- افتح لوحة الإدارة: `https://admin.souqrates.com`.
- جرّب شراء SKZ تجريبي.

### 5.4 أوقف خدمات Replit
- Deployments → Stop.
- البوت يعمل الآن 100% من Contabo. 🎉

---

## 🛠️ صيانة يومية

### إعادة النشر بعد تعديل الكود في Replit:
```bash
# من جذر المستودع المحلي:
echo "SERVER=souq@YOUR_SERVER_IP" > infra/.deploy.env
./infra/deploy.sh
```

### مراقبة الأداء:
```bash
ssh souq@YOUR_SERVER_IP
docker stats                          # CPU/RAM لكل خدمة
docker compose logs -f --tail=100 api # سجل API الحي
df -h                                 # مساحة القرص
```

### نسخ احتياطي يومي (إعداد cron):
```bash
ssh souq@YOUR_SERVER_IP
crontab -e
# أضف:
0 3 * * * docker exec souqrates-api-1 pg_dump $DATABASE_URL | gzip > /opt/backups/db-$(date +\%Y\%m\%d).sql.gz
```

---

## 🆘 حلّ المشاكل

| المشكلة | الحل |
|---|---|
| `docker compose up` يفشل في build | `docker compose build --no-cache <service>` |
| البوت لا يرد | `docker compose logs -f mother-bot` — تحقّق من TOKEN |
| API يرجع 502 | `docker compose restart api` |
| ssl_error | تحقّق Cloudflare → SSL/TLS = Full (strict) |
| القرص ممتلئ | `docker system prune -af --volumes` |

---

## 📞 ماذا أحتاج منك الآن لإكمال المرحلة B (فك ارتباط الكود)

أرسل لي:
1. **IP السيرفر** (لتجربة الاتصال)
2. **الدومين الذي تستخدمه** (souqrates.com أم آخر؟)
3. **هل أنشأت R2 bucket؟** (لأكتب كود الـ S3 storage المتوافق)
4. **هل أنشأت Neon project؟** (لأختبر الاتصال)

بعدها أبدأ مباشرة بـ:
- استبدال Replit Object Storage بـ S3 SDK يدعم R2.
- تحويل البوتات من polling إلى webhook mode.
- كتابة `scripts/set-webhooks.sh`.
- إضافة GitHub Actions للنشر التلقائي.
