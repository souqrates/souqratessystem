/**
 * Custom express-rate-limit Store backed by Upstash Redis REST.
 *
 * Why a hand-rolled REST client instead of @upstash/redis: that SDK is
 * declared as an optional peer of drizzle-orm. Installing it adds
 * @upstash/redis to drizzle-orm's peer-hash bucket → pnpm creates a
 * second resolved copy of drizzle-orm → TypeScript trips on the private
 * `shouldInlineParams` field mismatch across the workspace. A tiny
 * fetch-based client sidesteps the whole problem and is < 30 lines.
 *
 * Upstash REST contract: any command can be invoked as
 *   POST {url}/{cmd}/{arg1}/{arg2}...   with Bearer token
 * It returns { result } or { error }. Pipelining is just POSTing a
 * JSON array of command arrays to {url}/pipeline.
 *
 * Algorithm: atomic fixed-window via INCR + EXPIRE-NX, pipelined into
 * one round-trip. The first hit in a window sets the TTL; subsequent
 * hits just increment. When the TTL expires, the key disappears and the
 * next request starts a fresh window.
 *
 * Failure stance: any HTTP/network/parse error opens the gate (totalHits
 * = 1, never blocks). Rate-limiting is defence-in-depth; we must not
 * 500 legitimate traffic because Upstash hiccuped.
 */
import type { Store, IncrementResponse, Options } from "express-rate-limit";
import { logger } from "./logger";

const KEY_PREFIX = "rl:";

export class UpstashRestClient {
  constructor(private readonly url: string, private readonly token: string) {}

  async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`upstash http ${res.status}`);
    const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    // Surface per-command errors. A 200 OK envelope can still wrap a
    // command-level error (e.g. wrong arity, syntax) — silently dropping
    // those caused subtle failures where INCR succeeded but EXPIRE NX
    // didn't, leaving keys without TTL and effectively permanent
    // rate-limit lockouts.
    for (const r of data) {
      if (r && typeof r.error === "string" && r.error.length > 0) {
        throw new Error(`upstash cmd error: ${r.error}`);
      }
    }
    return data.map((r) => r.result);
  }

  async cmd(args: (string | number)[]): Promise<unknown> {
    const [out] = await this.pipeline([args]);
    return out;
  }

  async ping(): Promise<string> {
    const r = await this.cmd(["PING"]);
    return String(r ?? "");
  }
}

export class UpstashRedisStore implements Store {
  private windowMs = 60_000;
  constructor(private readonly client: UpstashRestClient, private readonly tag: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const fullKey = `${KEY_PREFIX}${this.tag}:${key}`;
    const ttlSec = Math.ceil(this.windowMs / 1000);
    try {
      const results = await this.client.pipeline([
        ["INCR", fullKey],
        ["EXPIRE", fullKey, ttlSec, "NX"],
      ]);
      const totalHits = Number(results[0]);
      if (!Number.isFinite(totalHits) || totalHits < 1) {
        // Anomalous response — treat as fail-open rather than serve a
        // bogus counter.
        throw new Error(`upstash INCR returned non-number: ${String(results[0])}`);
      }
      return {
        totalHits,
        resetTime: new Date(Date.now() + this.windowMs),
      };
    } catch (err) {
      logger.warn({ err, tag: this.tag }, "Upstash store INCR failed — fail-open");
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try { await this.client.cmd(["DECR", `${KEY_PREFIX}${this.tag}:${key}`]); } catch { /* fail-open */ }
  }

  async resetKey(key: string): Promise<void> {
    try { await this.client.cmd(["DEL", `${KEY_PREFIX}${this.tag}:${key}`]); } catch { /* fail-open */ }
  }
}
