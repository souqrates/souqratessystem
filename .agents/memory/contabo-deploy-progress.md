---
name: Contabo deployment progress
description: State of the Contabo VPS production deployment — what is done and what remains
---

## Done (as of 2026-05-28)

- pnpm downgraded to v10 on Contabo (v11 broke esbuild build-script approval)
- install.sh completed successfully: code built, Python venvs created, systemd + nginx configs installed
- Supabase DB schema applied manually via SQL Editor (28 tables + indexes + sub_agent_tiers seed)
- 5 env files copied to /etc/souqrates/ via SCP (gen-env.sh script)
- souqrates-api.service: active
- souqrates-mother-bot.service: active
- nginx: running (HTTP-only, no SSL yet)
- API healthz: {"status":"ok"} on 127.0.0.1:8080

## Remaining steps

1. Confirm all 4 bots active: `systemctl is-active souqrates-{api,mother-bot,books-bot,contests-bot,subagents-bot}`
2. DNS: point souqrates.com A record → 194.163.155.52 in Cloudflare
3. SSL: `certbot --nginx -d souqrates.com -d www.souqrates.com --redirect --agree-tos -m EMAIL`
4. Restore full nginx config (deploy/nginx/souqrates.conf) after SSL issued
5. Seed bots: `cd /opt/souqrates/repo && DATABASE_URL=... python3 artifacts/mother-bot/src/seed_bots.py`
6. UFW: `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable`
7. Smoke-test: `curl -sf https://souqrates.com/api/healthz`

## Key facts

- Contabo IP: 194.163.155.52
- Contabo user: root, app user: souqrates
- Repo on server: /opt/souqrates/repo
- Env files: /etc/souqrates/*.env
- Supabase project ref: nvywsoatlrtnjgkizqnh (ap-southeast-1 pooler)
- DATABASE_URL for server: use pooler port 5432 (session mode) — direct port 5432 on db.*.supabase.co is IPv6-only and unreachable from Contabo
- nginx currently HTTP-only (temp config); full SSL config is in deploy/nginx/souqrates.conf
- Better Stack warning on startup is harmless (integration not configured yet)
