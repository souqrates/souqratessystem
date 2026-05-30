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
  for slug in superadmin books-bot-web contests-bot-web subagents-bot-web bot-demo games-bot mother-bot-web; do
    if [ \"\$slug\" = \"games-bot\" ]; then
      BP=/\${slug}/
      VITE_SUPABASE_URL='${VITE_SB_URL}' VITE_SUPABASE_ANON_KEY='${VITE_SB_ANON}' PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
    elif [ \"\$slug\" = \"bot-demo\" ]; then
      BP=/sweep-bot-web/
      PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
    elif [ \"\$slug\" = \"mother-bot-web\" ]; then
      # SOUQRATES SYSTEM hub — served at the site root (/)
      BP=/
      PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
    else
      BP=/\${slug}/
      PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
    fi
  done
"

log "rsync static assets"
for slug in superadmin books-bot-web contests-bot-web subagents-bot-web bot-demo games-bot mother-bot-web; do
  src="${REPO_DIR}/artifacts/${slug}/dist/public"
  # bot-demo is the SWEEP Mini App — deploy to sweep-bot-web/ so nginx finds it.
  # mother-bot-web is the SOUQRATES SYSTEM hub — deploy to hub/ (served at site root).
  if [[ "$slug" == "bot-demo" ]]; then dst="${WWW_DIR}/sweep-bot-web";
  elif [[ "$slug" == "mother-bot-web" ]]; then dst="${WWW_DIR}/hub";
  else dst="${WWW_DIR}/${slug}"; fi
  [[ -d "$src" ]] || continue
  install -d -o "${APP_USER}" -g "${APP_USER}" "${dst}"
  rsync -a --delete "${src}/" "${dst}/"
  chown -R "${APP_USER}:${APP_USER}" "${dst}"
done

log "Seed new env files (first deploy of a new bot)"
ENV_DIR="/etc/souqrates"
for f in sweep-bot; do
  src="${REPO_DIR}/deploy/env/${f}.env.example"
  dst="${ENV_DIR}/${f}.env"
  if [[ ! -f "$dst" && -f "$src" ]]; then
    install -m 0640 -o root -g "${APP_USER}" "$src" "$dst"
    echo "  → seeded ${dst}  ← EDIT before the service restarts"
  fi
done

log "Ensure Python venvs exist + refresh deps if requirements.txt changed"
for bot in mother-bot books-bot contests-bot subagents-bot sweep-bot; do
  venv="${VENVS_DIR}/${bot}"
  req="${REPO_DIR}/artifacts/${bot}/requirements.txt"
  if [[ ! -f "$req" ]]; then echo "  skip ${bot}: no requirements.txt"; continue; fi
  if [[ ! -d "$venv" ]]; then
    echo "  creating venv for ${bot} (first deploy)"
    sudo -u "${APP_USER}" python3.12 -m venv "$venv"
    sudo -u "${APP_USER}" "${venv}/bin/pip" install --quiet --upgrade pip
    sudo -u "${APP_USER}" "${venv}/bin/pip" install --quiet -r "$req"
  elif echo "$CHANGED" | grep -q "^artifacts/${bot}/requirements.txt$"; then
    echo "  reinstalling ${bot} deps"
    sudo -u "${APP_USER}" "${venv}/bin/pip" install --quiet -r "$req"
  fi
done

log "Reinstall systemd units (always — ensures new services are registered)"
install -m 0644 "${REPO_DIR}/deploy/systemd/"*.service /etc/systemd/system/
systemctl daemon-reload
# Enable any service that isn't yet enabled (new bots added after initial install)
for svc in souqrates-api souqrates-mother-bot souqrates-books-bot \
            souqrates-contests-bot souqrates-subagents-bot souqrates-sweep-bot; do
  systemctl is-enabled --quiet "${svc}.service" || systemctl enable "${svc}.service"
done

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
  souqrates-subagents-bot.service \
  souqrates-sweep-bot.service

log "Health check"
sleep 8
curl -sfS http://127.0.0.1:8080/api/healthz && echo "  api ok"
for p in 8101:mother-bot 8102:books-bot 8103:contests-bot 8104:subagents-bot 8105:sweep-bot; do
  port="${p%:*}"; slug="${p#*:}"
  curl -sfS "http://127.0.0.1:${port}/telegram-webhook/${slug}/healthz" && echo
done

log "Deploy complete: ${HEAD:0:8}"
