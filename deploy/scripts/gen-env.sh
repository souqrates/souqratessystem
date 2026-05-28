#!/usr/bin/env bash
# Generates /etc/souqrates/*.env content from current environment variables.
# Run in Replit Shell, copy each block, paste into matching file on Contabo.
set -euo pipefail

SUPABASE_PASS="${1:-}"
if [[ -z "$SUPABASE_PASS" ]]; then
  echo "Usage: bash deploy/scripts/gen-env.sh <supabase-db-password>"
  exit 1
fi

SESSION_SECRET="$(openssl rand -hex 32)"
WEBHOOK_SECRET_MOTHER="$(openssl rand -hex 24)"
WEBHOOK_SECRET_BOOKS="$(openssl rand -hex 24)"
WEBHOOK_SECRET_CONTESTS="$(openssl rand -hex 24)"
WEBHOOK_SECRET_SUBAGENTS="$(openssl rand -hex 24)"

DB_URL="postgresql://postgres.nvywsoatlrtnjgkizqnh:${SUPABASE_PASS}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

echo "================================================================"
echo ">>> /etc/souqrates/api-server.env  (copy everything below to the next >>>)"
echo "================================================================"
cat <<EOF
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
DATABASE_URL=${DB_URL}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_TOKEN=${ADMIN_TOKEN:-MISSING}
MASTER_ADMIN_CODE=${MASTER_ADMIN_CODE:-MISSING}
MOTHER_BOT_API_KEY=${MOTHER_BOT_API_KEY:-MISSING}
BOOKS_BOT_API_KEY=${BOOKS_BOT_API_KEY:-MISSING}
CONTESTS_BOT_API_KEY=${CONTESTS_BOT_API_KEY:-MISSING}
SUBAGENTS_BOT_API_KEY=${SUBAGENTS_BOT_API_KEY:-MISSING}
GAMES_BOT_API_KEY=${GAMES_BOT_API_KEY:-}
UPSTASH_REST_URL=${UPSTASH_REST_URL:-}
UPSTASH_REST_TOKEN=${UPSTASH_REST_TOKEN:-}
TON_API_KEY=${TON_API_KEY:-}
TON_WALLET_ADDRESS=${TON_WALLET_ADDRESS:-}
CRYPTOMUS_MERCHANT_UUID=${CRYPTOMUS_MERCHANT_UUID:-}
CRYPTOMUS_PAYMENT_API_KEY=${CRYPTOMUS_PAYMENT_API_KEY:-}
CRYPTOMUS_PAYOUT_API_KEY=${CRYPTOMUS_PAYOUT_API_KEY:-}
CRYPTOMUS_WEBHOOK_SECRET=${CRYPTOMUS_WEBHOOK_SECRET:-}
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-}
CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID:-}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
SENTRY_DSN=${SENTRY_DSN:-}
RESEND_API_KEY=${RESEND_API_KEY:-}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-}
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
PRIVATE_OBJECT_DIR=
PUBLIC_OBJECT_SEARCH_PATHS=
EOF

echo ""
echo "================================================================"
echo ">>> /etc/souqrates/mother-bot.env"
echo "================================================================"
cat <<EOF
MOTHER_BOT_TOKEN=${MOTHER_BOT_TOKEN:-MISSING}
MOTHER_BOT_API_KEY=${MOTHER_BOT_API_KEY:-MISSING}
MOTHER_API_URL=http://127.0.0.1:8080/api
MASTER_ADMIN_CODE=${MASTER_ADMIN_CODE:-MISSING}
PUBLIC_BASE_URL=https://souqrates.com
USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET=${WEBHOOK_SECRET_MOTHER}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8101
DISABLE_SUBAGENTS_SPAWN=1
SENTRY_DSN=${SENTRY_DSN:-}
EOF

echo ""
echo "================================================================"
echo ">>> /etc/souqrates/books-bot.env"
echo "================================================================"
cat <<EOF
BOOKS_BOT_TOKEN=${BOOKS_BOT_TOKEN:-MISSING}
BOOKS_BOT_API_KEY=${BOOKS_BOT_API_KEY:-MISSING}
MOTHER_API_URL=http://127.0.0.1:8080/api
PUBLIC_BASE_URL=https://souqrates.com
USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET=${WEBHOOK_SECRET_BOOKS}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8102
SENTRY_DSN=${SENTRY_DSN:-}
EOF

echo ""
echo "================================================================"
echo ">>> /etc/souqrates/contests-bot.env"
echo "================================================================"
cat <<EOF
CONTESTS_BOT_TOKEN=${CONTESTS_BOT_TOKEN:-MISSING}
CONTESTS_BOT_API_KEY=${CONTESTS_BOT_API_KEY:-MISSING}
MOTHER_API_URL=http://127.0.0.1:8080/api
PUBLIC_BASE_URL=https://souqrates.com
USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET=${WEBHOOK_SECRET_CONTESTS}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8103
SENTRY_DSN=${SENTRY_DSN:-}
EOF

echo ""
echo "================================================================"
echo ">>> /etc/souqrates/subagents-bot.env"
echo "================================================================"
cat <<EOF
SUBAGENTS_BOT_TOKEN=${SUBAGENTS_BOT_TOKEN:-MISSING}
SUBAGENTS_BOT_API_KEY=${SUBAGENTS_BOT_API_KEY:-MISSING}
MOTHER_API_URL=http://127.0.0.1:8080/api
PUBLIC_BASE_URL=https://souqrates.com
USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET=${WEBHOOK_SECRET_SUBAGENTS}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8104
SENTRY_DSN=${SENTRY_DSN:-}
EOF

echo ""
echo "================================================================"
echo "DONE. Copy each block into the matching file on Contabo."
echo "Command: nano /etc/souqrates/<filename>.env"
echo "================================================================"
