import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, integrationsTable } from "@workspace/db";
import { requireSuperAdmin } from "../lib/super-admin-auth";
import { logAdminAction } from "../lib/audit-log";
import { integrationTestLimiter } from "../lib/rate-limit";
import {
  buildStoredConfig,
  decryptConfig,
  getAdapter,
  listAdapters,
  loadIntegrationRow,
  toPublicView,
} from "../lib/integrations";

const router: IRouter = Router();

/**
 * GET /superadmin/integrations
 * List every registered adapter with its current row (if any) — used by the
 * admin UI to render the grid of integration cards.
 */
router.get("/superadmin/integrations", requireSuperAdmin, async (_req, res): Promise<void> => {
  const adapters = listAdapters();
  const rows = await db.select().from(integrationsTable);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const data = adapters.map((a) =>
    toPublicView(a, (bySlug.get(a.slug) as Parameters<typeof toPublicView>[1]) ?? null),
  );
  res.json({ data });
});

/**
 * GET /superadmin/integrations/:slug — single integration detail.
 */
router.get("/superadmin/integrations/:slug", requireSuperAdmin, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const adapter = getAdapter(slug);
  if (!adapter) {
    res.status(404).json({ error: "unknown_integration" });
    return;
  }
  const row = await loadIntegrationRow(slug);
  res.json(toPublicView(adapter, row as Parameters<typeof toPublicView>[1] ?? null));
});

/**
 * PUT /superadmin/integrations/:slug
 * body: { enabled?: boolean, config?: Record<string, string> }
 *
 * Upsert pattern: any field NOT in `config` keeps its previous stored
 * value (so the admin can edit just one knob without re-entering the API
 * key). Secret fields are encrypted at rest.
 *
 * Saving wipes the previous test result so the badge resets to "untested"
 * until the admin clicks "Test" again. This prevents stale green badges
 * after a config change that may have broken things.
 */
router.put("/superadmin/integrations/:slug", requireSuperAdmin, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const adapter = getAdapter(slug);
  if (!adapter) {
    res.status(404).json({ error: "unknown_integration" });
    return;
  }
  const body = (req.body ?? {}) as { enabled?: boolean; config?: Record<string, unknown> };

  const previousRow = await loadIntegrationRow(slug);
  const previousConfig = (previousRow?.config ?? {}) as Record<string, unknown>;

  let newConfig = previousConfig;
  if (body.config && typeof body.config === "object") {
    newConfig = buildStoredConfig(adapter, body.config, previousConfig);
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : previousRow?.enabled ?? false;

  // Refuse to enable without at least one required field — protects against
  // a half-configured integration silently failing at runtime.
  if (enabled) {
    for (const f of adapter.fields) {
      if (!f.required) continue;
      const v = newConfig[f.key];
      const hasValue =
        (typeof v === "string" && v.length > 0) ||
        (typeof v === "object" && v !== null);
      if (!hasValue) {
        res.status(400).json({
          error: "missing_required_field",
          field: f.key,
          label: f.label,
        });
        return;
      }
    }
  }

  const configChanged = JSON.stringify(newConfig) !== JSON.stringify(previousConfig);
  const wipeTest = configChanged;

  const [row] = await db
    .insert(integrationsTable)
    .values({
      slug,
      enabled,
      config: newConfig,
      lastTestAt: wipeTest ? null : previousRow?.lastTestAt ?? null,
      lastTestStatus: wipeTest ? null : previousRow?.lastTestStatus ?? null,
      lastTestError: wipeTest ? null : previousRow?.lastTestError ?? null,
      lastTestMetadata: wipeTest ? null : (previousRow?.lastTestMetadata as Record<string, unknown> | null) ?? null,
    })
    .onConflictDoUpdate({
      target: integrationsTable.slug,
      set: {
        enabled,
        config: newConfig,
        ...(wipeTest
          ? {
              lastTestAt: null,
              lastTestStatus: null,
              lastTestError: null,
              lastTestMetadata: null,
            }
          : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  await logAdminAction(req, "superadmin", {
    action: "integration.upsert",
    targetType: "integration",
    targetId: slug,
    payload: {
      enabled,
      configChanged,
      fieldsTouched: body.config ? Object.keys(body.config) : [],
    },
  });

  req.log.info({ slug, enabled, configChanged }, "superadmin: integration updated");
  res.json(toPublicView(adapter, row as Parameters<typeof toPublicView>[1]));
});

/**
 * POST /superadmin/integrations/:slug/test
 * Runs the adapter's probe against the currently saved config and
 * persists the result so the UI can show the badge.
 */
router.post("/superadmin/integrations/:slug/test", integrationTestLimiter, requireSuperAdmin, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const adapter = getAdapter(slug);
  if (!adapter) {
    res.status(404).json({ error: "unknown_integration" });
    return;
  }
  const row = await loadIntegrationRow(slug);
  if (!row) {
    res.status(400).json({ error: "not_configured" });
    return;
  }

  const cfg = decryptConfig(adapter, (row.config ?? {}) as Record<string, unknown>);

  let result;
  try {
    result = await adapter.test(cfg);
  } catch (e) {
    // Adapter threw — treat as failed test (not a 500), so admin sees the cause.
    result = {
      ok: false,
      error: `adapter threw: ${e instanceof Error ? e.message : String(e)}`,
    };
    req.log.warn({ slug, err: e }, "integration test threw");
  }

  const [updated] = await db
    .update(integrationsTable)
    .set({
      lastTestAt: new Date(),
      lastTestStatus: result.ok ? "ok" : "failed",
      lastTestError: result.ok ? null : (result.error ?? "unknown"),
      lastTestMetadata: (result.metadata ?? null) as Record<string, unknown> | null,
    })
    .where(eq(integrationsTable.slug, slug))
    .returning();

  await logAdminAction(req, "superadmin", {
    action: "integration.test",
    targetType: "integration",
    targetId: slug,
    payload: { ok: result.ok, error: result.error ?? null },
  });

  res.json({
    ok: result.ok,
    error: result.error ?? null,
    metadata: result.metadata ?? null,
    view: toPublicView(adapter, updated as Parameters<typeof toPublicView>[1]),
  });
});

/**
 * DELETE /superadmin/integrations/:slug — remove stored config entirely.
 * Use this to forget a leaked key. Adapter remains registered and can be
 * re-configured later.
 */
router.delete("/superadmin/integrations/:slug", requireSuperAdmin, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const adapter = getAdapter(slug);
  if (!adapter) {
    res.status(404).json({ error: "unknown_integration" });
    return;
  }
  await db.delete(integrationsTable).where(eq(integrationsTable.slug, slug));
  await logAdminAction(req, "superadmin", {
    action: "integration.delete",
    targetType: "integration",
    targetId: slug,
    payload: {},
  });
  res.json({ ok: true });
});

export default router;
