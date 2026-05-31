---
name: Replit+Contabo webhook conflict
description: Why Python bots show TelegramConflictError and how to resolve it in dev.
---

# Replit ↔ Contabo webhook conflict

## The rule
Running the same Telegram bot on Replit (polling) AND Contabo (webhook mode) simultaneously creates a permanent conflict loop: Contabo sets a webhook → Replit's polling fails → Replit deletes it → Contabo sets it again.

**Why:** Telegram only allows ONE delivery method per bot token at a time.

## Symptoms
`TelegramConflictError: Conflict: can't use getUpdates method while webhook is active`

Repeats every 5 seconds indefinitely even after manually calling `deleteWebhook`.

## Fix in place (dev resilience)
`webhook_runtime.py` now has:
1. `await bot.delete_webhook()` at polling startup (always)
2. `_keep_webhook_deleted()` background task — runs every 45s, calls `get_webhook_info()`, and re-deletes if Contabo set it back

This makes Replit self-healing but does NOT solve the root conflict.

## Permanent fix (for production)
Stop one side. Options:
- Stop Contabo bots while doing Replit dev: `sudo systemctl stop souqrates-*`
- Or use `DISABLE_BOOKS_SPAWN=1` env vars to only run specific bots on Replit

## How to apply
Any time this error appears: manually call `deleteWebhook` for all bots, then the 45s watchdog takes over.
