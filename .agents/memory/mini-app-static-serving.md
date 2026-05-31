---
name: Mini App static serving
description: Why Telegram Mini Apps must be served as production static builds, not Vite dev servers — and the exact build + serve pattern to use.
---

## Rule
Every Telegram Mini App artifact (books-bot-web, scratchy/bot-demo, contests-bot-web, subagents-bot-web, games-bot) MUST be served as a production static build via `node server.js`, NOT as a Vite dev server.

**Why:** Vite dev server injects `/@vite/client` (HMR WebSocket client) and serves unbundled ESM modules that require live Vite transformation. Telegram's in-app webview blocks or fails on HMR websockets → blank screen / "app doesn't open". Works fine in browser preview (same session/origin) but silently fails inside Telegram.

`mother-bot-web` was converted to static serving first — this is the established pattern for the project.

## How to apply

### Build (must set BASE_PATH)
```bash
BASE_PATH=/<slug>/ pnpm --filter @workspace/<package> run build
```
Without BASE_PATH, Vite uses `base: "/"` → assets get root-relative paths `/assets/…` → proxy routes them to mother-bot-web (path `/`) which doesn't have them → `SyntaxError: Unexpected token '<'`.

Correct paths look like: `/books-bot-web/assets/index-<hash>.js`

### Serve (server.js)
Each artifact gets a `server.js` (ESM, reads BASE_PATH + PORT from env) that:
1. Strips the BASE_PATH prefix from request URLs (proxy sends full paths)
2. Serves files from `dist/public/`
3. Falls back to `index.html` for SPA routes (anything not found → index.html)
4. Sets `Cache-Control: immutable` for `/assets/*`, `no-cache` for index.html

### package.json
Change `"dev"` script from `vite --host 0.0.0.0` to `node server.js`.
Keep `"build"` as Vite build (needed for rebuilds).

### After code changes
Must rebuild + restart workflow:
```bash
BASE_PATH=/<slug>/ pnpm --filter @workspace/<package> run build
# then restart the workflow
```

## Artifact BASE_PATH / port map
| Artifact dir     | package                    | BASE_PATH             | port  |
|-----------------|----------------------------|-----------------------|-------|
| books-bot-web   | @workspace/books-bot-web   | /books-bot-web/       | 23758 |
| bot-demo        | @workspace/scratchy-bot-web| /scratchy-bot-web/    | 21905 |
| contests-bot-web| @workspace/contests-bot-web| /contests-bot-web/    | 18555 |
| subagents-bot-web|@workspace/subagents-bot-web| /subagents-bot-web/  | 23482 |
| games-bot       | @workspace/games-bot       | /games-bot/           | 21906 |
| mother-bot-web  | @workspace/mother-bot-web  | /                     | 17321 |
