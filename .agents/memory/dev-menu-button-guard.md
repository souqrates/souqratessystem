---
name: Dev bot overwrites prod menu button
description: Replit polling bots called set_chat_menu_button at startup, overwriting Contabo's correct production URL with a temporary replit.dev URL for all users globally.
---

## The Rule

Gate `set_chat_menu_button` (and any other global Telegram bot-level API calls) behind `os.getenv("USE_WEBHOOK")` in every bot's startup.

```python
# CORRECT — only runs in Contabo production (USE_WEBHOOK=1)
if WEB_APP_URL.startswith("https://") and os.getenv("USE_WEBHOOK"):
    await bot.set_chat_menu_button(...)

# WRONG — runs in Replit dev too, overwrites production setting
if WEB_APP_URL.startswith("https://"):
    await bot.set_chat_menu_button(...)
```

## Why

`set_chat_menu_button` is a **global, per-bot** Telegram API call — it changes the menu button for every user of the bot regardless of which server instance makes the call. Replit dev bots run with `REPLIT_DEV_DOMAIN` set, so `WEB_APP_URL` resolves to a `https://...replit.dev/...` URL. Every Replit bot restart silently replaced the Contabo production URL with this temporary URL, making the mini app unreachable for all users.

## How to apply

- Search for `set_chat_menu_button` in any new bot and add the `USE_WEBHOOK` guard
- Same principle applies to `set_my_description`, `set_my_short_description` if used — anything that mutates global bot state visible to all users

## Emergency reset

If the dev bot has already overwritten the button, call the Telegram API directly:
```bash
BOT_TOKEN=$(python3 -c "import os; print(os.environ.get('BOOKS_BOT_TOKEN',''))")
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🛍 SOUQ","web_app":{"url":"https://souqrates.com/books-bot-web/"}}}'
```
Returns `{"ok":true,"result":true}` on success. Takes effect immediately.
