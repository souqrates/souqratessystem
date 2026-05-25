import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Registry of all external service integrations the platform can be wired to
 * (Upstash Redis, Sentry, Resend, Cloudflare Turnstile, BetterStack, etc.).
 *
 * Design rules:
 *   - Row exists per integration ONLY when the admin has saved config at least
 *     once. Adapters that the admin never touched simply have no row and use
 *     defaults from code.
 *   - `slug` matches an adapter id registered in
 *     `artifacts/api-server/src/lib/integrations/registry.ts`. Unknown slugs
 *     are ignored at runtime, not deleted, so older configs survive a deploy.
 *   - `config` stores all user-provided fields. Fields marked `secret: true`
 *     in the adapter spec are encrypted at rest using SESSION_SECRET-derived
 *     AES-256-GCM (see `lib/integrations/crypto.ts`). The encrypted shape is
 *     `{ __enc: "v1", iv, tag, ct }`.
 *   - `lastTestStatus` is the result of the most recent admin "Test
 *     Connection" click ("ok" | "failed"). The UI uses this for the badge.
 *   - `enabled=true` means the integration is live in the runtime. The
 *     consuming code (e.g. the Sentry init) checks both `enabled` and a
 *     successful last test before activating.
 */
export const integrationsTable = pgTable("integrations", {
  slug: text("slug").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").notNull().default({}),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  lastTestStatus: text("last_test_status"),
  lastTestError: text("last_test_error"),
  lastTestMetadata: jsonb("last_test_metadata"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Integration = typeof integrationsTable.$inferSelect;
export type NewIntegration = typeof integrationsTable.$inferInsert;
