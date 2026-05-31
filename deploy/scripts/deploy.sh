#!/usr/bin/env bash
# Incremental deploy: pull latest code, rebuild, sync static assets,
# reinstall bot deps if requirements changed, restart all services.
# Run AS ROOT after the initial install.sh has succeeded.

set -euo pipefail

REPO_BRANCH="${REPO_BRANCH:-main}"
APP_USER="souqrates"
APP_HOME="/opt/souqrates"
REPO_DIR="${APP_HOME}/repo"
VENVS_DIR="${APP_HOME}/venvs"
WWW_DIR="/var/www/souqrates"

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo bash $0)" >&2; exit 1
fi

log "git pull"
sudo -u "${APP_USER}" git -C "${REPO_DIR}" fetch --depth=1 origin "${REPO_BRANCH}"
PREV=$(sudo -u "${APP_USER}" git -C "${REPO_DIR}" rev-parse HEAD)
sudo -u "${APP_USER}" git -C "${REPO_DIR}" reset --hard "origin/${REPO_BRANCH}"
HEAD=$(sudo -u "${APP_USER}" git -C "${REPO_DIR}" rev-parse HEAD)
echo "  ${PREV:0:8} → ${HEAD:0:8}"

CHANGED=$(sudo -u "${APP_USER}" git -C "${REPO_DIR}" diff --name-only "${PREV}" "${HEAD}" || true)

# ── Read VITE_ build-time vars (baked into games-bot bundle at compile time) ──
# games-bot Mini App calls Supabase directly for XP / ranks / gamification.
# Without these the bundle falls back to a no-op stub → ranks always show 0.
GAMES_BOT_ENV="/etc/souqrates/games-bot-build.env"
VITE_SB_URL=""
VITE_SB_ANON=""
if [[ -f "$GAMES_BOT_ENV" ]]; then
  VITE_SB_URL=$(grep  '^VITE_SUPABASE_URL='      "$GAMES_BOT_ENV" | cut -d= -f2- || true)
  VITE_SB_ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' "$GAMES_BOT_ENV" | cut -d= -f2- || true)
else
  echo "  ⚠  $GAMES_BOT_ENV not found — games-bot ranks/XP will be disabled"
fi

log "Fix node_modules ownership (prevent EACCES on pnpm install)"
chown -R "${APP_USER}:${APP_USER}" "${REPO_DIR}/node_modules" 2>/dev/null || true
chown -R "${APP_USER}:${APP_USER}" "${REPO_DIR}" 2>/dev/null || true

log "pnpm install + typecheck + build"
sudo -u "${APP_USER}" -H bash -lc "
  set -euo pipefail
  cd '${REPO_DIR}'
  # Remove stale pnpm lock file that can block install
  rm -f node_modules/.pnpm/lock.yaml 2>/dev/null || true
"
sudo -u "${APP_USER}" -H bash -lc "
  set -euo pipefail
  cd '${REPO_DIR}'
  pnpm install --frozen-lockfile
  pnpm run typecheck
  pnpm --filter @workspace/api-server run build
  # mother-bot-web is the root Mini App (BASE_PATH=/ — no slug prefix)
  PORT=1 BASE_PATH=/ pnpm --filter @workspace/mother-bot-web run build
  for slug in superadmin books-bot-web contests-bot-web subagents-bot-web scratchy-bot-web games-bot; do
    if [ \"\$slug\" = \"games-bot\" ]; then
      VITE_SUPABASE_URL='${VITE_SB_URL}' VITE_SUPABASE_ANON_KEY='${VITE_SB_ANON}' PORT=1 BASE_PATH=/\${slug}/ pnpm --filter @workspace/\${slug} run build
    else
      PORT=1 BASE_PATH=/\${slug}/ pnpm --filter @workspace/\${slug} run build
    fi
  done
"

log "rsync static assets"
# Slug-based apps → each goes to its own subdirectory
for slug in superadmin books-bot-web contests-bot-web subagents-bot-web scratchy-bot-web games-bot; do
  artifact_dir="$slug"; [[ "$slug" == "scratchy-bot-web" ]] && artifact_dir="bot-demo"
  src="${REPO_DIR}/artifacts/${artifact_dir}/dist/public"
  dst="${WWW_DIR}/${slug}"
  [[ -d "$src" ]] || continue
  install -d -o "${APP_USER}" -g "${APP_USER}" "${dst}"
  rsync -a --delete "${src}/" "${dst}/"
  chown -R "${APP_USER}:${APP_USER}" "${dst}"
done
# mother-bot-web → WWW root (BASE_PATH=/) — exclude slug subdirs to avoid wiping them
src="${REPO_DIR}/artifacts/mother-bot-web/dist/public"
if [[ -d "$src" ]]; then
  rsync -a \
    --exclude 'superadmin' --exclude 'books-bot-web' --exclude 'contests-bot-web' \
    --exclude 'subagents-bot-web' --exclude 'games-bot' --exclude 'scratchy-bot-web' \
    "${src}/" "${WWW_DIR}/"
  chown -R "${APP_USER}:${APP_USER}" "${WWW_DIR}/index.html" "${WWW_DIR}/assets" 2>/dev/null || true
  echo "  ✓ mother-bot-web synced to WWW root"
fi

log "Cloudflare cache purge (HTML index files)"
CF_ENV="/etc/souqrates/api-server.env"
CF_TOKEN=""
CF_ZONE=""
if [[ -f "$CF_ENV" ]]; then
  CF_TOKEN=$(grep '^CLOUDFLARE_API_TOKEN=' "$CF_ENV" | cut -d= -f2- | tr -d '"' || true)
  CF_ZONE=$(grep  '^CLOUDFLARE_ZONE_ID='    "$CF_ENV" | cut -d= -f2- | tr -d '"' || true)
fi
if [[ -n "$CF_TOKEN" && -n "$CF_ZONE" ]]; then
  PURGE_FILES='["https://souqrates.com/","https://souqrates.com/superadmin/","https://souqrates.com/books-bot-web/","https://souqrates.com/contests-bot-web/","https://souqrates.com/subagents-bot-web/","https://souqrates.com/games-bot/","https://souqrates.com/scratchy-bot-web/"]'
  RESULT=$(curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/purge_cache" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"files\":${PURGE_FILES}}" 2>&1 || true)
  if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
    echo "  ✓ HTML cache purged from Cloudflare edge"
  else
    echo "  ⚠ Cloudflare purge failed — token may lack Cache Purge permission"
    echo "    $(echo "$RESULT" | head -c 200)"
  fi
else
  echo "  ⚠ CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not in ${CF_ENV} — skipping"
fi

log "Refresh Python deps if requirements.txt changed"
for bot in mother-bot books-bot contests-bot subagents-bot scratchy-bot; do
  if echo "$CHANGED" | grep -q "^artifacts/${bot}/requirements.txt$"; then
    echo "  reinstalling ${bot} deps"
    sudo -u "${APP_USER}" "${VENVS_DIR}/${bot}/bin/pip" install --quiet -r "${REPO_DIR}/artifacts/${bot}/requirements.txt"
  fi
done

log "Reinstall systemd units / nginx config if changed"
if echo "$CHANGED" | grep -q '^deploy/systemd/'; then
  install -m 0644 "${REPO_DIR}/deploy/systemd/"*.service /etc/systemd/system/
  systemctl daemon-reload
fi
if echo "$CHANGED" | grep -q '^deploy/nginx/'; then
  install -m 0644 "${REPO_DIR}/deploy/nginx/souqrates.conf" /etc/nginx/sites-available/souqrates.conf
  nginx -t && systemctl reload nginx
fi

log "Restart services"
systemctl restart souqrates-api.service
sleep 5
systemctl restart \
  souqrates-mother-bot.service \
  souqrates-books-bot.service \
  souqrates-contests-bot.service \
  souqrates-subagents-bot.service \
  souqrates-scratchy-bot.service

log "Health check (waiting 35s for bots to initialise…)"
sleep 35
# API — retry up to 5 times, 3s apart
api_ok=0
for i in 1 2 3 4 5; do
  if curl -sfS http://127.0.0.1:8080/api/healthz 2>/dev/null; then
    echo "  api ok"; api_ok=1; break
  fi
  echo "  api not ready yet (attempt $i/5)…"; sleep 3
done
[[ $api_ok -eq 0 ]] && echo "  ⚠ api did not respond — check: journalctl -u souqrates-api.service -n 30"
# Bots
for p in 8101:mother-bot 8102:books-bot 8103:contests-bot 8104:subagents-bot 8105:scratchy-bot; do
  port="${p%:*}"; slug="${p#*:}"
  if curl -sfS "http://127.0.0.1:${port}/telegram-webhook/${slug}/healthz" 2>/dev/null; then
    echo "  ${slug} ok"
  else
    echo "  ⚠ ${slug} did not respond — check: journalctl -u souqrates-${slug}.service -n 20"
  fi
done

log "Deploy complete: ${HEAD:0:8}"
