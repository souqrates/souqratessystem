---
name: SubAgents Mini App path convention
description: The SOUQRATES SUB-AGENTS Mini App lives at /subagents-bot-web/, not /subagents/. Bot.py URL constants must match.
---

## Rule
`artifact.toml` for `artifacts/subagents-bot-web` sets `previewPath = "/subagents-bot-web/"`.
All bot.py URL constants MUST use that base:

```
APPLY_URL     = f"{BASE}/subagents-bot-web/apply"
DASHBOARD_URL = f"{BASE}/subagents-bot-web/dashboard"
STATUS_URL    = f"{BASE}/subagents-bot-web/pending"
LANDING_URL   = f"{BASE}/subagents-bot-web/"
```

**Why:** The Python bot had the wrong paths (`/subagents/*`) which would cause "page not found" when the Telegram button was tapped.

**How to apply:** Any time you add a new page to the Mini App, add the `/subagents-bot-web/<page>` URL to bot.py. Never drop the `subagents-bot-web` prefix.

## DB setup note
`sub_agent_tiers` needs its 7 default rows seeded via:
`POST /api/superadmin/subagent-tiers/seed` (requireSuperAdmin)
This is idempotent — safe to call again; uses `ON CONFLICT DO NOTHING`.
