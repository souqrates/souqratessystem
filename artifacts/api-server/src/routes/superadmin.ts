import { Router, type IRouter } from "express";
import { eq, sql, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  botsTable,
  commissionOverridesTable,
  usersTable,
  botTextsTable,
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

// ── Bot Texts (draft/publish editable copy) ──────────────────────────────

// Default seeded keys for any bot. Used to bootstrap the editor with a
// useful starting set on first GET when the bot has no entries yet.
const DEFAULT_TEXT_KEYS: Array<{ key: string; label: string; draft: string }> = [
  { key: "welcome", label: "رسالة الترحيب (/start)", draft: "أهلاً بك 👋" },
  { key: "help", label: "رسالة المساعدة (/help)", draft: "كيف يمكنني مساعدتك؟" },
  { key: "about", label: "نبذة عن البوت (/about)", draft: "" },
  { key: "error_generic", label: "رسالة خطأ عام", draft: "حدث خطأ غير متوقع، حاول مجدداً." },
  { key: "low_balance", label: "رصيد غير كافٍ", draft: "رصيدك لا يكفي لإتمام هذه العملية." },
  { key: "maintenance", label: "وضع الصيانة", draft: "البوت قيد الصيانة حالياً، نعود قريباً." },
];

async function ensureDefaultsFor(botSlug: string): Promise<void> {
  const existing = await db
    .select({ key: botTextsTable.key })
    .from(botTextsTable)
    .where(eq(botTextsTable.botSlug, botSlug));
  const have = new Set(existing.map((r) => r.key));
  const missing = DEFAULT_TEXT_KEYS.filter((d) => !have.has(d.key));
  if (missing.length === 0) return;
  await db
    .insert(botTextsTable)
    .values(missing.map((d) => ({ botSlug, key: d.key, label: d.label, draftValue: d.draft })))
    .onConflictDoNothing();
}

router.get("/superadmin/bot-texts", requireSuperAdmin, async (req, res): Promise<void> => {
  const botSlug = String(req.query.botSlug ?? "");
  if (!botSlug) {
    res.status(400).json({ error: "botSlug is required" });
    return;
  }
  await ensureDefaultsFor(botSlug);
  const rows = await db
    .select()
    .from(botTextsTable)
    .where(eq(botTextsTable.botSlug, botSlug))
    .orderBy(botTextsTable.id);
  res.json({ data: rows });
});

router.post("/superadmin/bot-texts", requireSuperAdmin, async (req, res): Promise<void> => {
  const { botSlug, key, label, draftValue } = req.body as {
    botSlug?: string;
    key?: string;
    label?: string;
    draftValue?: string;
  };
  if (!botSlug || !key || !label) {
    res.status(400).json({ error: "botSlug, key, label are required" });
    return;
  }
  const [row] = await db
    .insert(botTextsTable)
    .values({ botSlug, key, label, draftValue: draftValue ?? "" })
    .onConflictDoUpdate({
      target: [botTextsTable.botSlug, botTextsTable.key],
      set: { label, draftValue: draftValue ?? "", updatedAt: new Date() },
    })
    .returning();
  res.json(row);
});

router.patch("/superadmin/bot-texts/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { label, draftValue } = req.body as { label?: string; draftValue?: string };
  const updates: Partial<typeof botTextsTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof label === "string") updates.label = label;
  if (typeof draftValue === "string") updates.draftValue = draftValue;
  const [row] = await db.update(botTextsTable).set(updates).where(eq(botTextsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post("/superadmin/bot-texts/:id/publish", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .update(botTextsTable)
    .set({
      publishedValue: sql`${botTextsTable.draftValue}`,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(botTextsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post("/superadmin/bot-texts/publish-all", requireSuperAdmin, async (req, res): Promise<void> => {
  const botSlug = String((req.body ?? {}).botSlug ?? "");
  if (!botSlug) {
    res.status(400).json({ error: "botSlug is required" });
    return;
  }
  const rows = await db
    .update(botTextsTable)
    .set({
      publishedValue: sql`${botTextsTable.draftValue}`,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(botTextsTable.botSlug, botSlug))
    .returning({ id: botTextsTable.id });
  res.json({ ok: true, count: rows.length });
});

router.delete("/superadmin/bot-texts/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db.delete(botTextsTable).where(eq(botTextsTable.id, id)).returning();
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
