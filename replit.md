# البوت الأم - Mother Bot Platform

منصة بوتات تيليغرام متكاملة تضم 6 بوتات فرعية مرتبطة ببوت أم مالي مركزي.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `python3 artifacts/mother-bot/src/bot.py` — run the mother Telegram bot
- `python3 artifacts/mother-bot/src/seed_bots.py` — seed 6 child bots into DB
- Required env: `DATABASE_URL` — Postgres connection string (auto-set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Admin Dashboard: React + Vite + Tailwind (artifacts/admin-dashboard)
- Mother Bot: Python + aiogram 3 (artifacts/mother-bot)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — DB schema (users, wallets, transactions, bots, commissions, withdrawals)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/admin-dashboard/src/` — Admin dashboard React app
- `artifacts/mother-bot/src/bot.py` — Mother Telegram bot (Python/aiogram)
- `artifacts/mother-bot/src/client.py` — SDK for child bots to use

## Architecture decisions

- **Contract-first API**: OpenAPI spec gates all codegen; never hand-write types
- **Bot API key auth**: Each child bot has a unique API key stored in `bots` table; all internal financial ops require `X-Bot-Api-Key` header
- **Commission auto-deduction**: Every `credit` call automatically deducts commission and records it in `commissions` table; child bots receive gross, users receive net
- **Atomic wallet updates**: All balance changes use atomic SQL increments (`sql\`balance + ${n}\``) inside route handlers — no JS read-modify-write, no drift under concurrency
- **Single financial hub**: All 6 child bots share one wallet per user via `telegramId` lookup — no per-bot wallets
- **Panel → live wiring (no restart)**: Every super-admin setting is read fresh on each request, so changes apply instantly:
  - `getEffectiveCommissionRate(telegramId, botSlug, default)` — checks `commission_overrides` first, falls back to `bots.commissionRate`. Used in `/internal/credit` + `/internal/game/credit-reward`.
  - `rejectIfBlocked(user, res)` — returns 403 if `users.isBlocked`. Applied to every mutating route (`/credit`, `/debit`, `/deposit`, `/game/charge-entry`, `/game/credit-reward`, `/stars-invoice`, `/ton-deposit-intent`, `/withdraw`, `/users/upsert`). Exempt: `/game/refund-entry` (must still refund a blocked user).
  - `getSkzRates()` / `getReferralRates()` — read from `platform_settings` on every call.
  - `GET /internal/bot-texts` — returns published copy for the calling bot. A bot may only read its own slug (cross-bot reads rejected 403). Python `BotTexts` class in `mother-bot/src/client.py` wraps this with a 60s TTL cache (asyncio.Lock + double-check to prevent thundering-herd).

## Product

### البوت الأم (Mother Bot)
- محفظة موحدة لكل مستخدم (USDT + Stars + TON)
- ربط مالي بين 6 بوتات فرعية
- نظام عمولة تلقائي قابل للضبط لكل بوت
- سحب الأرباح بعدة طرق
- نظام إحالة

### البوتات الفرعية المخططة
1. **بوت الألعاب** (games-bot) — ألعاب مهارات مع رهانات
2. **بوت الفيديو** (video-bot) — TikTok-like مع أرباح للمنشئين
3. **بوت الغرف الصوتية** (voice-bot) — غرف صوتية مدفوعة
4. **بوت الذكاء الاصطناعي** (ai-bot) — توليد نصوص/صور/فيديو
5. **المتجر الرقمي** (store-bot) — بيع منتجات رقمية
6. **بوت المسابقات** (contests-bot) — مسابقات وجوائز

### لوحة التحكم الإدارية
- إحصاءات مالية شاملة
- إدارة المستخدمين والمحافظ
- سجل المعاملات والعمولات
- إدارة طلبات السحب (قبول/رفض)
- إدارة البوتات الفرعية

## User preferences

- لغة التطوير: يفضل أعلى أداء ممكن
- الدفع: Telegram Stars + Crypto (USDT/TON)
- البناء: بوت بوت بشكل تدريجي

## Gotchas

- أضف `SESSION_SECRET` كـ secret في Replit
- لتشغيل بوت التيليغرام: أضف `MOTHER_BOT_TOKEN` كـ secret
- سجّل البوت الأم أولاً عبر `POST /api/bots` للحصول على API key
- استخدم `client.py` في كل بوت فرعي للتواصل مع البوت الأم
- الـ API الداخلية تتطلب `X-Bot-Api-Key` header
- عند تغيير OpenAPI spec: أعد تشغيل `pnpm --filter @workspace/api-spec run codegen`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Internal API docs: GET /api/healthz for server health
- Child bot SDK: artifacts/mother-bot/src/client.py
