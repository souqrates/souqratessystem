import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Append-only audit log of privileged actions taken by admins/superadmins.
 *
 * Recorded for every mutating admin endpoint (approve/reject withdrawal,
 * credit/debit a user, change platform settings, block/unblock a user,
 * publish bot texts, send broadcasts, …). The row is written BEFORE the
 * response is sent — if the audit insert fails the operation aborts (5xx),
 * so no privileged write can ever land without an audit trail.
 *
 * `actorRole` is "admin" or "superadmin" depending on which guard ran.
 * `actorTokenHash` is a SHA-256 of the bearer token so we can correlate
 * actions to a specific key without ever storing the key in plaintext.
 * `targetType` + `targetId` link to the affected entity (e.g. "withdrawal"/12,
 * "user"/843). `payload` keeps the request body excerpt useful for review
 * (PII removed by the caller before passing in).
 */
export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    actorRole: text("actor_role").notNull(),
    actorTokenHash: text("actor_token_hash"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    payload: jsonb("payload"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    success: integer("success").notNull().default(1), // 1 ok, 0 failure
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    auditCreatedIdx: index("audit_created_idx").on(t.createdAt),
    auditActionIdx: index("audit_action_idx").on(t.action),
    auditTargetIdx: index("audit_target_idx").on(t.targetType, t.targetId),
  }),
);

export const insertAdminAuditLogSchema = createInsertSchema(
  adminAuditLogTable,
).omit({ id: true, createdAt: true });
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;
