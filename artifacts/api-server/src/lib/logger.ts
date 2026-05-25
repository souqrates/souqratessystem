import pino, { type Logger, multistream, type StreamEntry } from "pino";

const isProduction = process.env.NODE_ENV === "production";

const baseOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
};

function buildDefaultLogger(): Logger {
  return pino(
    baseOptions,
    isProduction
      ? pino.destination(1)
      : pino.transport({
          target: "pino-pretty",
          options: { colorize: true },
        }) as unknown as NodeJS.WritableStream,
  );
}

// Live logger instance. Wrapped in a Proxy below so import bindings stay
// stable even when we swap the underlying instance (boot-time upgrade to
// Better Stack multi-stream).
let _logger: Logger = buildDefaultLogger();

export const logger: Logger = new Proxy({} as Logger, {
  get: (_t, prop) => Reflect.get(_logger as object, prop),
  set: (_t, prop, value) => Reflect.set(_logger as object, prop, value),
}) as Logger;

/**
 * Boot-time hook: if Better Stack is configured + enabled in /integrations,
 * rebuild the logger with a multi-stream destination so every log line is
 * written to BOTH stdout AND shipped to Better Stack (batched).
 *
 * Called from index.ts after Sentry + rate-limit init. No-op if disabled.
 */
export async function upgradeLoggerWithBetterStack(): Promise<boolean> {
  try {
    const { getActiveConfig } = await import("./integrations");
    const cfg = await getActiveConfig("betterstack");
    if (!cfg || !cfg["logs_source_token"]) return false;
    const { createBetterStackStream } = await import("./logger-betterstack");
    const bsStream = createBetterStackStream({
      token: cfg["logs_source_token"],
      host: cfg["logs_ingest_host"] || "in.logs.betterstack.com",
    });
    // Multi-stream: keep local stdout for ops + ship to Better Stack.
    // pino multistream requires real Streams — we pass our Writable.
    const streams: StreamEntry[] = [
      { stream: process.stdout },
      { stream: bsStream },
    ];
    _logger = pino(baseOptions, multistream(streams));
    _logger.info("Logger upgraded: Better Stack streaming enabled");
    return true;
  } catch (err) {
    _logger.warn({ err }, "Better Stack init failed — keeping default logger");
    return false;
  }
}
