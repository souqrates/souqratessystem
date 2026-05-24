import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Super-admin authentication for the central master control panel at
 * /superadmin. Backed by the MASTER_ADMIN_CODE env secret (distinct from
 * ADMIN_TOKEN used by the older single-bot admin dashboard).
 *
 * Token is sent as `Authorization: Bearer <code>` and compared in constant
 * time. If MASTER_ADMIN_CODE is unset or too short (<8 chars) we fail
 * closed with 503 to refuse super-admin operations.
 */
export function verifySuperAdminCode(candidate: string): boolean {
  const expected = process.env.MASTER_ADMIN_CODE;
  if (!expected || expected.length < 8) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.MASTER_ADMIN_CODE;
  if (!expected || expected.length < 8) {
    res.status(503).json({
      error: "MASTER_ADMIN_CODE is not configured. Super-admin routes are disabled.",
    });
    return;
  }

  const header = req.headers.authorization;
  const provided = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!provided) {
    res.status(401).json({ error: "Super-admin authentication required" });
    return;
  }

  if (!verifySuperAdminCode(provided)) {
    res.status(403).json({ error: "Invalid super-admin code" });
    return;
  }

  next();
}
