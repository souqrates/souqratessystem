---
name: Replit+Contabo webhook conflict
description: Running the same Telegram bot in polling (Replit) and webhook (Contabo) simultaneously; how to prevent Replit from destroying the production webhook.
---

# Replit ↔ Contabo webhook conflict

## The problem
Running the same Telegram bot on Replit (polling) AND Contabo (webhook mode) simultaneously breaks production in two ways:
1. At startup, Replit calls `delete_webhook()` — instantly deletes the Contabo webhook.
2. The 45-second watchdog (`_keep_webhook_deleted`) keeps re-deleting any webhook it finds — continuously wiping Contabo's webhook.

**Symptom:** `TelegramConflictError: can't use getUpdates while webhook is active` on Replit, AND Contabo bot stops responding because its webhook keeps getting deleted.

## The fix (now in all 5 `webhook_runtime.py` copies)

Detection is automatic via `REPLIT_DEV_DOMAIN` (set automatically by Replit, e.g. `abc123-user.replit.dev`).

```python
def _is_production_webhook(url, replit_domain) -> bool:
    if not replit_domain:
        return False
    return not url.startswith(f"https://{replit_domain}")
```

**At startup (polling mode):**
- Active webhook + production URL → `return` immediately (ABORT POLLING, do NOT delete webhook)
- Active webhook + Replit URL → delete it (normal cleanup)

**Watchdog every 45 s:**
- Production webhook → log warning, skip deletion (protects Contabo)
- Replit/stale webhook → delete as before

## Why this is safe on Contabo
On Contabo, `USE_WEBHOOK=1` is set, so the polling branch is never entered. `_is_production_webhook` is never called. Zero behavioral change in production.

## Permanent fix
Stop the Python bot workflows on Replit entirely when Contabo production is running. The code fix is a safety net, not a substitute.

## Keeping copies in sync
All 5 copies must be byte-identical. Verify with:
```bash
md5sum artifacts/*/src/webhook_runtime.py
```
Edit `artifacts/books-bot/src/webhook_runtime.py` then `cp` to the other 4.
