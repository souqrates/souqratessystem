import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Require a valid admin bearer token on the request.
 *
 * Token is provided via `Authorization: Bearer <token>` and compared in
 * constant time against the `ADMIN_TOKEN` environment secret.
 *
 * If `ADMIN_TOKEN` is not configured the server refuses to serve admin
 * routes with 503 — failing closed, never open.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 16) {
    res.status(503).json({
      error:
        "ADMIN_TOKEN is not configured on this server. Admin routes are disabled.",
    });
    return;
  }

  const header = req.headers.authorization;
  const provided = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!provided) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(403).json({ error: "Invalid admin token" });
    return;
  }

  next();
}

/**
 * Plain helper for the /api/admin/login endpoint — verify a candidate token
 * against ADMIN_TOKEN in constant time and return a boolean. Does not throw.
 */
export function verifyAdminToken(candidate: string): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 16) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
