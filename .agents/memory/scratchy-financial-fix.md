---
name: Scratchy game financial integration
description: How scratch card wins/losses connect to the central wallet — the bug and the fix.
---

## The bug
`applyDeduct` and `applyCredit` in `useBalance.ts` were purely local React state mutations —
no API calls. Win/loss result was computed client-side with `Math.random()`.
Balance reverted to the real (unchanged) server value on every page reload.

## The fix
`POST /api/scratchy/play` (in `artifacts/api-server/src/routes/scratchy.ts`):
- Validates Telegram `initData` HMAC using `SCRATCHY_BOT_TOKEN`
- Extracts `telegramId` from validated data
- Rolls prize server-side (same tier weights as client)
- Atomically deducts entry fee + credits prize in a single DB transaction
- Returns `{ ok, prize, won }` to client

Client changes (`Cards.tsx`):
- `confirmPlay()` calls the endpoint before opening scratch screen
- `ScratchReveal` receives `forcedPrize` → builds synthetic tier with
  deterministic weights so the animation reveals the server result
- `handleResult()` calls `onRefresh()` to sync real balance

## WebApp URL fallback fix
scratchy-bot, books-bot, contests-bot `_resolve_*_web_app_url()` functions
returned `""` on Contabo (no REPLIT_DOMAINS, no PUBLIC_BASE_URL set) →
no WebApp button → apps opened in phone browser.
Added `https://souqrates.com/<slug>/` as final hardcoded fallback.

**Why:** mother-bot already had this fallback hardcoded; child bots did not.
**How to apply:** Set `PUBLIC_BASE_URL=https://souqrates.com` on Contabo for
explicit control; the hardcoded fallback is the safety net.
