# SOUQRATES — Replit → Contabo + Neon + Cloudflare R2 Migration Runbook

Single source of truth for the production cutover. Run every command **on the
Contabo VPS (194.163.155.52)** unless the section header says otherwise.

The codebase is already migration-ready: storage auto-switches to S3/R2 when
`S3_ENDPOINT` is set, and bots auto-switch to webhook mode when `USE_WEBHOOK=1`
is set. No code changes are required for the cutover — only env wiring.

---

## Step 1 — Bots → webhook (CODE READY ✅)

All four Python bots (`mother-bot`, `books-bot`, `contests-bot`,
`subagents-bot`) end `main()` with `await run_bot(bot, dp, "<slug>")` from a
shared `webhook_runtime.py` (byte-identical per bot dir). With `USE_WEBHOOK`
unset they stay on polling — that's what Replit runs today.

### Env on VPS (per bot service)
```
USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET=<random 32+ chars; one per bot is safer but a single shared one is OK>
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=<see table>
```

| Bot           | WEBHOOK_PORT | Telegram path                       |
|---------------|--------------|-------------------------------------|
| mother-bot    | 8101         | /telegram-webhook/mother-bot        |
| books-bot     | 8102         | /telegram-webhook/books-bot         |
| contests-bot  | 8103         | /telegram-webhook/contests-bot      |
| subagents-bot | 8104         | /telegram-webhook/subagents-bot     |

**On VPS set `DISABLE_SUBAGENTS_SPAWN=1` in the mother-bot's systemd unit.**
Otherwise the mother-bot process will also fork-launch subagents-bot via
`subprocess.Popen` (Replit-only workaround for the 10-workflow cap), and you'd
end up with two `subagents-bot` processes competing for the same Telegram
webhook. Each bot must be its own systemd service on Contabo.

Health probe per bot: `GET /telegram-webhook/<slug>/healthz` → `ok <slug>`.

### nginx fragment
```nginx
# inside server { listen 443 ssl; server_name souqrates.com; ... }

location /telegram-webhook/mother-bot    { proxy_pass http://127.0.0.1:8101; include /etc/nginx/snippets/tg-proxy.conf; }
location /telegram-webhook/books-bot     { proxy_pass http://127.0.0.1:8102; include /etc/nginx/snippets/tg-proxy.conf; }
location /telegram-webhook/contests-bot  { proxy_pass http://127.0.0.1:8103; include /etc/nginx/snippets/tg-proxy.conf; }
location /telegram-webhook/subagents-bot { proxy_pass http://127.0.0.1:8104; include /etc/nginx/snippets/tg-proxy.conf; }
```

`/etc/nginx/snippets/tg-proxy.conf`:
```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# Telegram passes the secret here — preserve it verbatim.
proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
proxy_read_timeout 75s;
client_max_body_size 25m;
```

---

## Step 2 — Files: Replit Object Storage → Cloudflare R2 (DATA: NOTHING TO MIGRATE)

Audit run 2026-05-27 against the live DB — counted distinct origins of every
file-bearing column (`avatar_url`, `cover_url`, `file_url`, `photo_url`,
`id_photo_path`, `bonus_file_url`, `draft_image_url`, `published_image_url`,
`media_url`):

- Internal `/objects/...` references: **0**
- Legacy `https://storage.googleapis.com/...` references: **0**
- Only non-empty column: `digital_products.file_url` (12 rows, all external
  HTTP URLs — sample data / 3rd-party PDFs, nothing on Replit storage).

**Therefore no DB-referenced file needs copying.** The application already
writes new uploads to R2 because `S3_ENDPOINT` is set in Replit secrets, so
the runtime selects `s3Storage.ts` (see `objectStorage.ts:24`).

### Insurance mirror (optional, ~5 min)
If you want to be 100% safe in case orphan/un-DB-referenced files exist on
the Replit bucket, mirror it once on the VPS:

```bash
# Install rclone if missing
curl -fsSL https://rclone.org/install.sh | sudo bash

cat > ~/.config/rclone/rclone.conf <<'CFG'
[r2]
type = s3
provider = Cloudflare
endpoint = https://fbdc242872a8b998c83e4dea16cc2154.r2.cloudflarestorage.com
access_key_id = <S3_ACCESS_KEY>
secret_access_key = <S3_SECRET_KEY>
region = auto
acl = private

# Replit Object Storage is GCS-backed. From Replit shell:
#   gcloud auth application-default print-access-token
# then export as a service-account JSON if you have one, or use a
# Replit-issued signed bucket URL. Skip if you don't have these — there
# is nothing in the DB to migrate.
[replit-gcs]
type = google cloud storage
service_account_file = /root/replit-sa.json
project_number = <project-id-from-replit>
CFG

# Dry run first
rclone copy replit-gcs:<old-bucket-name> r2:<R2_BUCKET> --dry-run --progress
# Real copy
rclone copy replit-gcs:<old-bucket-name> r2:<R2_BUCKET> --progress --transfers 16 --checkers 32
# Verify
rclone check replit-gcs:<old-bucket-name> r2:<R2_BUCKET>
```

### Env on VPS (api-server)
```
S3_ENDPOINT=https://fbdc242872a8b998c83e4dea16cc2154.r2.cloudflarestorage.com
S3_BUCKET=<your R2 bucket name>
S3_REGION=auto
S3_ACCESS_KEY=<R2 access key>
S3_SECRET_KEY=<R2 secret>
PRIVATE_OBJECT_DIR=/<R2_BUCKET>/private
PUBLIC_OBJECT_SEARCH_PATHS=/<R2_BUCKET>/public
# Do NOT set DEFAULT_OBJECT_STORAGE_BUCKET_ID on VPS — that's a Replit-only var.
```

---

## Step 3 — DNS cutover + final E2E

Pre-flight on VPS (before flipping DNS):
1. All 4 bot systemd services are active, healthcheck returns ok.
2. `curl -sf http://127.0.0.1:8101/telegram-webhook/mother-bot/healthz` etc.
3. `nginx -t && systemctl reload nginx`
4. Hit `https://souqrates.com/api/healthz` via the VPS's own IP through a
   `/etc/hosts` override and confirm 200.
5. api-server logs show `useS3 = true` (or no errors on first upload).

### Cloudflare DNS flip
- Set `souqrates.com` and `www.souqrates.com` A records to `194.163.155.52`
  (proxied: orange cloud ON for caching/WAF; bots-only paths
  `/telegram-webhook/*` must bypass cache — add a Page Rule: "Cache Level:
  Bypass" for `souqrates.com/telegram-webhook/*`).
- TTL 60s during cutover; raise to 1h after stability is confirmed.

### Bot side
On the VPS, after webhook env is set and services are up, each bot's first
boot calls `bot.set_webhook(url, secret_token=…, drop_pending_updates=True)`
automatically — no manual Telegram API call needed.

If you ever need to roll back to polling on Replit: just `unset USE_WEBHOOK`
in Replit secrets and restart the mother-bot workflow; the runtime will
`delete_webhook()` first and resume polling.

### E2E checklist (run from a real Telegram client)
- [ ] `/start` to each of the 4 bots → no "bot stopped" error.
- [ ] Mother-bot: open Mini App → wallet loads.
- [ ] Books-bot: browse a product page (covers load from R2 — open the
      image URL in browser, confirm it's an R2 signed URL).
- [ ] Contests-bot: open contests Mini App, cast a free vote.
- [ ] Sub-agents bot: submit a fresh application with ID photo —
      confirm photo round-trips through `/api/subagents/me`.
- [ ] Make one Telegram Stars test deposit → confirm SKZ credited.
- [ ] Open `/api/healthz` from the public domain → 200.
- [ ] Sentry receives no new errors for 15 min.

### Post-cutover
- Disable the Replit deployment (or scale to zero) once 24 h pass clean.
- Snapshot Neon DB.
- Rotate `WEBHOOK_SECRET` and `ADMIN_TOKEN` (the values used during the
  Replit era should be retired).
