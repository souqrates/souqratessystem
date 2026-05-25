import rateLimit, {
  ipKeyGenerator,
  type RateLimitRequestHandler,
  type Store,
} from "express-rate-limit";
import type { RequestHandler } from "express";
import { getActiveConfig } from "./integrations";
import { UpstashRedisStore, UpstashRestClient } from "./rate-limit-upstash-store";
import { logger } from "./logger";

/**
 * Limiter design notes
 * --------------------
 * We export *middleware wrappers* (RequestHandler) instead of the raw
 * RateLimitRequestHandler. Each wrapper delegates to a live limiter that
 * the boot sequence can swap from memory→Redis after reading the admin
 * integrations panel. This avoids restructuring every importer.
 *
 * At process start, all four wrappers point at memory-backed limiters
 * (safe default). If Upstash Redis is enabled in /integrations, the boot
 * sequence calls `installDistributedRateLimitStore()` which rebuilds the
 * four limiters against a shared Upstash store. After that, every replica
 * shares one global counter per key — the only correct behaviour under
 * horizontal scale.
 */

function buildLimiters(store?: Store) {
  return {
    global: rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "rate_limited" },
      ...(store ? { store } : {}),
    }),
    internalWrite: rateLimit({
      windowMs: 10_000,
      limit: 200,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) =>
        req.header("X-Bot-Api-Key") ?? ipKeyGenerator(req.ip ?? "anon"),
      message: { error: "rate_limited_bot" },
      ...(store ? { store } : {}),
    }),
    adminLogin: rateLimit({
      windowMs: 5 * 60_000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "too_many_login_attempts" },
      ...(store ? { store } : {}),
    }),
    integrationTest: rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "test_rate_limited" },
      ...(store ? { store } : {}),
    }),
  };
}

let live = buildLimiters();

// Wrapper delegators — keep stable references so `app.use(globalLimiter)`
// still works after the live limiter is swapped at boot.
export const globalLimiter: RequestHandler = (req, res, next) =>
  live.global(req, res, next);
export const internalWriteLimiter: RequestHandler = (req, res, next) =>
  live.internalWrite(req, res, next);
export const adminLoginLimiter: RequestHandler = (req, res, next) =>
  live.adminLogin(req, res, next);
export const integrationTestLimiter: RequestHandler = (req, res, next) =>
  live.integrationTest(req, res, next);

/**
 * Boot-time hook: if Upstash Redis is configured + enabled in the admin
 * panel, rebuild all four limiters against a shared Redis store. Called
 * from index.ts after Sentry init and before app.listen.
 *
 * No-op if Upstash isn't enabled (limiters stay memory-backed).
 */
export async function installDistributedRateLimitStore(): Promise<boolean> {
  try {
    const cfg = await getActiveConfig("upstash_redis");
    if (!cfg || !cfg["rest_url"] || !cfg["rest_token"]) {
      logger.info("Rate limit: Upstash not configured, using in-memory store");
      return false;
    }
    const client = new UpstashRestClient(cfg["rest_url"], cfg["rest_token"]);
    // Cheap connectivity probe — fail-fast so we don't poison every
    // request with timeouts if the credentials are wrong.
    try {
      await client.ping();
    } catch (e) {
      logger.warn({ err: e }, "Upstash ping failed — falling back to in-memory rate limit");
      return false;
    }
    live = {
      global: rateLimit({
        windowMs: 60_000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false,
        message: { error: "rate_limited" },
        store: new UpstashRedisStore(client, "global"),
      }),
      internalWrite: rateLimit({
        windowMs: 10_000, limit: 200, standardHeaders: "draft-7", legacyHeaders: false,
        keyGenerator: (req) =>
          req.header("X-Bot-Api-Key") ?? ipKeyGenerator(req.ip ?? "anon"),
        message: { error: "rate_limited_bot" },
        store: new UpstashRedisStore(client, "internal"),
      }),
      adminLogin: rateLimit({
        windowMs: 5 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false,
        message: { error: "too_many_login_attempts" },
        store: new UpstashRedisStore(client, "adminlogin"),
      }),
      integrationTest: rateLimit({
        windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false,
        message: { error: "test_rate_limited" },
        store: new UpstashRedisStore(client, "inttest"),
      }),
    };
    logger.info("Rate limit: upgraded to Upstash Redis (distributed)");
    return true;
  } catch (err) {
    logger.error({ err }, "installDistributedRateLimitStore failed — keeping memory store");
    return false;
  }
}
