---
name: Custom-domain stale-build trap
description: A pinned custom brand domain in .replit env can silently serve an OLDER deploy than the current Replit host — bots end up linking users to a stale Mini App.
---

# Custom-domain stale-build trap

When the bot's `MINI_APP_URL` (or `GAMES_APP_URL`, `PUBLIC_BASE_URL`, etc.)
is hard-pinned to a custom brand domain (e.g. `souqrates.com`) in
`.replit`'s `[userenv.shared]`, that domain's DNS may still point at an
older host while the current Replit deployment serves the live build.
The bot then sends users to the stale host — newer games/features look
"missing" even though they exist in the codebase.

**Why:** `.replit` env wins over our `_resolve_default_base()` fallback,
and custom-domain DNS changes are out-of-band from Replit deploys, so
they drift independently.

**How to apply:**
- For URLs that point at our own deployment, derive from
  `REPLIT_DOMAINS[0]` (or `REPLIT_DEV_DOMAIN` in dev) by default — these
  always track the running host.
- Do NOT honor per-artifact env overrides (`MINI_APP_URL`, etc.) that
  could be pinned in `.replit`. Keep one explicit override channel
  (`PUBLIC_BASE_URL` as a Replit secret) so brand-domain pinning is an
  opt-in decision, not a `.replit` accident.
- Symptom to recognize: "feature works on `*.replit.dev` but missing on
  the branded domain" → suspect DNS, compare what each host's
  `/api/games/configs` (or equivalent) actually returns before touching
  code.
