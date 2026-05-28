---
name: Contabo deploy path
description: Correct paths and commands for deploying updates to Contabo VPS
---

The git repo on Contabo lives at `/opt/souqrates/repo`, NOT at `/opt/souqrates` directly.

**To deploy any update:**
```bash
ssh root@194.163.155.52
sudo bash /opt/souqrates/repo/deploy/scripts/deploy.sh
```

The script does: git pull → pnpm install + typecheck + build all artifacts → rsync static → restart all systemd services → health check.

**Why:** The initial `install.sh` clones into `/opt/souqrates/repo` and runs services from there. `/opt/souqrates/` itself is the home dir for the `souqrates` system user and contains venvs, logs, etc.
