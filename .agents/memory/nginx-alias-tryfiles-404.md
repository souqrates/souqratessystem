---
name: nginx alias + try_files → asset 404 (black screen)
description: Why every Mini App served a blank/black screen in production and the exact nginx fix.
---

# Symptom

Every Vite Mini App on souqrates.com (superadmin, books/contests/subagents/games/sweep)
showed a black screen in the Telegram WebView. The HTML (`/<slug>/`) returned 200,
but every hashed asset (`/<slug>/assets/index-*.js`, `*.css`) returned **404** —
so React never booted and `#root` stayed empty.

# Root cause

The nginx static blocks used `alias /var/www/souqrates/<slug>/;` together with
`try_files`. `alias` + `try_files` is a long-standing nginx footgun: nginx
mis-builds the path (effectively duplicating the location prefix), so the file is
not found even though it exists on disk at the exact referenced hash. The outer
block still served `index.html` because its `try_files` fallback was the named
`/<slug>/index.html`, which masked the problem — only the assets 404'd.

# Fix

Replace `alias /var/www/souqrates/<slug>/;` with `root /var/www/souqrates;` in
**every** static location block (outer + nested asset regex block). Because the
URL path `/<slug>/...` maps 1:1 to `/var/www/souqrates/<slug>/...`, `root` makes
nginx resolve `root + full_uri` correctly and `try_files` then works.

**Why root not alias:** with `root`, nginx appends the full request URI to the
root dir (no prefix stripping), giving the correct path. With `alias` + try_files
the prefix handling is broken.

**How to apply:** edit `deploy/nginx/souqrates.conf`; deploy.sh auto-installs +
`nginx -t && systemctl reload nginx` whenever a file under `deploy/nginx/`
changes. For an immediate hotfix on the server:
`sudo sed -i -E 's#^([[:space:]]*)alias /var/www/souqrates/[^;]+;#\1root /var/www/souqrates;#' /etc/nginx/sites-available/souqrates.conf && sudo nginx -t && sudo systemctl reload nginx`

# Diagnostic that nails it

`curl -I https://souqrates.com/<slug>/` → 200, but
`curl -o /dev/null -w '%{http_code}' https://souqrates.com/<slug>/assets/<hash>.js` → 404,
while the file IS present on disk (`ls /var/www/souqrates/<slug>/assets/`) with the
exact hash index.html references = nginx path bug, not a deploy/build problem.
