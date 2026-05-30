#!/usr/bin/env bash
# SOUQRATES SYSTEM — Comprehensive Platform Health Check
# Runs on the Contabo server (has access to local ports, nginx, systemd).
#
# Usage:
#   sudo bash deploy/scripts/health-check.sh
#   sudo bash deploy/scripts/health-check.sh --base-url https://souqrates.com
#
# Exit code: 0 = all critical checks passed, 1 = one or more critical checks failed.

set -euo pipefail

BASE_URL="${BASE_URL:-https://souqrates.com}"
API_ENV="/etc/souqrates/api-server.env"
NGINX_CONF="/etc/nginx/sites-available/souqrates.conf"

# ── Colour helpers ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'
BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✅ $*${RESET}"; }
fail() { echo -e "  ${RED}❌ $*${RESET}"; FAILED=$((FAILED+1)); }
warn() { echo -e "  ${YELLOW}⚠️  $*${RESET}"; WARNED=$((WARNED+1)); }
hdr()  { echo -e "\n${BOLD}── $* ──────────────────────────────────────────────────────────${RESET}"; }

FAILED=0
WARNED=0

# ── Read env vars (ADMIN_TOKEN, bot API keys, CF creds) ────────────────────
ADMIN_TOKEN=""
GAMES_API_KEY=""
CF_TOKEN=""
CF_ZONE=""
if [[ -f "$API_ENV" ]]; then
  ADMIN_TOKEN=$(grep  '^ADMIN_TOKEN='             "$API_ENV" | cut -d= -f2- | tr -d '"' || true)
  GAMES_API_KEY=$(grep '^GAMES_BOT_API_KEY='      "$API_ENV" | cut -d= -f2- | tr -d '"' || true)
  CF_TOKEN=$(grep     '^CLOUDFLARE_API_TOKEN='    "$API_ENV" | cut -d= -f2- | tr -d '"' || true)
  CF_ZONE=$(grep      '^CLOUDFLARE_ZONE_ID='      "$API_ENV" | cut -d= -f2- | tr -d '"' || true)
fi

# ── Helper: HTTP status code ────────────────────────────────────────────────
http_code() { curl -sk -o /dev/null -w "%{http_code}" "$1"; }
http_body() { curl -sk "$@"; }

echo -e "\n${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  SOUQRATES SYSTEM — HEALTH CHECK   $(date '+%Y-%m-%d %H:%M:%S UTC')${RESET}"
echo -e "${BOLD}  Base URL: ${BASE_URL}${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${RESET}"

# ────────────────────────────────────────────────────────────────────────────
hdr "1. nginx config — root (not alias)"
# ────────────────────────────────────────────────────────────────────────────
if [[ -f "$NGINX_CONF" ]]; then
  ALIAS_COUNT=$(grep -c '^\s*alias ' "$NGINX_CONF" || true)
  ROOT_COUNT=$(grep  -c '^\s*root '  "$NGINX_CONF" || true)
  if [[ "$ALIAS_COUNT" -eq 0 ]]; then
    ok "nginx config uses 'root' for all locations (no alias directives) — ${ROOT_COUNT} root lines"
  else
    fail "nginx config still has ${ALIAS_COUNT} 'alias' directive(s) — assets will 404 on subpath SPAs"
  fi

  # Cache headers for HTML
  NO_STORE=$(grep -c 'no-store' "$NGINX_CONF" || true)
  if [[ "$NO_STORE" -gt 0 ]]; then
    ok "HTML cache headers: no-store present in nginx config (${NO_STORE} locations)"
  else
    warn "HTML cache headers: no-store NOT found in nginx config — index.html may be edge-cached"
  fi
else
  warn "nginx config not found at ${NGINX_CONF} (running outside Contabo?)"
fi

# nginx service
if command -v systemctl &>/dev/null; then
  if systemctl is-active --quiet nginx; then
    ok "nginx service is running"
  else
    fail "nginx service is NOT running"
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "2. SPA — HTML (200) + JS asset (200)"
# ────────────────────────────────────────────────────────────────────────────
declare -A SPA_PATHS=(
  [superadmin]="/superadmin/"
  [books-bot-web]="/books-bot-web/"
  [contests-bot-web]="/contests-bot-web/"
  [subagents-bot-web]="/subagents-bot-web/"
  [games-bot]="/games-bot/"
  [bot-demo]="/"
)

for slug in superadmin books-bot-web contests-bot-web subagents-bot-web games-bot bot-demo; do
  path="${SPA_PATHS[$slug]}"
  url="${BASE_URL}${path}"

  # HTML
  html_code=$(http_code "$url")
  html_body=$(http_body "$url")
  if [[ "$html_code" == "200" ]]; then
    # JS asset
    js_path=$(echo "$html_body" | grep -o "${path}assets/[^\"']*\.js" | head -1)
    [[ -z "$js_path" ]] && js_path=$(echo "$html_body" | grep -o '/assets/[^"'\'']*\.js' | grep -v telegram | head -1)
    if [[ -n "$js_path" ]]; then
      js_code=$(http_code "${BASE_URL}${js_path}")
      if [[ "$js_code" == "200" ]]; then
        ok "${slug}: HTML=200, JS=200 (${js_path##*/})"
      else
        fail "${slug}: HTML=200 but JS asset=${js_code} (${js_path##*/})"
      fi
    else
      warn "${slug}: HTML=200 but could not find JS asset reference in page"
    fi
  else
    fail "${slug}: HTML=${html_code} (expected 200)"
  fi
done

# ────────────────────────────────────────────────────────────────────────────
hdr "3. API server"
# ────────────────────────────────────────────────────────────────────────────
# healthz
hc_body=$(http_body "${BASE_URL}/api/healthz")
hc_ok=$(echo "$hc_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || true)
if [[ "$hc_ok" == "ok" ]]; then
  ok "API /healthz → {status:ok}"
else
  fail "API /healthz → unexpected: ${hc_body:0:80}"
fi

# Auth gates
code=$(http_code "${BASE_URL}/api/internal/users/upsert")
if [[ "$code" == "401" ]]; then
  ok "Auth gate (internal, no key) → 401 ✓"
else
  fail "Auth gate (internal, no key) → ${code} (expected 401)"
fi

code=$(http_code "${BASE_URL}/api/superadmin/users")
if [[ "$code" == "401" ]]; then
  ok "Auth gate (superadmin, no token) → 401 ✓"
else
  fail "Auth gate (superadmin, no token) → ${code} (expected 401)"
fi

# systemd
if command -v systemctl &>/dev/null; then
  if systemctl is-active --quiet souqrates-api.service; then
    ok "souqrates-api.service is running"
  else
    fail "souqrates-api.service is NOT running"
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "4. Bot webhooks — systemd + /healthz"
# ────────────────────────────────────────────────────────────────────────────
declare -A BOT_PORTS=(
  [mother-bot]=8101
  [books-bot]=8102
  [contests-bot]=8103
  [subagents-bot]=8104
)

for bot in mother-bot books-bot contests-bot subagents-bot; do
  port="${BOT_PORTS[$bot]}"
  svc="souqrates-${bot}.service"

  # systemd
  svc_status="unknown"
  if command -v systemctl &>/dev/null; then
    systemctl is-active --quiet "$svc" && svc_status="active" || svc_status="inactive"
  fi

  # healthz via public URL
  hc=$(http_body "${BASE_URL}/telegram-webhook/${bot}/healthz")
  hc_code=$(http_code "${BASE_URL}/telegram-webhook/${bot}/healthz")

  if [[ "$hc_code" == "200" ]]; then
    ok "${bot}: systemd=${svc_status}, /healthz=200 (\"${hc}\")"
  else
    fail "${bot}: systemd=${svc_status}, /healthz=${hc_code}"
  fi
done

# ────────────────────────────────────────────────────────────────────────────
hdr "5. Financial path (credit → commission → debit → balance)"
# ────────────────────────────────────────────────────────────────────────────
if [[ -z "$GAMES_API_KEY" ]]; then
  warn "GAMES_BOT_API_KEY not found in ${API_ENV} — skipping financial path test"
else
  TEST_TID="99999999901"
  REF="hc_$(date +%s)"

  # Upsert test user
  UPSERT=$(curl -sk -X POST "${BASE_URL}/api/internal/users/upsert" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"telegramId\":\"${TEST_TID}\",\"firstName\":\"HealthCheck\"}" 2>/dev/null)
  UID=$(echo "$UPSERT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))" 2>/dev/null || true)
  if [[ -n "$UID" ]]; then
    ok "upsert test user → id=${UID}"
  else
    fail "upsert test user failed: ${UPSERT:0:120}"
  fi

  # Balance before
  BAL0=$(curl -sk "${BASE_URL}/api/internal/balance/${TEST_TID}" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('balanceSkz','err'))" 2>/dev/null || echo "err")

  # Credit 50 SKZ (games-bot has 8% commission → user gets 46)
  CREDIT=$(curl -sk -X POST "${BASE_URL}/api/internal/credit" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"telegramId\":\"${TEST_TID}\",\"amount\":\"50\",\"description\":\"health-check\",\"referenceId\":\"${REF}_cr\"}")
  CR_BAL=$(echo "$CREDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('newSkzBalance','err'))" 2>/dev/null || echo "err")
  CR_COM=$(echo "$CREDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('commissionDeducted','err'))" 2>/dev/null || echo "err")
  CR_TX=$(echo  "$CREDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('transactionId','err'))" 2>/dev/null || echo "err")

  if [[ "$CR_BAL" != "err" && "$CR_TX" != "err" ]]; then
    ok "credit 50 SKZ → newBalance=${CR_BAL}, commissionDeducted=${CR_COM}, txId=${CR_TX}"
  else
    fail "credit failed: ${CREDIT:0:120}"
  fi

  # Debit 10 SKZ
  DEBIT=$(curl -sk -X POST "${BASE_URL}/api/internal/debit" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"telegramId\":\"${TEST_TID}\",\"amount\":\"10\",\"description\":\"health-check-debit\",\"referenceId\":\"${REF}_db\"}")
  DB_BAL=$(echo "$DEBIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('newSkzBalance','err'))" 2>/dev/null || echo "err")

  if [[ "$DB_BAL" != "err" ]]; then
    ok "debit 10 SKZ → newBalance=${DB_BAL}"
  else
    fail "debit failed: ${DEBIT:0:120}"
  fi

  # Final balance cross-check
  BAL1=$(curl -sk "${BASE_URL}/api/internal/balance/${TEST_TID}" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('balanceSkz','err'))" 2>/dev/null || echo "err")
  if [[ "$BAL1" == "$DB_BAL" ]]; then
    ok "balance endpoint agrees with debit response: ${BAL1} SKZ"
  else
    fail "balance mismatch: /balance=${BAL1} vs debit response=${DB_BAL}"
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "6. Superadmin panel — key endpoints"
# ────────────────────────────────────────────────────────────────────────────
if [[ -z "$ADMIN_TOKEN" ]]; then
  warn "ADMIN_TOKEN not found in ${API_ENV} — skipping superadmin checks"
else
  STATS=$(curl -sk "${BASE_URL}/api/stats/overview" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  TOTAL_USERS=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalUsers','err'))" 2>/dev/null || echo "err")
  ACTIVE_BOTS=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('activeBots','err'))" 2>/dev/null || echo "err")
  PENDING_WD=$(echo  "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pendingWithdrawals','err'))" 2>/dev/null || echo "err")

  if [[ "$TOTAL_USERS" != "err" ]]; then
    ok "stats/overview → users=${TOTAL_USERS}, activeBots=${ACTIVE_BOTS}, pendingWithdrawals=${PENDING_WD}"
  else
    fail "stats/overview failed: ${STATS:0:80}"
  fi

  for ep in users bots transactions withdrawals; do
    code=$(http_code "${BASE_URL}/api/superadmin/${ep}" -H "Authorization: Bearer ${ADMIN_TOKEN}")
    [[ "$code" == "200" ]] && ok "superadmin/${ep} → 200" || fail "superadmin/${ep} → ${code}"
  done
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "7. Cloudflare API token — Cache Purge permission"
# ────────────────────────────────────────────────────────────────────────────
if [[ -z "$CF_TOKEN" || -z "$CF_ZONE" ]]; then
  warn "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not set in ${API_ENV}"
else
  PURGE=$(curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/purge_cache" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"files":["https://souqrates.com/__health_check_probe__"]}' 2>/dev/null || true)
  PURGE_OK=$(echo "$PURGE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null || echo "false")
  if [[ "$PURGE_OK" == "True" || "$PURGE_OK" == "true" ]]; then
    ok "Cloudflare token has Cache Purge permission ✓"
  else
    PURGE_ERR=$(echo "$PURGE" | python3 -c "import sys,json; d=json.load(sys.stdin); errs=d.get('errors',[]); print(errs[0].get('message','') if errs else '')" 2>/dev/null || true)
    fail "Cloudflare token lacks Cache Purge permission — ${PURGE_ERR}"
    echo -e "     ${YELLOW}Fix: create a new token at dash.cloudflare.com → API Tokens → Cache Purge template${RESET}"
    echo -e "     ${YELLOW}Then update CLOUDFLARE_API_TOKEN in ${API_ENV}${RESET}"
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
if [[ $FAILED -eq 0 && $WARNED -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  RESULT: ALL CHECKS PASSED ✅${RESET}"
elif [[ $FAILED -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}  RESULT: PASSED with ${WARNED} warning(s) ⚠️${RESET}"
else
  echo -e "${RED}${BOLD}  RESULT: ${FAILED} CRITICAL FAILURE(S) ❌  |  ${WARNED} warning(s)${RESET}"
fi
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${RESET}\n"

exit $FAILED
