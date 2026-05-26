---
name: Bot user.languageCode overwrite
description: How per-user language preference can silently reset on every /start in this multi-bot Telegram platform, and the rule that prevents it.
---

# Rule

The `/internal/users/upsert` endpoint accepts an optional `languageCode`
and only overwrites the stored value when the caller explicitly passes one.
Routine upserts (called on every /start, every middleware tick, every
deep-link, etc.) MUST NOT pass `languageCode`. The ONLY path that should
ever send `languageCode` to that endpoint is the user-driven language
switcher (`set_user_lang()` in each bot's `i18n.py`).

**Why:** Bots used to forward `user.language_code` from Telegram on every
upsert. Telegram serves the user's UI language, not their app preference,
so any user who picked a different language via `/lang` would have their
choice silently reverted the next time they typed `/start`. The user-side
symptom is "the language toggle works for one screen, then snaps back".

**How to apply:**
- In any Python bot client (`client.py`, ad-hoc `api_upsert_user`, SDKs):
  omit `languageCode` from the upsert payload. The mother-bot SDK enforces
  this by typing `language_code: Optional[str] = None` and only including
  the key in the JSON when non-None.
- The server-side guarantee is one line in `routes/internal.ts` upsert:
  `...(languageCode ? { languageCode } : {})` spread into the
  `onConflictDoUpdate.set` clause. Don't "simplify" it back to an
  unconditional assignment.
- If you add a new bot, copy the comment block from
  `artifacts/books-bot/src/client.py` upsert_user so the next maintainer
  doesn't reintroduce the bug.
