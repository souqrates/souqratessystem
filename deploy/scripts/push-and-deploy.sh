#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  push-and-deploy.sh
#  يُشغَّل من Replit shell بعد أي تعديل.
#  يرفع الكود لـ GitHub ثم يسحبه مباشرة لـ Contabo ويُعيد التشغيل.
#
#  الاستخدام:
#    bash deploy/scripts/push-and-deploy.sh
#
#  المتطلبات (مرة واحدة فقط):
#    1. أضف مفتاح SSH هذا على Contabo:
#       ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOjHwLBBQWF6tf6B/j9lTEDJ5TWAMJZ5z498wdoKEn8G replit-contabo-deploy
#    2. تأكد أن ملفات /etc/souqrates/*.env موجودة على Contabo
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

VPS_HOST="${VPS_HOST:-194.163.155.52}"
VPS_USER="${VPS_USER:-root}"
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/contabo_deploy}"
REPO_DIR="/opt/souqrates/repo"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes)
[[ -f "$VPS_SSH_KEY" ]] && SSH_OPTS+=(-i "$VPS_SSH_KEY")

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

# ── 1. رفع الكود لـ GitHub ────────────────────────────────────────
log "رفع الكود لـ GitHub"
git push origin main 2>&1 | grep -v "warning:\|lock\|Another git\|crashed\|remove the" || true

HEAD=$(git rev-parse --short HEAD)
echo "  ✓ رُفع: $HEAD"

# ── 2. سحب الكود على Contabo ونشره ───────────────────────────────
log "اتصال بـ Contabo ($VPS_HOST) …"

ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" bash << REMOTE
  set -euo pipefail
  echo "  ▶ git pull"
  sudo bash ${REPO_DIR}/deploy/scripts/deploy.sh
REMOTE

log "✅ النشر اكتمل: $HEAD مباشر على الإنتاج"
