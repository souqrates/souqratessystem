---
name: Mini App → Mini App navigation
description: Why links inside a Telegram Mini App open in an external browser, and how to keep the user inside Telegram when jumping to another sub-app.
---

# Inside-Mini-App navigation rule

A `web_app=WebAppInfo(url=...)` inline button opens its target as a Mini App inside Telegram. But `<a href>` / `wa.openLink(url)` from **inside** a running Mini App opens an **external browser** — `openLink` is by definition "leave the Mini App".

Telegram offers no `openMiniApp(url)` for arbitrary URLs. The only ways to stay inside Telegram from inside a Mini App are:

1. **Same-origin navigation**: `window.location.href = url` when the target is on the same origin as the current Mini App webview. The webview just navigates; the Mini App chrome (close ✕, main button, theme) stays. This is what you want for sub-apps that live as path-routed siblings under the same domain (e.g. `/games-bot/`, `/books-bot-web/` under `souqrates.com`).
2. **`wa.openTelegramLink('https://t.me/<bot>/<app>')`**: only works for a *different* bot's Mini App that has been registered via BotFather `/newapp`. Not a fit for sibling sub-apps of the same product.

**Why:** A user reported "games button opens in browser, not inside the bot" — but only when launched from inside the main Mini App; the `/start` inline button worked fine. Root cause was a shared helper that fell through to `wa.openLink()` for any non-`t.me/` URL, and the sub-app URLs were hard-coded to `https://souqrates.com/...` (absolute), so even on the dev origin the same-origin check would have failed.

**How to apply:** Any helper that opens a URL from inside a Mini App must (a) prefer `window.location.href` for same-origin targets, and (b) callers must use *relative* URLs for sibling sub-apps, never hard-coded production hostnames — otherwise the same-origin check fails on dev/preview origins and the user gets booted to a browser.
