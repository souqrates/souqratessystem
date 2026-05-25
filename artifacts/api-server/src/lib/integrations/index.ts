import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  decryptString,
  encryptString,
  isEncrypted,
  maskSecret,
} from "./crypto";
import { getAdapter, listAdapters } from "./registry";
import type { IntegrationAdapter, IntegrationTestResult } from "./types";

export { listAdapters, getAdapter };
export type { IntegrationAdapter, IntegrationTestResult };

/**
 * Convert a user-submitted config object into a storable JSON object,
 * encrypting any field that the adapter marks `secret: true`. Fields not
 * declared on the adapter are dropped — protects against schema pollution.
 *
 * When a secret field is omitted in the input but already exists in the
 * previous row (`previous`), the old encrypted value is preserved. This is
 * how the UI lets the admin update only non-secret fields without retyping
 * keys every time.
 */
export function buildStoredConfig(
  adapter: IntegrationAdapter,
  input: Record<string, unknown>,
  previous: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of adapter.fields) {
    const incoming = input[f.key];
    if (typeof incoming === "string" && incoming.length > 0) {
      out[f.key] = f.secret ? encryptString(incoming) : incoming;
    } else if (incoming === "" && !f.secret) {
      // Allow clearing non-secret fields explicitly.
      out[f.key] = "";
    } else if (f.secret && previous[f.key]) {
      // Keep prior encrypted secret if the admin didn't re-enter it.
      out[f.key] = previous[f.key];
    } else if (f.default !== undefined) {
      out[f.key] = f.default;
    }
  }
  return out;
}

/**
 * Build the *plaintext* config that adapter.test() expects — decrypt
 * each secret field. NEVER returns the decrypted secrets out of the
 * admin-test flow.
 */
export function decryptConfig(
  adapter: IntegrationAdapter,
  stored: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of adapter.fields) {
    const v = stored[f.key];
    if (typeof v === "string") {
      out[f.key] = v;
    } else if (f.secret && isEncrypted(v)) {
      out[f.key] = decryptString(v);
    } else if (f.default !== undefined) {
      out[f.key] = f.default;
    } else {
      out[f.key] = "";
    }
  }
  return out;
}

/**
 * Public-safe view of an integration row for the UI. Secret fields are
 * returned as masked strings (last 4 chars visible) when present, or
 * empty string when not yet configured.
 */
export interface IntegrationPublicView {
  slug: string;
  enabled: boolean;
  configured: boolean;
  fields: Record<string, string>;
  fieldMeta: Record<string, { hasValue: boolean; masked?: string }>;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  lastTestMetadata: Record<string, unknown> | null;
  adapter: {
    slug: string;
    name: string;
    brand: string;
    category: string;
    tier: number;
    description: string;
    signupUrl: string;
    docsUrl: string;
    pricing: string;
    fields: IntegrationAdapter["fields"];
  };
}

export function toPublicView(
  adapter: IntegrationAdapter,
  row: {
    slug: string;
    enabled: boolean;
    config: Record<string, unknown>;
    lastTestAt: Date | null;
    lastTestStatus: string | null;
    lastTestError: string | null;
    lastTestMetadata: Record<string, unknown> | null;
  } | null,
): IntegrationPublicView {
  const stored = row?.config ?? {};
  const fields: Record<string, string> = {};
  const fieldMeta: Record<string, { hasValue: boolean; masked?: string }> = {};
  let anyValue = false;

  for (const f of adapter.fields) {
    const v = stored[f.key];
    if (f.secret) {
      if (isEncrypted(v)) {
        try {
          const plain = decryptString(v);
          fields[f.key] = ""; // never echo secret back to client
          fieldMeta[f.key] = { hasValue: true, masked: maskSecret(plain) };
          anyValue = true;
        } catch {
          fields[f.key] = "";
          fieldMeta[f.key] = { hasValue: true, masked: "•••• (decrypt error)" };
        }
      } else {
        fields[f.key] = "";
        fieldMeta[f.key] = { hasValue: false };
      }
    } else if (typeof v === "string" && v.length > 0) {
      fields[f.key] = v;
      fieldMeta[f.key] = { hasValue: true };
      anyValue = true;
    } else {
      fields[f.key] = f.default ?? "";
      fieldMeta[f.key] = { hasValue: false };
    }
  }

  return {
    slug: adapter.slug,
    enabled: row?.enabled ?? false,
    configured: anyValue,
    fields,
    fieldMeta,
    lastTestAt: row?.lastTestAt ? row.lastTestAt.toISOString() : null,
    lastTestStatus: row?.lastTestStatus ?? null,
    lastTestError: row?.lastTestError ?? null,
    lastTestMetadata: row?.lastTestMetadata ?? null,
    adapter: {
      slug: adapter.slug,
      name: adapter.name,
      brand: adapter.brand,
      category: adapter.category,
      tier: adapter.tier,
      description: adapter.description,
      signupUrl: adapter.signupUrl,
      docsUrl: adapter.docsUrl,
      pricing: adapter.pricing,
      fields: adapter.fields,
    },
  };
}

/** Look up a stored row by slug, or null if none. */
export async function loadIntegrationRow(slug: string) {
  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * Runtime helper: read the *decrypted, ready-to-use* config of an enabled
 * integration. Returns `null` if not enabled or no row. Use this from
 * application code (e.g. when initialising Sentry, or when sending an
 * email through Resend).
 */
export async function getActiveConfig(
  slug: string,
): Promise<Record<string, string> | null> {
  const adapter = getAdapter(slug);
  if (!adapter) return null;
  const row = await loadIntegrationRow(slug);
  if (!row || !row.enabled) return null;
  return decryptConfig(adapter, (row.config ?? {}) as Record<string, unknown>);
}
