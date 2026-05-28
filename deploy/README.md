# SOUQRATES — Contabo VPS deploy

كل ما تحتاجه لتشغيل المنصة على خادم Contabo (`194.163.155.52`) بنطاق
`souqrates.com` متصل بـ Neon Postgres + Cloudflare R2 + Cloudflare DNS.

## محتويات هذا المجلد

```
deploy/
├── README.md                 ← هذا الملف
├── systemd/                  ← 5 وحدات systemd (api + 4 بوتات)
│   ├── souqrates-api.service
│   ├── souqrates-mother-bot.service
│   ├── souqrates-books-bot.service
│   ├── souqrates-contests-bot.service
│   └── souqrates-subagents-bot.service
├── nginx/
│   └── souqrates.conf        ← server block واحد لكل الـ artifacts
├── env/                      ← قوالب متغيرات بيئة (.example)
│   ├── api-server.env.example
│   ├── mother-bot.env.example
│   ├── books-bot.env.example
│   ├── contests-bot.env.example
│   └── subagents-bot.env.example
└── scripts/
    ├── install.sh                    ← التثبيت الأولي (يُشغّل مرة واحدة)
    ├── setup-ssl.sh                  ← تفعيل HTTPS + UFW + خدمات + seed DB (بعد install.sh)
    ├── activate-subagents-bot.sh     ← تفعيل subagents-bot على خادم شغّال
    └── deploy.sh                     ← تحديثات لاحقة (git pull + rebuild + restart)
```

---

## الخريطة الكاملة (المعمار على VPS)

```
                         Cloudflare DNS (souqrates.com → 194.163.155.52)
                                       │
                          ┌────────────┴────────────┐
                          │  nginx (443 + 80)       │
                          └────────────┬────────────┘
                                       │
   ┌────────────┬─────────────┬────────┴────────┬─────────────┬─────────────┐
   │            │             │                 │             │             │
/api/*   /superadmin/*   /books-bot-web/* …  /telegram-webhook/<slug>     /
   │            │             │                 │
   ▼            ▼             ▼                 ▼
8080 node   static (vite dist)            8101-8104 aiohttp (python bots)
api-server                                 ┌─ 8101 mother-bot
                                           ├─ 8102 books-bot
                                           ├─ 8103 contests-bot
                                           └─ 8104 subagents-bot
   │
   ▼
 Neon Postgres (Frankfurt)
 Cloudflare R2 (S3-compatible)
```

5 خدمات systemd تعمل تحت مستخدم `souqrates` غير privileged، nginx يُنهي TLS
ويوجّه الطلبات. كل بوت يسجّل webhook خاص به مع Telegram أوتوماتيكياً عند
الإقلاع.

---

## أول مرة: التشغيل من الصفر

### 0. متطلبات مسبقة (على Replit / محلياً)
- Push الكود لـ GitHub. حدّث متغير `REPO_URL` في رأس `install.sh`.
- جهّز قاعدة Neon Postgres جديدة في Frankfurt → خذ الـ connection string.
- جهّز Cloudflare R2 bucket → خذ Access Key + Secret + Bucket Name.
- في BotFather: تأكد أنك تملك tokens الـ 4 بوتات.

### 1. على VPS كـ root
```bash
ssh root@194.163.155.52

# سحب الكود مؤقتاً فقط لتشغيل install.sh
git clone --depth=1 https://github.com/souqrates/souqratessystem.git /tmp/repo
bash /tmp/repo/deploy/scripts/install.sh
# (السكربت سيكرّر الـ clone لمكانه النهائي /opt/souqrates/repo)
```

السكربت يثبّت كل شيء، يبني كل الـ artifacts، ينسخ الـ static إلى
`/var/www/souqrates/`، وينشئ Python venvs للبوتات.

### 2. عبئ ملفات البيئة
بعد انتهاء `install.sh`، تجد 5 ملفات نموذجية في `/etc/souqrates/`:
```bash
nano /etc/souqrates/api-server.env       # DATABASE_URL, ADMIN_TOKEN, R2, …
nano /etc/souqrates/mother-bot.env
nano /etc/souqrates/books-bot.env
nano /etc/souqrates/contests-bot.env
nano /etc/souqrates/subagents-bot.env
```

**مهم:** `WEBHOOK_SECRET` يجب أن يكون عشوائياً ≥16 حرف (يفضّل 32+). يمكن
استخدام:
```bash
openssl rand -hex 24    # ينتج 48 حرف hex
```

**مهم:** `MOTHER_BOT_API_KEY` وما يماثله يجب أن **يطابق** القيم في
`api-server.env`. ولّد قيماً جديدة (لا تستعمل قيم Replit القديمة).

### 3. ادفع الـ schema لقاعدة Neon
```bash
cd /opt/souqrates/repo
sudo -u souqrates bash -lc \
  'DATABASE_URL=$(grep ^DATABASE_URL /etc/souqrates/api-server.env | cut -d= -f2-) \
   pnpm --filter @workspace/db run push'
```

### 4. شهادة TLS + خدمات + seed (setup-ssl.sh)

⚠ **قبل التشغيل:** حوّل `souqrates.com` و `www.souqrates.com` A records في
Cloudflare إلى `194.163.155.52` مع **orange cloud OFF** (DNS only) مؤقتاً —
certbot يحتاج http-01 مباشراً. يمكنك تفعيل orange cloud بعد نجاح الشهادة.

```bash
# يُنفّذ كـ root — استبدل your@email.com ببريدك الحقيقي
CERTBOT_EMAIL=your@email.com bash /opt/souqrates/repo/deploy/scripts/setup-ssl.sh
```

السكربت يقوم بالخطوات التالية تلقائياً:
1. يتحقق من DNS + nginx
2. يُصدر شهادة Let's Encrypt (certbot) ويُعيد تحميل nginx
3. يُفعّل جدار الحماية UFW (منافذ 22, 80, 443)
4. يُشغّل ويُمكّن جميع الـ 5 خدمات systemd
5. يُسجّل البوتات في DB (`seed_bots.py`)
6. يُجري فحوصات صحية شاملة (HTTPS + webhook per-bot)

خيارات اختيارية:
```bash
CERTBOT_STAGING=1  # استخدم بيئة اختبار Let's Encrypt أولاً (لا تثق بها المتصفحات)
SKIP_SEED=1        # تجاهل seed إذا سبق تسجيل البوتات
SKIP_UFW=1         # تجاهل UFW إذا يديره firewall آخر
```

**واجب بعد نجاح الشهادة:**
- فعّل orange cloud في Cloudflare للحماية CDN/WAF
- أضف Cache Rule: `souqrates.com/telegram-webhook/*` → Cache Level: Bypass

### 5. فحص يدوي (اختياري بعد setup-ssl.sh)
```bash
curl -sfS https://souqrates.com/api/healthz
curl -sfS http://127.0.0.1:8101/telegram-webhook/mother-bot/healthz
journalctl -u souqrates-mother-bot -f
```

ثم على Telegram من حسابك الشخصي: `/start` لكل بوت — يجب أن يردّ فوراً.

---

## تفعيل subagents-bot على خادم شغّال (الحالة الحالية)

إذا كانت البوتات الأخرى (mother-bot, books-bot, contests-bot) تعمل بالفعل
وتريد إضافة subagents-bot فقط، استخدم السكربت المخصص:

```bash
ssh root@194.163.155.52

# 1. git pull لتحديث الكود
sudo -u souqrates git -C /opt/souqrates/repo pull

# 2. عبّئ ملف البيئة إذا لم يكن موجوداً
cp /opt/souqrates/repo/deploy/env/subagents-bot.env.example /etc/souqrates/subagents-bot.env
chmod 640 /etc/souqrates/subagents-bot.env
nano /etc/souqrates/subagents-bot.env
# ↑ أدخل: SUBAGENTS_BOT_TOKEN, SUBAGENTS_BOT_API_KEY, MOTHER_BOT_USERNAME,
#         WEBHOOK_SECRET (openssl rand -hex 24), باقي الحقول كما هي

# 3. شغّل سكربت التفعيل
bash /opt/souqrates/repo/deploy/scripts/activate-subagents-bot.sh
```

السكربت يقوم تلقائياً بـ:
1. التحقق من ملف البيئة (يرفض إذا كان به placeholders)
2. إنشاء Python venv وتثبيت المتطلبات (بما فيها `sentry-sdk`)
3. تثبيت وتمكين وتشغيل `souqrates-subagents-bot.service`
4. تسجيل البوت في قاعدة البيانات عبر `seed_bots.py`
5. الانتظار حتى يكون healthz endpoint جاهزاً (`:8104`)
6. التحقق من إمكانية الوصول لـ `https://souqrates.com/telegram-webhook/subagents-bot`
7. التحقق من تسجيل الـ webhook مع Telegram عبر `getWebhookInfo`

للتحقق اليدوي بعد التفعيل:
```bash
# حالة الخدمة
systemctl status souqrates-subagents-bot

# سجل الأحداث
journalctl -u souqrates-subagents-bot -f

# فحص صحي داخلي
curl http://127.0.0.1:8104/telegram-webhook/subagents-bot/healthz

# التحقق من webhook مع Telegram
curl -s "https://api.telegram.org/bot$(grep ^SUBAGENTS_BOT_TOKEN /etc/souqrates/subagents-bot.env | cut -d= -f2-)/getWebhookInfo" | python3 -m json.tool
```

---

## التحديثات اللاحقة (بعد أي تعديل في الكود)

```bash
ssh root@194.163.155.52
bash /opt/souqrates/repo/deploy/scripts/deploy.sh
```
يقوم بـ: `git pull` + `pnpm install` + `typecheck` + build كل الـ artifacts
+ rsync الـ static + إعادة تثبيت Python deps إذا تغيّر `requirements.txt` +
restart للخدمات + فحص صحي.

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---|---|
| البوت لا يردّ | `journalctl -u souqrates-<bot> -n 100 --no-pager` — إذا ظهر `set_webhook` failed: تأكد من `WEBHOOK_BASE_URL` HTTPS + شهادة TLS صالحة. |
| nginx 502 | تأكد أن الخدمة شغّالة على المنفذ الصحيح: `ss -lntp \| grep 8101`. |
| api يفشل | `journalctl -u souqrates-api -n 100` — أغلب الأخطاء = `DATABASE_URL` غلط أو `SESSION_SECRET` غير مضبوط. |
| Telegram يقول "Bad Request: webhook URL must be HTTPS" | شهادة TLS لم تُصدر بعد. شغّل certbot أولاً. |
| المستخدم يرى صفحة Mini App قديمة | امسح cache CDN لـ `/superadmin/`, `/books-bot-web/`, إلخ. |

---

## استرجاع طارئ (rollback)

```bash
# عودة لمراجعة git سابقة
cd /opt/souqrates/repo
sudo -u souqrates git log --oneline -10
sudo -u souqrates git reset --hard <COMMIT_HASH>
bash deploy/scripts/deploy.sh
```

لإيقاف كل شيء بسرعة:
```bash
systemctl stop souqrates-api.service \
               souqrates-mother-bot.service \
               souqrates-books-bot.service \
               souqrates-contests-bot.service \
               souqrates-subagents-bot.service
```
