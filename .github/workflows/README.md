# دليل النشر التلقائي (GitHub Actions → Contabo)

كل مرة تدفع كود إلى GitHub، الخادم يحدّث نفسه تلقائياً خلال ~5 دقائق.

## ⚙️ إعداد لمرّة واحدة

### 1. أنشئ مستخدم نشر على الخادم (مرة واحدة، عبر SSH)

```bash
ssh root@194.163.155.52
adduser --disabled-password --gecos "" souq
usermod -aG docker souq
mkdir -p /home/souq/.ssh /opt/souqrates
chown -R souq:souq /home/souq/.ssh /opt/souqrates
chmod 700 /home/souq/.ssh
```

### 2. أنشئ مفتاح SSH خاص بـ GitHub (على جهازك أو في Replit shell)

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/souqrates_deploy -N ""
cat ~/.ssh/souqrates_deploy.pub        # ← انسخ هذا
```

ثم على الخادم:
```bash
echo "<الصق المفتاح العام هنا>" >> /home/souq/.ssh/authorized_keys
chown souq:souq /home/souq/.ssh/authorized_keys
chmod 600 /home/souq/.ssh/authorized_keys
```

### 3. التقط بصمة الخادم (مهم — يمنع هجمات MITM)

من جهازك:
```bash
ssh-keyscan -t ed25519 -p 22 194.163.155.52
# يعطيك سطراً مثل:
# 194.163.155.52 ssh-ed25519 AAAAC3Nz...
```
انسخ السطر بالكامل واحفظه في الـ secret `CONTABO_HOSTKEY` (الخطوة التالية).

### 4. احفظ Secrets في GitHub

اذهب إلى مستودعك → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** وأضف:

| Secret | القيمة | إجباري؟ |
|---|---|---|
| `CONTABO_HOST` | `194.163.155.52` | ✅ |
| `CONTABO_USER` | `souq` | ✅ |
| `CONTABO_SSH_KEY` | محتوى `~/.ssh/souqrates_deploy` (يبدأ بـ `-----BEGIN OPENSSH PRIVATE KEY-----`) | ✅ |
| `CONTABO_HOSTKEY` | ناتج `ssh-keyscan` من الخطوة 3 | ✅ — يمنع MITM |
| `CONTABO_PORT` | `22` | اختياري |

### 5. أنشئ ملف `.env` على الخادم (مرة واحدة)

```bash
ssh souq@194.163.155.52
mkdir -p /opt/souqrates/infra
nano /opt/souqrates/infra/.env
```

الصق محتوى `infra/.env.example` واملأ كل القيم الفارغة.

---

## 🚀 كيف تنشر بعد ذلك؟

### الطريقة 1: تلقائياً عند الـ push
```bash
git push origin main
```
ستجد التقدّم في تبويب **Actions** على GitHub.

### الطريقة 2: نشر يدوي بضغطة زر
1. اذهب إلى **Actions** على GitHub
2. اضغط **Deploy to Contabo** (يسار)
3. اضغط **Run workflow** (أعلى يمين)
4. اختر `main` ثم **Run workflow**

### الطريقة 3: نشر إعادة بناء كامل (لو شيء غريب يحدث)
نفس الطريقة 2، لكن فعّل ☑ "إعادة البناء من الصفر".

---

## 📊 مراقبة النشر

في تبويب **Actions** كل run يعرض:
- ✅ Typecheck (بوابة جودة — يمنع كود معطوب من الوصول للخادم)
- ✅ Sync (rsync للملفات)
- ✅ Build & restart (docker compose)
- ✅ Health check (يتأكد API يستجيب)
- ✅ Summary (الرابط النهائي)

إذا فشل أي step، النشر يتوقّف ولا تتأذّى البيئة الحيّة.

---

## 🛟 الـ rollback (التراجع للإصدار السابق)

### الطريقة الأسرع (من جهازك — تنشر تلقائياً)
```bash
git revert HEAD       # ينشئ commit عكسي للأخير
git push origin main  # GitHub Actions ينشره خلال ~5 دقائق
```

### الطريقة اليدوية على الخادم (إن كان GitHub معطّلاً)
كل نشر يترك بصمة في `/opt/souqrates/.deployed-sha`. خطوات الرجوع:

```bash
ssh souq@194.163.155.52
cd /opt/souqrates
cat .deployed-sha .deployed-at    # شاهد آخر نشر
git log --oneline -10             # شاهد آخر 10 commits
git checkout <COMMIT_HASH_للنسخة_السابقة>
cd infra && docker compose up -d --build
```

> **ملاحظة**: مجلد `.git/` محفوظ على الخادم تلقائياً (يُنقل بـ rsync مع كل نشر).
> هذا يجعل الـ rollback ممكناً حتى لو GitHub معطّل.
