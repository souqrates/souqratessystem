/**
 * Two-tier read-through cache used by hot money-path helpers
 * (getSkzRates, getReferralRates, getEffectiveCommissionRate, bot lookup
 * by API key, …) and as an idempotency-claim store for create/sell flows.
 *
 * Tier 1: in-process LRU-ish Map. Bounded, microsecond hits, survives a
 *         brief Upstash outage. Naturally per-replica — short TTLs make
 *         eventual consistency acceptable.
 * Tier 2: Upstash Redis via the existing REST client. Shared across
 *         replicas. Lazy-init from the `integrations` row so the operator
 *         can enable it from /integrations without a restart.
 *
 * Failure stance: every Upstash error is logged and swallowed. A cache
 * miss returns null; a SET failure leaves the value in memory only.
 * Cache is defence-in-depth — DB is the authoritative store.
 */
import { getActiveConfig } from "./integrations";
import { UpstashRestClient } from "./rate-limit-upstash-store";
import { logger } from "./logger";

const KEY_PREFIX = "c:";
const MEM_MAX = 2000;

type MemEntry = { v: unknown; exp: number };
const mem = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) { mem.delete(key); return null; }
  // bump recency
  mem.delete(key); mem.set(key, hit);
  return hit.v as T;
}

function memSet(key: string, value: unknown, ttlSec: number): void {
  if (mem.size >= MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
}

function memDel(key: string): void { mem.delete(key); }

// ── Lazy Upstash client ────────────────────────────────────────────────
// Re-check every 60s so flipping the toggle in /integrations picks up
// without a restart.
let client: UpstashRestClient | null = null;
let clientCheckedAt = 0;
let clientPromise: Promise<UpstashRestClient | null> | null = null;

async function getClient(): Promise<UpstashRestClient | null> {
  const now = Date.now();
  if (now - clientCheckedAt < 60_000) return client;
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    try {
      const cfg = await getActiveConfig("upstash_redis");
      clientCheckedAt = Date.now();
      if (!cfg || !cfg["rest_url"] || !cfg["rest_token"]) {
        client = null;
        return null;
      }
      client = new UpstashRestClient(String(cfg["rest_url"]), String(cfg["rest_token"]));
      return client;
    } catch (err) {
      logger.warn({ err }, "cache: failed to read upstash_redis config");
      clientCheckedAt = Date.now();
      client = null;
      return null;
    } finally {
      clientPromise = null;
    }
  })();
  return clientPromise;
}

// ── Public API ─────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const full = KEY_PREFIX + key;
  const hit = memGet<T>(full);
  if (hit !== null) return hit;
  const c = await getClient();
  if (!c) return null;
  try {
    const raw = await c.cmd(["GET", full]);
    if (raw == null) return null;
    const parsed = JSON.parse(String(raw)) as T;
    return parsed;
  } catch (err) {
    logger.warn({ err, key }, "cache GET failed");
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const full = KEY_PREFIX + key;
  memSet(full, value, ttlSec);
  const c = await getClient();
  if (!c) return;
  try {
    await c.cmd(["SET", full, JSON.stringify(value), "EX", ttlSec]);
  } catch (err) {
    logger.warn({ err, key }, "cache SET failed — mem only");
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  for (const k of keys) memDel(KEY_PREFIX + k);
  const c = await getClient();
  if (!c || keys.length === 0) return;
  try {
    await c.cmd(["DEL", ...keys.map(k => KEY_PREFIX + k)]);
  } catch (err) {
    logger.warn({ err, keys }, "cache DEL failed");
  }
}

/**
 * Read-through cache.
 *
 * Loader runs ONLY on miss. Cache failures never throw — a SET failure
 * leaves the value cached in-process only; a GET failure is treated as
 * a miss and the loader runs. We deliberately do NOT cache null/undefined
 * to avoid pinning negative results behind a TTL.
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await loader();
  if (value !== null && value !== undefined) {
    cacheSet(key, value, ttlSec).catch(() => {});
  }
  return value;
}

/**
 * Atomic idempotency claim (SET NX EX). Returns true the FIRST time a
 * key is seen, false on every replay within `ttlSec`.
 *
 * Use for create/sell flows where the client may retry on network
 * failure — DB-level uniqueness is the authoritative guard, this is a
 * fast pre-DB short-circuit.
 *
 * Fails OPEN: if Upstash is unreachable we record the key in mem and
 * return true so the legitimate request still goes through. DB
 * uniqueness will catch a same-replica replay; cross-replica replays
 * during an Upstash outage are an accepted, time-bounded risk.
 */
export async function idempotencyClaim(key: string, ttlSec = 86_400): Promise<boolean> {
  const full = KEY_PREFIX + "idem:" + key;
  if (memGet(full) !== null) return false;
  const c = await getClient();
  if (!c) {
    memSet(full, 1, Math.min(ttlSec, 3600));
    return true;
  }
  try {
    const r = await c.cmd(["SET", full, "1", "EX", ttlSec, "NX"]);
    const claimed = r === "OK";
    if (claimed) memSet(full, 1, Math.min(ttlSec, 3600));
    return claimed;
  } catch (err) {
    logger.warn({ err, key }, "idempotency SET NX failed — fail-open");
    memSet(full, 1, Math.min(ttlSec, 3600));
    return true;
  }
}
