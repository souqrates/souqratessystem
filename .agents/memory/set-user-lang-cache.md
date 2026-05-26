---
name: set_user_lang cache-on-success
description: Rule for the Python bots' i18n module — never poison the in-memory language cache with a value that didn't actually persist to the API.
---

# Rule

In each bot's `i18n.py`, `set_user_lang()` may ONLY write to
`_LANG_CACHE[telegram_id]` when the upstream `/internal/users/upsert`
call returned 200. On failure (non-200 or transport exception) it must
`_LANG_CACHE.pop(telegram_id, None)` so the next `get_user_lang()` is
forced to re-read from the database.

**Why:** The previous implementation cached unconditionally. A failed
save would still flip the bot's UI to the new language for ~60 seconds
(the cache TTL), then snap back when the cache expired and reloaded the
unchanged DB value. The user perceives this as "the bot says language
saved, then forgets". For a financial product, any "I changed a setting
and it silently reverted" UX is a trust bug — same class as the original
`languageCode`-overwrite-on-/start issue.

**How to apply:**
- This pattern must hold in all three i18n.py copies
  (mother-bot, books-bot, contests-bot). If a new Python bot is added,
  copy the same `if ok: ... else: pop` block.
- The user-facing callback handler should also check the boolean return
  value and surface a localized error toast on False — don't show the
  "saved" confirmation when persistence failed.
- Do NOT extend the cache TTL to mask the problem. The fix is at the
  write path, not the read path.
