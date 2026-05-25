# Threat Model — SOUQRATES SYSTEM (Mother-Bot Platform)

## Project Overview

A multi-bot Telegram financial platform built as a pnpm monorepo. A central
**mother-bot** (Python / aiogram 3) owns one unified wallet per Telegram user
(SKZ in-platform credit, plus Telegram Stars and TON balances). Six branded
child bots — Games (SKILLZ), Books (SOUQ), Video (SCENE), Voice (STREAM),
AI (SIGNAL), Contests (STAGE) — share that wallet through a single Express 5
+ Drizzle + Postgres API. All inter-bot money movement (charge entry,
credit reward, refund, deposit, withdraw) runs through `/internal/*` routes
authenticated by per-bot API keys. A React/Vite super-admin panel
(`artifacts/superadmin`) is the only operator console.

Real money flows through the system: Telegram Stars deposits via Bot API,
TON crypto deposits via blockchain watcher, and SKZ withdrawals via several
methods. Therefore the security posture must match a payments product, not
a hobby bot.

## Assets

- **User wallets** — SKZ / Stars / TON balances in the `wallets` table (one
  row per `users.id`). Any unsigned mutation = direct theft of platform
  liability.
- **Bot API keys** — one per child bot in `bots.apiKey`. Compromise lets the
  holder credit arbitrary users (= mint money) or debit them.
- **Super-admin sessions** — `ADMIN_TOKEN` and the operator session grants
  unrestricted read/write on every wallet, withdrawal, integration secret,
  and platform setting.
- **Integration secrets** — Redis URLs, Sentry DSNs, OpenRouter keys, etc.
  stored encrypted in `integrations.config` (AES-256-GCM with a
  `SESSION_SECRET`-derived key).
- **Withdrawal queue** — `withdrawals` rows in `pending`/`processing` are an
  attacker's primary target: bypass approval = exfiltrate funds.
- **Commission ledger** — `commissions` + `transactions` rows are the
  authoritative book of record. Tampering breaks the platform's accounting.
- **PII** — `users.telegramId`, optional username/email, withdrawal addresses
  (TON wallets, IBANs).
- **Telegram bot tokens** — `MOTHER_BOT_TOKEN`, child bot tokens. Compromise
  = full account takeover at the Telegram layer (send messages as the bot).

## Trust Boundaries

- **Telegram → mother-bot** — incoming `Update` payloads. Telegram-id is the
  ONLY user identity; webhook/polling traffic is implicitly trusted (TLS to
  api.telegram.org). The `successful_payment` event is the only trusted
  signal that Stars were actually paid — `pre_checkout_query` MUST NOT be
  used to credit balances.
- **Mother-bot ↔ API server** — server-to-server over loopback, but every
  request must still carry `X-Bot-Api-Key`. Network is shared with other
  bots, so an internal mis-route could leak.
- **Child bots ↔ API server** — same `X-Bot-Api-Key` auth; additional rule:
  a bot may only read its OWN slug's bot-texts (cross-bot read returns 403).
- **Browser → super-admin → API server** — every `/api/superadmin/*` route
  must pass `requireSuperAdmin` middleware. Bearer `ADMIN_TOKEN` or signed
  operator session only.
- **Public web artifacts (`books-bot-web`, `games-bot`, etc.) → API** —
  unauthenticated landing/marketing UIs. They MUST NOT call any
  `/internal/*` route; only public read endpoints.
- **API server → Postgres** — direct DB access. SQL injection here = total
  compromise. All queries go through Drizzle (parameterized).
- **API server → third-party integrations** — Sentry, Resend, OneSignal,
  Bunny.net, OpenRouter, Cloudflare. Outbound only; configs decrypted at
  runtime from `integrations` table.
- **Stored secrets → memory** — `SESSION_SECRET` is the root of the
  integration-secret encryption tree. Rotating it invalidates every stored
  integration config by design.

## Scan Anchors

- Production entry points:
  - `artifacts/api-server/src/index.ts` — Express app.
  - `artifacts/api-server/src/routes/internal.ts` — money-moving endpoints,
    bot-API-key authed. **Highest risk file in the repo.**
  - `artifacts/api-server/src/routes/superadmin.ts` — admin surface.
  - `artifacts/api-server/src/routes/public.ts` — anything reachable without
    auth.
  - `artifacts/mother-bot/src/bot.py` — Telegram-side handlers, including
    `pre_checkout_handler` and `msg_successful_payment` for Stars.
- Highest-risk code areas:
  - `internal.ts` routes for `/credit`, `/debit`, `/stars-confirm`,
    `/ton-deposit-intent`, `/withdraw`, `/game/charge-entry`,
    `/game/credit-reward`, `/game/refund-entry`. Each must enforce: bot-API
    key, `rejectIfBlocked` (except refund), atomic SQL increment, idempotency.
  - `lib/integrations/crypto.ts` — AES-GCM encryption helpers. Any change
    risks invalidating all stored configs.
  - `artifacts/api-server/src/lib/super-admin-auth.ts` — `requireSuperAdmin`
    (admin gate). The bot-API-key gate (`requireBot`) lives at the top of
    `artifacts/api-server/src/routes/internal.ts` and looks up `bots.apiKey`.
- Public vs authenticated vs admin surfaces:
  - **Public**: web artifacts under `artifacts/{books,contests,games}-bot-web`,
    `artifacts/bot-demo`, and `/api/public/*` routes.
  - **Bot-authenticated** (`X-Bot-Api-Key`): `/api/internal/*`.
  - **Admin-authenticated** (`requireSuperAdmin`): `/api/superadmin/*`.
- Dev-only / out of scope unless proven reachable in production:
  - `artifacts/mockup-sandbox`, `.local/skills`, `scripts/`.
  - `artifacts/games-bot/supabase/migrations/*.sql` — legacy Supabase
    artifacts; the public anon JWT inside is the standard Supabase public
    key (RLS-protected, not a credential leak).

## Threat Categories

### Spoofing

The platform has three identity layers: Telegram user (`telegramId`), child
bot (`X-Bot-Api-Key` → `bots` row), and super-admin (`ADMIN_TOKEN` /
session). Each MUST be authenticated on every request — no implicit trust
from previous calls or shared memory.

- `pre_checkout_query` from Telegram is **not** authentication of payment;
  only `successful_payment` is. `/internal/stars-confirm` MUST trust the
  Telegram-server-signed `successful_payment` event and MUST be idempotent
  on the pending-tx referenceId so a replay doesn't double-credit.
- Bot API keys must be unique per bot, generated with `crypto.randomBytes`,
  and rotatable from the super-admin panel.
- Super-admin auth must reject missing / malformed / expired tokens with 401,
  never silently allow.

### Tampering

The wallet is the prize. Any path that mutates `users.balance*` columns must
treat the request body as hostile and recompute money from authoritative
sources.

- All balance updates MUST use atomic SQL increments
  (`sql\`balance + ${n}\``) inside a single statement — never JS
  read-modify-write. This is the documented rule in `replit.md` and the
  invariant the platform's correctness rests on.
- `/internal/credit` MUST recompute commission server-side via
  `getEffectiveCommissionRate(telegramId, botSlug, default)` — never trust
  a client-supplied commission or net amount.
- `/internal/stars-confirm` MUST derive BOTH Stars and SKZ credits from the
  pending transaction created at `/stars-invoice` time
  (`transactions.amount` for Stars, `metadata.expectedSkz` for SKZ) — NEVER
  from any number on the inbound request body. A corrupted/missing
  metadata field must REFUSE the credit, not silently fall back to a live
  rate (a fallback would let a tampered payload override the snapshotted
  amount). Caller is restricted to `bot.slug === 'mother-bot'`.
- Withdrawals: amount, fee, and net must be recomputed from
  `platform_settings` on submission; the client only chooses currency,
  method, and address.
- All Postgres access goes through Drizzle parameterized queries. New code
  must not introduce raw string concatenation into `sql\`\`` templates.

### Repudiation

Money movements must be auditable end-to-end.

- Every wallet mutation writes a `transactions` row (`type`, `currency`,
  `amount`, `sourceBot`, `referenceId`, `metadata`) BEFORE balance is
  changed, in the same transaction.
- Every commission-deducting credit also writes a `commissions` row tying
  back to `transactionId`.
- Withdrawal status transitions (`pending → processing → approved/rejected`)
  must record actor and timestamp; rejection must store `rejectedReason`.
- Use `req.log` (per pnpm-workspace skill) — never `console.log` — so logs
  carry request id, route, and user context.

### Information Disclosure

- Integration secrets MUST stay encrypted at rest and MUST NEVER be
  returned from `GET /api/superadmin/integrations`. Only metadata
  (slug, enabled, last test status) is safe to surface.
- Bot API keys: `GET /api/bots` must return key only on creation; subsequent
  reads must return a masked value.
- Error responses MUST NOT include stack traces, raw SQL errors, or
  `metadata` blobs in production.
- Logs MUST NOT contain bot tokens, API keys, decrypted integration configs,
  Telegram payment charge ids tied to user PII, or full TON wallet addresses
  beyond what is operationally necessary.
- `/internal/bot-texts` enforces that a bot may only read its own slug —
  preserve that check on any future cross-bot endpoint.

### Denial of Service

A Telegram bot is trivially reachable by anyone with the bot username, and
public web artifacts are open to the internet.

- All `/internal/*` and `/superadmin/*` mutating routes should be rate
  limited (Upstash Redis integration is wired for exactly this — enable on
  deploy).
- `/internal/stars-invoice` and `/internal/ton-deposit-intent` create DB
  rows on every call; both must be rate-limited per-telegramId (e.g. ≤ N
  pending per user) to prevent table bloat.
- Outbound integration calls (Sentry, Resend, OpenRouter, etc.) MUST set a
  request timeout (≤ 10s) so a hung third party can't pin an Express worker.
- Withdrawal approval is a single-admin manual action — there is no
  automated batch processor that could be flooded.

### Elevation of Privilege

- `requireSuperAdmin` MUST gate every `/api/superadmin/*` route. Adding a
  new admin route requires explicitly attaching the middleware; do not rely
  on router-level defaults that future refactors might break.
- `rejectIfBlocked(user, res)` must run on every mutating internal route
  EXCEPT `/game/refund-entry` (a blocked user must still be made whole).
  Forgetting it on a new route lets blocked users continue moving funds.
- Bot API keys are scoped to the calling bot only — never use the caller's
  key to act on behalf of another bot.
- DB role used by the API must NOT be the Postgres superuser.
- `.replit` and any committed file MUST NOT contain raw secrets,
  API keys, or tokens. `MOTHER_BOT_API_KEY` is supplied exclusively via
  Replit secrets.
