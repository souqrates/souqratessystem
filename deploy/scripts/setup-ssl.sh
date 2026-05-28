#!/usr/bin/env bash
# ============================================================
#  SOUQRATES — Phase 2: SSL activation + service bringup
# ============================================================
#
#  Run this AFTER:
#    1. install.sh has completed successfully.
#    2. /etc/souqrates/*.env files have been filled in.
#    3. DNS A records for souqrates.com + www.souqrates.com
#       point to this VPS (194.163.155.52).
#       ⚠ Cloudflare MUST be in "DNS only" mode (grey cloud)
#       while certbot runs — orange cloud blocks ACME http-01.
#       You can re-enable the orange cloud afterwards.
#
#  Usage (as root on the VPS):
#    CERTBOT_EMAIL=you@example.com bash deploy/scripts/setup-ssl.sh
#
#  Optional env vars:
#    CERTBOT_STAGING=1   — use Let's Encrypt staging (safe for tests)
#    SKIP_SEED=1         — skip python seed_bots.py
#    SKIP_UFW=1          — skip UFW firewall rules
#
# ============================================================

set -euo pipefail

CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
CERTBOT_STAGING="${CERTBOT_STAGING:-0}"
SKIP_SEED="${SKIP_SEED:-0}"
SKIP_UFW="${SKIP_UFW:-0}"

APP_USER="souqrates"
APP_HOME="/opt/souqrates"
REPO_DIR="${APP_HOME}/repo"
ENV_DIR="/etc/souqrates"
DOMAIN="souqrates.com"
WWW_DOMAIN="www.souqrates.com"
API_LOCAL="http://127.0.0.1:8080"

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
err()  { printf '  \033[1;31m✗\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }
warn() { printf '  \033[1;33m⚠\033[0m %s\n' "$*"; }

# ─── pre-flight ──────────────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
  die "Run as root: sudo bash $0"
fi

if [[ -z "${CERTBOT_EMAIL}" ]]; then
  die "Set CERTBOT_EMAIL before running: CERTBOT_EMAIL=you@example.com bash $0"
fi

log "Pre-flight checks"

# install.sh must have run
[[ -d "${REPO_DIR}/.git" ]] || die "${REPO_DIR} not found. Run install.sh first."
[[ -f "${ENV_DIR}/api-server.env" ]] || die "${ENV_DIR}/api-server.env missing. Fill env files first."

# nginx must be running and config must load cleanly
nginx -t 2>/dev/null || die "nginx config test failed (nginx -t). Fix errors before continuing."
systemctl is-active --quiet nginx || systemctl start nginx
ok "nginx is active"

# Check DNS resolution points to this machine's IP
SERVER_IP="$(curl -s --max-time 5 ifconfig.me || echo '')"
RESOLVED_IP="$(dig +short "${DOMAIN}" A | tail -n1 || echo '')"
if [[ -z "${RESOLVED_IP}" ]]; then
  warn "DNS lookup for ${DOMAIN} returned nothing — check Cloudflare A record."
  warn "Certbot may fail if DNS hasn't propagated. Continue anyway? (Ctrl-C to abort)"
  sleep 5
elif [[ "${RESOLVED_IP}" != "${SERVER_IP}" ]]; then
  warn "${DOMAIN} resolves to ${RESOLVED_IP}, but this server is ${SERVER_IP}."
  warn "Certbot http-01 challenge will fail if DNS doesn't point here."
  warn "Waiting 10 s — press Ctrl-C to abort or wait to continue."
  sleep 10
else
  ok "${DOMAIN} → ${RESOLVED_IP} (matches this VPS)"
fi

# ─── step 1: TLS certificate ─────────────────────────────────────────────────

log "1/5  Issue TLS certificate (certbot)"

CERTBOT_OPTS=(
  "--nginx"
  "-d" "${DOMAIN}"
  "-d" "${WWW_DOMAIN}"
  "--agree-tos"
  "--non-interactive"
  "-m" "${CERTBOT_EMAIL}"
  "--redirect"
)
if [[ "${CERTBOT_STAGING}" == "1" ]]; then
  CERTBOT_OPTS+=("--staging")
  warn "Using Let's Encrypt STAGING — cert will NOT be trusted by browsers."
fi

# Idempotent: if cert already exists and is valid, just renew.
if certbot certificates 2>/dev/null | grep -q "${DOMAIN}"; then
  warn "Certificate for ${DOMAIN} already exists. Running renew instead."
  certbot renew --quiet
  ok "Certificate renewed (or still valid)"
else
  certbot "${CERTBOT_OPTS[@]}"
  ok "TLS certificate issued for ${DOMAIN} + ${WWW_DOMAIN}"
fi

# Reload nginx so the 443 block activates.
nginx -t && systemctl reload nginx
ok "nginx reloaded with TLS config"

# Ensure certbot auto-renewal timer is active (Ubuntu 22+ ships it by default).
systemctl is-enabled --quiet certbot.timer 2>/dev/null \
  && ok "certbot.timer enabled" \
  || { systemctl enable --now certbot.timer 2>/dev/null && ok "certbot.timer enabled"; }

# ─── step 2: UFW firewall ─────────────────────────────────────────────────────

if [[ "${SKIP_UFW}" != "1" ]]; then
  log "2/5  Firewall (UFW)"
  ufw allow 22/tcp   comment "SSH"
  ufw allow 80/tcp   comment "HTTP (ACME + redirect)"
  ufw allow 443/tcp  comment "HTTPS"
  # Deny everything else by default (idempotent).
  ufw default deny incoming 2>/dev/null || true
  ufw default allow outgoing 2>/dev/null || true
  # Enable (--force skips interactive confirmation).
  ufw --force enable
  ufw status verbose
  ok "UFW active"
else
  warn "SKIP_UFW=1 — skipping firewall setup"
fi

# ─── step 3: enable + start all services ─────────────────────────────────────

log "3/5  Enable + start systemd services"

systemctl enable --now souqrates-api.service
sleep 2   # give the API a moment before starting bots that depend on it
systemctl enable --now \
  souqrates-mother-bot.service \
  souqrates-books-bot.service \
  souqrates-contests-bot.service \
  souqrates-subagents-bot.service

# Brief settle time.
sleep 3

for svc in \
  souqrates-api \
  souqrates-mother-bot \
  souqrates-books-bot \
  souqrates-contests-bot \
  souqrates-subagents-bot
do
  if systemctl is-active --quiet "${svc}.service"; then
    ok "${svc} running"
  else
    err "${svc} FAILED — check: journalctl -u ${svc} -n 50 --no-pager"
  fi
done

# ─── step 4: seed bots into DB ───────────────────────────────────────────────

if [[ "${SKIP_SEED}" != "1" ]]; then
  log "4/5  Seed bots into database (seed_bots.py)"

  # Wait for the API to be healthy before seeding.
  RETRIES=10
  for i in $(seq 1 ${RETRIES}); do
    if curl -sf "${API_LOCAL}/api/healthz" >/dev/null 2>&1; then
      ok "API is healthy"
      break
    fi
    warn "API not ready yet (attempt ${i}/${RETRIES}) — waiting 3 s…"
    sleep 3
    if [[ "${i}" -eq "${RETRIES}" ]]; then
      die "API did not become healthy. Check: journalctl -u souqrates-api -n 50"
    fi
  done

  VENV_DIR="${APP_HOME}/venvs/mother-bot"
  if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
    die "Mother-bot venv not found at ${VENV_DIR}. Re-run install.sh."
  fi

  # seed_bots.py targets http://localhost:80/api — the nginx proxy.
  # On VPS, port 80 → nginx → port 8080. Must be running.
  sudo -u "${APP_USER}" "${VENV_DIR}/bin/python" \
    "${REPO_DIR}/artifacts/mother-bot/src/seed_bots.py" \
    || warn "seed_bots.py exited non-zero — some bots may already exist (safe to ignore)."
else
  warn "SKIP_SEED=1 — skipping DB seed"
fi

# ─── step 5: smoke tests ─────────────────────────────────────────────────────

log "5/5  Smoke tests"

# Public HTTPS endpoint
if curl -sf --max-time 10 "https://${DOMAIN}/api/healthz" >/dev/null; then
  ok "https://${DOMAIN}/api/healthz → 200"
else
  err "https://${DOMAIN}/api/healthz failed — HTTPS may not be wired yet."
  err "If Cloudflare is in proxy mode (orange cloud), disable it temporarily and retry."
fi

# Per-bot webhook health probes (internal)
declare -A BOT_PORTS=(
  [mother-bot]=8101
  [books-bot]=8102
  [contests-bot]=8103
  [subagents-bot]=8104
)
for slug in mother-bot books-bot contests-bot subagents-bot; do
  port="${BOT_PORTS[$slug]}"
  url="http://127.0.0.1:${port}/telegram-webhook/${slug}/healthz"
  if curl -sf --max-time 5 "${url}" >/dev/null; then
    ok "${slug} healthz (port ${port}) → ok"
  else
    err "${slug} healthz FAILED: ${url}"
    err "  → journalctl -u souqrates-${slug} -n 30 --no-pager"
  fi
done

# Redirect check: http → https
REDIRECT_CODE="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "http://${DOMAIN}/api/healthz" || echo 000)"
if [[ "${REDIRECT_CODE}" == "301" || "${REDIRECT_CODE}" == "302" ]]; then
  ok "HTTP → HTTPS redirect active (${REDIRECT_CODE})"
else
  warn "HTTP redirect returned ${REDIRECT_CODE} (expected 301/302)"
fi

# ─── done ────────────────────────────────────────────────────────────────────

cat <<'EOF'

============================================================
  Setup complete!
============================================================

Next steps:

1. Enable Cloudflare orange cloud (proxy mode) for souqrates.com
   and www.souqrates.com A records — this activates CDN + WAF.

2. Add a Cloudflare Cache Rule (formerly Page Rule) to bypass cache
   for: souqrates.com/telegram-webhook/*
   (prevents Cloudflare from caching bot webhook requests)

3. Verify from a real Telegram client:
     - /start each bot → should reply immediately
     - Mother-bot Mini App → wallet loads

4. Optional: rotate WEBHOOK_SECRET and ADMIN_TOKEN now that
   production is live (the Replit-era values should be retired).

5. After 24 h of clean operation:
     - Snapshot Neon DB
     - Scale down / disable Replit deployment

Logs:  journalctl -u souqrates-api -f
       journalctl -u souqrates-mother-bot -f
Deploy updates:  bash /opt/souqrates/repo/deploy/scripts/deploy.sh
============================================================
EOF
