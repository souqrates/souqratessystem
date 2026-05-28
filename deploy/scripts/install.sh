#!/usr/bin/env bash
# One-shot bootstrap for SOUQRATES on a fresh Ubuntu 22.04/24.04 Contabo VPS.
# Run AS ROOT:  bash deploy/scripts/install.sh
#
# Idempotent: safe to re-run. It installs system packages, creates the
# `souqrates` system user, installs Node 24 + pnpm + Python 3.12, clones
# (or pulls) the repo into /opt/souqrates/repo, builds every artifact,
# creates per-bot Python venvs, copies systemd units and the nginx config,
# and prints next steps.
#
# It does NOT: edit DNS, request TLS certs, fill /etc/souqrates/*.env,
# enable/start services. Those are explicit follow-up steps so you can
# review env files first.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/souqrates/souqratessystem.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_USER="souqrates"
APP_HOME="/opt/souqrates"
REPO_DIR="${APP_HOME}/repo"
VENVS_DIR="${APP_HOME}/venvs"
WWW_DIR="/var/www/souqrates"
ENV_DIR="/etc/souqrates"

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo bash $0)" >&2; exit 1
fi

log "1/9  apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git build-essential pkg-config \
  python3.12 python3.12-venv python3-pip \
  nginx certbot python3-certbot-nginx \
  ufw rsync jq

log "2/9  Node.js 24 (NodeSource) + pnpm"
if ! command -v node >/dev/null || [[ "$(node -v)" != v24.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
if ! command -v pnpm >/dev/null; then
  npm install -g pnpm@10
fi
node -v && pnpm -v

log "3/9  Create system user '${APP_USER}'"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${APP_HOME}" --shell /bin/bash "${APP_USER}"
fi
install -d -o "${APP_USER}" -g "${APP_USER}" "${REPO_DIR}" "${VENVS_DIR}" "${WWW_DIR}"
install -d -m 0750 -o root -g "${APP_USER}" "${ENV_DIR}"

log "4/9  Clone or update repo at ${REPO_DIR}"
if [[ -d "${REPO_DIR}/.git" ]]; then
  sudo -u "${APP_USER}" git -C "${REPO_DIR}" fetch --depth=1 origin "${REPO_BRANCH}"
  sudo -u "${APP_USER}" git -C "${REPO_DIR}" reset --hard "origin/${REPO_BRANCH}"
else
  sudo -u "${APP_USER}" git clone --depth=1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${REPO_DIR}"
fi

log "5/9  pnpm install + build everything"
# Delete committed lockfile so pnpm 11 regenerates it with correct build approvals
# (pnpm 11 encodes onlyBuiltDependencies approvals in the lockfile at resolution time;
#  a lockfile generated on another machine won't have those entries yet)
rm -f "${REPO_DIR}/pnpm-lock.yaml"
sudo -u "${APP_USER}" -H bash -lc "
  set -euo pipefail
  cd '${REPO_DIR}'
  pnpm install
  pnpm run typecheck
  pnpm --filter @workspace/api-server run build
  for slug in superadmin books-bot-web contests-bot-web subagents-bot-web bot-demo games-bot; do
    # bot-demo is served from / on the VPS (matches its artifact.toml).
    # Every other artifact lives under its own path prefix.
    if [ \"\$slug\" = \"bot-demo\" ]; then BP=/; else BP=/\${slug}/; fi
    PORT=1 BASE_PATH=\$BP pnpm --filter @workspace/\${slug} run build
  done
"

log "6/9  Copy built static assets into ${WWW_DIR}"
for slug in superadmin books-bot-web contests-bot-web subagents-bot-web bot-demo games-bot; do
  src="${REPO_DIR}/artifacts/${slug}/dist/public"
  dst="${WWW_DIR}/${slug}"
  [[ -d "$src" ]] || { echo "  skip ${slug}: ${src} missing"; continue; }
  install -d -o "${APP_USER}" -g "${APP_USER}" "${dst}"
  rsync -a --delete "${src}/" "${dst}/"
  chown -R "${APP_USER}:${APP_USER}" "${dst}"
done

log "7/9  Python venvs for the 4 bots"
for bot in mother-bot books-bot contests-bot subagents-bot; do
  venv="${VENVS_DIR}/${bot}"
  req="${REPO_DIR}/artifacts/${bot}/requirements.txt"
  if [[ ! -f "$req" ]]; then echo "  skip ${bot}: no requirements.txt"; continue; fi
  if [[ ! -d "$venv" ]]; then
    sudo -u "${APP_USER}" python3.12 -m venv "$venv"
  fi
  sudo -u "${APP_USER}" "${venv}/bin/pip" install --quiet --upgrade pip
  sudo -u "${APP_USER}" "${venv}/bin/pip" install --quiet -r "$req"
done

log "8/9  Install systemd units + nginx site"
install -m 0644 "${REPO_DIR}/deploy/systemd/"*.service /etc/systemd/system/
install -m 0644 "${REPO_DIR}/deploy/nginx/souqrates.conf" /etc/nginx/sites-available/souqrates.conf
ln -sf /etc/nginx/sites-available/souqrates.conf /etc/nginx/sites-enabled/souqrates.conf
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot
systemctl daemon-reload

log "9/9  Seed example env files (if not already present)"
for f in api-server mother-bot books-bot contests-bot subagents-bot; do
  src="${REPO_DIR}/deploy/env/${f}.env.example"
  dst="${ENV_DIR}/${f}.env"
  if [[ ! -f "$dst" ]]; then
    install -m 0640 -o root -g "${APP_USER}" "$src" "$dst"
    echo "  → seeded ${dst} (EDIT IT before starting the service)"
  else
    echo "  ✓ ${dst} already exists; not overwriting"
  fi
done

cat <<EOF

============================================================
  Install finished. Next steps (in order):
============================================================

1. Fill the 5 env files in ${ENV_DIR}/   (chmod is already 0640)
       \$EDITOR ${ENV_DIR}/api-server.env
       \$EDITOR ${ENV_DIR}/mother-bot.env
       \$EDITOR ${ENV_DIR}/books-bot.env
       \$EDITOR ${ENV_DIR}/contests-bot.env
       \$EDITOR ${ENV_DIR}/subagents-bot.env

2. Push DB schema to Neon (one-time, from the repo):
       cd ${REPO_DIR}
       sudo -u ${APP_USER} bash -lc \\
         'DATABASE_URL=\$(grep ^DATABASE_URL ${ENV_DIR}/api-server.env | cut -d= -f2-) \\
          pnpm --filter @workspace/db run push'

3. Issue TLS cert (DNS must already point to this VPS, or use --staging first):
       systemctl reload nginx       # serves /.well-known/acme-challenge
       certbot --nginx -d souqrates.com -d www.souqrates.com \\
               --redirect --agree-tos -m you@example.com

4. Enable + start services:
       systemctl enable --now souqrates-api.service
       systemctl enable --now souqrates-mother-bot.service \\
                              souqrates-books-bot.service \\
                              souqrates-contests-bot.service \\
                              souqrates-subagents-bot.service
       systemctl reload nginx

5. Smoke-test:
       curl -sf https://souqrates.com/api/healthz
       for p in 8101 8102 8103 8104; do
         curl -sf http://127.0.0.1:\$p/telegram-webhook/\$(case \$p in
           8101) echo mother-bot;; 8102) echo books-bot;;
           8103) echo contests-bot;; 8104) echo subagents-bot;; esac)/healthz
       done

6. UFW (firewall):
       ufw allow 22/tcp
       ufw allow 80/tcp
       ufw allow 443/tcp
       ufw --force enable

For subsequent code updates use:  bash deploy/scripts/deploy.sh
EOF
