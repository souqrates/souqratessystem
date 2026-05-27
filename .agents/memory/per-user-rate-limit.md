---
name: Per-user rate limit on row-creating money routes
description: Which routes need perUserCreateLimiter and why the bucket key is telegramId, not IP or bot-API-key.
---

# Rule
Any route that inserts a `transactions` / `withdrawals` / `sub_agent_sales` row on user action must sit behind `perUserCreateLimiter` (10/min per telegramId).

**Why:** the global `internalWriteLimiter` is keyed by `X-Bot-Api-Key`, so one bot's traffic shares a single bucket — a single abusive user can exhaust it for everyone. IP-based limiting is useless because all `/internal/*` traffic comes from the same backend bots. Only `telegramId` isolates one user from the rest.

# Key resolution
`perUserKey(req)` order:
1. `req.telegramId` (set by `requireTelegramAuth` for browser-facing routes)
2. `req.body.telegramId` (server-to-server `/internal/*` calls from child bots)
3. IP (last resort; should rarely be hit on these routes)

# Routes currently protected
- `/internal/stars-invoice`, `/internal/ton-deposit-intent`, `/internal/usdt-deposit-intent`, `/internal/withdraw`
- `/subagents/sell`

Any new route that creates a row from user action must be added; forgetting it = DB-bloat DoS vector.

# Distributed
`installDistributedRateLimitStore()` rebuilds this limiter against Upstash on boot if the integration is enabled. Multi-replica deployments share the counter. Tag-scoping via `ScopedStore` keeps the bucket separate from other limiters that share the same Redis.
