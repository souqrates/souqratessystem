---
name: Two-tier cache layer
description: When and how to cache reads on the money path, plus the invalidation contract.
---

# When to cache

Wrap a DB read in `cached(key, ttlSec, loader)` from `lib/cache.ts` ONLY if:
- it's called on the hot money path (every credit/debit/charge),
- it reads slow-changing config (rates, tiers, bot rows, commission overrides),
- AND a stale read for ~ttlSec is acceptable.

Do NOT cache: balances, transaction history, anything where staleness corrupts accounting.

**Why:** the platform reads `getSkzRates()` / `getReferralRates()` once or more per money-moving request. Uncached, that's 1–2 extra round-trips per request to Postgres for values that change a few times a day.

**How to apply:** put the key in a module-scoped const (e.g. `CK_SKZ_RATES`) and export a `invalidateXxxCache()` that calls `cacheDel(...)`. EVERY write site that touches the underlying rows must call the invalidator in the same handler, before the response. Settings routes are the canonical example.

# Failure stance
Cache fails open. Upstash unavailable → in-process LRU fallback (≤2000 entries) keeps a single replica fast; a full outage degrades to direct DB reads. Never throw from a cache call into the money path.

# Idempotency
`idempotencyClaim(key, ttlSec)` uses `SET NX EX`. Use it as a fast pre-DB guard for create/sell flows where the client may retry. DB uniqueness constraints (referenceId, idempotencyKey columns) remain the authoritative dedup — the Redis claim is only an optimisation. Fails OPEN: an Upstash outage must not block a legitimate first attempt.
