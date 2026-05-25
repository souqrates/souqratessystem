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
  broadcastsTable,
  externalLinksTable,
  errorLogsTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  requireSuperAdmin,
  verifySuperAdminCode,
} from "../lib/super-admin-auth";
import { logAdminAction } from "../lib/audit-log";
import { notifyUser } from "../lib/notify-user";
import { capture } from "../lib/analytics";
import { withdrawalAddressesTable, adminAuditLogTable } from "@workspace/db";
import { getCryptomusEnv, createCryptomusPayout } from "../lib/cryptomus";
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
  await logAdminAction(req, "superadmin", {
    action: "bot.update", targetType: "bot", targetId: raw,
    payload: updates,
  });
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
  await logAdminAction(req, "superadmin", {
    action: "commission_override.delete", targetType: "commission_override", targetId: id,
    payload: { telegramId: result[0]?.telegramId?.toString?.(), botSlug: result[0]?.botSlug },
  });
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

  const conds = [];
  if (status) conds.push(eq(withdrawalsTable.status, status));
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
    db.select({ c: sql<number>`count(*)::int` }).from(withdrawalsTable).where(where),
  ]);
  res.json({ data: rows, total: Number(count[0]?.c ?? 0), page, limit });
});

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

      if (!walletUpdated) throw new Error("Insufficient wallet balance at approval time");
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
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.approve", targetType: "withdrawal", targetId: id,
      payload: { txHash }, success: false,
      errorMessage: err instanceof Error ? err.message : "Approval failed",
    });
    req.log.error({ err, id }, "superadmin withdrawal approve failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Approval failed" });
  }
});

/**
 * POST /superadmin/withdrawals/:id/auto-payout
 *
 * One-click automatic payout via Cryptomus. Atomically:
 *   1. CAS withdrawal: pending → processing (loses race ⇒ 409, no funds moved).
 *   2. CAS wallet: deduct balance (insufficient ⇒ rollback + 400).
 *   3. Stamp txHash = `cm:<orderId>` so the payout webhook can resolve us.
 * THEN calls Cryptomus /v1/payout. On gateway rejection we fully refund
 * (status → pending, balance → restored). On gateway accept the row stays
 * in `processing` until the payout webhook flips it to `approved` (with
 * the real on-chain txid) or back to `pending` on failure.
 *
 * Why the wallet deduction happens *here* and not on /approve like the
 * manual path: an auto-payout is the moment we commit funds to leave the
 * platform. We deduct before calling Cryptomus, then refund on failure,
 * so a successful Cryptomus call never leaves the wallet over-credited.
 */
router.post("/superadmin/withdrawals/:id/auto-payout", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const env = await getCryptomusEnv();
  if (!env) { res.status(503).json({ error: "Cryptomus not configured in /integrations" }); return; }
  if (!env.publicWebhookBase) {
    res.status(503).json({ error: "public_webhook_base not configured" });
    return;
  }

  const orderId = crypto.randomUUID();
  const txHashMarker = `cm:${orderId}`;

  // ── Step 1+2: CAS withdrawal to processing AND deduct wallet, atomically.
  let row: typeof withdrawalsTable.$inferSelect | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      const [w] = await tx.update(withdrawalsTable)
        .set({ status: "processing", txHash: txHashMarker, processedAt: new Date() })
        .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
        .returning();
      if (!w) return { error: "Only pending withdrawals can be auto-paid", row: null };

      const amt = parseFloat(w.amount);
      let walletUpdated: typeof walletsTable.$inferSelect | undefined;
      if (w.currency === "usdt") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceUsdt:    sql`${walletsTable.balanceUsdt}    - ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
        }).where(and(
          eq(walletsTable.userId, w.userId),
          sql`${walletsTable.balanceUsdt} >= ${amt}`,
        )).returning();
      } else if (w.currency === "ton") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceTon:     sql`${walletsTable.balanceTon}     - ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amt}`,
        }).where(and(
          eq(walletsTable.userId, w.userId),
          sql`${walletsTable.balanceTon} >= ${amt}`,
        )).returning();
      } else {
        // SKZ and Stars don't go on-chain — they need a different rail.
        throw new Error(`Auto-payout not supported for currency: ${w.currency}`);
      }
      if (!walletUpdated) throw new Error("Insufficient wallet balance");
      return { error: null, row: w };
    });

    if (result.error || !result.row) {
      await logAdminAction(req, "superadmin", {
        action: "withdrawal.auto_payout", targetType: "withdrawal", targetId: id,
        payload: { orderId }, success: false, errorMessage: result.error ?? "Auto-payout failed",
      });
      res.status(409).json({ error: result.error ?? "Auto-payout failed" });
      return;
    }
    row = result.row;
  } catch (err) {
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.auto_payout", targetType: "withdrawal", targetId: id,
      payload: { orderId }, success: false,
      errorMessage: err instanceof Error ? err.message : "wallet_deduction_failed",
    });
    req.log.error({ err, id }, "auto-payout pre-call deduction failed");
    res.status(400).json({ error: err instanceof Error ? err.message : "Wallet deduction failed" });
    return;
  }

  // ── Step 3: actually call Cryptomus. From here, any failure must REFUND.
  const network = (() => {
    if (typeof row.method === "string") {
      if (row.method.includes("trc20") || row.method === "tron") return "tron";
      if (row.method === "ton") return "ton";
    }
    return row.currency === "ton" ? "ton" : "tron";
  })();

  if (!row.address) {
    // Refund + abort: cannot pay out without a destination address.
    await refundAutoPayout(row, "missing_address");
    res.status(400).json({ error: "Withdrawal has no destination address" });
    return;
  }

  const urlCallback = `${env.publicWebhookBase.replace(/\/$/, "")}/api/payments/cryptomus/payout-webhook`;
  const gw = await createCryptomusPayout(env, {
    amount: row.netAmount,
    currency: row.currency.toUpperCase(),
    network,
    address: row.address,
    orderId,
    urlCallback,
    isSubtract: false, // we already netted the fee in row.netAmount
  });

  if (!gw.ok) {
    // ── Refund SAFETY ──────────────────────────────────────────────────
    // A transport-level error (timeout, DNS, TLS, connection reset) is
    // an *ambiguous* outcome: Cryptomus may still have accepted the
    // payout despite our client never seeing the response. If we refund
    // the wallet now, we risk double-paying the user (gateway settles,
    // user already has the balance back, then we pay again).
    //
    // Policy:
    //   - Deterministic gateway rejection (HTTP body with state≠0) →
    //     safe to refund: Cryptomus told us "no".
    //   - Transport error → DO NOT refund. Leave row in `processing`
    //     with marker intact. Webhook will reconcile if Cryptomus
    //     actually accepted; otherwise admin can investigate via
    //     dashboard and manually revert.
    const ambiguous = gw.error === "gateway_unreachable";
    if (ambiguous) {
      await logAdminAction(req, "superadmin", {
        action: "withdrawal.auto_payout", targetType: "withdrawal", targetId: id,
        payload: { orderId, gatewayError: gw.error }, success: false,
        errorMessage: "ambiguous_no_refund:" + gw.error,
      });
      req.log.error(
        { err: gw.error, id, orderId },
        "auto-payout: AMBIGUOUS gateway error — left in processing for manual reconciliation",
      );
      res.status(502).json({
        error: "Gateway unreachable — withdrawal is in processing state. " +
               "Check Cryptomus dashboard for orderId before retrying.",
        orderId,
      });
      return;
    }
    await refundAutoPayout(row, gw.error);
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.auto_payout", targetType: "withdrawal", targetId: id,
      payload: { orderId, gatewayError: gw.error }, success: false, errorMessage: gw.error,
    });
    req.log.warn({ err: gw.error, id, orderId }, "auto-payout: gateway rejected, refunded");
    res.status(502).json({ error: `Gateway: ${gw.error}` });
    return;
  }

  // Stash the gateway uuid alongside the orderId so support can correlate
  // in the Cryptomus dashboard without grepping logs.
  //
  // CAS guard: a fast webhook may have already settled the row and
  // replaced txHash with the real on-chain txid. We must NOT overwrite
  // that — only stamp the gw uuid if the marker is still in place AND
  // the row is still processing. Losing this race is fine: webhook
  // already wrote the authoritative value.
  await db.update(withdrawalsTable)
    .set({ txHash: `cm:${orderId}:${gw.uuid}` })
    .where(and(
      eq(withdrawalsTable.id, id),
      eq(withdrawalsTable.status, "processing"),
      eq(withdrawalsTable.txHash, txHashMarker),
    ));

  await logAdminAction(req, "superadmin", {
    action: "withdrawal.auto_payout", targetType: "withdrawal", targetId: id,
    payload: { orderId, gatewayUuid: gw.uuid, amount: row.netAmount, currency: row.currency, network },
  });

  req.log.info({ id, orderId, gatewayUuid: gw.uuid }, "auto-payout: dispatched to Cryptomus");
  res.json({ ok: true, status: "processing", orderId, gatewayUuid: gw.uuid });
});

/**
 * Refund helper for failed auto-payouts. Reverses both the wallet
 * deduction and the row status. Best-effort logging — the caller has
 * already decided to surface an error to the operator.
 */
async function refundAutoPayout(
  row: typeof withdrawalsTable.$inferSelect,
  reason: string,
): Promise<void> {
  const amt = parseFloat(row.amount);
  await db.transaction(async (tx) => {
    // Only refund if the row is still in processing — defensive guard
    // against the webhook racing in and already handling it.
    const [reverted] = await tx.update(withdrawalsTable)
      .set({ status: "pending", txHash: null, processedAt: null, rejectedReason: reason })
      .where(and(eq(withdrawalsTable.id, row.id), eq(withdrawalsTable.status, "processing")))
      .returning();
    if (!reverted) return;

    if (reverted.currency === "usdt") {
      await tx.update(walletsTable).set({
        balanceUsdt:    sql`${walletsTable.balanceUsdt}    + ${amt}`,
        totalWithdrawn: sql`${walletsTable.totalWithdrawn} - ${amt}`,
      }).where(eq(walletsTable.userId, reverted.userId));
    } else if (reverted.currency === "ton") {
      await tx.update(walletsTable).set({
        balanceTon:     sql`${walletsTable.balanceTon}     + ${amt}`,
        totalWithdrawn: sql`${walletsTable.totalWithdrawn} - ${amt}`,
      }).where(eq(walletsTable.userId, reverted.userId));
    }
  });
}

router.post("/superadmin/withdrawals/:id/reject", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { reason } = req.body as { reason?: string };

  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "rejected", rejectedReason: reason ?? null, processedAt: new Date() })
    .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
    .returning();
  if (!updated) {
    await logAdminAction(req, "superadmin", {
      action: "withdrawal.reject", targetType: "withdrawal", targetId: id,
      payload: { reason }, success: false, errorMessage: "not_pending",
    });
    res.status(400).json({ error: "Only pending withdrawals can be rejected" });
    return;
  }
  await logAdminAction(req, "superadmin", {
    action: "withdrawal.reject", targetType: "withdrawal", targetId: id,
    payload: { reason, amount: updated.amount, currency: updated.currency },
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

export default router;
