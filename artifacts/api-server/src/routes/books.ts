/**
 * Books-bot routes — digital products marketplace.
 *
 * Public:
 *   GET  /books/categories
 *   GET  /books/products?categoryId=&q=&limit=&offset=
 *   GET  /books/products/:id
 *
 * Internal (X-Bot-Api-Key, calling bot must be active):
 *   POST /internal/books/products/submit         publisher submits a new product (pending)
 *   POST /internal/books/products/purchase       buyer pays in SKZ → publisher credited
 *   GET  /internal/books/products/my?telegramId  my purchases + my published products
 *   GET  /internal/books/products/download/:token signed time-limited file URL redirect
 *
 * Super-admin (Bearer):
 *   GET    /superadmin/books/products?status=&q=&limit=&offset=
 *   PATCH  /superadmin/books/products/:id        { status, rejectionReason? }
 *   DELETE /superadmin/books/products/:id        hard delete (admin escape hatch)
 *   GET    /superadmin/books/categories
 *   POST   /superadmin/books/categories          { slug, nameAr, icon?, sortOrder? }
 *   PATCH  /superadmin/books/categories/:id
 *   DELETE /superadmin/books/categories/:id
 *   GET    /superadmin/books/stats               { totals, pendingCount, topPublishers }
 *
 * Financial rules (mirror games-bot pattern):
 *   - All mutating routes check rejectIfBlocked(user) → 403 if blocked.
 *   - Purchase uses an atomic SKZ debit on buyer wallet (guarded UPDATE).
 *   - Commission rate is fetched fresh via getEffectiveCommissionRate('books-bot',…)
 *     → super-admin per-user override wins over bots.commissionRate default.
 *   - Publisher is credited net = price − commission (rounded to 2 dp).
 *   - Both legs + commission row inserted in a single db.transaction so the
 *     wallet & ledger cannot drift.
 */
import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, sql, and, desc, asc, ilike, or, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  commissionsTable,
  commissionOverridesTable,
  productCategoriesTable,
  digitalProductsTable,
  productPurchasesTable,
} from "@workspace/db";
import { requireSuperAdmin } from "../lib/super-admin-auth";

const router: IRouter = Router();
const BOT_SLUG = "books-bot";

// ── Local helpers (mirror internal.ts; intentionally inlined for isolation) ──
async function requireBot(req: any, res: any) {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Bot-Api-Key header" });
    return null;
  }
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  if (!bot || !bot.isActive) {
    res.status(403).json({ error: "Invalid or inactive bot API key" });
    return null;
  }
  if (bot.slug !== BOT_SLUG) {
    res.status(403).json({ error: "Forbidden: books-bot API key required for this endpoint" });
    return null;
  }
  return bot;
}

function publicDownloadUrl(token: string): string {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const host = domains[0] ?? process.env.REPLIT_DEV_DOMAIN ?? "";
  const base = host ? `https://${host}` : "";
  return `${base}/api/internal/books/products/download/${encodeURIComponent(token)}`;
}

function rejectIfBlocked(user: { isBlocked: boolean | null }, res: any): boolean {
  if (user.isBlocked === true) {
    res.status(403).json({ error: "هذا المستخدم محظور — لا يمكن إجراء عمليات مالية" });
    return true;
  }
  return false;
}

async function getEffectiveCommissionRate(
  telegramId: bigint,
  botSlug: string,
  defaultRate: string | number,
): Promise<number> {
  const [override] = await db
    .select({ rate: commissionOverridesTable.commissionRate })
    .from(commissionOverridesTable)
    .where(and(
      eq(commissionOverridesTable.telegramId, telegramId),
      eq(commissionOverridesTable.botSlug, botSlug),
    ))
    .limit(1);
  return parseFloat(String(override?.rate ?? defaultRate));
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw Object.assign(new Error("SESSION_SECRET not configured"), { status: 503 });
  return s;
}

/** Signed download token bound to (purchaseId, productId, exp). */
function signDownloadToken(purchaseId: number, productId: number, expMs: number): string {
  const payload = `${purchaseId}:${productId}:${expMs}`;
  const hmac = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

function verifyDownloadToken(token: string): { purchaseId: number; productId: number } | null {
  try {
    const parts = token.split(":");
    if (parts.length !== 4) return null;
    const [pStr, prStr, expStr, hmac] = parts;
    if (Date.now() > parseInt(expStr, 10)) return null;
    const expected = crypto.createHmac("sha256", getSecret()).update(`${pStr}:${prStr}:${expStr}`).digest("hex");
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    return { purchaseId: parseInt(pStr, 10), productId: parseInt(prStr, 10) };
  } catch {
    return null;
  }
}

async function getBooksBotRecord() {
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.slug, BOT_SLUG));
  return bot ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────────────────────

router.get("/books/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(productCategoriesTable)
    .orderBy(asc(productCategoriesTable.sortOrder), asc(productCategoriesTable.id));
  res.json({ data: rows });
});

router.get("/books/products", async (req, res): Promise<void> => {
  const { categoryId, q } = req.query as { categoryId?: string; q?: string };
  const limit = Math.min(parseInt((req.query.limit as string) ?? "30", 10) || 30, 100);
  const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;

  const conds = [eq(digitalProductsTable.status, "approved")];
  if (categoryId) {
    const cid = parseInt(categoryId, 10);
    if (Number.isFinite(cid)) conds.push(eq(digitalProductsTable.categoryId, cid));
  }
  if (q) conds.push(ilike(digitalProductsTable.title, `%${q}%`));

  const rows = await db
    .select({
      id: digitalProductsTable.id,
      title: digitalProductsTable.title,
      description: digitalProductsTable.description,
      coverUrl: digitalProductsTable.coverUrl,
      categoryId: digitalProductsTable.categoryId,
      priceUsdt: digitalProductsTable.priceUsdt,
      salesCount: digitalProductsTable.salesCount,
      rating: digitalProductsTable.rating,
      ratingCount: digitalProductsTable.ratingCount,
      createdAt: digitalProductsTable.createdAt,
    })
    .from(digitalProductsTable)
    .where(and(...conds))
    .orderBy(desc(digitalProductsTable.salesCount), desc(digitalProductsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(digitalProductsTable)
    .where(and(...conds));

  res.json({ data: rows, total: Number(total), limit, offset });
});

router.get("/books/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .select({
      id: digitalProductsTable.id,
      title: digitalProductsTable.title,
      description: digitalProductsTable.description,
      coverUrl: digitalProductsTable.coverUrl,
      categoryId: digitalProductsTable.categoryId,
      priceUsdt: digitalProductsTable.priceUsdt,
      salesCount: digitalProductsTable.salesCount,
      rating: digitalProductsTable.rating,
      ratingCount: digitalProductsTable.ratingCount,
      status: digitalProductsTable.status,
      createdAt: digitalProductsTable.createdAt,
    })
    .from(digitalProductsTable)
    .where(eq(digitalProductsTable.id, id));
  if (!row || row.status !== "approved") { res.status(404).json({ error: "Product not found" }); return; }
  res.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL (X-Bot-Api-Key)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/internal/books/products/submit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, title, description, coverUrl, fileUrl, fileSize, priceUsdt, categoryId } = req.body as {
    telegramId: string;
    title: string;
    description?: string;
    coverUrl?: string;
    fileUrl: string;
    fileSize?: number;
    priceUsdt: string | number;
    categoryId?: number;
  };

  if (!telegramId || !title || !fileUrl || priceUsdt === undefined) {
    res.status(400).json({ error: "telegramId, title, fileUrl, priceUsdt required" });
    return;
  }
  const price = typeof priceUsdt === "number" ? priceUsdt : parseFloat(priceUsdt);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Invalid priceUsdt" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(String(telegramId))));
  if (!user) { res.status(404).json({ error: "User not found — call /internal/users/upsert first" }); return; }
  if (rejectIfBlocked(user, res)) return;

  const [row] = await db
    .insert(digitalProductsTable)
    .values({
      publisherTelegramId: BigInt(String(telegramId)),
      categoryId: categoryId ?? null,
      title: title.trim().slice(0, 200),
      description: (description ?? "").slice(0, 4000),
      coverUrl: coverUrl ?? null,
      fileUrl,
      fileSize: fileSize ?? 0,
      priceUsdt: String(price.toFixed(6)),
      status: "pending",
    })
    .returning();

  req.log.info({ productId: row.id, telegramId, price }, "books: product submitted");
  res.status(201).json(row);
});

router.post("/internal/books/products/purchase", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, productId } = req.body as { telegramId: string; productId: number };
  if (!telegramId || !productId) { res.status(400).json({ error: "telegramId, productId required" }); return; }

  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.telegramId, BigInt(String(telegramId))));
  if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }
  if (rejectIfBlocked(buyer, res)) return;

  const [product] = await db.select().from(digitalProductsTable).where(eq(digitalProductsTable.id, productId));
  if (!product || product.status !== "approved") { res.status(404).json({ error: "Product not available" }); return; }
  if (product.publisherTelegramId === buyer.telegramId) { res.status(400).json({ error: "Cannot purchase your own product" }); return; }

  // Idempotency: only one active purchase per (buyer, product). Cheap guard, not a hard unique idx,
  // because the user may legitimately re-buy if the publisher updates the file (out of scope for v1).
  const [existing] = await db
    .select({ id: productPurchasesTable.id })
    .from(productPurchasesTable)
    .where(and(
      eq(productPurchasesTable.buyerTelegramId, buyer.telegramId),
      eq(productPurchasesTable.productId, productId),
    ))
    .limit(1);
  if (existing) { res.status(409).json({ error: "You already own this product", purchaseId: existing.id }); return; }

  const priceNum = parseFloat(product.priceUsdt);
  // Fresh per-buyer commission rate (super-admin override wins).
  const rate = await getEffectiveCommissionRate(buyer.telegramId, BOT_SLUG, bot.commissionRate);
  const commission = +(priceNum * rate).toFixed(6);
  const netToPublisher = +(priceNum - commission).toFixed(6);

  const booksBot = await getBooksBotRecord();

  const result = await db.transaction(async (tx) => {
    // 1. Atomic guarded debit on buyer wallet — UPDATE only succeeds if balance ≥ price.
    const [debited] = await tx
      .update(walletsTable)
      .set({ balanceSkz: sql`${walletsTable.balanceSkz} - ${priceNum}` })
      .where(and(eq(walletsTable.userId, buyer.id), sql`${walletsTable.balanceSkz} >= ${priceNum}`))
      .returning();
    if (!debited) throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { code: "INSUFFICIENT_BALANCE" });

    // 2. Buyer debit ledger row.
    const [debitTx] = await tx.insert(transactionsTable).values({
      userId: buyer.id,
      type: "purchase",
      currency: "skz",
      amount: String(priceNum.toFixed(2)),
      fee: "0",
      status: "completed",
      sourceBot: BOT_SLUG,
      referenceId: `book_${productId}`,
      description: `شراء كتاب: ${product.title}`,
      metadata: JSON.stringify({ productId, title: product.title }),
    }).returning();

    // 3. Credit publisher (look up publisher user + wallet; net of commission).
    const [pubUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, product.publisherTelegramId));
    let publisherTxId: number | null = null;
    if (pubUser) {
      await tx.update(walletsTable).set({
        balanceSkz: sql`${walletsTable.balanceSkz} + ${netToPublisher}`,
        totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${netToPublisher}`,
      }).where(eq(walletsTable.userId, pubUser.id));

      const [credTx] = await tx.insert(transactionsTable).values({
        userId: pubUser.id,
        type: "credit",
        currency: "skz",
        amount: String(priceNum.toFixed(2)),
        fee: String(commission.toFixed(2)),
        status: "completed",
        sourceBot: BOT_SLUG,
        referenceId: `book_sale_${productId}_${debitTx.id}`,
        description: `بيع كتاب: ${product.title}`,
        metadata: JSON.stringify({ productId, buyerId: buyer.id }),
      }).returning();
      publisherTxId = credTx.id;

      // 4. Commission ledger.
      await tx.insert(commissionsTable).values({
        transactionId: credTx.id,
        botSlug: BOT_SLUG,
        userId: pubUser.id,
        grossAmount: String(priceNum.toFixed(2)),
        commissionRate: String(rate),
        commissionAmount: String(commission.toFixed(2)),
        netAmount: String(netToPublisher.toFixed(2)),
        currency: "skz",
      });
    }

    // 5. Bump bot-level aggregates (best-effort).
    if (booksBot) {
      await tx.update(botsTable).set({
        totalVolumeUsdt: sql`${botsTable.totalVolumeUsdt} + ${priceNum}`,
        totalCommissionUsdt: sql`${botsTable.totalCommissionUsdt} + ${commission}`,
      }).where(eq(botsTable.id, booksBot.id));
    }

    // 6. Bump product sales counter.
    await tx.update(digitalProductsTable)
      .set({ salesCount: sql`${digitalProductsTable.salesCount} + 1` })
      .where(eq(digitalProductsTable.id, productId));

    // 7. Issue download token + persist purchase row.
    const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7-day download window
    // Insert first WITHOUT a token to obtain id, then update with HMAC-signed token tied to that id.
    const [purchase] = await tx.insert(productPurchasesTable).values({
      productId,
      buyerTelegramId: buyer.telegramId,
      pricePaid: String(priceNum.toFixed(6)),
      commissionAmount: String(commission.toFixed(6)),
      netToPublisher: String(netToPublisher.toFixed(6)),
      transactionId: debitTx.id,
      downloadToken: crypto.randomBytes(16).toString("hex"), // placeholder, replaced below
      downloadExpiresAt: new Date(expMs),
    }).returning();
    const finalToken = signDownloadToken(purchase.id, productId, expMs);
    await tx.update(productPurchasesTable)
      .set({ downloadToken: finalToken })
      .where(eq(productPurchasesTable.id, purchase.id));

    return {
      purchaseId: purchase.id,
      debitTxId: debitTx.id,
      publisherTxId,
      newBalance: debited.balanceSkz,
      downloadToken: finalToken,
      downloadExpiresAt: new Date(expMs).toISOString(),
      pricePaid: priceNum.toFixed(2),
      commission: commission.toFixed(2),
      netToPublisher: netToPublisher.toFixed(2),
    };
  }).catch((e: any) => {
    if (e?.code === "INSUFFICIENT_BALANCE") return { error: "INSUFFICIENT_BALANCE" as const };
    throw e;
  });

  if ("error" in result) { res.status(400).json({ error: "رصيد SKZ غير كافٍ" }); return; }
  req.log.info({ purchaseId: result.purchaseId, productId, buyerId: buyer.id }, "books: purchase complete");
  res.status(201).json({ success: true, ...result });
});

router.get("/internal/books/products/my", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;
  const telegramId = String(req.query.telegramId ?? "");
  if (!telegramId) { res.status(400).json({ error: "telegramId required" }); return; }
  const tg = BigInt(telegramId);

  const [purchases, published] = await Promise.all([
    db.select({
      id: productPurchasesTable.id,
      productId: productPurchasesTable.productId,
      title: digitalProductsTable.title,
      coverUrl: digitalProductsTable.coverUrl,
      pricePaid: productPurchasesTable.pricePaid,
      downloadToken: productPurchasesTable.downloadToken,
      downloadExpiresAt: productPurchasesTable.downloadExpiresAt,
      createdAt: productPurchasesTable.createdAt,
    })
      .from(productPurchasesTable)
      .leftJoin(digitalProductsTable, eq(productPurchasesTable.productId, digitalProductsTable.id))
      .where(eq(productPurchasesTable.buyerTelegramId, tg))
      .orderBy(desc(productPurchasesTable.createdAt))
      .limit(100),
    db.select()
      .from(digitalProductsTable)
      .where(eq(digitalProductsTable.publisherTelegramId, tg))
      .orderBy(desc(digitalProductsTable.createdAt))
      .limit(100),
  ]);
  const purchasesWithUrls = purchases.map((p) => ({
    ...p,
    downloadUrl: publicDownloadUrl(p.downloadToken),
  }));
  res.json({
    purchases: purchasesWithUrls,
    published: published.map((p) => ({ ...p, publisherTelegramId: String(p.publisherTelegramId) })),
  });
});

/**
 * GET /internal/books/products/download/:token
 * Validates the HMAC token + freshness window, then returns the underlying fileUrl.
 * Frontend/bot is expected to redirect or stream — we just hand back the URL.
 * NOTE: This route does NOT require X-Bot-Api-Key — the signed token itself is the auth.
 */
router.get("/internal/books/products/download/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token);
  const parsed = verifyDownloadToken(token);
  if (!parsed) { res.status(403).json({ error: "Invalid or expired download token" }); return; }

  const [purchase] = await db.select().from(productPurchasesTable).where(eq(productPurchasesTable.id, parsed.purchaseId));
  if (!purchase || purchase.downloadToken !== token) { res.status(403).json({ error: "Token revoked" }); return; }
  if (new Date(purchase.downloadExpiresAt).getTime() < Date.now()) { res.status(403).json({ error: "Download window expired" }); return; }

  const [product] = await db.select({ fileUrl: digitalProductsTable.fileUrl, title: digitalProductsTable.title })
    .from(digitalProductsTable).where(eq(digitalProductsTable.id, parsed.productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  res.json({ fileUrl: product.fileUrl, title: product.title, expiresAt: purchase.downloadExpiresAt });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN
// ─────────────────────────────────────────────────────────────────────────────

router.get("/superadmin/books/products", requireSuperAdmin, async (req, res): Promise<void> => {
  const { status, q } = req.query as { status?: string; q?: string };
  const limit = Math.min(parseInt((req.query.limit as string) ?? "100", 10) || 100, 500);
  const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;

  const conds = [] as any[];
  if (status && ["pending", "approved", "rejected", "disabled"].includes(status)) {
    conds.push(eq(digitalProductsTable.status, status));
  }
  if (q) conds.push(or(ilike(digitalProductsTable.title, `%${q}%`), ilike(digitalProductsTable.description, `%${q}%`)));

  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(digitalProductsTable)
    .where(where as any)
    .orderBy(desc(digitalProductsTable.createdAt))
    .limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(digitalProductsTable).where(where as any);
  res.json({ data: rows.map((r) => ({ ...r, publisherTelegramId: String(r.publisherTelegramId) })), total: Number(total), limit, offset });
});

router.patch("/superadmin/books/products/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, rejectionReason, priceUsdt, categoryId, title, description } = req.body as {
    status?: string; rejectionReason?: string; priceUsdt?: string | number; categoryId?: number | null;
    title?: string; description?: string;
  };
  const updates: Partial<typeof digitalProductsTable.$inferInsert> = {};
  if (status) {
    if (!["pending", "approved", "rejected", "disabled"].includes(status)) {
      res.status(400).json({ error: "Invalid status" }); return;
    }
    updates.status = status;
    if (status === "approved") updates.approvedAt = new Date();
    if (status === "rejected") updates.rejectionReason = rejectionReason ?? "";
  }
  if (priceUsdt !== undefined) {
    const p = typeof priceUsdt === "number" ? priceUsdt : parseFloat(priceUsdt);
    if (!Number.isFinite(p) || p < 0) { res.status(400).json({ error: "Invalid priceUsdt" }); return; }
    updates.priceUsdt = String(p.toFixed(6));
  }
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (typeof title === "string" && title.trim()) updates.title = title.trim().slice(0, 200);
  if (typeof description === "string") updates.description = description.slice(0, 4000);
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  const [updated] = await db.update(digitalProductsTable).set(updates).where(eq(digitalProductsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  req.log.info({ id, updates }, "superadmin: product updated");
  res.json({ ...updated, publisherTelegramId: String(updated.publisherTelegramId) });
});

router.delete("/superadmin/books/products/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(digitalProductsTable).where(eq(digitalProductsTable.id, id));
  res.json({ success: true });
});

router.get("/superadmin/books/categories", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(productCategoriesTable)
    .orderBy(asc(productCategoriesTable.sortOrder), asc(productCategoriesTable.id));
  res.json({ data: rows });
});

router.post("/superadmin/books/categories", requireSuperAdmin, async (req, res): Promise<void> => {
  const { slug, nameAr, icon, sortOrder } = req.body as { slug: string; nameAr: string; icon?: string; sortOrder?: number };
  if (!slug || !nameAr) { res.status(400).json({ error: "slug + nameAr required" }); return; }
  try {
    const [row] = await db.insert(productCategoriesTable).values({
      slug: slug.toLowerCase().trim(),
      nameAr: nameAr.trim(),
      icon: icon ?? "📚",
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(409).json({ error: e?.message ?? "Could not create category" });
  }
});

router.patch("/superadmin/books/categories/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { nameAr, icon, sortOrder } = req.body as { nameAr?: string; icon?: string; sortOrder?: number };
  const updates: Partial<typeof productCategoriesTable.$inferInsert> = {};
  if (nameAr) updates.nameAr = nameAr.trim();
  if (icon) updates.icon = icon;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [row] = await db.update(productCategoriesTable).set(updates).where(eq(productCategoriesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/superadmin/books/categories/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(productCategoriesTable).where(eq(productCategoriesTable.id, id));
  res.json({ success: true });
});

router.get("/superadmin/books/stats", requireSuperAdmin, async (_req, res): Promise<void> => {
  const [counts] = await db
    .select({
      totalProducts: count(),
    })
    .from(digitalProductsTable);

  const pendingRows = await db.select({ c: count() }).from(digitalProductsTable).where(eq(digitalProductsTable.status, "pending"));
  const approvedRows = await db.select({ c: count() }).from(digitalProductsTable).where(eq(digitalProductsTable.status, "approved"));
  const [purchaseRow] = await db.select({
    total: count(),
    volumeSkz: sql<string>`coalesce(sum(${productPurchasesTable.pricePaid}),0)::text`,
    commissionSkz: sql<string>`coalesce(sum(${productPurchasesTable.commissionAmount}),0)::text`,
  }).from(productPurchasesTable);

  // Top 5 publishers by net revenue.
  const top = await db.execute(sql`
    SELECT p.publisher_telegram_id::text AS "publisherTelegramId",
           COALESCE(SUM(pu.net_to_publisher),0)::text AS "netSkz",
           COUNT(pu.id)::int AS "sales"
      FROM product_purchases pu
      JOIN digital_products p ON p.id = pu.product_id
     GROUP BY p.publisher_telegram_id
     ORDER BY SUM(pu.net_to_publisher) DESC NULLS LAST
     LIMIT 5
  `);

  res.json({
    totalProducts: Number(counts.totalProducts),
    pendingCount: Number(pendingRows[0]?.c ?? 0),
    approvedCount: Number(approvedRows[0]?.c ?? 0),
    totalPurchases: Number(purchaseRow.total),
    volumeSkz: purchaseRow.volumeSkz,
    commissionSkz: purchaseRow.commissionSkz,
    topPublishers: (top as any).rows ?? [],
  });
});

export default router;
