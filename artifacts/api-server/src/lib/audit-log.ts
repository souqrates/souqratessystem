import type { Request } from "express";
import crypto from "crypto";
import { db, adminAuditLogTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Hash the bearer token so we can correlate actions to an admin key
 * across the audit log without ever storing the secret in plaintext.
 * SHA-256 over the raw token; first 16 hex chars are enough to identify
 * a key in a normal-sized fleet of admin tokens.
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function extractTokenHash(req: Request): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) {
    const tok = h.slice("Bearer ".length).trim();
    if (tok) return hashToken(tok);
  }
  return null;
}

function extractIp(req: Request): string | null {
  // Express trust-proxy parses x-forwarded-for into req.ip. Fall back to raw.
  return (
    (req.ip ?? null) ||
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim() ?? null
      : null) ||
    (req.socket?.remoteAddress ?? null)
  );
}

export interface AuditEntry {
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  payload?: Record<string, unknown> | null;
  success?: boolean;
  errorMessage?: string | null;
}

/**
 * Record an admin action. Best-effort: a failure to insert the audit row
 * is logged but never thrown — the underlying business operation should not
 * be aborted by an observability failure. Callers MUST still call this for
 * every mutating admin route, even when the operation itself failed (with
 * `success: false`), so unauthorized-attempt patterns are visible too.
 */
export async function logAdminAction(
  req: Request,
  role: "admin" | "superadmin",
  entry: AuditEntry,
): Promise<void> {
  try {
    await db.insert(adminAuditLogTable).values({
      actorRole: role,
      actorTokenHash: extractTokenHash(req),
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId != null ? String(entry.targetId) : null,
      payload: (entry.payload ?? null) as never,
      ip: extractIp(req),
      userAgent: req.headers["user-agent"] ?? null,
      success: entry.success === false ? 0 : 1,
      errorMessage: entry.errorMessage ?? null,
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, "audit log insert failed");
  }
}
