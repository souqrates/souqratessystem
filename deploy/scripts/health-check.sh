#!/usr/bin/env bash
# SOUQRATES SYSTEM — Comprehensive Platform Health Check
#
# Usage (on Contabo):
#   sudo bash deploy/scripts/health-check.sh
#   sudo bash deploy/scripts/health-check.sh --base-url https://souqrates.com
#   sudo bash deploy/scripts/health-check.sh --base-url https://souqrates.com --skip-financial
#
# Can also be run from Replit against the live domain (no local checks):
#   bash deploy/scripts/health-check.sh --base-url https://souqrates.com
#
# Exit code: 0 = all critical checks passed, 1 = one or more critical failures.

set -euo pipefail

# ── CLI args ────────────────────────────────────────────────────────────────
BASE_URL="https://souqrates.com"
SKIP_FINANCIAL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)    BASE_URL="$2"; shift 2 ;;
    --skip-financial) SKIP_FINANCIAL=1; shift ;;
    *) echo "Unknown arg: $1" >&2; shift ;;
  esac
done

# ── Paths ───────────────────────────────────────────────────────────────────
API_ENV="/etc/souqrates/api-server.env"
NGINX_CONF_SERVER="/etc/nginx/sites-available/souqrates.conf"
NGINX_CONF_REPO="$(dirname "$(dirname "$0")")/nginx/souqrates.conf"
ON_SERVER=0
[[ -f "$NGINX_CONF_SERVER" ]] && ON_SERVER=1

# ── Colour helpers ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'
BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✅ $*${RESET}"; }
fail() { echo -e "  ${RED}❌ $*${RESET}"; FAILED=$((FAILED+1)); }
warn() { echo -e "  ${YELLOW}⚠️  $*${RESET}"; WARNED=$((WARNED+1)); }
hdr()  { echo -e "\n${BOLD}── $* ──────────────────────────────────────────────────────────${RESET}"; }

FAILED=0
WARNED=0

# ── curl helpers (forward ALL args so -H headers work) ─────────────────────
# origin_fetch: bypasses Cloudflare DNS by resolving to 127.0.0.1 (server only)
http_code()    { curl -sk -o /dev/null -w "%{http_code}" "$@"; }
http_body()    { curl -sk "$@"; }
origin_code()  { curl -sk -o /dev/null -w "%{http_code}" --resolve "souqrates.com:443:127.0.0.1" "$@"; }
origin_body()  { curl -sk --resolve "souqrates.com:443:127.0.0.1" "$@"; }

# ── Read secrets from env file ──────────────────────────────────────────────
ADMIN_TOKEN=""
GAMES_API_KEY=""
BOOKS_API_KEY=""
CONTESTS_API_KEY=""
SUBAGENTS_API_KEY=""
CF_TOKEN=""
CF_ZONE=""
if [[ -f "$API_ENV" ]]; then
  _get() { grep "^$1=" "$API_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' || true; }
  ADMIN_TOKEN=$(_get ADMIN_TOKEN)
  GAMES_API_KEY=$(_get GAMES_BOT_API_KEY)
  BOOKS_API_KEY=$(_get BOOKS_BOT_API_KEY)
  CONTESTS_API_KEY=$(_get CONTESTS_BOT_API_KEY)
  SUBAGENTS_API_KEY=$(_get SUBAGENTS_BOT_API_KEY)
  CF_TOKEN=$(_get CLOUDFLARE_API_TOKEN)
  CF_ZONE=$(_get CLOUDFLARE_ZONE_ID)
fi

echo -e "\n${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  SOUQRATES SYSTEM — HEALTH CHECK   $(date -u '+%Y-%m-%d %H:%M:%S UTC')${RESET}"
echo -e "${BOLD}  Base URL  : ${BASE_URL}${RESET}"
echo -e "${BOLD}  On server : ${ON_SERVER}  (1=Contabo, 0=remote)${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${RESET}"

# ────────────────────────────────────────────────────────────────────────────
hdr "1. nginx — config correctness + parity with repo"
# ────────────────────────────────────────────────────────────────────────────
if [[ $ON_SERVER -eq 1 ]]; then
  # No alias directives
  ALIAS_COUNT=$(grep -c '^\s*alias ' "$NGINX_CONF_SERVER" || true)
  if [[ "$ALIAS_COUNT" -eq 0 ]]; then
    ok "No 'alias' directives in server nginx config (all use 'root')"
  else
    fail "${ALIAS_COUNT} 'alias' directive(s) remain — SPA assets will 404 on subpaths"
  fi

  # no-store cache header for HTML
  NO_STORE=$(grep -c 'no-store' "$NGINX_CONF_SERVER" || true)
  if [[ "$NO_STORE" -gt 0 ]]; then
    ok "HTML cache header: no-store present (${NO_STORE} locations)"
  else
    warn "HTML cache header: no-store NOT found — index.html may be edge-cached by Cloudflare"
  fi

  # Parity check: server config == repo canonical config
  if [[ -f "$NGINX_CONF_REPO" ]]; then
    if diff -q "$NGINX_CONF_SERVER" "$NGINX_CONF_REPO" &>/dev/null; then
      ok "nginx config matches repo canonical (deploy/nginx/souqrates.conf)"
    else
      warn "nginx config differs from repo canonical — run deploy.sh to sync"
      diff "$NGINX_CONF_SERVER" "$NGINX_CONF_REPO" | head -20 || true
    fi
  else
    warn "Repo nginx config not found at ${NGINX_CONF_REPO} — skipping parity check"
  fi

  # nginx service
  if command -v systemctl &>/dev/null; then
    systemctl is-active --quiet nginx \
      && ok "nginx service: active" \
      || fail "nginx service: NOT active"
  fi
else
  warn "Not on Contabo server — skipping nginx config/parity/systemd checks"
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "2. SPA — HTML + JS asset (external + origin)"
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

  html_code=$(http_code "$url")
  if [[ "$html_code" != "200" ]]; then
    fail "${slug}: HTML=${html_code} (expected 200)"
    continue
  fi

  html_body=$(http_body "$url")
  js_path=$(echo "$html_body" | grep -o "${path}assets/[^\"']*\.js" | head -1)
  [[ -z "$js_path" ]] && js_path=$(echo "$html_body" | grep -o '/assets/[^"'\'']*\.js' | grep -v telegram | head -1)

  if [[ -z "$js_path" ]]; then
    warn "${slug}: HTML=200 but JS asset reference not found in page"
    continue
  fi

  js_code=$(http_code "${BASE_URL}${js_path}")
  if [[ "$js_code" != "200" ]]; then
    fail "${slug}: HTML=200 but JS=${js_code} (${js_path##*/})"
    continue
  fi

  ok "${slug}: HTML=200, JS=200 (${js_path##*/})"

  # Origin check (bypass Cloudflare) — server only
  if [[ $ON_SERVER -eq 1 ]]; then
    o_html=$(origin_code "$url")
    o_js=$(origin_code "${BASE_URL}${js_path}")
    if [[ "$o_html" == "200" && "$o_js" == "200" ]]; then
      ok "${slug} [origin/direct]: HTML=200, JS=200"
    else
      fail "${slug} [origin/direct]: HTML=${o_html}, JS=${o_js} — nginx may still have misconfiguration"
    fi
  fi
done

# ────────────────────────────────────────────────────────────────────────────
hdr "3. API server — health + auth gates"
# ────────────────────────────────────────────────────────────────────────────
# systemd
if [[ $ON_SERVER -eq 1 ]] && command -v systemctl &>/dev/null; then
  systemctl is-active --quiet souqrates-api.service \
    && ok "souqrates-api.service: active" \
    || fail "souqrates-api.service: NOT active"
fi

# healthz
hc_body=$(http_body "${BASE_URL}/api/healthz")
hc_status=$(echo "$hc_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || true)
[[ "$hc_status" == "ok" ]] \
  && ok "GET /api/healthz → {status:ok}" \
  || fail "GET /api/healthz → unexpected: ${hc_body:0:80}"

# Auth gate: internal without key → 401
code=$(http_code "${BASE_URL}/api/internal/users/upsert")
[[ "$code" == "401" ]] \
  && ok "Auth gate (internal, no key) → 401" \
  || fail "Auth gate (internal, no key) → ${code} (expected 401)"

# Auth gate: superadmin without token → 401
code=$(http_code "${BASE_URL}/api/superadmin/users")
[[ "$code" == "401" ]] \
  && ok "Auth gate (superadmin, no token) → 401" \
  || fail "Auth gate (superadmin, no token) → ${code} (expected 401)"

# Bots list endpoint
if [[ -n "$ADMIN_TOKEN" ]]; then
  code=$(http_code "${BASE_URL}/api/bots" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  [[ "$code" == "200" ]] \
    && ok "GET /api/bots (admin) → 200" \
    || fail "GET /api/bots (admin) → ${code}"
else
  warn "ADMIN_TOKEN not available — skipping /api/bots check"
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "4. Bot webhooks — systemd + /healthz per bot"
# ────────────────────────────────────────────────────────────────────────────
declare -A BOT_PORTS=([mother-bot]=8101 [books-bot]=8102 [contests-bot]=8103 [subagents-bot]=8104)

for bot in mother-bot books-bot contests-bot subagents-bot; do
  svc="souqrates-${bot}.service"
  svc_status="skipped"
  if [[ $ON_SERVER -eq 1 ]] && command -v systemctl &>/dev/null; then
    systemctl is-active --quiet "$svc" && svc_status="active" || svc_status="inactive"
  fi

  hc_code=$(http_code "${BASE_URL}/telegram-webhook/${bot}/healthz")
  hc_body=$(http_body "${BASE_URL}/telegram-webhook/${bot}/healthz")

  if [[ "$hc_code" == "200" ]]; then
    ok "${bot}: systemd=${svc_status}, /healthz=200 (\"${hc_body}\")"
  else
    fail "${bot}: systemd=${svc_status}, /healthz=${hc_code}"
  fi
done

# ────────────────────────────────────────────────────────────────────────────
hdr "5. Per-bot API key — authenticated endpoint smoke test"
# ────────────────────────────────────────────────────────────────────────────
declare -A BOT_KEYS=(
  [games-bot]="${GAMES_API_KEY:-}"
  [books-bot]="${BOOKS_API_KEY:-}"
  [contests-bot]="${CONTESTS_API_KEY:-}"
  [subagents-bot]="${SUBAGENTS_API_KEY:-}"
)
declare -A BOT_SLUGS=([games-bot]=games-bot [books-bot]=books-bot [contests-bot]=contests-bot [subagents-bot]=subagents-bot)
TEST_TID_PROBE="88888888801"

for bot in games-bot books-bot contests-bot subagents-bot; do
  key="${BOT_KEYS[$bot]}"
  if [[ -z "$key" ]]; then
    warn "${bot}: API key not found in env — skipping"
    continue
  fi
  code=$(http_code "${BASE_URL}/api/internal/balance/${TEST_TID_PROBE}" \
    -H "X-Bot-Api-Key: ${key}")
  if [[ "$code" == "200" || "$code" == "404" ]]; then
    # 200 = user found, 404 = user not found — both prove key is valid
    ok "${bot}: X-Bot-Api-Key valid (GET /balance → ${code})"
  elif [[ "$code" == "401" ]]; then
    fail "${bot}: X-Bot-Api-Key rejected (401) — key may be wrong or revoked"
  else
    fail "${bot}: unexpected response ${code} on /balance probe"
  fi
done

# ────────────────────────────────────────────────────────────────────────────
hdr "6. Financial path — credit → commission math → debit → balance invariant"
# ────────────────────────────────────────────────────────────────────────────
if [[ $SKIP_FINANCIAL -eq 1 ]]; then
  warn "Financial path test skipped (--skip-financial)"
elif [[ -z "$GAMES_API_KEY" ]]; then
  warn "GAMES_BOT_API_KEY not available — skipping financial path test"
else
  TEST_TID="99999999901"
  REF="hc_$(date +%s)"
  EXPECTED_COMMISSION_RATE="0.08"   # games-bot 8%
  CREDIT_AMOUNT="50"
  DEBIT_AMOUNT="10"

  # Upsert test user
  UPSERT=$(curl -sk -X POST "${BASE_URL}/api/internal/users/upsert" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"telegramId\":\"${TEST_TID}\",\"firstName\":\"HealthCheck\"}")
  UID=$(echo "$UPSERT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))" 2>/dev/null || true)
  [[ -n "$UID" ]] \
    && ok "upsert test user → id=${UID}" \
    || fail "upsert test user failed: ${UPSERT:0:120}"

  # Balance before credit
  BAL_BEFORE=$(curl -sk "${BASE_URL}/api/internal/balance/${TEST_TID}" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('balanceSkz','err'))" 2>/dev/null || echo "err")

  # Credit
  CREDIT=$(curl -sk -X POST "${BASE_URL}/api/internal/credit" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"telegramId\":\"${TEST_TID}\",\"amount\":\"${CREDIT_AMOUNT}\",\"description\":\"health-check\",\"referenceId\":\"${REF}_cr\"}")
  CR_BAL=$(echo "$CREDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('newSkzBalance','err'))" 2>/dev/null || echo "err")
  CR_COM=$(echo "$CREDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('commissionDeducted','err'))" 2>/dev/null || echo "err")
  CR_TX=$(echo  "$CREDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('transactionId','err'))" 2>/dev/null || echo "err")

  if [[ "$CR_BAL" == "err" || "$CR_TX" == "err" ]]; then
    fail "credit call failed: ${CREDIT:0:120}"
  else
    ok "credit ${CREDIT_AMOUNT} SKZ → txId=${CR_TX}, commissionDeducted=${CR_COM} SKZ, newBalance=${CR_BAL}"

    # Assert commission math: commission = amount * rate, net = amount - commission
    MATH_OK=$(python3 - <<PYEOF 2>/dev/null
import decimal
D = decimal.Decimal
amount = D("${CREDIT_AMOUNT}")
rate   = D("${EXPECTED_COMMISSION_RATE}")
before = D("${BAL_BEFORE}") if "${BAL_BEFORE}" != "err" else None
commission_got = D("${CR_COM}")
balance_got    = D("${CR_BAL}")
expected_commission = (amount * rate).quantize(D("0.01"))
expected_balance    = (before + amount - expected_commission) if before is not None else None
ok = True
if abs(commission_got - expected_commission) > D("0.10"):
    print(f"COMMISSION_MISMATCH: expected~={expected_commission} got={commission_got}")
    ok = False
if expected_balance is not None and abs(balance_got - expected_balance) > D("0.10"):
    print(f"BALANCE_MISMATCH: expected~={expected_balance} got={balance_got}")
    ok = False
if ok:
    print("OK")
PYEOF
)
    if [[ "$MATH_OK" == "OK" ]]; then
      ok "Commission math: ${CREDIT_AMOUNT} × ${EXPECTED_COMMISSION_RATE} = ${CR_COM} deducted, balance delta correct"
    elif [[ -n "$MATH_OK" ]]; then
      fail "Commission math error: ${MATH_OK}"
    else
      warn "Could not verify commission math (python3 unavailable)"
    fi
  fi

  # Debit
  DEBIT=$(curl -sk -X POST "${BASE_URL}/api/internal/debit" \
    -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"telegramId\":\"${TEST_TID}\",\"amount\":\"${DEBIT_AMOUNT}\",\"description\":\"health-check-debit\",\"referenceId\":\"${REF}_db\"}")
  DB_BAL=$(echo "$DEBIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('newSkzBalance','err'))" 2>/dev/null || echo "err")
  [[ "$DB_BAL" != "err" ]] \
    && ok "debit ${DEBIT_AMOUNT} SKZ → newBalance=${DB_BAL}" \
    || fail "debit failed: ${DEBIT:0:120}"

  # Balance endpoint must agree with debit response
  if [[ "$DB_BAL" != "err" ]]; then
    BAL_FINAL=$(curl -sk "${BASE_URL}/api/internal/balance/${TEST_TID}" \
      -H "X-Bot-Api-Key: ${GAMES_API_KEY}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('balanceSkz','err'))" 2>/dev/null || echo "err")
    BAL_MATCH=$(python3 -c "
from decimal import Decimal
a, b = Decimal('${DB_BAL}'), Decimal('${BAL_FINAL}')
print('OK' if abs(a-b) < Decimal('0.01') else f'MISMATCH: debit={a} balance={b}')
" 2>/dev/null || echo "skip")
    if [[ "$BAL_MATCH" == "OK" ]]; then
      ok "Balance invariant: /balance endpoint agrees with debit response (${BAL_FINAL} SKZ)"
    elif [[ "$BAL_MATCH" == "skip" ]]; then
      warn "Could not verify balance invariant"
    else
      fail "Balance invariant: ${BAL_MATCH}"
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "7. Superadmin panel — key endpoints (with auth)"
# ────────────────────────────────────────────────────────────────────────────
if [[ -z "$ADMIN_TOKEN" ]]; then
  warn "ADMIN_TOKEN not available — skipping superadmin checks"
else
  STATS=$(http_body "${BASE_URL}/api/stats/overview" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  TOTAL_USERS=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalUsers','err'))" 2>/dev/null || echo "err")
  ACTIVE_BOTS=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('activeBots','err'))" 2>/dev/null || echo "err")
  PENDING_WD=$(echo  "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pendingWithdrawals','err'))" 2>/dev/null || echo "err")

  if [[ "$TOTAL_USERS" != "err" ]]; then
    ok "GET /api/stats/overview → users=${TOTAL_USERS}, activeBots=${ACTIVE_BOTS}, pendingWithdrawals=${PENDING_WD}"
  else
    fail "GET /api/stats/overview failed: ${STATS:0:80}"
  fi

  for ep in users bots transactions withdrawals; do
    code=$(http_code "${BASE_URL}/api/superadmin/${ep}" -H "Authorization: Bearer ${ADMIN_TOKEN}")
    [[ "$code" == "200" ]] \
      && ok "GET /api/superadmin/${ep} → 200" \
      || fail "GET /api/superadmin/${ep} → ${code} (expected 200)"
  done
fi

# ────────────────────────────────────────────────────────────────────────────
hdr "8. Cloudflare API token — Cache Purge permission"
# ────────────────────────────────────────────────────────────────────────────
if [[ -z "$CF_TOKEN" || -z "$CF_ZONE" ]]; then
  warn "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not set in ${API_ENV} — skipping"
else
  PURGE=$(curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/purge_cache" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"files":["https://souqrates.com/__health_check_probe__"]}' 2>/dev/null || true)
  PURGE_OK=$(echo "$PURGE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null || echo "false")
  if [[ "$PURGE_OK" == "True" || "$PURGE_OK" == "true" ]]; then
    ok "Cloudflare token has Cache Purge permission ✓"
  else
    PURGE_ERR=$(echo "$PURGE" | python3 -c "import sys,json; d=json.load(sys.stdin); errs=d.get('errors',[]); print(errs[0].get('message','') if errs else 'unknown')" 2>/dev/null || echo "unknown")
    fail "Cloudflare token lacks Cache Purge permission — ${PURGE_ERR}"
    echo -e "     ${YELLOW}Fix: dash.cloudflare.com → API Tokens → Create Token → Cache Purge template → Zone: souqrates.com${RESET}"
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
if [[ $FAILED -eq 0 && $WARNED -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  RESULT: ALL CHECKS PASSED ✅${RESET}"
elif [[ $FAILED -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}  RESULT: PASSED with ${WARNED} warning(s) ⚠️${RESET}"
else
  echo -e "${RED}${BOLD}  RESULT: ${FAILED} CRITICAL FAILURE(S) ❌   |   ${WARNED} warning(s)${RESET}"
fi
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${RESET}\n"

exit "$FAILED"
