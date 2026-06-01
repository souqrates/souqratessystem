// Allow BigInt fields (e.g. telegramId) to be JSON-serialised as strings
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

// Sentry must be initialised BEFORE app is imported, otherwise its
// instrumentation can't patch http/express modules. We await the DB read
// once at boot — adds ~50ms to startup, worth it to avoid env-var duplication.
import { initSentryFromIntegration } from "./lib/sentry-init";
await initSentryFromIntegration();

// Upgrade rate-limit store from in-memory to Upstash Redis (if enabled
// in /integrations). MUST run before app import so the live limiters
// app.ts wires are already pointing at the Redis-backed store.
import { installDistributedRateLimitStore } from "./lib/rate-limit";
await installDistributedRateLimitStore();

// Upgrade pino to multi-stream with Better Stack ingest (if enabled).
// Logger stays import-stable thanks to its Proxy wrapper.
import { upgradeLoggerWithBetterStack, logger } from "./lib/logger";
await upgradeLoggerWithBetterStack();

// Dynamic import so `./app` (and its transitive http/express modules) is
// evaluated AFTER Sentry init. A static import would be hoisted and
// loaded before the top-level awaits above, defeating Sentry's
// auto-instrumentation patching of http/express.
const { default: app } = await import("./app");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Hold a reference to stopDepositWatcher so the shutdown handler can call it
// even though the watcher is loaded lazily after the server is up.
let _stopDepositWatcher: (() => void) | null = null;

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start the on-chain deposit watcher AFTER the HTTP server is up so a
  // tonapi outage at boot can't block readiness. The watcher is a no-op
  // if TON_WALLET_ADDRESS is unset (dev/local).
  import("./lib/deposit-watcher").then(({ startDepositWatcher, stopDepositWatcher }) => {
    startDepositWatcher();
    _stopDepositWatcher = stopDepositWatcher;
  }).catch((e: unknown) => {
    logger.error({ err: e }, "failed to start deposit watcher");
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
// Handles SIGTERM (sent by Docker/K8s/systemd on deploy) and SIGINT (Ctrl-C).
// Stops accepting new connections, drains the deposit watcher, then exits.
// Falls back to a forced exit after 10 s so a hung keep-alive never blocks.
function shutdown(signal: string): void {
  logger.info({ signal }, "shutdown signal received — closing gracefully");
  _stopDepositWatcher?.();
  server.close(() => {
    logger.info("HTTP server closed cleanly");
    process.exit(0);
  });
  // Force-exit if connections don't drain within 10 s.
  setTimeout(() => {
    logger.warn("graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
