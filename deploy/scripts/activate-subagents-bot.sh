#!/usr/bin/env bash
# ============================================================
#  SOUQRATES — Activate subagents-bot on an already-running VPS
# ============================================================
#
#  Use this script when the other bots (mother-bot, books-bot,
#  contests-bot) are already live on Contabo and you need to
#  bolt on the subagents-bot without touching anything else.
#
#  Prerequisites:
#    1. install.sh has already been run (Node, Python, nginx, API live).
#    2. /etc/souqrates/subagents-bot.env is filled in.
#       At minimum, these must be non-placeholder before running:
#         SUBAGENTS_BOT_TOKEN=<from BotFather>
#         WEBHOOK_SECRET=<openssl rand -hex 24>
#         WEBHOOK_HOST=127.0.0.1
#         WEBHOOK_PORT=8104
#         WEBHOOK_BASE_URL=https://souqrates.com
#         PUBLIC_BASE_URL=https://souqrates.com
#         MOTHER_API_URL=http://127.0.0.1:8080/api
#         MOTHER_BOT_USERNAME=<username without @>
#       SUBAGENTS_BOT_API_KEY may be empty on first run — the script
#       will seed the bot, capture the returned key, and write it for you.
#    3. DNS for souqrates.com already points to this VPS.
#    4. TLS cert is valid (certbot was run previously).
#
#  Usage (as root on the VPS):
#    bash /opt/souqrates/repo/deploy/scripts/activate-subagents-bot.sh
#
#  Optional env vars:
#    SKIP_SEED=1   — skip DB seed (bot already registered and API key set)
#    REPO_DIR=...  — override repo path (default: /opt/souqrates/repo)
# ============================================================

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/souqrates/repo}"
APP_USER="souqrates"
APP_HOME="/opt/souqrates"
VENVS_DIR="${APP_HOME}/venvs"
ENV_DIR="/etc/souqrates"
ENV_FILE="${ENV_DIR}/subagents-bot.env"
SLUG="subagents-bot"
PORT=8104
SVC="souqrates-subagents-bot"
# Use the direct Express port for internal health checks (bypass nginx)
API_DIRECT="http://127.0.0.1:8080/api"
SKIP_SEED="${SKIP_SEED:-0}"

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
err()  { printf '  \033[1;31m✗\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }
warn() { printf '  \033[1;33m⚠\033[0m %s\n' "$*"; }

_read_env() { grep "^${1}=" "${ENV_FILE}" | cut -d= -f2- || true; }
_is_placeholder() { [[ -z "$1" || "$1" == *MISSING* || "$1" == *__FROM* || "$1" == *__SAME* || "$1" == *__RANDOM* || "$1" == *__YOUR* ]]; }

if [[ $EUID -ne 0 ]]; then
  die "Run as root: sudo bash $0"
fi

# ─── Step 0: pre-flight ──────────────────────────────────────────────────────

log "0/7  Pre-flight checks"

[[ -d "${REPO_DIR}/.git" ]] || die "${REPO_DIR} not found. Run install.sh first."

# Seed the example env file if not present yet.
if [[ ! -f "${ENV_FILE}" ]]; then
  install -m 0640 -o root -g "${APP_USER}" \
    "${REPO_DIR}/deploy/env/subagents-bot.env.example" "${ENV_FILE}"
  die "${ENV_FILE} was not found — I've seeded the example for you.
  Edit it now, then re-run this script:
    nano ${ENV_FILE}
  At minimum fill in: SUBAGENTS_BOT_TOKEN, WEBHOOK_SECRET, MOTHER_BOT_USERNAME"
fi

# Validate fields that MUST be set before the bot can run at all.
# SUBAGENTS_BOT_API_KEY is NOT required here — seed will provide it.
for var in SUBAGENTS_BOT_TOKEN WEBHOOK_SECRET; do
  val="$(_read_env "$var")"
  _is_placeholder "$val" && \
    die "${ENV_FILE}: ${var} is not set or still has a placeholder. Edit the file first."
done
ok "Required env vars are set"

# API server must be reachable (direct port, no nginx dependency)
if ! curl -sf --max-time 8 "${API_DIRECT}/healthz" >/dev/null; then
  die "API not responding at ${API_DIRECT}/healthz. Is souqrates-api running?
  Check: systemctl status souqrates-api && journalctl -u souqrates-api -n 30"
fi
ok "API is healthy at ${API_DIRECT}"

# Ensure nginx has the subagents-bot location. Reinstall if missing.
if ! nginx -T 2>/dev/null | grep -q "proxy_pass http://127.0.0.1:${PORT}"; then
  warn "nginx config missing subagents-bot location — reinstalling from repo..."
  install -m 0644 "${REPO_DIR}/deploy/nginx/souqrates.conf" \
    /etc/nginx/sites-available/souqrates.conf
  nginx -t || die "nginx config test failed after reinstall."
  systemctl reload nginx
  ok "nginx config reinstalled and reloaded"
else
  ok "nginx already has /telegram-webhook/${SLUG} → :${PORT}"
fi

# ─── Step 1: Python venv ─────────────────────────────────────────────────────

log "1/7  Python venv for ${SLUG}"

VENV="${VENVS_DIR}/${SLUG}"
REQ="${REPO_DIR}/artifacts/${SLUG}/requirements.txt"
[[ -f "$REQ" ]] || die "requirements.txt not found at ${REQ}. Is the repo up to date?"

if [[ ! -d "$VENV" ]]; then
  sudo -u "${APP_USER}" python3.12 -m venv "$VENV"
  ok "venv created at ${VENV}"
else
  ok "venv exists"
fi
sudo -u "${APP_USER}" "${VENV}/bin/pip" install --quiet --upgrade pip
sudo -u "${APP_USER}" "${VENV}/bin/pip" install --quiet -r "$REQ"
ok "Python dependencies installed (incl. sentry-sdk)"

# ─── Step 2: DB seed ─────────────────────────────────────────────────────────

if [[ "${SKIP_SEED}" == "1" ]]; then
  warn "SKIP_SEED=1 — skipping DB seed"
  # In skip mode the API key MUST already be set.
  API_KEY="$(_read_env "SUBAGENTS_BOT_API_KEY")"
  _is_placeholder "$API_KEY" && \
    die "SKIP_SEED=1 but SUBAGENTS_BOT_API_KEY is missing/placeholder in ${ENV_FILE}."
else
  log "2/7  Seed ${SLUG} into database"

  VENV_MOTHER="${VENVS_DIR}/mother-bot"
  [[ -x "${VENV_MOTHER}/bin/python" ]] || die "mother-bot venv not found. Run install.sh first."

  # seed_bots.py uses http://localhost:80/api (nginx proxy → 8080).
  # nginx must be running for this to work.
  systemctl is-active --quiet nginx || die "nginx is not running — cannot reach the seed endpoint."

  # Capture seed output so we can parse the returned API key.
  SEED_OUT="$(sudo -u "${APP_USER}" \
    "${VENV_MOTHER}/bin/python" \
    "${REPO_DIR}/artifacts/mother-bot/src/seed_bots.py" 2>&1 || true)"

  echo "${SEED_OUT}"

  # Parse the API key from the seed output (printed as "   API Key: <value>")
  NEW_KEY="$(echo "${SEED_OUT}" | grep -A2 "SOUQRATES SUB-AGENTS" | \
    grep "API Key:" | awk '{print $NF}' || true)"

  if [[ -n "${NEW_KEY}" ]]; then
    # Bot was freshly registered — write the API key into the env file.
    if grep -q "^SUBAGENTS_BOT_API_KEY=" "${ENV_FILE}"; then
      sed -i "s|^SUBAGENTS_BOT_API_KEY=.*|SUBAGENTS_BOT_API_KEY=${NEW_KEY}|" "${ENV_FILE}"
    else
      echo "SUBAGENTS_BOT_API_KEY=${NEW_KEY}" >> "${ENV_FILE}"
    fi
    ok "SUBAGENTS_BOT_API_KEY written to ${ENV_FILE}"
  else
    # Bot was already registered (409) or key was not printed.
    # Check the existing env value; if missing, user must supply it.
    API_KEY="$(_read_env "SUBAGENTS_BOT_API_KEY")"
    if _is_placeholder "$API_KEY"; then
      err "seed_bots.py did not return a new API key (bot may already exist)."
      err "Get the key from the superadmin panel → Bots → subagents-bot → Regenerate key"
      err "Then set it in ${ENV_FILE} and re-run with SKIP_SEED=1."
      exit 1
    else
      ok "Bot already registered; existing SUBAGENTS_BOT_API_KEY will be used."
    fi
  fi

  # ── Verify the bot actually exists in DB ──────────────────────────────────
  # GET /api/bots returns the list. We check for subagents-bot slug presence.
  DB_CHECK="$(curl -sf --max-time 8 "${API_DIRECT}/bots" 2>/dev/null || echo '')"
  if echo "${DB_CHECK}" | python3 -c \
      "import sys,json; bots=json.load(sys.stdin); \
       slugs=[b.get('slug','') for b in (bots if isinstance(bots,list) else bots.get('data',[]))]; \
       exit(0 if 'subagents-bot' in slugs else 1)" 2>/dev/null; then
    ok "Confirmed: subagents-bot exists in DB"
  else
    warn "Could not confirm subagents-bot in DB via ${API_DIRECT}/bots"
    warn "Response: ${DB_CHECK}"
    warn "Continuing — check superadmin panel to verify."
  fi
fi

# ─── Step 3: systemd service ─────────────────────────────────────────────────

log "3/7  Install + enable systemd service"

install -m 0644 "${REPO_DIR}/deploy/systemd/${SVC}.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "${SVC}.service"
ok "service installed and enabled"

# Restart to pick up the (possibly updated) env file.
systemctl restart "${SVC}.service"
ok "service started"

# ─── Step 4: wait for healthz ────────────────────────────────────────────────

log "4/7  Wait for webhook server to be healthy (:${PORT})"

HEALTHZ="http://127.0.0.1:${PORT}/telegram-webhook/${SLUG}/healthz"
RETRIES=15
for i in $(seq 1 ${RETRIES}); do
  if curl -sf --max-time 3 "${HEALTHZ}" >/dev/null 2>&1; then
    ok "${SLUG} healthz → $(curl -s --max-time 3 "${HEALTHZ}")"
    break
  fi
  if [[ "$i" -eq "${RETRIES}" ]]; then
    err "${SLUG} did not become healthy after ${RETRIES} attempts."
    err "Check: journalctl -u ${SVC} -n 50 --no-pager"
    exit 1
  fi
  warn "not ready yet (attempt ${i}/${RETRIES}) — waiting 2 s..."
  sleep 2
done

# ─── Step 5: verify public HTTPS endpoint ────────────────────────────────────

log "5/7  Verify public HTTPS webhook endpoint"

PUBLIC_URL="https://souqrates.com/telegram-webhook/${SLUG}"
HTTP_CODE="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "${PUBLIC_URL}" || echo 000)"

# Telegram POSTs to this URL; a GET returns 405 (Method Not Allowed) from aiogram,
# which confirms nginx → bot routing is working. 502/503 means the bot isn't up.
case "${HTTP_CODE}" in
  405|200) ok "Public URL reachable (HTTP ${HTTP_CODE} — expected 405 from aiogram)" ;;
  000)     err "Could not reach ${PUBLIC_URL} — check DNS and TLS cert." ;;
  502|503) err "nginx returned ${HTTP_CODE} — bot may not be running on port ${PORT}. Check: ss -lntp | grep ${PORT}" ;;
  *)       warn "Unexpected HTTP ${HTTP_CODE} from ${PUBLIC_URL}" ;;
esac

# ─── Step 6: verify Telegram webhook registration ────────────────────────────

log "6/7  Verify Telegram webhook registration (getWebhookInfo)"

BOT_TOKEN="$(_read_env "SUBAGENTS_BOT_TOKEN")"
if [[ -z "$BOT_TOKEN" ]]; then
  warn "Cannot read SUBAGENTS_BOT_TOKEN — skipping Telegram verification"
else
  WEBHOOK_INFO="$(curl -sf --max-time 10 \
    "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" 2>/dev/null || echo '')"

  if [[ -z "$WEBHOOK_INFO" ]]; then
    warn "Could not reach api.telegram.org — check outbound connectivity"
  else
    REGISTERED_URL="$(echo "$WEBHOOK_INFO" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('url',''))" 2>/dev/null || echo '')"
    PENDING="$(echo "$WEBHOOK_INFO" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('pending_update_count',0))" 2>/dev/null || echo '?')"
    LAST_ERROR="$(echo "$WEBHOOK_INFO" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('last_error_message',''))" 2>/dev/null || echo '')"

    EXPECTED_URL="https://souqrates.com/telegram-webhook/${SLUG}"

    if [[ "$REGISTERED_URL" == "$EXPECTED_URL" ]]; then
      ok "Webhook registered: ${REGISTERED_URL}"
      ok "Pending updates: ${PENDING}"
      [[ -n "$LAST_ERROR" ]] && warn "Last Telegram error: ${LAST_ERROR}"
    elif [[ -z "$REGISTERED_URL" ]]; then
      warn "Webhook URL is empty — bot may not have called set_webhook yet."
      warn "Wait a few seconds and check: journalctl -u ${SVC} -n 30 --no-pager"
    else
      warn "Webhook URL mismatch!"
      warn "  Expected : ${EXPECTED_URL}"
      warn "  Telegram : ${REGISTERED_URL}"
      warn "Force re-register:"
      warn "  curl -s 'https://api.telegram.org/bot\${SUBAGENTS_BOT_TOKEN}/setWebhook?url=${EXPECTED_URL}&drop_pending_updates=true'"
    fi
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

log "7/7  Done"

cat <<EOF

============================================================
  SOUQRATES SUB-AGENTS bot is live!
============================================================

Quick smoke-test from a real Telegram account:
  1. Open the bot → send /start — should reply immediately.
  2. Tap "قدّم طلبك الآن" — Mini App opens at /subagents/apply.

Monitor:
  journalctl -u ${SVC} -f
  curl http://127.0.0.1:${PORT}/telegram-webhook/${SLUG}/healthz
  curl -s "https://api.telegram.org/bot\$(grep ^SUBAGENTS_BOT_TOKEN ${ENV_FILE} | cut -d= -f2-)/getWebhookInfo" | python3 -m json.tool

Future code updates (all 4 bots at once):
  bash ${REPO_DIR}/deploy/scripts/deploy.sh
============================================================
EOF
