---
name: Pre-launch audit fixes
description: What was done to address the pre-launch audit report (H3–H5, M1–M7, L1–L3) and important gotchas discovered.
---

# Pre-launch audit fixes

## DB FK + CHECK constraints (M1, M2)
Applied via `executeSql` directly (NOT `drizzle push`) because drizzle push is interactive
and requires stdin "yes" to proceed — shell commands cannot pipe to it reliably.

**Constraints added:**
- `wallets.user_id → users.id ON DELETE RESTRICT`
- 5 CHECK constraints on wallets: `balance_skz >= 0`, `referral_balance_skz >= 0`, `balance_stars >= 0`, `balance_usdt >= 0`, `balance_ton >= 0`
- `transactions.user_id → users.id ON DELETE RESTRICT`
- `commissions.user_id → users.id ON DELETE RESTRICT`
- `commissions.transaction_id → transactions.id ON DELETE RESTRICT`
- `withdrawals.user_id → users.id ON DELETE RESTRICT`

**Orphan data:** wallet id=297, user_id=297 was an orphan row (no matching user) — deleted before applying FK.

**Why:** drizzle TypeScript schema files have the `.references()` chains, so the schema is canonical. But future `drizzle push` runs will see "constraint already exists" from the DB and should handle it correctly.

## charge-entry double-tap guard (H3)
Module-level `_chargeEntryInFlight = new Map<string, number>()` added in internal.ts
BEFORE the route definition. Key = `telegramId:gameId:amountNum`. TTL = 5s.
Returns 429 `duplicate_request` if identical request arrives within 5s.

## Python in-flight guards (H5)
- `contests-bot/bot.py`: `_vote_in_flight: set[tuple[int,int,int]]` + try/finally wrapping `cast_vote`
- `books-bot/bot.py`: `_buy_in_flight: set[tuple[int,int]]` + discard in except + discard at end of happy path

## Python .get() crash guards (H4)
3 locations in mother-bot/bot.py where `wallet["key"]` → `wallet.get("key", "0")`.
books-bot/bot.py line 489: `_, cid_s, page_s = cb.data.split(":")` wrapped in try/except.

## Error message leakage (M6)
Pattern: `res.status(err.status ?? 500).json({ error: err.message })` →
`res.status(err.status ?? 500).json({ error: (err.status && err.status < 500) ? err.message : "Internal server error" })`
5 locations: superadmin.ts (credit, debit, approval), internal.ts (refund), withdrawals.ts (approve).

## L2, L3 already present
All 5 web apps (books-bot-web, contests-bot-web, bot-demo, subagents-bot-web, superadmin) had
`ErrorBoundary` and full stale-chunk/ChunkLoadError recovery already in place from a prior session.
mother-bot-web has no src/ — it's a static file server, no React app to add ErrorBoundary to.
