import { Router, type IRouter } from "express";
import { eq, sql, and, desc, or, ilike, gte, lte, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  botsTable,
  commissionOverridesTable,
  commissionsTable,
  usersTable,
  botTextsTable,
  walletsTable,
  transactionsTable,
  broadcastsTable,
  externalLinksTable,
  errorLogsTable,
  withdrawalsTable,
  platformSettingsTable,
  botHeartbeatsTable,
  scratchCardsTable,
} from "@workspace/db";
import {
  requireSuperAdmin,
  verifySuperAdminCode,
} from "../lib/super-admin-auth";
import { logAdminAction } from "../lib/audit-log";
import { notifyUser } from "../lib/notify-user";
import { capture } from "../lib/analytics";
import { invalidateCommissionOverride, invalidateFinanceCache, getSkzRates } from "../lib/finance";
import {
  getScratchyConfig,
  saveScratchyConfig,
  scratchyConfigSchema,
  DEFAULT_SCRATCHY_CONFIG,
} from "../lib/scratchy-config";
import { withdrawalAddressesTable, adminAuditLogTable } from "@workspace/db";
// Cryptomus removed (content restrictions). The /auto-payout route below
// is kept as a 410 Gone stub so any cached admin UI / external call gets a
// clear error instead of a server crash.
import crypto from "crypto";

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
  const { name, description, commissionRate, isActive, botUsername, miniAppName } = req.body as {
    name?: string;
    description?: string;
    commissionRate?: string | number;
    isActive?: boolean;
    botUsername?: string;
    miniAppName?: string;
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
  if (typeof botUsername === "string") updates.botUsername = botUsername.trim().replace(/^@/, "") || null;
  if (typeof miniAppName === "string") updates.miniAppName = miniAppName.trim() || null;
  if (typeof (req.body as Record<string, unknown>).webhookUrl === "string")
    updates.webhookUrl = ((req.body as Record<string, unknown>).webhookUrl as string).trim() || null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db.update(botsTable).set(updates).where(eq(botsTable.slug, raw)).returning();
  const { apiKey: _k, webhookSecret: _s, ...safe } = updated;
  await logAdminAction(req, "superadmin", {
    action: "bot.update", targetType: "bot", targetId: raw,
    payload: updates,
  });
  req.log.info({ slug: raw, updates }, "superadmin: bot updated");
  res.json(safe);
});

// ── Bot API-key management ────────────────────────────────────────────────
// Reveal the raw API key for a bot (admin only — never exposed in GET /bots).
router.get("/superadmin/bots/:slug/api-key", requireSuperAdmin, async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [bot] = await db.select({ apiKey: botsTable.apiKey }).from(botsTable).where(eq(botsTable.slug, slug));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  req.log.info({ slug }, "superadmin: api-key revealed");
  res.json({ apiKey: bot.apiKey });
});

// Rotate (regenerate) the API key for a bot and return the new key once.
router.post("/superadmin/bots/:slug/rotate-key", requireSuperAdmin, async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [existing] = await db.select({ id: botsTable.id }).from(botsTable).where(eq(botsTable.slug, slug));
  if (!existing) { res.status(404).json({ error: "Bot not found" }); return; }
  const newKey = crypto.randomBytes(32).toString("hex");
  await db.update(botsTable).set({ apiKey: newKey }).where(eq(botsTable.slug, slug));
  await logAdminAction(req, "superadmin", {
    action: "bot.rotate-key", targetType: "bot", targetId: slug, payload: {},
  });
  req.log.info({ slug }, "superadmin: bot api-key rotated");
  res.json({ apiKey: newKey });
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

  // Drop the cached override lookup for this (user, bot) so the next
  // money-move sees the new rate immediately, not after the 30s TTL.
  await invalidateCommissionOverride(tid, botSlug);

  await logAdminAction(req, "superadmin", {
    action: "commission_override.upsert", targetType: "user", targetId: tid.toString(),
    payload: { botSlug, commissionRate: rate, note: note ?? null },
  });
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
  const deletedRow = result[0];
  if (deletedRow?.telegramId && deletedRow?.botSlug) {
    await invalidateCommissionOverride(deletedRow.telegramId, deletedRow.botSlug);
  }
  await logAdminAction(req, "superadmin", {
    action: "commission_override.delete", targetType: "commission_override", targetId: id,
    payload: { telegramId: deletedRow?.telegramId?.toString?.(), botSlug: deletedRow?.botSlug },
  });
  res.json({ ok: true });
});

// ── Commission Analytics ───────────────────────────────────────────────────
// GET /superadmin/commissions?botSlug=&telegramId=&from=&to=&limit=&offset=
router.get("/superadmin/commissions", requireSuperAdmin, async (req, res): Promise<void> => {
  const { botSlug, telegramId, from, to } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);
  const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;

  const conds: ReturnType<typeof eq>[] = [];
  if (botSlug) conds.push(eq(commissionsTable.botSlug, botSlug));
  if (telegramId && /^\d+$/.test(telegramId)) {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.telegramId, BigInt(telegramId)));
    if (user) conds.push(eq(commissionsTable.userId, user.id));
    else { res.json({ data: [], total: 0, summary: { totalCommission: "0", byBot: [] } }); return; }
  }
  if (from) conds.push(gte(commissionsTable.createdAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conds.push(lte(commissionsTable.createdAt, toDate));
  }

  const where = conds.length ? and(...conds) : undefined;

  const [rows, countRow, summaryRows] = await Promise.all([
    db.select({
      id: commissionsTable.id,
      botSlug: commissionsTable.botSlug,
      userId: commissionsTable.userId,
      telegramId: usersTable.telegramId,
      username: usersTable.username,
      grossAmount: commissionsTable.grossAmount,
      commissionRate: commissionsTable.commissionRate,
      commissionAmount: commissionsTable.commissionAmount,
      netAmount: commissionsTable.netAmount,
      currency: commissionsTable.currency,
      status: commissionsTable.status,
      createdAt: commissionsTable.createdAt,
    }).from(commissionsTable)
      .leftJoin(usersTable, eq(usersTable.id, commissionsTable.userId))
      .where(where)
      .orderBy(desc(commissionsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(commissionsTable).where(where),
    db.select({
      botSlug: commissionsTable.botSlug,
      total: sql<string>`coalesce(sum(${commissionsTable.commissionAmount}),0)::numeric(18,4)`,
      count: sql<number>`count(*)::int`,
    }).from(commissionsTable).where(where).groupBy(commissionsTable.botSlug)
      .orderBy(desc(sql`sum(${commissionsTable.commissionAmount})`)),
  ]);

  const totalCommission = summaryRows.reduce((s, r) => s + parseFloat(r.total), 0);

  res.json({
    data: rows.map(r => ({ ...r, telegramId: r.telegramId?.toString() })),
    total: countRow[0]?.count ?? 0,
    summary: {
      totalCommission: totalCommission.toFixed(4),
      byBot: summaryRows.map(r => ({ botSlug: r.botSlug, total: r.total, count: r.count })),
    },
  });
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
  await logAdminAction(req, "superadmin", {
    action: "bot_text.upsert", targetType: "bot_text", targetId: row.id,
    payload: { botSlug, key, label },
  });
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
  await logAdminAction(req, "superadmin", {
    action: "bot_text.update", targetType: "bot_text", targetId: id,
    payload: { fields: Object.keys(updates).filter((k) => k !== "updatedAt") },
  });
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
  await logAdminAction(req, "superadmin", {
    action: "bot_text.publish", targetType: "bot_text", targetId: id,
    payload: { botSlug: row.botSlug, key: row.key },
  });
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
  await logAdminAction(req, "superadmin", {
    action: "bot_text.publish_all", targetType: "bot", targetId: botSlug,
    payload: { count: rows.length },
  });
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
  await logAdminAction(req, "superadmin", {
    action: "bot_text.delete", targetType: "bot_text", targetId: id,
    payload: { botSlug: result[0]?.botSlug, key: result[0]?.key },
  });
  res.json({ ok: true });
});

// ── Bot-texts convenience: path-based slug endpoints ─────────────────────
// GET  /superadmin/bot-texts/:slug  — all texts for a bot by slug
// PUT  /superadmin/bot-texts/:slug  — bulk-save + publish all texts for a bot

router.get("/superadmin/bot-texts/:slug", requireSuperAdmin, async (req, res): Promise<void> => {
  const botSlug = String(req.params.slug ?? "").trim();
  if (!botSlug) { res.status(400).json({ error: "slug is required" }); return; }
  await ensureDefaultsFor(botSlug);
  const rows = await db
    .select()
    .from(botTextsTable)
    .where(eq(botTextsTable.botSlug, botSlug))
    .orderBy(botTextsTable.id);
  res.json({ data: rows });
});

// Bulk key-value save + publish for a bot slug.
// Body: { entries: [{ key: string; value: string }] }
// Each entry is upserted (key = unique per slug) and immediately published.
router.put("/superadmin/bot-texts/:slug", requireSuperAdmin, async (req, res): Promise<void> => {
  const botSlug = String(req.params.slug ?? "").trim();
  if (!botSlug) { res.status(400).json({ error: "slug is required" }); return; }
  const { entries } = req.body as { entries?: Array<{ key: string; value: string; label?: string }> };
  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: "entries array is required" });
    return;
  }
  const now = new Date();
  const saved: typeof botTextsTable.$inferSelect[] = [];
  for (const entry of entries) {
    if (!entry.key || typeof entry.value !== "string") continue;
    const [row] = await db
      .insert(botTextsTable)
      .values({
        botSlug,
        key: entry.key,
        label: entry.label ?? entry.key,
        draftValue: entry.value,
        publishedValue: entry.value,
        publishedAt: now,
      })
      .onConflictDoUpdate({
        target: [botTextsTable.botSlug, botTextsTable.key],
        set: {
          draftValue: entry.value,
          publishedValue: entry.value,
          publishedAt: now,
          updatedAt: now,
          ...(entry.label ? { label: entry.label } : {}),
        },
      })
      .returning();
    if (row) saved.push(row);
  }
  await logAdminAction(req, "superadmin", {
    action: "bot_text.bulk_save", targetType: "bot_text", targetId: botSlug,
    payload: { count: saved.length },
  });
  res.json({ data: saved, count: saved.length });
});

// ── Users (search, view, block, manual SKZ credit/debit) ─────────────────

router.get("/superadmin/users", requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const search = (req.query.search as string | undefined)?.trim();
  const offset = (page - 1) * limit;

  const conds = [];
  if (search) {
    // Escape ILIKE wildcards so a user typing "%" or "_" can't broaden the match.
    const esc = search.replace(/[\\%_]/g, (c) => `\\${c}`);
    const pat = `%${esc}%`;
    conds.push(
      or(
        ilike(usersTable.username, pat),
        ilike(usersTable.firstName, pat),
        ilike(usersTable.lastName, pat),
        sql`CAST(${usersTable.telegramId} AS TEXT) ILIKE ${pat}`,
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  const [rows, count] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        telegramId: usersTable.telegramId,
        username: usersTable.username,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        isBlocked: usersTable.isBlocked,
        isPremium: usersTable.isPremium,
        createdAt: usersTable.createdAt,
        balanceSkz: walletsTable.balanceSkz,
        totalEarnedSkz: walletsTable.totalEarnedSkz,
      })
      .from(usersTable)
      .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(usersTable).where(where),
  ]);

  res.json({ data: rows, total: Number(count[0]?.c ?? 0), page, limit });
});

router.get("/superadmin/users/:telegramId", requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = String(req.params.telegramId);
  let tid: bigint;
  try { tid = BigInt(raw); } catch { res.status(400).json({ error: "Invalid telegramId" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tid));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  const recentTx = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  res.json({ user, wallet: wallet ?? null, transactions: recentTx });
});

router.patch("/superadmin/users/:telegramId", requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = String(req.params.telegramId);
  let tid: bigint;
  try { tid = BigInt(raw); } catch { res.status(400).json({ error: "Invalid telegramId" }); return; }
  const { isBlocked } = req.body as { isBlocked?: boolean };
  if (typeof isBlocked !== "boolean") { res.status(400).json({ error: "isBlocked is required" }); return; }

  const [updated] = await db
    .update(usersTable)
    .set({ isBlocked })
    .where(eq(usersTable.telegramId, tid))
    .returning();
  if (!updated) {
    await logAdminAction(req, "superadmin", {
      action: isBlocked ? "user.block" : "user.unblock",
      targetType: "user", targetId: tid.toString(),
      success: false, errorMessage: "not_found",
    });
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAdminAction(req, "superadmin", {
    action: isBlocked ? "user.block" : "user.unblock",
    targetType: "user", targetId: tid.toString(),
    payload: { isBlocked },
  });
  req.log.info({ telegramId: tid.toString(), isBlocked }, "superadmin: user block toggled");
  res.json(updated);
});

// Manual SKZ adjustment. `direction`: "credit" adds, "debit" subtracts.
// Wrapped in a DB transaction with FOR UPDATE row lock to prevent races.
// NOTE: totalEarnedSkz tracks gross income only — it is NOT decremented on debit.
async function adjustWalletSkz(
  telegramId: bigint,
  direction: "credit" | "debit",
  amount: number,
  reason: string,
  actor: string,
): Promise<{ user: typeof usersTable.$inferSelect; wallet: typeof walletsTable.$inferSelect; transactionId: number }> {
  return await db.transaction(async (tx) => {
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.telegramId, telegramId));
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    // Lock the wallet row (or its absence) to serialise concurrent adjustments.
    let [wallet] = await tx
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, user.id))
      .for("update");
    if (!wallet) {
      [wallet] = await tx.insert(walletsTable).values({ userId: user.id }).returning();
    }

    const current = parseFloat(wallet.balanceSkz);
    const delta = direction === "credit" ? amount : -amount;
    const next = current + delta;
    if (next < 0) throw Object.assign(new Error("الرصيد سيصبح سالباً — العملية مرفوضة"), { status: 400 });

    const newTotalEarned = direction === "credit"
      ? (parseFloat(wallet.totalEarnedSkz) + amount).toFixed(2)
      : wallet.totalEarnedSkz;

    const [updatedWallet] = await tx
      .update(walletsTable)
      .set({ balanceSkz: next.toFixed(2), totalEarnedSkz: newTotalEarned })
      .where(eq(walletsTable.id, wallet.id))
      .returning();

    const [txRow] = await tx
      .insert(transactionsTable)
      .values({
        userId: user.id,
        type: direction === "credit" ? "admin_credit" : "admin_debit",
        currency: "skz",
        amount: amount.toFixed(2),
        fee: "0",
        status: "completed",
        sourceBot: "superadmin",
        description: `[${actor}] ${reason}`,
      })
      .returning({ id: transactionsTable.id });

    return { user, wallet: updatedWallet, transactionId: txRow.id };
  });
}

router.post("/superadmin/users/:telegramId/credit", requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = String(req.params.telegramId);
  let tid: bigint;
  try { tid = BigInt(raw); } catch { res.status(400).json({ error: "Invalid telegramId" }); return; }
  const { amountSkz, reason } = req.body as { amountSkz?: string | number; reason?: string };
  const amt = typeof amountSkz === "number" ? amountSkz : parseFloat(String(amountSkz));
  if (!Number.isFinite(amt) || amt <= 0) { res.status(400).json({ error: "amountSkz must be > 0" }); return; }
  if (!reason || !reason.trim()) { res.status(400).json({ error: "reason is required" }); return; }

  try {
    const out = await adjustWalletSkz(tid, "credit", amt, reason.trim(), "superadmin");
    await logAdminAction(req, "superadmin", {
      action: "wallet.credit", targetType: "user", targetId: tid.toString(),
      payload: { amountSkz: amt, reason: reason.trim(), transactionId: out.transactionId },
    });
    req.log.info({ telegramId: tid.toString(), amount: amt, txId: out.transactionId }, "superadmin: manual credit");
    res.json({ ok: true, wallet: out.wallet, transactionId: out.transactionId });
  } catch (e) {
    const err = e as { status?: number; message: string };
    await logAdminAction(req, "superadmin", {
      action: "wallet.credit", targetType: "user", targetId: tid.toString(),
      payload: { amountSkz: amt, reason: reason.trim() },
      success: false, errorMessage: err.message,
    });
    res.status(err.status ?? 500).json({ error: (err.status && err.status < 500) ? err.message : "Internal server error" });
  }
});

router.post("/superadmin/users/:telegramId/debit", requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = String(req.params.telegramId);
  let tid: bigint;
  try { tid = BigInt(raw); } catch { res.status(400).json({ error: "Invalid telegramId" }); return; }
  const { amountSkz, reason } = req.body as { amountSkz?: string | number; reason?: string };
  const amt = typeof amountSkz === "number" ? amountSkz : parseFloat(String(amountSkz));
  if (!Number.isFinite(amt) || amt <= 0) { res.status(400).json({ error: "amountSkz must be > 0" }); return; }
  if (!reason || !reason.trim()) { res.status(400).json({ error: "reason is required" }); return; }

  try {
    const out = await adjustWalletSkz(tid, "debit", amt, reason.trim(), "superadmin");
    await logAdminAction(req, "superadmin", {
      action: "wallet.debit", targetType: "user", targetId: tid.toString(),
      payload: { amountSkz: amt, reason: reason.trim(), transactionId: out.transactionId },
    });
    req.log.info({ telegramId: tid.toString(), amount: amt, txId: out.transactionId }, "superadmin: manual debit");
    res.json({ ok: true, wallet: out.wallet, transactionId: out.transactionId });
  } catch (e) {
    const err = e as { status?: number; message: string };
    await logAdminAction(req, "superadmin", {
      action: "wallet.debit", targetType: "user", targetId: tid.toString(),
      payload: { amountSkz: amt, reason: reason.trim() },
      success: false, errorMessage: err.message,
    });
    res.status(err.status ?? 500).json({ error: (err.status && err.status < 500) ? err.message : "Internal server error" });
  }
});

// ── Transactions (paginated, with optional filters & user info) ──────────
router.get("/superadmin/transactions", requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;
  const sourceBot = req.query.sourceBot as string | undefined;
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const telegramId = req.query.telegramId as string | undefined;

  const conds = [];
  if (sourceBot) conds.push(eq(transactionsTable.sourceBot, sourceBot));
  if (type) conds.push(eq(transactionsTable.type, type));
  if (status) conds.push(eq(transactionsTable.status, status));
  if (telegramId) {
    try { conds.push(eq(usersTable.telegramId, BigInt(telegramId))); }
    catch { res.status(400).json({ error: "Invalid telegramId" }); return; }
  }
  const where = conds.length ? and(...conds) : undefined;

  const [rows, count] = await Promise.all([
    db
      .select({
        id: transactionsTable.id,
        userId: transactionsTable.userId,
        type: transactionsTable.type,
        currency: transactionsTable.currency,
        amount: transactionsTable.amount,
        fee: transactionsTable.fee,
        status: transactionsTable.status,
        sourceBot: transactionsTable.sourceBot,
        description: transactionsTable.description,
        createdAt: transactionsTable.createdAt,
        userTelegramId: usersTable.telegramId,
        userFirstName: usersTable.firstName,
        userUsername: usersTable.username,
      })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
      .where(where)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
      .where(where),
  ]);

  res.json({ data: rows, total: Number(count[0]?.c ?? 0), page, limit });
});

// ── Broadcasts ───────────────────────────────────────────────────────────

router.get("/superadmin/broadcasts", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(broadcastsTable)
    .orderBy(desc(broadcastsTable.createdAt))
    .limit(50);
  res.json({ data: rows });
});

router.post("/superadmin/broadcasts", requireSuperAdmin, async (req, res): Promise<void> => {
  const { body, audience, targetValue } = req.body as {
    body?: string;
    audience?: "all" | "bot" | "single";
    targetValue?: string;
  };

  if (!body || !body.trim()) { res.status(400).json({ error: "body is required" }); return; }
  if (audience !== "all" && audience !== "bot" && audience !== "single") {
    res.status(400).json({ error: "audience must be all|bot|single" });
    return;
  }
  if ((audience === "bot" || audience === "single") && !targetValue) {
    res.status(400).json({ error: "targetValue is required for bot/single audience" });
    return;
  }

  const token = process.env.MOTHER_BOT_TOKEN;
  if (!token) { res.status(500).json({ error: "MOTHER_BOT_TOKEN not configured" }); return; }

  // Resolve target telegram IDs.
  let recipients: bigint[] = [];
  try {
    if (audience === "single") {
      recipients = [BigInt(String(targetValue))];
    } else if (audience === "all") {
      const rows = await db
        .select({ tid: usersTable.telegramId })
        .from(usersTable)
        .where(eq(usersTable.isBlocked, false));
      recipients = rows.map((r) => r.tid);
    } else {
      // audience === "bot": users who have any transaction with sourceBot = targetValue
      const rows = await db
        .selectDistinct({ tid: usersTable.telegramId })
        .from(usersTable)
        .innerJoin(transactionsTable, eq(transactionsTable.userId, usersTable.id))
        .where(and(eq(transactionsTable.sourceBot, String(targetValue)), eq(usersTable.isBlocked, false)));
      recipients = rows.map((r) => r.tid);
    }
  } catch (e) {
    res.status(400).json({ error: `فشل تحديد المستلمين: ${(e as Error).message}` });
    return;
  }

  const [row] = await db
    .insert(broadcastsTable)
    .values({
      audience,
      targetValue: targetValue ?? null,
      body: body.trim(),
      status: "pending",
      totalCount: recipients.length,
    })
    .returning();

  await logAdminAction(req, "superadmin", {
    action: "broadcast.create", targetType: "broadcast", targetId: row.id,
    payload: { audience, targetValue: targetValue ?? null, recipients: recipients.length },
  });

  // Dispatch in the background — respond immediately with the job id.
  void dispatchBroadcast(row.id, token, recipients, body.trim()).catch((err) => {
    req.log.error({ err, broadcastId: row.id }, "broadcast dispatch crashed");
  });

  res.json(row);
});

async function dispatchBroadcast(
  broadcastId: number,
  token: string,
  recipients: bigint[],
  body: string,
): Promise<void> {
  await db
    .update(broadcastsTable)
    .set({ status: "sending", startedAt: new Date() })
    .where(eq(broadcastsTable.id, broadcastId));

  let sent = 0;
  let failed = 0;
  // Telegram limit: ~30 messages/sec to distinct users; we pace at 25/sec with
  // a steady 40ms gap between calls. Persist progress every 50 messages so the
  // dashboard can show live progress instead of jumping from 0 → done.
  const perMessageDelayMs = 40;
  for (let i = 0; i < recipients.length; i++) {
    const tid = recipients[i];
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: tid.toString(), text: body, parse_mode: "HTML" }),
      });
      if (resp.ok) sent++; else failed++;
    } catch {
      failed++;
    }
    // Always pace — base on attempt index, not on sent (which won't grow if
    // every recipient errors out).
    if (i < recipients.length - 1) {
      await new Promise((r) => setTimeout(r, perMessageDelayMs));
    }
    if ((i + 1) % 50 === 0) {
      await db
        .update(broadcastsTable)
        .set({ sentCount: sent, failedCount: failed })
        .where(eq(broadcastsTable.id, broadcastId));
    }
  }

  await db
    .update(broadcastsTable)
    .set({
      status: "completed",
      sentCount: sent,
      failedCount: failed,
      completedAt: new Date(),
    })
    .where(eq(broadcastsTable.id, broadcastId));
}

// ── External Links / CDN ────────────────────────────────────────────────

router.get("/superadmin/links", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(externalLinksTable).orderBy(externalLinksTable.category, externalLinksTable.label);
  res.json({ data: rows });
});

router.post("/superadmin/links", requireSuperAdmin, async (req, res): Promise<void> => {
  const { key, label, url, category, isActive, notes } = req.body as {
    key?: string; label?: string; url?: string; category?: string; isActive?: boolean; notes?: string;
  };
  if (!key || !label || !url) {
    res.status(400).json({ error: "key, label, url are required" });
    return;
  }
  try {
    const [row] = await db.insert(externalLinksTable).values({
      key: key.trim(),
      label: label.trim(),
      url: url.trim(),
      category: category ?? "general",
      isActive: isActive ?? true,
      notes: notes ?? null,
    }).returning();
    await logAdminAction(req, "superadmin", {
      action: "link.create", targetType: "link", targetId: row.id,
      payload: { key: row.key, category: row.category },
    });
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: `فشلت الإضافة: ${(e as Error).message}` });
  }
});

router.patch("/superadmin/links/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { label, url, category, isActive, notes } = req.body as {
    label?: string; url?: string; category?: string; isActive?: boolean; notes?: string;
  };
  const updates: Partial<typeof externalLinksTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof label === "string") updates.label = label;
  if (typeof url === "string") updates.url = url;
  if (typeof category === "string") updates.category = category;
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (typeof notes === "string") updates.notes = notes;
  const [row] = await db.update(externalLinksTable).set(updates).where(eq(externalLinksTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logAdminAction(req, "superadmin", {
    action: "link.update", targetType: "link", targetId: id,
    payload: { fields: Object.keys(updates).filter((k) => k !== "updatedAt") },
  });
  res.json(row);
});

router.delete("/superadmin/links/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db.delete(externalLinksTable).where(eq(externalLinksTable.id, id)).returning();
  if (result.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  await logAdminAction(req, "superadmin", {
    action: "link.delete", targetType: "link", targetId: id,
    payload: { key: result[0]?.key },
  });
  res.json({ ok: true });
});

// ── Error Logs ───────────────────────────────────────────────────────────

router.get("/superadmin/error-logs", requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;
  const source = req.query.source as string | undefined;
  const level = req.query.level as string | undefined;
  const resolved = req.query.resolved as string | undefined;

  const conds = [];
  if (source) conds.push(eq(errorLogsTable.source, source));
  if (level) conds.push(eq(errorLogsTable.level, level));
  if (resolved === "true") conds.push(eq(errorLogsTable.resolved, true));
  if (resolved === "false") conds.push(eq(errorLogsTable.resolved, false));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, count] = await Promise.all([
    db.select().from(errorLogsTable).where(where).orderBy(desc(errorLogsTable.createdAt)).limit(limit).offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(errorLogsTable).where(where),
  ]);
  res.json({ data: rows, total: Number(count[0]?.c ?? 0), page, limit });
});

router.post("/superadmin/error-logs/:id/resolve", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(errorLogsTable).set({ resolved: true }).where(eq(errorLogsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/superadmin/error-logs/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(errorLogsTable).where(eq(errorLogsTable.id, id));
  res.json({ ok: true });
});

// ── Withdrawals (super-admin view + approve/reject) ──────────────────────
// These wrap the existing admin-scoped routes but authenticate via the
// superadmin bearer so the panel doesn't need a second token.

router.get("/superadmin/withdrawals", requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const currency = req.query.currency as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const tgRaw = (req.query.telegramId as string | undefined)?.trim();

  const conds = [];
  if (status) conds.push(eq(withdrawalsTable.status, status));
  if (currency) conds.push(eq(withdrawalsTable.currency, currency));
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) conds.push(gte(withdrawalsTable.createdAt, d));
  }
  if (to) {
    const d = new Date(to);
    // Inclusive end-of-day so a date-only `to` covers the whole day.
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conds.push(lte(withdrawalsTable.createdAt, d));
    }
  }
  if (tgRaw) {
    try { conds.push(eq(usersTable.telegramId, BigInt(tgRaw))); } catch { /* ignore non-numeric */ }
  }
  const where = conds.length ? and(...conds) : undefined;

  const [rows, count] = await Promise.all([
    db
      .select({
        id: withdrawalsTable.id,
        userId: withdrawalsTable.userId,
        currency: withdrawalsTable.currency,
        amount: withdrawalsTable.amount,
        fee: withdrawalsTable.fee,
        netAmount: withdrawalsTable.netAmount,
        method: withdrawalsTable.method,
        address: withdrawalsTable.address,
        txHash: withdrawalsTable.txHash,
        status: withdrawalsTable.status,
        rejectedReason: withdrawalsTable.rejectedReason,
        createdAt: withdrawalsTable.createdAt,
        processedAt: withdrawalsTable.processedAt,
        userTelegramId: usersTable.telegramId,
        userFirstName: usersTable.firstName,
        userUsername: usersTable.username,
      })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(usersTable.id, withdrawalsTable.userId))
      .where(where)
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(usersTable.id, withdrawalsTable.userId))
      .where(where),
  ]);
  res.json({ data: rows, total: Number(count[0]?.c ?? 0), page, limit });
});

/** Thrown inside a DB transaction to signal insufficient balance at approval
 *  time.  The throw rolls back the status update; the outer catch returns 422
 *  (not 500) and notifies the affected user.  */
class InsufficientFundsAtApprovalError extends Error {
  readonly code = "insufficient_funds_at_approval" as const;
  constructor() {
    super("Insufficient wallet balance at approval time");
    this.name = "InsufficientFundsAtApprovalError";
  }
}

router.post("/superadmin/withdrawals/:id/approve", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { txHash } = req.body as { txHash?: string };

  try {
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(withdrawalsTable)
        .set({ status: "approved", txHash: txHash ?? null, processedAt: new Date() })
        .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
        .returning();
      if (!updated) return { error: "Only pending withdrawals can be approved", row: null };

      const amt = parseFloat(updated.amount);

      // Explicit per-currency update for compile-time safety: no dynamic
      // computed keys, no `as` casts. Drizzle types the .set() shape.
      let walletUpdated: typeof walletsTable.$inferSelect | undefined;
      if (updated.currency === "stars") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceStars:   sql`${walletsTable.balanceStars}   - ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceStars} >= ${amt}`,
        )).returning();
      } else if (updated.currency === "usdt") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceUsdt:    sql`${walletsTable.balanceUsdt}    - ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceUsdt} >= ${amt}`,
        )).returning();
      } else if (updated.currency === "ton") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceTon:     sql`${walletsTable.balanceTon}     - ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceTon} >= ${amt}`,
        )).returning();
      } else if (updated.currency === "skz") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceSkz:        sql`${walletsTable.balanceSkz}        - ${amt}`,
          totalWithdrawnSkz: sql`${walletsTable.totalWithdrawnSkz} + ${amt}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceSkz} >= ${amt}`,
        )).returning();
      } else {
        throw new Error(`Unsupported currency: ${updated.currency}`);
      }

      if (!walletUpdated) throw new InsufficientFundsAtApprovalError();

      // Audit trail: record the withdrawal deduction in the transactions ledger
      // so the book of record is complete without querying the withdrawals table.
      await tx.insert(transactionsTable).values({
        userId:      updated.userId,
        type:        "withdrawal",
        currency:    updated.currency,
        amount:      String((parseFloat(updated.amount) * -1).toFixed(2)),
        status:      "completed",
        sourceBot:   updated.sourceBot ?? "superadmin",
        referenceId: `withdrawal_${updated.id}`,
        description: `سحب #${updated.id} عبر ${updated.method}`,
        metadata:    JSON.stringify({
          withdrawalId: updated.id,
          method:       updated.method,
          address:      updated.address,
          txHash:       txHash ?? null,
          approvedBy:   "superadmin",
        }),
      });

      return { error: null, row: updated };
    });

    if (result.error || !result.row) {
      await logAdminAction(req, "superadmin", {
        action: "withdrawal.approve", targetType: "withdrawal", targetId: id,
        payload: { txHash }, success: false, errorMessage: result.error ?? "Approval failed",
      });
      res.status(400).json({ error: result.error ?? "Approval failed" });
      return;
    }
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.approve", targetType: "withdrawal", targetId: id,
      payload: { amount: result.row.amount, currency: result.row.currency, method: result.row.method, txHash },
    });
    // Detached side-effects: response is already going out, but a DB
    // hiccup inside this IIFE must NOT become an unhandled rejection
    // (Node 24 default kills the process on those). Inner try/catch
    // keeps the failure isolated and logged.
    void (async () => {
      try {
        const [u] = await db.select({ tid: usersTable.telegramId })
          .from(usersTable).where(eq(usersTable.id, result.row.userId));
        if (u) {
          await notifyUser(
            String(u.tid),
            `✅ تمت الموافقة على طلب السحب #${id}\nالمبلغ: ${result.row.amount} ${result.row.currency.toUpperCase()}${txHash ? `\nهاش العملية: ${txHash}` : ""}`,
          );
          capture("withdraw_approved", String(u.tid), {
            withdrawal_id: id,
            amount: result.row.amount,
            currency: result.row.currency,
            method: result.row.method,
          });
        }
      } catch (err) {
        req.log.warn({ err, withdrawalId: id }, "post-approve notify/capture failed");
      }
    })();
    res.json(result.row);
  } catch (err) {
    if (err instanceof InsufficientFundsAtApprovalError) {
      await logAdminAction(req, "superadmin", {
        action: "withdrawal.approve", targetType: "withdrawal", targetId: id,
        payload: { txHash }, success: false, errorMessage: err.code,
      });
      req.log.warn({ id }, "withdrawal approval: insufficient funds — withdrawal stays pending");
      // Notify the user so they know to top up before the admin retries.
      void (async () => {
        try {
          const [wd] = await db
            .select({ userId: withdrawalsTable.userId, amount: withdrawalsTable.amount, currency: withdrawalsTable.currency })
            .from(withdrawalsTable).where(eq(withdrawalsTable.id, id)).limit(1);
          if (wd) {
            const [u] = await db
              .select({ tid: usersTable.telegramId })
              .from(usersTable).where(eq(usersTable.id, wd.userId)).limit(1);
            if (u) {
              await notifyUser(
                String(u.tid),
                `⚠️ تعذّر تنفيذ طلب السحب #${id}\n` +
                `المبلغ: ${wd.amount} ${wd.currency.toUpperCase()}\n` +
                `السبب: رصيدك الحالي أقل من مبلغ الطلب.\n` +
                `يُرجى شحن رصيدك ثم تواصل مع الدعم لإعادة المحاولة.`,
              );
            }
          }
        } catch (notifyErr) {
          req.log.warn({ notifyErr, id }, "post-insufficientfunds notify failed");
        }
      })();
      res.status(422).json({
        error: err.code,
        message: "رصيد المستخدم أقل من مبلغ السحب عند الموافقة — تم إخطاره. يمكنك إعادة المحاولة بعد شحن رصيده أو رفض الطلب.",
      });
      return;
    }
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.approve", targetType: "withdrawal", targetId: id,
      payload: { txHash }, success: false,
      errorMessage: err instanceof Error ? err.message : "Approval failed",
    });
    req.log.error({ err, id }, "superadmin withdrawal approve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /superadmin/withdrawals/:id/auto-payout — DISABLED
 *
 * Cryptomus auto-payouts were removed due to platform content restrictions.
 * All withdrawals now go through the manual approve/reject flow with an
 * admin-entered on-chain txHash. This stub returns 410 Gone so any cached
 * admin UI or external caller gets a clear, recoverable error.
 */
router.post("/superadmin/withdrawals/:id/auto-payout", requireSuperAdmin, async (_req, res): Promise<void> => {
  res.status(410).json({
    error: "Auto-payout disabled. Use manual approve with an on-chain txHash.",
  });
});

// Original Cryptomus auto-payout implementation removed — see git history
// if it ever needs to be revived. The block below was the route body +
// refundAutoPayout() helper.

router.post("/superadmin/withdrawals/:id/reject", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { reason } = req.body as { reason?: string };

  // Allow rejecting both `pending` (normal reject) and `processing`
  // (force-reject when a transfer failed on-chain). Balance is only
  // debited on `approved`, so no refund is needed in either case.
  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "rejected", rejectedReason: reason ?? null, processedAt: new Date() })
    .where(and(eq(withdrawalsTable.id, id), inArray(withdrawalsTable.status, ["pending", "processing"])))
    .returning();
  if (!updated) {
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.reject", targetType: "withdrawal", targetId: id,
      payload: { reason }, success: false, errorMessage: "not_pending_or_processing",
    });
    res.status(400).json({ error: "Only pending or processing withdrawals can be rejected" });
    return;
  }
  const wasForceReject = updated.status === "rejected" && (req.body as { force?: boolean }).force !== false;
  void wasForceReject; // used for future audit distinction if needed
  await logAdminAction(req, "superadmin", {
    action: "withdrawal.reject", targetType: "withdrawal", targetId: id,
    payload: { reason, amount: updated.amount, currency: updated.currency, forceReject: updated.status === "rejected" },
  });
  // See approve handler for rationale on the inner try/catch.
  void (async () => {
    try {
      const [u] = await db.select({ tid: usersTable.telegramId })
        .from(usersTable).where(eq(usersTable.id, updated.userId));
      if (u) {
        await notifyUser(
          String(u.tid),
          `❌ تم رفض طلب السحب #${id}\nالمبلغ: ${updated.amount} ${updated.currency.toUpperCase()}${reason ? `\nالسبب: ${reason}` : ""}\nالرصيد لم يُخصم من محفظتك.`,
        );
        capture("withdraw_rejected", String(u.tid), {
          withdrawal_id: id,
          amount: updated.amount,
          currency: updated.currency,
          method: updated.method,
          reason: reason ?? null,
        });
      }
    } catch (err) {
      req.log.warn({ err, withdrawalId: id }, "post-reject notify/capture failed");
    }
  })();
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────
// Withdrawal address whitelist (per-user) — admin tooling
// ─────────────────────────────────────────────────────────────────────────

/**
 * List a user's known withdrawal destinations. Used by support to see
 * which addresses have already passed the 24-hour cooldown and which are
 * still pending. `userId` is the internal id (not telegramId).
 */
router.get("/superadmin/users/:telegramId/withdrawal-addresses", requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = String(req.params.telegramId);
  let tid: bigint;
  try { tid = BigInt(raw); } catch { res.status(400).json({ error: "Invalid telegramId" }); return; }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.telegramId, tid));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db.select().from(withdrawalAddressesTable)
    .where(eq(withdrawalAddressesTable.userId, user.id))
    .orderBy(desc(withdrawalAddressesTable.addedAt));
  res.json({ data: rows });
});

/**
 * Revoke a whitelisted address. Sets revokedAt — the next withdrawal
 * attempt to it is refused (`address_revoked`). Soft-delete so we keep
 * the history for forensics.
 */
router.delete("/superadmin/withdrawal-addresses/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db.update(withdrawalAddressesTable)
    .set({ revokedAt: new Date() })
    .where(eq(withdrawalAddressesTable.id, id))
    .returning();
  if (!updated) {
    await logAdminAction(req, "superadmin", {
      action: "withdrawal_address.revoke", targetType: "withdrawal_address", targetId: id,
      success: false, errorMessage: "not_found",
    });
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logAdminAction(req, "superadmin", {
    action: "withdrawal_address.revoke", targetType: "withdrawal_address", targetId: id,
    payload: { network: updated.network, userId: updated.userId },
  });
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────
// Admin audit log — read-only view of who did what
// ─────────────────────────────────────────────────────────────────────────
router.get("/superadmin/audit-log", requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;
  const action = req.query.action as string | undefined;
  const targetType = req.query.targetType as string | undefined;

  const conds = [];
  if (action) conds.push(eq(adminAuditLogTable.action, action));
  if (targetType) conds.push(eq(adminAuditLogTable.targetType, targetType));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, count] = await Promise.all([
    db.select().from(adminAuditLogTable).where(where)
      .orderBy(desc(adminAuditLogTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(adminAuditLogTable).where(where),
  ]);
  res.json({ data: rows, total: Number(count[0]?.c ?? 0), page, limit });
});

// ── Platform stats (lightweight overview) ────────────────────────────────
router.get("/superadmin/overview", requireSuperAdmin, async (_req, res): Promise<void> => {
  // Single bundled query set so the dashboard renders all charts from one
  // HTTP round-trip. All series are bounded (30 days / top-N) so payload
  // size stays trivially small even at scale.
  const [
    usersCount,
    botsCount,
    overridesCount,
    revenueByDay,
    withdrawalsByStatus,
    topBots,
    totals,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(usersTable),
    db.select({ c: sql<number>`count(*)::int` }).from(botsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(commissionOverridesTable),
    // Last 30 days of commission revenue (settled SKZ commissions only).
    db.execute(sql`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        sum(commission_amount)::numeric(18,2) AS revenue
      FROM commissions
      WHERE created_at >= now() - interval '30 days'
        AND status = 'settled'
      GROUP BY 1
      ORDER BY 1
    `),
    // Donut of current withdrawal funnel.
    db.execute(sql`
      SELECT status, count(*)::int AS count
      FROM withdrawals
      GROUP BY status
    `),
    // Top 7 bots by total commission revenue (lifetime).
    db.execute(sql`
      SELECT bot_slug AS slug,
             sum(commission_amount)::numeric(18,2) AS revenue,
             count(*)::int AS transactions
      FROM commissions
      WHERE status = 'settled'
      GROUP BY bot_slug
      ORDER BY revenue DESC NULLS LAST
      LIMIT 7
    `),
    // Coarse lifetime totals for the top stat cards.
    db.execute(sql`
      SELECT
        (SELECT coalesce(sum(commission_amount),0)::numeric(18,2) FROM commissions WHERE status = 'settled') AS total_revenue,
        (SELECT coalesce(sum(amount),0)::numeric(18,2)            FROM withdrawals WHERE status = 'approved') AS total_withdrawn,
        (SELECT count(*)::int FROM withdrawals WHERE status IN ('pending','processing')) AS pending_withdrawals
    `),
  ]);

  const totalsRow = (totals.rows?.[0] ?? {}) as Record<string, unknown>;

  res.json({
    users: Number(usersCount[0]?.c ?? 0),
    bots: Number(botsCount[0]?.c ?? 0),
    overrides: Number(overridesCount[0]?.c ?? 0),
    totalRevenue: String(totalsRow.total_revenue ?? "0.00"),
    totalWithdrawn: String(totalsRow.total_withdrawn ?? "0.00"),
    pendingWithdrawals: Number(totalsRow.pending_withdrawals ?? 0),
    revenueByDay: (revenueByDay.rows as Array<{ day: string; revenue: string }>).map((r) => ({
      day: r.day,
      revenue: Number(r.revenue),
    })),
    withdrawalsByStatus: (withdrawalsByStatus.rows as Array<{ status: string; count: number }>).map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
    topBots: (topBots.rows as Array<{ slug: string; revenue: string; transactions: number }>).map((r) => ({
      slug: r.slug,
      revenue: Number(r.revenue),
      transactions: Number(r.transactions),
    })),
  });
});

// ── SCRATCHY economy config ────────────────────────────────────────────────
// Full control over ticket prices, prize tables, win weights and the jackpot
// formula for SOUQRATES SCRATCHY. Read live by /api/scratchy/play — changes
// apply with no restart (cache is invalidated on save).

// GET /superadmin/scratchy-config — current economy + canonical defaults.
router.get("/superadmin/scratchy-config", requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const config = await getScratchyConfig();
    res.json({ config, defaults: DEFAULT_SCRATCHY_CONFIG });
  } catch (err) {
    req.log.error({ err }, "superadmin: get scratchy-config failed");
    res.status(500).json({ error: "Failed to load scratchy config" });
  }
});

// PUT /superadmin/scratchy-config — validate + persist the full economy.
router.put("/superadmin/scratchy-config", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = scratchyConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "إعدادات غير صالحة",
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  try {
    await saveScratchyConfig(parsed.data);
    await logAdminAction(req, "superadmin", {
      action: "scratchy.config.update",
      targetType: "platform_settings",
      targetId: "scratchy_config",
      payload: {
        tierCount: parsed.data.tiers.length,
        jackpotBase: parsed.data.jackpotBase,
        jackpotMultiplier: parsed.data.jackpotMultiplier,
      },
    });
    req.log.info(
      { tiers: parsed.data.tiers.map((t) => ({ id: t.id, cost: t.cost })) },
      "superadmin: scratchy config updated",
    );
    res.json({ config: parsed.data });
  } catch (err) {
    req.log.error({ err }, "superadmin: save scratchy-config failed");
    res.status(500).json({ error: "Failed to save scratchy config" });
  }
});

// ── Referral rates (L1/L2/L3) ────────────────────────────────────────────
// These are the CANONICAL keys read by finance.getReferralRates(). The older
// /settings page wrote referral_bonus_percent for L1, which getReferralRates
// never reads — so L1 edits there had no effect. This editor writes the keys
// the money flow actually uses, and invalidates the finance cache so changes
// apply on the next credit with no restart.
const REFERRAL_KEYS = ["referral_l1_percent", "referral_l2_percent", "referral_l3_percent"] as const;
const REFERRAL_DEFAULTS: Record<string, string> = {
  referral_l1_percent: "5",
  referral_l2_percent: "2",
  referral_l3_percent: "1",
};

router.get("/superadmin/referral-rates", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, [...REFERRAL_KEYS]));
  const map: Record<string, string> = { ...REFERRAL_DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  res.json({
    l1Percent: map["referral_l1_percent"],
    l2Percent: map["referral_l2_percent"],
    l3Percent: map["referral_l3_percent"],
  });
});

router.put("/superadmin/referral-rates", requireSuperAdmin, async (req, res): Promise<void> => {
  const body = req.body as { l1Percent?: unknown; l2Percent?: unknown; l3Percent?: unknown };
  const fieldMap: Array<[keyof typeof body, string]> = [
    ["l1Percent", "referral_l1_percent"],
    ["l2Percent", "referral_l2_percent"],
    ["l3Percent", "referral_l3_percent"],
  ];

  const updates: Array<[string, string]> = [];
  for (const [field, key] of fieldMap) {
    const raw = body[field];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      res.status(400).json({ error: "كل نسبة يجب أن تكون بين 0 و 100" });
      return;
    }
    updates.push([key, String(n)]);
  }
  if (updates.length === 0) {
    res.status(400).json({ error: "لا توجد حقول صالحة للتحديث" });
    return;
  }

  await Promise.all(
    updates.map(([key, value]) =>
      db
        .insert(platformSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } }),
    ),
  );
  await invalidateFinanceCache();
  await logAdminAction(req, "superadmin", {
    action: "referral_rates.update",
    targetType: "platform_settings",
    payload: Object.fromEntries(updates),
  });

  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, [...REFERRAL_KEYS]));
  const map: Record<string, string> = { ...REFERRAL_DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  res.json({
    l1Percent: map["referral_l1_percent"],
    l2Percent: map["referral_l2_percent"],
    l3Percent: map["referral_l3_percent"],
  });
});

// ── Daily financial report ───────────────────────────────────────────────
// Bounded daily time-series for the reports page. Range defaults to the last
// 30 days and is hard-capped at 180 days so the payload + query stay cheap.
router.get("/superadmin/reports/daily", requireSuperAdmin, async (req, res): Promise<void> => {
  const toRaw = req.query.to ? new Date(String(req.query.to)) : new Date();
  const fromRaw = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 29 * 86400_000);
  const to = isNaN(toRaw.getTime()) ? new Date() : toRaw;
  let from = isNaN(fromRaw.getTime()) ? new Date(Date.now() - 29 * 86400_000) : fromRaw;
  // Clamp window to 180 days.
  const maxSpanMs = 180 * 86400_000;
  if (to.getTime() - from.getTime() > maxSpanMs) from = new Date(to.getTime() - maxSpanMs);
  // Inclusive end-of-day.
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const fromIso = from.toISOString();
  const toIso = toEnd.toISOString();

  // Deposits and withdrawals are multi-currency (stars/ton/usdt/skz). Summing
  // raw amounts would mix units, so normalize every row to its SKZ-equivalent
  // using the current exchange rates before aggregating. Commission revenue is
  // already denominated in SKZ. Rates are "current" (not historical), which is
  // an acceptable approximation for a trend report — and far more correct than
  // adding heterogeneous units together.
  const rates = await getSkzRates();
  const skzEquiv = (col: ReturnType<typeof sql>) => sql`
    ${col} * (CASE currency
      WHEN 'skz'   THEN 1
      WHEN 'usdt'  THEN ${rates.perUsdt}
      WHEN 'star'  THEN ${rates.perStar}
      WHEN 'stars' THEN ${rates.perStar}
      WHEN 'ton'   THEN ${rates.perTon}
      ELSE 0
    END)`;

  const [revenue, deposits, withdrawalsAgg, newUsers] = await Promise.all([
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             sum(commission_amount)::numeric(18,2) AS v
      FROM commissions
      WHERE status = 'settled' AND created_at BETWEEN ${fromIso} AND ${toIso}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             sum(${skzEquiv(sql`amount`)})::numeric(18,2) AS v
      FROM transactions
      WHERE type = 'deposit' AND status = 'completed'
            AND created_at BETWEEN ${fromIso} AND ${toIso}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             sum(${skzEquiv(sql`amount`)})::numeric(18,2) AS v
      FROM withdrawals
      WHERE status = 'approved' AND created_at BETWEEN ${fromIso} AND ${toIso}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             count(*)::int AS v
      FROM users
      WHERE created_at BETWEEN ${fromIso} AND ${toIso}
      GROUP BY 1 ORDER BY 1
    `),
  ]);

  // Densify: one row per day in range so charts have no gaps.
  const dayMap = new Map<string, { day: string; revenue: number; deposits: number; withdrawals: number; newUsers: number }>();
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(toEnd);
  while (cursor <= lastDay) {
    const key = cursor.toISOString().slice(0, 10);
    dayMap.set(key, { day: key, revenue: 0, deposits: 0, withdrawals: 0, newUsers: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const apply = (rows: Array<Record<string, unknown>>, field: "revenue" | "deposits" | "withdrawals" | "newUsers") => {
    for (const r of rows) {
      const k = String(r.day);
      const row = dayMap.get(k);
      if (row) row[field] = Number(r.v) || 0;
    }
  };
  apply(revenue.rows as Array<Record<string, unknown>>, "revenue");
  apply(deposits.rows as Array<Record<string, unknown>>, "deposits");
  apply(withdrawalsAgg.rows as Array<Record<string, unknown>>, "withdrawals");
  apply(newUsers.rows as Array<Record<string, unknown>>, "newUsers");

  const series = Array.from(dayMap.values());
  res.json({
    from: from.toISOString().slice(0, 10),
    to: toEnd.toISOString().slice(0, 10),
    series,
    totals: {
      revenue: series.reduce((s, r) => s + r.revenue, 0),
      deposits: series.reduce((s, r) => s + r.deposits, 0),
      withdrawals: series.reduce((s, r) => s + r.withdrawals, 0),
      newUsers: series.reduce((s, r) => s + r.newUsers, 0),
    },
  });
});

// ── Bulk withdrawal actions ──────────────────────────────────────────────
// POST /superadmin/withdrawals/bulk-approve
// Approves multiple pending withdrawals in one call. Each withdrawal is
// processed in its own DB transaction (no shared lock). txHash is omitted
// (it is optional in the single-approve route too). Results are returned
// per-item so the UI can report partial success.
// Cap at 50 IDs to bound the sequential processing window.
router.post("/superadmin/withdrawals/bulk-approve", requireSuperAdmin, async (req, res): Promise<void> => {
  const body = req.body as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
    : [];
  if (ids.length === 0) { res.status(400).json({ error: "لا توجد طلبات محددة" }); return; }
  if (ids.length > 50) { res.status(400).json({ error: "حد أقصى 50 طلب في المرة الواحدة للقبول الجماعي" }); return; }

  const results: { id: number; ok: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(withdrawalsTable)
          .set({ status: "approved", txHash: null, processedAt: new Date() })
          .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
          .returning();
        if (!updated) throw new Error("ليس في حالة انتظار");

        const amt = parseFloat(updated.amount);
        let walletUpdated: typeof walletsTable.$inferSelect | undefined;
        if (updated.currency === "stars") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceStars:   sql`${walletsTable.balanceStars}   - ${amt}`,
            totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceStars} >= ${amt}`)).returning();
        } else if (updated.currency === "usdt") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceUsdt:    sql`${walletsTable.balanceUsdt}    - ${amt}`,
            totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceUsdt} >= ${amt}`)).returning();
        } else if (updated.currency === "ton") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceTon:     sql`${walletsTable.balanceTon}     - ${amt}`,
            totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceTon} >= ${amt}`)).returning();
        } else if (updated.currency === "skz") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceSkz:        sql`${walletsTable.balanceSkz}        - ${amt}`,
            totalWithdrawnSkz: sql`${walletsTable.totalWithdrawnSkz} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceSkz} >= ${amt}`)).returning();
        } else {
          throw new Error(`عملة غير مدعومة: ${updated.currency}`);
        }
        if (!walletUpdated) throw new Error("رصيد غير كافٍ");

        await tx.insert(transactionsTable).values({
          userId:      updated.userId,
          type:        "withdrawal",
          currency:    updated.currency,
          amount:      String((parseFloat(updated.amount) * -1).toFixed(2)),
          status:      "completed",
          sourceBot:   updated.sourceBot ?? "superadmin",
          referenceId: `withdrawal_${updated.id}`,
          description: `سحب #${updated.id} عبر ${updated.method}`,
          metadata:    JSON.stringify({
            withdrawalId: updated.id,
            method: updated.method,
            address: updated.address,
            txHash: null,
            approvedBy: "superadmin-bulk",
          }),
        });
      });
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : "فشل" });
    }
  }

  const approved = results.filter((r) => r.ok).length;
  const failed   = results.filter((r) => !r.ok).length;

  await logAdminAction(req, "superadmin", {
    action: "withdrawal.bulk_approve", targetType: "withdrawal", targetId: 0,
    payload: { ids, approved, failed }, success: approved > 0,
  });

  res.json({
    approved,
    failed,
    errors: results.filter((r) => !r.ok).map((r) => ({ id: r.id, error: r.error })),
  });
});

router.post("/superadmin/withdrawals/bulk-reject", requireSuperAdmin, async (req, res): Promise<void> => {
  const body = req.body as { ids?: unknown; reason?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
    : [];
  const reason = typeof body.reason === "string" ? body.reason : null;
  if (ids.length === 0) { res.status(400).json({ error: "لا توجد طلبات محددة" }); return; }
  if (ids.length > 200) { res.status(400).json({ error: "حد أقصى 200 طلب في المرة الواحدة" }); return; }

  const updated = await db
    .update(withdrawalsTable)
    .set({ status: "rejected", rejectedReason: reason, processedAt: new Date() })
    .where(and(inArray(withdrawalsTable.id, ids), eq(withdrawalsTable.status, "pending")))
    .returning({ id: withdrawalsTable.id, userId: withdrawalsTable.userId, amount: withdrawalsTable.amount, currency: withdrawalsTable.currency });

  await logAdminAction(req, "superadmin", {
    action: "withdrawal.bulk_reject",
    targetType: "withdrawal",
    payload: { requested: ids.length, rejected: updated.length, reason },
  });

  // Detached notify per affected user — isolated so a notify failure can't
  // turn into an unhandled rejection.
  void (async () => {
    for (const w of updated) {
      try {
        const [u] = await db.select({ tid: usersTable.telegramId }).from(usersTable).where(eq(usersTable.id, w.userId));
        if (u) {
          await notifyUser(
            String(u.tid),
            `❌ تم رفض طلب السحب #${w.id}\nالمبلغ: ${w.amount} ${w.currency.toUpperCase()}${reason ? `\nالسبب: ${reason}` : ""}\nالرصيد لم يُخصم من محفظتك.`,
          );
        }
      } catch (err) {
        req.log.warn({ err, withdrawalId: w.id }, "bulk-reject notify failed");
      }
    }
  })();

  res.json({ rejected: updated.length, ids: updated.map((u) => u.id) });
});

// ── Approve ALL pending withdrawals (global, not page-limited) ───────────
// Fetches every pending withdrawal and processes them sequentially.
// The per-item DB transaction is identical to bulk-approve. Returns a
// summary {approved, failed, total} plus per-item errors.
router.post("/superadmin/withdrawals/approve-all-pending", requireSuperAdmin, async (req, res): Promise<void> => {
  const pending = await db
    .select({ id: withdrawalsTable.id })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"))
    .limit(500); // safety ceiling — practically there won't be >500 at once

  if (pending.length === 0) {
    res.json({ approved: 0, failed: 0, total: 0, errors: [] });
    return;
  }

  const results: { id: number; ok: boolean; error?: string }[] = [];

  for (const { id } of pending) {
    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(withdrawalsTable)
          .set({ status: "approved", txHash: null, processedAt: new Date() })
          .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
          .returning();
        if (!updated) throw new Error("ليس في حالة انتظار");

        const amt = parseFloat(updated.amount);
        let walletUpdated: typeof walletsTable.$inferSelect | undefined;
        if (updated.currency === "stars") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceStars:   sql`${walletsTable.balanceStars}   - ${amt}`,
            totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceStars} >= ${amt}`)).returning();
        } else if (updated.currency === "usdt") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceUsdt:    sql`${walletsTable.balanceUsdt}    - ${amt}`,
            totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceUsdt} >= ${amt}`)).returning();
        } else if (updated.currency === "ton") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceTon:     sql`${walletsTable.balanceTon}     - ${amt}`,
            totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceTon} >= ${amt}`)).returning();
        } else if (updated.currency === "skz") {
          [walletUpdated] = await tx.update(walletsTable).set({
            balanceSkz:        sql`${walletsTable.balanceSkz}        - ${amt}`,
            totalWithdrawnSkz: sql`${walletsTable.totalWithdrawnSkz} + ${amt}`,
          }).where(and(eq(walletsTable.userId, updated.userId), sql`${walletsTable.balanceSkz} >= ${amt}`)).returning();
        } else {
          throw new Error(`عملة غير مدعومة: ${updated.currency}`);
        }
        if (!walletUpdated) throw new Error("رصيد غير كافٍ");

        await tx.insert(transactionsTable).values({
          userId:      updated.userId,
          type:        "withdrawal",
          currency:    updated.currency,
          amount:      String((parseFloat(updated.amount) * -1).toFixed(2)),
          status:      "completed",
          sourceBot:   updated.sourceBot ?? "superadmin",
          referenceId: `withdrawal_${updated.id}`,
          description: `سحب #${updated.id} عبر ${updated.method}`,
          metadata: JSON.stringify({
            withdrawalId: updated.id,
            method: updated.method,
            address: updated.address,
            txHash: null,
            approvedBy: "superadmin-approve-all",
          }),
        });
      });
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : "فشل" });
    }
  }

  const approved = results.filter((r) => r.ok).length;
  const failed   = results.filter((r) => !r.ok).length;

  await logAdminAction(req, "superadmin", {
    action: "withdrawal.approve_all_pending", targetType: "withdrawal", targetId: 0,
    payload: { total: pending.length, approved, failed }, success: approved > 0,
  });

  res.json({
    total: pending.length,
    approved,
    failed,
    errors: results.filter((r) => !r.ok).map((r) => ({ id: r.id, error: r.error })),
  });
});

// ── Scratch Cards catalogue (CRUD) ───────────────────────────────────────
// Admins manage the full catalogue of scratch-and-win card types here.
// Each row has: slug, name, isActive, buyPriceSKZ, winRate, maxPrizeSKZ, jackpotValueSKZ.

router.get("/superadmin/scratch-cards", requireSuperAdmin, async (_req, res): Promise<void> => {
  const cards = await db
    .select()
    .from(scratchCardsTable)
    .orderBy(scratchCardsTable.displayOrder, scratchCardsTable.id);
  res.json({ data: cards });
});

router.post("/superadmin/scratch-cards", requireSuperAdmin, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const slug = String(b.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  const name = String(b.name ?? "").trim();
  if (!slug || !name) { res.status(400).json({ error: "slug and name are required" }); return; }

  const buyPrice = parseFloat(String(b.buyPriceSKZ ?? "10"));
  const winRate  = parseFloat(String(b.winRate ?? "0.3"));
  const maxPrize = parseFloat(String(b.maxPrizeSKZ ?? "100"));
  const jackpot  = parseFloat(String(b.jackpotValueSKZ ?? "1000"));
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) { res.status(400).json({ error: "buyPriceSKZ must be > 0" }); return; }
  if (!Number.isFinite(winRate) || winRate < 0 || winRate > 1) { res.status(400).json({ error: "winRate must be 0–1" }); return; }

  const [card] = await db.insert(scratchCardsTable).values({
    slug, name,
    description: typeof b.description === "string" ? b.description : null,
    isActive: b.isActive !== false,
    buyPriceSKZ: buyPrice.toFixed(6),
    winRate: winRate.toFixed(4),
    maxPrizeSKZ: maxPrize.toFixed(6),
    jackpotValueSKZ: jackpot.toFixed(6),
    displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : 0,
  }).returning();
  await logAdminAction(req, "superadmin", { action: "scratch_card.create", targetType: "scratch_card", targetId: card.id, payload: { slug } });
  res.status(201).json(card);
});

router.patch("/superadmin/scratch-cards/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const b = req.body as Record<string, unknown>;
  const updates: Partial<typeof scratchCardsTable.$inferInsert> = { updatedAt: new Date() };

  if (typeof b.name === "string" && b.name.trim()) updates.name = b.name.trim();
  if (typeof b.description === "string") updates.description = b.description.trim() || null;
  if (typeof b.isActive === "boolean") updates.isActive = b.isActive;
  if (b.displayOrder !== undefined) updates.displayOrder = Number(b.displayOrder);

  for (const [field, col] of [
    ["buyPriceSKZ", "buyPriceSKZ"] as const,
    ["maxPrizeSKZ", "maxPrizeSKZ"] as const,
    ["jackpotValueSKZ", "jackpotValueSKZ"] as const,
  ] as Array<[string, "buyPriceSKZ" | "maxPrizeSKZ" | "jackpotValueSKZ"]>) {
    if (b[field] !== undefined) {
      const v = parseFloat(String(b[field]));
      if (!Number.isFinite(v) || v < 0) { res.status(400).json({ error: `${field} must be >= 0` }); return; }
      updates[col] = v.toFixed(6);
    }
  }
  if (b.winRate !== undefined) {
    const v = parseFloat(String(b.winRate));
    if (!Number.isFinite(v) || v < 0 || v > 1) { res.status(400).json({ error: "winRate must be 0–1" }); return; }
    updates.winRate = v.toFixed(4);
  }

  const [card] = await db.update(scratchCardsTable).set(updates).where(eq(scratchCardsTable.id, id)).returning();
  if (!card) { res.status(404).json({ error: "Card not found" }); return; }
  await logAdminAction(req, "superadmin", { action: "scratch_card.update", targetType: "scratch_card", targetId: id, payload: updates });
  res.json(card);
});

router.delete("/superadmin/scratch-cards/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(scratchCardsTable).where(eq(scratchCardsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Card not found" }); return; }
  await logAdminAction(req, "superadmin", { action: "scratch_card.delete", targetType: "scratch_card", targetId: id, payload: { slug: deleted.slug } });
  res.json({ ok: true });
});

// ── Scratchy Games alias (/scratchy-games → same scratch_cards data) ──────
// The route contract requested by the task uses the "scratchy-games" path;
// the underlying table remains scratch_cards (unchanged data model).

router.get("/superadmin/scratchy-games", requireSuperAdmin, async (_req, res): Promise<void> => {
  const cards = await db
    .select()
    .from(scratchCardsTable)
    .orderBy(scratchCardsTable.displayOrder, scratchCardsTable.id);
  res.json({ data: cards });
});

router.post("/superadmin/scratchy-games", requireSuperAdmin, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const slug = String(b.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  const name = String(b.name ?? "").trim();
  if (!slug || !name) { res.status(400).json({ error: "slug and name are required" }); return; }
  const buyPrice = parseFloat(String(b.buyPriceSKZ ?? "10"));
  const winRate  = parseFloat(String(b.winRate ?? "0.3"));
  const maxPrize = parseFloat(String(b.maxPrizeSKZ ?? "100"));
  const jackpot  = parseFloat(String(b.jackpotValueSKZ ?? "1000"));
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) { res.status(400).json({ error: "buyPriceSKZ must be > 0" }); return; }
  if (!Number.isFinite(winRate) || winRate < 0 || winRate > 1) { res.status(400).json({ error: "winRate must be 0–1" }); return; }
  const [card] = await db.insert(scratchCardsTable).values({
    slug, name,
    description: typeof b.description === "string" ? b.description : null,
    isActive: b.isActive !== false,
    buyPriceSKZ: buyPrice.toFixed(6),
    winRate: winRate.toFixed(4),
    maxPrizeSKZ: maxPrize.toFixed(6),
    jackpotValueSKZ: jackpot.toFixed(6),
    displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : 0,
  }).returning();
  await logAdminAction(req, "superadmin", { action: "scratchy_game.create", targetType: "scratchy_game", targetId: card.id, payload: { slug } });
  res.status(201).json(card);
});

router.patch("/superadmin/scratchy-games/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const b = req.body as Record<string, unknown>;
  const updates: Partial<typeof scratchCardsTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof b.name === "string" && b.name.trim()) updates.name = b.name.trim();
  if (typeof b.description === "string") updates.description = b.description.trim() || null;
  if (typeof b.isActive === "boolean") updates.isActive = b.isActive;
  if (b.displayOrder !== undefined) updates.displayOrder = Number(b.displayOrder);
  for (const [field, col] of [
    ["buyPriceSKZ", "buyPriceSKZ"] as const,
    ["maxPrizeSKZ", "maxPrizeSKZ"] as const,
    ["jackpotValueSKZ", "jackpotValueSKZ"] as const,
  ] as Array<[string, "buyPriceSKZ" | "maxPrizeSKZ" | "jackpotValueSKZ"]>) {
    if (b[field] !== undefined) {
      const v = parseFloat(String(b[field]));
      if (!Number.isFinite(v) || v < 0) { res.status(400).json({ error: `${field} must be >= 0` }); return; }
      updates[col] = v.toFixed(6);
    }
  }
  if (b.winRate !== undefined) {
    const v = parseFloat(String(b.winRate));
    if (!Number.isFinite(v) || v < 0 || v > 1) { res.status(400).json({ error: "winRate must be 0–1" }); return; }
    updates.winRate = v.toFixed(4);
  }
  const [card] = await db.update(scratchCardsTable).set(updates).where(eq(scratchCardsTable.id, id)).returning();
  if (!card) { res.status(404).json({ error: "Game not found" }); return; }
  await logAdminAction(req, "superadmin", { action: "scratchy_game.update", targetType: "scratchy_game", targetId: id, payload: updates });
  res.json(card);
});

router.delete("/superadmin/scratchy-games/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(scratchCardsTable).where(eq(scratchCardsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Game not found" }); return; }
  await logAdminAction(req, "superadmin", { action: "scratchy_game.delete", targetType: "scratchy_game", targetId: id, payload: { slug: deleted.slug } });
  res.json({ ok: true });
});

// ── Bot heartbeats (live up/down for the Python bots) ────────────────────
// The five Python bots run as separate processes (aiogram) and emit a
// heartbeat every 30s via /internal/heartbeat. We always render the full
// expected set so a bot that has never pinged (new, crashed before first
// ping, or misconfigured) shows as offline rather than vanishing.
const HEARTBEAT_BOTS = ["mother-bot", "books-bot", "contests-bot", "scratchy-bot", "subagents-bot"] as const;
router.get("/superadmin/bots-health", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(botHeartbeatsTable);
  const bySlug = new Map(rows.map((r) => [r.botSlug, r]));
  const now = Date.now();
  const ONLINE_WINDOW_MS = 90_000;
  // Union of expected bots and any unexpected slug that has reported.
  const slugs = Array.from(new Set<string>([...HEARTBEAT_BOTS, ...rows.map((r) => r.botSlug)]));
  const data = slugs.map((slug) => {
    const r = bySlug.get(slug);
    const lastSeenMs = r?.lastSeenAt ? new Date(r.lastSeenAt).getTime() : 0;
    const ageSec = r ? Math.round((now - lastSeenMs) / 1000) : -1;
    return {
      botSlug: slug,
      status: r && now - lastSeenMs <= ONLINE_WINDOW_MS ? "online" : "offline",
      reportedStatus: r?.status ?? null,
      version: r?.version ?? null,
      lastSeenAt: r?.lastSeenAt ?? null,
      ageSec,
    };
  });
  res.json({ data });
});

export default router;
