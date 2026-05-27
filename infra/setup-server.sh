#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  SOUQRATES SYSTEM — Contabo VPS bootstrap
#  Run ONCE on a fresh Ubuntu 24.04 server:
#    ssh root@YOUR_IP "bash -s" < setup-server.sh
#  Idempotent: safe to re-run.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

DEPLOY_USER="souq"
SSH_PORT="${SSH_PORT:-22}"

log() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }

# ── 1. System update ────────────────────────────────────────────────────
log "Updating system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  htop ncdu jq git rsync \
  postgresql-client-16

# ── 2. Swap (Contabo VPS often ships without swap) ──────────────────────
if [[ ! -f /swapfile ]]; then
  log "Creating 4G swapfile"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf
  sysctl -p /etc/sysctl.d/99-swap.conf
fi

# ── 3. Deploy user ──────────────────────────────────────────────────────
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  log "Creating deploy user: $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  mkdir -p /home/$DEPLOY_USER/.ssh
  # copy root's authorized_keys so you can ssh as souq with same key
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
  fi
  echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
fi

# ── 4. Docker + compose v2 ──────────────────────────────────────────────
if ! command -v docker >/dev/null; then
  log "Installing Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  usermod -aG docker "$DEPLOY_USER"
  systemctl enable --now docker
fi

# Docker daemon: log rotation so containers don't fill the disk
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" },
  "default-address-pools": [{ "base": "172.30.0.0/16", "size": 24 }]
}
EOF
systemctl restart docker

# ── 5. Firewall ─────────────────────────────────────────────────────────
log "Configuring ufw firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow $SSH_PORT/tcp comment 'SSH'
ufw allow 80/tcp        comment 'HTTP'
ufw allow 443/tcp       comment 'HTTPS'
ufw allow 443/udp       comment 'HTTP/3'
ufw --force enable

# ── 6. fail2ban (basic SSH protection) ──────────────────────────────────
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban

# ── 7. Auto security updates ────────────────────────────────────────────
dpkg-reconfigure -fnoninteractive unattended-upgrades || true
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ── 8. App directory ────────────────────────────────────────────────────
mkdir -p /opt/souqrates
chown $DEPLOY_USER:$DEPLOY_USER /opt/souqrates

# ── 9. Done ─────────────────────────────────────────────────────────────
log "✅ Server ready."
echo
echo "Next steps:"
echo "  1. SSH as the deploy user from now on:  ssh $DEPLOY_USER@<this-server-ip>"
echo "  2. Copy your repo to /opt/souqrates:    rsync -avz ./ $DEPLOY_USER@<ip>:/opt/souqrates/"
echo "  3. Copy infra/.env.example to /opt/souqrates/infra/.env and fill values"
echo "  4. Run: cd /opt/souqrates/infra && docker compose up -d --build"
echo
echo "After verifying, disable root SSH:"
echo "  sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl reload ssh"
