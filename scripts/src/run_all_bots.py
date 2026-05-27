#!/usr/bin/env python3
"""Run all Telegram bots concurrently in one workflow."""
import subprocess
import sys
import signal
import os

BOTS = [
    ("mother",    "artifacts/mother-bot/src/bot.py"),
    ("books",     "artifacts/books-bot/src/bot.py"),
    ("contests",  "artifacts/contests-bot/src/bot.py"),
    ("subagents", "artifacts/subagents-bot/src/bot.py"),
]

procs = []

def shutdown(*_):
    for name, p in procs:
        if p.poll() is None:
            try: p.terminate()
            except Exception: pass
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

for name, path in BOTS:
    print(f"[supervisor] starting {name} → {path}", flush=True)
    p = subprocess.Popen(
        [sys.executable, "-u", path],
        env={**os.environ, "BOT_LABEL": name},
        stdout=sys.stdout, stderr=sys.stderr,
    )
    procs.append((name, p))

# Wait — exit if any child dies so the workflow auto-restarts the whole group
while True:
    for name, p in procs:
        rc = p.poll()
        if rc is not None:
            print(f"[supervisor] {name} exited with code {rc}; shutting down group", flush=True)
            shutdown()
    try:
        signal.pause()
    except Exception:
        break
