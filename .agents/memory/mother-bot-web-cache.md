---
name: mother-bot-web cache and security headers
description: Cache-control policy and security headers for the raw-Node.js static server.
---

## Policy (server.js)

| File type              | Cache-Control                              |
|------------------------|--------------------------------------------|
| `index.html`, `bots.html` | `no-store`                            |
| `/assets/*` (Vite-hashed) | `public, max-age=31536000, immutable` |
| Everything else        | `no-store`                                 |

## Security headers (every response)
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
```

**Why:** `no-cache` for HTML still allows browsers to serve stale cached
content after revalidation fails; `no-store` prevents any caching at all,
ensuring users always get the latest shell after a deploy.

**How to apply:** Any change to server.js must preserve both the SECURITY_HEADERS
spread on all `res.writeHead()` calls AND the `isHashedAsset` check.
