/**
 * Better Stack (Logtail) destination for pino.
 *
 * Why custom: @logtail/pino spawns a worker thread; that worker can't
 * read our DB-stored token without env vars (the whole point of the
 * /integrations panel is to *avoid* duplicate env vars). A simple in-
 * process batched HTTP destination is ~70 lines, has no extra deps,
 * and never blocks log writes — failures are dropped, not retried,
 * because logs that can't be shipped must not crash the API.
 *
 * Batching: up to 100 lines OR 1s flush, whichever comes first.
 * Backpressure: if the buffer exceeds 5000 pending lines (e.g. Better
 * Stack outage), oldest lines are dropped to bound memory.
 */
import { Writable } from "node:stream";

const MAX_BATCH = 100;
const FLUSH_MS = 1000;
const MAX_BUFFER = 5000;

export function createBetterStackStream(opts: {
  token: string;
  host: string;
}): Writable {
  const host = opts.host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const url = `https://${host}`;
  const buffer: Record<string, unknown>[] = [];
  let timer: NodeJS.Timeout | null = null;
  let dropped = 0;

  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, MAX_BATCH);
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Silent: never block app for log shipping failures.
    }
    if (buffer.length > 0 && !timer) {
      timer = setTimeout(flush, FLUSH_MS);
    }
  };

  const stream = new Writable({
    write(chunk, _enc, cb) {
      try {
        const text = chunk.toString("utf8");
        for (const line of text.split("\n")) {
          if (!line) continue;
          let obj: Record<string, unknown>;
          try { obj = JSON.parse(line) as Record<string, unknown>; }
          catch { obj = { message: line }; }
          // Logtail expects `dt` for timestamp + flat `message`.
          if (typeof obj["time"] === "number") {
            obj["dt"] = new Date(obj["time"] as number).toISOString();
          }
          if (typeof obj["msg"] === "string" && typeof obj["message"] !== "string") {
            obj["message"] = obj["msg"];
          }
          buffer.push(obj);
          if (buffer.length > MAX_BUFFER) {
            buffer.splice(0, buffer.length - MAX_BUFFER);
            dropped++;
          }
          if (buffer.length >= MAX_BATCH) {
            void flush();
          } else if (!timer) {
            timer = setTimeout(flush, FLUSH_MS);
          }
        }
      } catch {
        // Never throw from a log destination.
      }
      cb();
    },
  });

  // Best-effort flush on process exit so the last batch ships.
  process.once("beforeExit", () => { void flush(); });

  // Periodic visibility into drops via stderr (NOT through pino — would loop).
  setInterval(() => {
    if (dropped > 0) {
      process.stderr.write(`[betterstack] dropped ${dropped} log lines due to backpressure\n`);
      dropped = 0;
    }
  }, 60_000).unref();

  return stream;
}
