import { Router, type IRouter } from "express";
import { eq, sql, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  botsTable,
  commissionOverridesTable,
  usersTable,
} from "@workspace/db";
import {
  requireSuperAdmin,
  verifySuperAdminCode,
} from "../lib/super-admin-auth";

const router: IRouter = Router();

// ── Auth ─────────────────────────────────────────────────────────────────
router.post("/superadmin/login", (req, res): void => {
  const { code } = (req.body ?? {}) as { code?: string };
  if (typeof code !== "string" || !code) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  if (!verifySuperAdminCode(code)) {
    res.status(403).json({ error: "Invalid super-admin code" });
    return;
  }
  res.json({ ok: true });
});

router.get("/superadmin/me", requireSuperAdmin, (_req, res): void => {
  res.json({ ok: true, role: "superadmin" });
});

// ── Bots ─────────────────────────────────────────────────────────────────
router.get("/superadmin/bots", requireSuperAdmin, async (_req, res): Promise<void> => {
  const bots = await db.select().from(botsTable).orderBy(botsTable.id);
  const safe = bots.map(({ apiKey: _k, webhookSecret: _s, ...rest }) => rest);
  res.json({ data: safe });
});

router.patch("/superadmin/bots/:slug", requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const { name, description, commissionRate, isActive } = req.body as {
    name?: string;
    description?: string;
    commissionRate?: string | number;
    isActive?: boolean;
  };

  const [existing] = await db.select({ id: botsTable.id }).from(botsTable).where(eq(botsTable.slug, raw));
  if (!existing) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const updates: Partial<typeof botsTable.$inferInsert> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof description === "string") updates.description = description;
  if (commissionRate !== undefined) {
    const rate = typeof commissionRate === "number" ? commissionRate : parseFloat(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      res.status(400).json({ error: "commissionRate must be a decimal between 0 and 1 (e.g. 0.05 = 5%)" });
      return;
    }
    updates.commissionRate = rate.toFixed(4);
  }
  if (typeof isActive === "boolean") updates.isActive = isActive;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db.update(botsTable).set(updates).where(eq(botsTable.slug, raw)).returning();
  const { apiKey: _k, webhookSecret: _s, ...safe } = updated;
  req.log.info({ slug: raw, updates }, "superadmin: bot updated");
  res.json(safe);
});

// ── Commission Overrides (per-user exception rates) ──────────────────────
router.get("/superadmin/commission-overrides", requireSuperAdmin, async (req, res): Promise<void> => {
  const { botSlug, telegramId } = req.query as { botSlug?: string; telegramId?: string };

  const conds = [];
  if (botSlug) conds.push(eq(commissionOverridesTable.botSlug, botSlug));
  if (telegramId) {
    try {
      conds.push(eq(commissionOverridesTable.telegramId, BigInt(telegramId)));
    } catch {
      res.status(400).json({ error: "Invalid telegramId" });
      return;
    }
  }

  const rows = await db
    .select({
      id: commissionOverridesTable.id,
      telegramId: commissionOverridesTable.telegramId,
      botSlug: commissionOverridesTable.botSlug,
      commissionRate: commissionOverridesTable.commissionRate,
      note: commissionOverridesTable.note,
      createdAt: commissionOverridesTable.createdAt,
      updatedAt: commissionOverridesTable.updatedAt,
      userFirstName: usersTable.firstName,
      userUsername: usersTable.username,
    })
    .from(commissionOverridesTable)
    .leftJoin(usersTable, eq(usersTable.telegramId, commissionOverridesTable.telegramId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(commissionOverridesTable.updatedAt));

  res.json({ data: rows });
});

router.post("/superadmin/commission-overrides", requireSuperAdmin, async (req, res): Promise<void> => {
  const { telegramId, botSlug, commissionRate, note } = req.body as {
    telegramId?: string | number;
    botSlug?: string;
    commissionRate?: string | number;
    note?: string;
  };

  if (!telegramId || !botSlug || commissionRate === undefined) {
    res.status(400).json({ error: "telegramId, botSlug, commissionRate are required" });
    return;
  }

  let tid: bigint;
  try {
    tid = BigInt(String(telegramId));
  } catch {
    res.status(400).json({ error: "Invalid telegramId" });
    return;
  }

  const rate = typeof commissionRate === "number" ? commissionRate : parseFloat(String(commissionRate));
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    res.status(400).json({ error: "commissionRate must be a decimal between 0 and 1" });
    return;
  }

  const [bot] = await db.select({ id: botsTable.id }).from(botsTable).where(eq(botsTable.slug, botSlug));
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [row] = await db
    .insert(commissionOverridesTable)
    .values({
      telegramId: tid,
      botSlug,
      commissionRate: rate.toFixed(4),
      note: note ?? null,
    })
    .onConflictDoUpdate({
      target: [commissionOverridesTable.telegramId, commissionOverridesTable.botSlug],
      set: { commissionRate: rate.toFixed(4), note: note ?? null, updatedAt: new Date() },
    })
    .returning();

  req.log.info({ telegramId: tid.toString(), botSlug, rate }, "superadmin: commission override upserted");
  res.json(row);
});

router.delete("/superadmin/commission-overrides/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db.delete(commissionOverridesTable).where(eq(commissionOverridesTable.id, id)).returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

// ── Platform stats (lightweight overview) ────────────────────────────────
router.get("/superadmin/overview", requireSuperAdmin, async (_req, res): Promise<void> => {
  const [usersCount, botsCount, overridesCount] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(usersTable),
    db.select({ c: sql<number>`count(*)::int` }).from(botsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(commissionOverridesTable),
  ]);
  res.json({
    users: Number(usersCount[0]?.c ?? 0),
    bots: Number(botsCount[0]?.c ?? 0),
    overrides: Number(overridesCount[0]?.c ?? 0),
  });
});

export default router;
