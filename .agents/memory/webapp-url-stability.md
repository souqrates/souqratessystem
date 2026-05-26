---
name: WebApp URL stability
description: Why Telegram WebApp (Mini App) URLs in inline keyboards must stay byte-identical across bot restarts.
---

# Rule
Telegram WebApp URLs (sent via `WebAppInfo(url=...)` in inline keyboards) must
NEVER carry a per-restart cache-buster like `?v=<timestamp>` or `?build=<sha>`.

**Why:** Telegram caches its "is this domain/URL allowed as a WebApp" validation
decision PER FULL URL. On bot process restart the cache-buster changes → URL
changes → old keyboards (sent before restart) now point at a "stale" URL.
Telegram re-validates; if validation hiccups even once (common under load), it
blacklists THAT exact URL for several minutes. Users see "Cannot open game /
Cannot open this link" until they fully kill and restart the Telegram app.
Fresh state works briefly, then re-poisons on next restart.

**How to apply:** Front-end bundle freshness is already handled by:
  1. Vite content-hashed asset filenames (`assets/main-<hash>.js`).
  2. Stale-chunk auto-reload in `artifacts/games-bot/src/main.jsx` that catches
     `vite:preloadError` + script load errors and triggers a one-shot hard
     reload.
So if a user reports "Mini App shows old version", check (a) browser/webview
cache on the user side and (b) the auto-reload hook — do NOT reach for a URL
cache-buster. The fix path is origin Cache-Control headers, not URL mutation.

See the inline comment block at the top of `MINI_APP_URL` in
`artifacts/mother-bot/src/bot.py` for the canonical version of this rule.
