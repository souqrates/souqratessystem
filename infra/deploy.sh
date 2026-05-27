#!/usr/bin/env bash
# Push current working tree to the server and (re)deploy.
# Usage:
#   ./infra/deploy.sh                       # uses SERVER from infra/.deploy.env
#   SERVER=souq@1.2.3.4 ./infra/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load deploy target if present
[[ -f infra/.deploy.env ]] && source infra/.deploy.env
: "${SERVER:?set SERVER=user@host (e.g. souq@1.2.3.4) or put it in infra/.deploy.env}"
REMOTE_DIR="${REMOTE_DIR:-/opt/souqrates}"

echo "▶ Syncing source to ${SERVER}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.next/' \
  --exclude '__pycache__/' \
  --exclude '.local/' \
  --exclude '.agents/' \
  --exclude '.replit*' \
  --exclude 'attached_assets/' \
  --exclude 'infra/.env' \
  --exclude 'infra/.deploy.env' \
  ./ "${SERVER}:${REMOTE_DIR}/"

echo "▶ Building & restarting on remote"
ssh "$SERVER" "cd ${REMOTE_DIR}/infra && docker compose pull --ignore-pull-failures && docker compose up -d --build --remove-orphans && docker image prune -f"

echo "▶ Status:"
ssh "$SERVER" "cd ${REMOTE_DIR}/infra && docker compose ps"

echo "✅ Deploy complete."
