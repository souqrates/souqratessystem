---
name: nginx subpath SPA static serving
description: Why subpath SPAs (/games-bot/, /superadmin/, etc.) 404 all hashed assets, and the two-layer root cause (nginx alias bug + Cloudflare 404 caching).
---

# nginx subpath static (souqrates.com, Contabo)

Multiple branded SPAs are served at subpaths off one domain: `/superadmin/`,
`/books-bot-web/`, `/contests-bot-web/`, `/subagents-bot-web/`, `/games-bot/`,
plus `bot-demo` at `/`. On-disk layout: `/var/www/souqrates/<slug>/...`.

## Rule: use `root /var/www/souqrates`, never `alias`, for these blocks

**Why:** with `location /games-bot/ { alias /var/www/souqrates/games-bot/; try_files $uri ... }`
nginx appends the FULL request URI (including the `/games-bot/` prefix) to the
alias path → it looks for `/var/www/souqrates/games-bot/games-bot/assets/...`
(doubled prefix) → 404 on every hashed JS/CSS asset. The SPA HTML still loads
(served via the `/slug/index.html` fallback), so the symptom is a black screen:
HTML loads, no JS.

Because the on-disk layout already includes the slug dir, `root /var/www/souqrates`
+ `$uri` resolves correctly: `/var/www/souqrates` + `/games-bot/assets/x.js` =
the real file. `try_files $uri =404` then works.

**Do NOT** try to fix the alias form with `try_files $request_filename =404` —
it does not resolve correctly in these nested regex asset locations and it also
broke the root-based `bot-demo` block. The fix is `root` + `$uri`, full stop.

**How to apply:** every subpath block (outer + nested `~* \.(js|css|...)$`) uses
`root /var/www/souqrates;`. The root `/` block (bot-demo) uses
`root /var/www/souqrates/bot-demo;`. Source of truth: `deploy/nginx/souqrates.conf`.

## Cloudflare caches the 404s — purge after fixing origin

souqrates.com is fronted by Cloudflare. After fixing nginx, the origin
(`curl -sk https://127.0.0.1/<path> -H "Host: souqrates.com"`) returned 200 for
ALL assets, but through `souqrates.com` some still returned 404 because
Cloudflare had cached the pre-fix 404 for the exact asset URLs that were curled
repeatedly during debugging. Purge Cloudflare cache (dashboard → Caching →
Purge Everything, or API `purge_cache {"purge_everything":true}`) then re-test.

**Always isolate origin vs edge** when souqrates.com disagrees with the file on
disk: test `https://127.0.0.1/... -H "Host: souqrates.com"` first. 200 at origin
+ 404 at edge = Cloudflare cache, not nginx.

## Sync gotcha

Replit checkpoint commits do NOT auto-push to the git remote Contabo pulls from
(`git pull` on Contabo said "already up to date"). The live `/etc/nginx` fix was
applied by direct `sed` on Contabo; the Replit `deploy/nginx/souqrates.conf` is
also fixed. Push Replit → remote so a future `git pull` on Contabo keeps the fix.
`deploy.sh` does NOT copy nginx config, so a redeploy won't clobber live nginx.
