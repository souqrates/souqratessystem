import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

// Global cheap limiter: blunts trivial floods without affecting real users.
// 600 req/min/IP is generous for a Mini App + bot mix (≈10 rps sustained).
export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Per-IP key. When a leaked bot API key is being abused, the bot-scoped
  // limiter below kicks in additionally.
  message: { error: "rate_limited" },
});

// Tighter limiter applied to write-heavy /internal/* routes. Keyed by the
// bot API key so one misbehaving bot can't drown the others.
export const internalWriteLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10_000,
  limit: 200, // 20 rps per bot
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.header("X-Bot-Api-Key") ?? req.ip ?? "anon",
  message: { error: "rate_limited_bot" },
});

// Very strict limiter for the admin login endpoint: deters credential brute
// force without locking out a legitimate admin who mistyped once or twice.
export const adminLoginLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too_many_login_attempts" },
});
