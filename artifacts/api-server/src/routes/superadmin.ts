import { Router, type IRouter } from "express";
import { eq, sql, and, desc, or, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  botsTable,
  commissionOverridesTable,
  usersTable,
  botTextsTable,
  walletsTable,
  transactionsTable,
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
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
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
    req.log.info({ telegramId: tid.toString(), amount: amt, txId: out.transactionId }, "superadmin: manual credit");
    res.json({ ok: true, wallet: out.wallet, transactionId: out.transactionId });
  } catch (e) {
    const err = e as { status?: number; message: string };
    res.status(err.status ?? 500).json({ error: err.message });
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
    req.log.info({ telegramId: tid.toString(), amount: amt, txId: out.transactionId }, "superadmin: manual debit");
    res.json({ ok: true, wallet: out.wallet, transactionId: out.transactionId });
  } catch (e) {
    const err = e as { status?: number; message: string };
    res.status(err.status ?? 500).json({ error: err.message });
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
