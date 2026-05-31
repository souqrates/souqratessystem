#!/usr/bin/env python3
"""
Generate all /etc/souqrates/*.env files from Replit secrets and push to Contabo.

Usage (from Replit shell):
    python3 deploy/scripts/push-envs-to-contabo.py

Requirements:
    - SSH key at ~/.ssh/id_rsa (or set VPS_SSH_KEY env var)
    - Contabo VPS at 194.163.155.52 (or set VPS_HOST env var)
    - openssh-client available (scp command)

The script reads every secret from the current Replit environment,
writes the 6 env files to /tmp/souqrates-envs/, then SCPs them into
/etc/souqrates/ on the VPS as root (chmod 640).
"""

import os, subprocess, secrets, sys, textwrap
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
VPS_HOST    = os.getenv("VPS_HOST",    "194.163.155.52")
VPS_USER    = os.getenv("VPS_USER",    "root")
VPS_SSH_KEY = os.getenv("VPS_SSH_KEY", str(Path.home() / ".ssh" / "id_rsa"))
ENV_DIR     = "/etc/souqrates"
TMP_DIR     = Path("/tmp/souqrates-envs")

# ── Helpers ───────────────────────────────────────────────────────────────────
def e(key, fallback=""):
    """Read an env var; warn if missing."""
    val = os.getenv(key, fallback)
    if not val:
        print(f"  ⚠  {key} not set in environment", flush=True)
    return val

def webhook_secret():
    """Each bot should have a unique, fresh 32-byte hex secret."""
    return secrets.token_hex(32)

def fix_api_key(val, slug):
    """
    Guard against the known mistake of setting SCRATCHY_BOT_API_KEY
    (and similar) to the Telegram bot token (contains a colon).
    """
    if ":" in val:
        print(f"  ⚠  {slug} API key looks like a Telegram token — it will be "
              f"BLANK in the env file.  Fix {slug.upper().replace('-','_')}_API_KEY "
              f"in Replit secrets.", flush=True)
        return ""
    return val

# ── Read DATABASE_URL ─────────────────────────────────────────────────────────
# On Replit it is injected automatically (not listed in named secrets).
# On VPS it must be a Neon pooled connection string.
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL is not set. Export it before running:")
    print("  export DATABASE_URL='postgresql://user:pass@host/souqrates?sslmode=require'")
    sys.exit(1)

# ── Assemble env file contents ────────────────────────────────────────────────
WEBHOOK_SECRETS = {bot: webhook_secret()
                   for bot in ("mother-bot","books-bot","contests-bot",
                               "subagents-bot","scratchy-bot")}

_scratchy_raw = e("SCRATCHY_BOT_API_KEY")
if not _scratchy_raw:
    print("ERROR: SCRATCHY_BOT_API_KEY is not set. Cannot generate env files.", flush=True)
    sys.exit(1)
SCRATCHY_API_KEY = fix_api_key(_scratchy_raw, "scratchy-bot")
if not SCRATCHY_API_KEY:
    print("ERROR: SCRATCHY_BOT_API_KEY looks like a Telegram token (contains ':')."
          " Set a proper API key in Replit secrets.", flush=True)
    sys.exit(1)

ENV_FILES = {

"api-server.env": f"""\
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

DATABASE_URL={DATABASE_URL}

SESSION_SECRET={e("SESSION_SECRET")}
ADMIN_TOKEN={e("ADMIN_TOKEN")}
MASTER_ADMIN_CODE={e("MASTER_ADMIN_CODE")}

S3_ENDPOINT={e("S3_ENDPOINT")}
S3_REGION={e("S3_REGION","auto")}
S3_BUCKET={e("S3_BUCKET")}
S3_ACCESS_KEY={e("S3_ACCESS_KEY")}
S3_SECRET_KEY={e("S3_SECRET_KEY")}
PRIVATE_OBJECT_DIR={e("PRIVATE_OBJECT_DIR")}
PUBLIC_OBJECT_SEARCH_PATHS={e("PUBLIC_OBJECT_SEARCH_PATHS")}

TON_API_KEY={e("TON_API_KEY")}
TON_WALLET_ADDRESS={e("TON_WALLET_ADDRESS")}

CRYPTOMUS_MERCHANT_UUID={e("CRYPTOMUS_MERCHANT_UUID")}
CRYPTOMUS_PAYMENT_API_KEY={e("CRYPTOMUS_PAYMENT_API_KEY")}
CRYPTOMUS_PAYOUT_API_KEY={e("CRYPTOMUS_PAYOUT_API_KEY")}
CRYPTOMUS_WEBHOOK_SECRET={e("CRYPTOMUS_WEBHOOK_SECRET")}

RESEND_API_KEY={e("RESEND_API_KEY")}
RESEND_FROM_EMAIL={e("RESEND_FROM_EMAIL")}

SENTRY_DSN={e("SENTRY_DSN")}

TURNSTILE_SECRET_KEY={e("TURNSTILE_SECRET_KEY")}
TURNSTILE_SITE_KEY={e("TURNSTILE_SITE_KEY")}

UPSTASH_REST_URL={e("UPSTASH_REST_URL")}
UPSTASH_REST_TOKEN={e("UPSTASH_REST_TOKEN")}

CLOUDFLARE_API_TOKEN={e("CLOUDFLARE_API_TOKEN")}
CLOUDFLARE_ZONE_ID={e("CLOUDFLARE_ZONE_ID")}

MOTHER_BOT_TOKEN={e("MOTHER_BOT_TOKEN")}
GAMES_BOT_TOKEN={e("GAMES_BOT_TOKEN")}
BOOKS_BOT_TOKEN={e("BOOKS_BOT_TOKEN")}
CONTESTS_BOT_TOKEN={e("CONTESTS_BOT_TOKEN")}
SUBAGENTS_BOT_TOKEN={e("SUBAGENTS_BOT_TOKEN")}
SCRATCHY_BOT_TOKEN={e("SCRATCHY_BOT_TOKEN")}

MOTHER_BOT_API_KEY={fix_api_key(e("MOTHER_BOT_API_KEY"), "mother-bot")}
BOOKS_BOT_API_KEY={fix_api_key(e("BOOKS_BOT_API_KEY"), "books-bot")}
CONTESTS_BOT_API_KEY={fix_api_key(e("CONTESTS_BOT_API_KEY"), "contests-bot")}
SUBAGENTS_BOT_API_KEY={fix_api_key(e("SUBAGENTS_BOT_API_KEY"), "subagents-bot")}
GAMES_BOT_API_KEY={fix_api_key(e("GAMES_BOT_API_KEY"), "games-bot")}
SCRATCHY_BOT_API_KEY={SCRATCHY_API_KEY}
""",

"mother-bot.env": f"""\
MOTHER_BOT_TOKEN={e("MOTHER_BOT_TOKEN")}
MOTHER_BOT_API_KEY={fix_api_key(e("MOTHER_BOT_API_KEY"), "mother-bot")}
MOTHER_API_URL=http://127.0.0.1:8080/api
MASTER_ADMIN_CODE={e("MASTER_ADMIN_CODE")}
PUBLIC_BASE_URL=https://souqrates.com

USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET={WEBHOOK_SECRETS["mother-bot"]}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8101

DISABLE_SUBAGENTS_SPAWN=1
DISABLE_SCRATCHY_SPAWN=1

SENTRY_DSN={e("SENTRY_DSN")}
""",

"books-bot.env": f"""\
BOOKS_BOT_TOKEN={e("BOOKS_BOT_TOKEN")}
BOOKS_BOT_API_KEY={fix_api_key(e("BOOKS_BOT_API_KEY"), "books-bot")}
MOTHER_API_URL=http://127.0.0.1:8080/api
PUBLIC_BASE_URL=https://souqrates.com

USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET={WEBHOOK_SECRETS["books-bot"]}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8102

SENTRY_DSN={e("SENTRY_DSN")}
""",

"contests-bot.env": f"""\
CONTESTS_BOT_TOKEN={e("CONTESTS_BOT_TOKEN")}
CONTESTS_BOT_API_KEY={fix_api_key(e("CONTESTS_BOT_API_KEY"), "contests-bot")}
MOTHER_API_URL=http://127.0.0.1:8080/api
PUBLIC_BASE_URL=https://souqrates.com

USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET={WEBHOOK_SECRETS["contests-bot"]}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8103

SENTRY_DSN={e("SENTRY_DSN")}
""",

"subagents-bot.env": f"""\
SUBAGENTS_BOT_TOKEN={e("SUBAGENTS_BOT_TOKEN")}
SUBAGENTS_BOT_API_KEY={fix_api_key(e("SUBAGENTS_BOT_API_KEY"), "subagents-bot")}
MOTHER_API_URL=http://127.0.0.1:8080/api
MOTHER_BOT_USERNAME=souqrates_system_bot
PUBLIC_BASE_URL=https://souqrates.com

USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET={WEBHOOK_SECRETS["subagents-bot"]}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8104

SENTRY_DSN={e("SENTRY_DSN")}
""",

"scratchy-bot.env": f"""\
SCRATCHY_BOT_TOKEN={e("SCRATCHY_BOT_TOKEN")}
SCRATCHY_BOT_API_KEY={SCRATCHY_API_KEY}
MOTHER_API_URL=http://127.0.0.1:8080/api
PUBLIC_BASE_URL=https://souqrates.com

USE_WEBHOOK=1
WEBHOOK_BASE_URL=https://souqrates.com
WEBHOOK_SECRET={WEBHOOK_SECRETS["scratchy-bot"]}
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8105

SENTRY_DSN={e("SENTRY_DSN")}
""",

}

# ── Write to /tmp ─────────────────────────────────────────────────────────────
TMP_DIR.mkdir(parents=True, exist_ok=True)
for fname, content in ENV_FILES.items():
    path = TMP_DIR / fname
    path.write_text(content)
    path.chmod(0o600)
    print(f"  ✓  wrote {path}", flush=True)

print(f"\n✅  All env files written to {TMP_DIR}", flush=True)

# ── SCP to VPS ────────────────────────────────────────────────────────────────
SSH_OPTS = [
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
]
if Path(VPS_SSH_KEY).exists():
    SSH_OPTS += ["-i", VPS_SSH_KEY]

print(f"\n🚀  Pushing to {VPS_USER}@{VPS_HOST}:{ENV_DIR}/", flush=True)

# Ensure /etc/souqrates exists and is owned correctly on VPS
prep_cmd = (
    f"install -d -m 0750 -o root -g souqrates {ENV_DIR} 2>/dev/null || "
    f"mkdir -p {ENV_DIR}"
)
subprocess.run(
    ["ssh"] + SSH_OPTS + [f"{VPS_USER}@{VPS_HOST}", prep_cmd],
    check=True
)

for fname in ENV_FILES:
    src = str(TMP_DIR / fname)
    dst = f"{VPS_USER}@{VPS_HOST}:{ENV_DIR}/{fname}"
    result = subprocess.run(
        ["scp"] + SSH_OPTS + [src, dst],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  ✓  {fname}", flush=True)
    else:
        print(f"  ✗  {fname}: {result.stderr.strip()}", flush=True)

# Fix permissions on VPS
fix_cmd = f"chmod 640 {ENV_DIR}/*.env && chown root:souqrates {ENV_DIR}/*.env"
subprocess.run(
    ["ssh"] + SSH_OPTS + [f"{VPS_USER}@{VPS_HOST}", fix_cmd],
    check=True
)

print(f"""
╔══════════════════════════════════════════════════════╗
║  env files are live on Contabo.                      ║
║  Next steps on VPS:                                  ║
║                                                      ║
║  1. Push DB schema (if first time):                  ║
║     cd /opt/souqrates/repo                           ║
║     sudo -u souqrates bash -lc                       ║
║       'DATABASE_URL=$(grep ^DATABASE_URL             ║
║         /etc/souqrates/api-server.env                ║
║         | cut -d= -f2-)                              ║
║        pnpm --filter @workspace/db run push'         ║
║                                                      ║
║  2. Start / restart services:                        ║
║     systemctl restart souqrates-api.service          ║
║     systemctl restart souqrates-mother-bot.service   ║
║       souqrates-books-bot.service                    ║
║       souqrates-contests-bot.service                 ║
║       souqrates-subagents-bot.service                ║
║       souqrates-scratchy-bot.service                 ║
╚══════════════════════════════════════════════════════╝
""", flush=True)
