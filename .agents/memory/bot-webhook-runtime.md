---
name: Bot webhook/polling runtime switch
description: How the 4 Python bots toggle between polling (dev) and webhook (prod) via a shared per-bot `webhook_runtime.py`.
---

The 4 bots (mother / books / contests / subagents) all end `main()` by calling
`run_bot(bot, dp, "<slug>")` from `webhook_runtime.py` (an identical file in
each bot's `src/`). Behavior is env-driven, not code-driven.

**Why:** dev on Replit has no per-bot HTTPS path, and production on Contabo
runs every bot behind one nginx host. A single switch keeps the same code
in both environments and avoids forking a "prod bot" branch.

**How to apply:**
- Polling (default): leave `USE_WEBHOOK` unset. The runtime calls
  `delete_webhook` first so Telegram stops trying to POST to a stale URL.
- Webhook (prod): set `USE_WEBHOOK=1`, `WEBHOOK_BASE_URL=https://<host>`,
  `WEBHOOK_SECRET=<>=16 chars>`, and a unique `WEBHOOK_PORT` per bot
  (suggested: 8101 mother, 8102 books, 8103 contests, 8104 subagents).
  Optional `WEBHOOK_HOST` (default `127.0.0.1`).
- nginx forwards `POST /telegram-webhook/<slug>` → `127.0.0.1:<port>`.
- The runtime also exposes `GET /telegram-webhook/<slug>/healthz`.
- The aiogram `SimpleRequestHandler` verifies the
  `X-Telegram-Bot-Api-Secret-Token` header against `WEBHOOK_SECRET`, so the
  endpoint is safe to expose publicly.
- When editing `webhook_runtime.py`, copy the file to all 4 bot dirs —
  they are deliberately byte-identical and not a shared lib (each bot is
  its own independent Python artifact, mirroring `client.py` /
  `sentry_init.py`).
