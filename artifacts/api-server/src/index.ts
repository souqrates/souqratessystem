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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
