---
name: Platform audit status
description: Security audit results and what was fixed — use to avoid re-auditing completed items
---

## Audit completed 2026-05-28

### Scans — all clean
- SAST: 0 findings
- HoundDog secrets: 0 production findings (1 MEDIUM in dev-only cloudflare-dns-setup.ts — acceptable)
- JS dependencies: 0 vulnerabilities
- Python dependencies: aiohttp 3.10.11 had 4 critical CVEs → fixed in requirements.txt

### What was fixed in code
1. `aiohttp>=3.13.4,<4` added to all 4 bots' requirements.txt (mother-bot, books-bot, contests-bot, subagents-bot)
2. `/internal/ton-deposit-intent`: max 10,000 TON guard → 400 max_deposit_exceeded
3. `/internal/usdt-deposit-intent`: max 10,000 USDT guard → 400 max_deposit_exceeded
4. `/internal/stars-invoice`: 429 if user has ≥ 10 pending Stars invoices
5. `sub_agent_tiers` seeded via `POST /api/superadmin/subagent-tiers/seed` — 7 tiers (Bronze L1 0% → Sovereign L7 13%)

### Still pending (manual on Contabo)
- Enable Upstash Redis from `/integrations` panel → makes all 5 rate-limit tiers distributed
- Run `pip install --break-system-packages "aiohttp>=3.13.4"` on each Python bot venv (or use venv setup)
- Re-run seed: `curl -X POST https://souqrates.com/api/superadmin/subagent-tiers/seed -H "Authorization: Bearer $ADMIN_TOKEN"`

**Why:** Upstash enables distributed rate limiting across processes; without it the in-memory limiter only protects the single Node process.
