/**
 * PostHog server-side capture helper.
 *
 * Why hand-rolled (not posthog-node): we already have an /integrations
 * panel that stores PostHog credentials in the DB. Adding posthog-node
 * would mean either duplicating creds in env vars (defeats the panel)
 * or reaching into private internals to swap credentials at runtime.
 * PostHog's capture endpoint is a single HTTP POST, so a 40-line client
 * is simpler and keeps the dependency footprint tiny.
 *
 * Contract: callers fire-and-forget via `void capture(...)`. We never
 * throw — analytics failures must not affect business flows. Events are
 * sent on a background timer (batched up to 50 events or 2s). Buffer is
 * bounded at 5000 to cap memory if PostHog is unreachable.
 *
 * Config refresh: cached for 60s so admin toggles in /integrations are
 * picked up quickly without hammering the DB on every event.
 */
import { getActiveConfig } from "./integrations";
import { logger } from "./logger";

type Cfg = { host: string; key: string } | null;

const CACHE_TTL_MS = 60_000;
const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH = 50;
const MAX_BUFFER = 5000;

let cached: { value: Cfg; at: number } | null = null;
let cacheLock: Promise<Cfg> | null = null;

async function loadCfg(): Promise<Cfg> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  // Single-flight: avoid thundering-herd on cold cache.
  if (cacheLock) return cacheLock;
  cacheLock = (async (): Promise<Cfg> => {
    try {
      const cfg = await getActiveConfig("posthog");
      const value: Cfg =
        cfg && cfg["project_api_key"]
          ? {
              host: (cfg["host"] || "https://us.i.posthog.com").replace(/\/+$/, ""),
              key: cfg["project_api_key"],
            }
          : null;
      cached = { value, at: Date.now() };
      return value;
    } catch (err) {
      logger.warn({ err }, "PostHog config load failed");
      cached = { value: null, at: Date.now() };
      return null;
    } finally {
      cacheLock = null;
    }
  })();
  return cacheLock;
}

interface QueuedEvent {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

const queue: QueuedEvent[] = [];
let dropped = 0;
let timer: NodeJS.Timeout | null = null;

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const cfg = await loadCfg();
  if (!cfg) {
    // Disabled — discard pending events so we don't accumulate forever.
    queue.length = 0;
    return;
  }
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await fetch(`${cfg.host}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.key,
        batch: batch.map((e) => ({ ...e, type: "capture" })),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.debug({ err }, "PostHog batch send failed (dropped)");
  }
}

function scheduleFlush(): void {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    await flush();
    if (queue.length > 0) scheduleFlush();
  }, FLUSH_INTERVAL_MS);
  timer.unref();
}

/**
 * Fire-and-forget. Caller uses `void capture(...)`. Safe to call from
 * any code path — never throws, never blocks.
 */
export function capture(
  event: string,
  distinctId: string | number | bigint,
  properties: Record<string, unknown> = {},
): void {
  try {
    if (queue.length >= MAX_BUFFER) {
      queue.splice(0, queue.length - MAX_BUFFER + 1);
      dropped++;
    }
    queue.push({
      event,
      distinct_id: String(distinctId),
      properties,
      timestamp: new Date().toISOString(),
    });
    if (queue.length >= MAX_BATCH) {
      void flush();
    } else {
      scheduleFlush();
    }
  } catch {
    // Never throw from analytics.
  }
}

setInterval(() => {
  if (dropped > 0) {
    logger.warn({ dropped }, "PostHog analytics drops (buffer full)");
    dropped = 0;
  }
}, 60_000).unref();
