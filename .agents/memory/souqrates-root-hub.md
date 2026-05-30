---
name: SOUQRATES root hub
description: souqrates.com root serves the unified hub (mother-bot-web), not the SWEEP app — routing/deploy/bot wiring and why.
---

# souqrates.com root = the unified hub

The site root `/` serves the **SOUQRATES SYSTEM hub** — a portal that links to
every bot's Mini App. It is NOT the SWEEP app and NOT a redirect.

**History:** the root historically served the SWEEP app (bot-demo) and at one
point 301-redirected `/` → `/sweep-bot-web/`. There was never a real "mother web
app" before this — the old `mother-bot-web` dir held only stale node_modules.

## Key facts (decisions, not derivable from a quick grep)

- **`artifacts/mother-bot-web` is a plain workspace package, NOT a registered
  Replit artifact.** The repo already hit the 7-artifact cap, so `createArtifact`
  fails. Consequence: there is **no dev workflow / preview** for the hub — it only
  exists in production via nginx + deploy.sh. Verify it locally with
  `BASE_PATH=/ pnpm --filter @workspace/mother-bot-web run build` (assets must be
  root-relative `/assets/...`).
- **nginx root block uses `root` (never `alias`).** `location /` →
  `root /var/www/souqrates/hub; try_files $uri $uri/ /index.html;`. The
  `alias`+`try_files` combo causes the asset-404 black screen (see
  nginx-alias-tryfiles-404.md). Per-bot prefix blocks (`/games-bot/`,
  `/sweep-bot-web/`, …) are more specific so they still win over `/`.
- **Hub deploys to its OWN dir `/var/www/souqrates/hub`**, never the parent
  `/var/www/souqrates`. deploy.sh uses `rsync --delete`; targeting the parent
  would wipe every sibling app dir.
- **`MINI_APP_URL` (mother bot's main button) points to the root `/`** = the hub.
  Safe because root is served statically (no 3xx) — Telegram WebView black-screens
  on any redirect.

**Why:** user clarified souqrates.com must be "البوت الأساسي الذي يحتوي كل البوتات"
— a single entry portal, not one of the sub-apps.

## Deploy is the user's manual server step

Agent CANNOT SSH to Contabo (no private key in the Replit env — only known_hosts;
`ssh root@194.163.155.52` → Permission denied publickey). Flow is: agent commits
(platform checkpoint) → `git push origin main` (GitHub) → **user** runs
`sudo bash /opt/souqrates/repo/deploy/scripts/deploy.sh` on the server, which does
`git reset --hard origin/main` then rebuilds. So GitHub origin MUST have the commit
before the server deploy, and nginx only reloads when `deploy/nginx/` is in the git
diff.
