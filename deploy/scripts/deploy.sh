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
  for slug in superadmin books-bot-web contests-bot-web subagents-bot-web bot-demo games-bot; do
    if [ \"\$slug\" = \"bot-demo\" ]; then BP=/; else BP=/\${slug}/; fi
    if [ \"\$slug\" = \"games-bot\" ]; then
      VITE_SUPABASE_URL='${VITE_SB_URL}' VITE_SUPABASE_ANON_KEY='${VITE_SB_ANON}' PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
    else
      PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
    fi
  done
"

log "rsync static assets"
for slug in superadmin books-bot-web contests-bot-web subagents-bot-web bot-demo games-bot; do
  src="${REPO_DIR}/artifacts/${slug}/dist/public"
  dst="${WWW_DIR}/${slug}"
  [[ -d "$src" ]] || continue
  install -d -o "${APP_USER}" -g "${APP_USER}" "${dst}"
  rsync -a --delete "${src}/" "${dst}/"
  chown -R "${APP_USER}:${APP_USER}" "${dst}"
done

log "Refresh Python deps if requirements.txt changed"
for bot in mother-bot books-bot contests-bot subagents-bot; do
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
sleep 2
systemctl restart \
  souqrates-mother-bot.service \
  souqrates-books-bot.service \
  souqrates-contests-bot.service \
  souqrates-subagents-bot.service

log "Health check"
sleep 3
curl -sfS http://127.0.0.1:8080/api/healthz && echo "  api ok"
for p in 8101:mother-bot 8102:books-bot 8103:contests-bot 8104:subagents-bot; do
  port="${p%:*}"; slug="${p#*:}"
  curl -sfS "http://127.0.0.1:${port}/telegram-webhook/${slug}/healthz" && echo
done

log "Deploy complete: ${HEAD:0:8}"
