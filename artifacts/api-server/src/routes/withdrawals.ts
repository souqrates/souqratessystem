import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { withdrawalsTable, walletsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/withdrawals", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const offset = (page - 1) * limit;
  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (userId !== undefined && !isNaN(userId)) conditions.push(eq(withdrawalsTable.userId, userId));
  if (status) conditions.push(eq(withdrawalsTable.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [withdrawals, countResult] = await Promise.all([
    db.select().from(withdrawalsTable)
      .where(whereClause)
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(withdrawalsTable).where(whereClause),
  ]);

  res.json({
    data: withdrawals,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

router.post("/withdrawals", async (req, res): Promise<void> => {
  const { userId, currency, amount, method, address } = req.body as {
    userId: number;
    currency: string;
    amount: string;
    method: string;
    address?: string;
  };

  if (!userId || !currency || !amount || !method) {
    res.status(400).json({ error: "userId, currency, amount, and method are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const feeRate = 0.01;
  const fee = amountNum * feeRate;
  const netAmount = amountNum - fee;

  let currentBalance = 0;
  if (currency === "stars") currentBalance = parseFloat(wallet.balanceStars);
  else if (currency === "usdt") currentBalance = parseFloat(wallet.balanceUsdt);
  else if (currency === "ton") currentBalance = parseFloat(wallet.balanceTon);

  if (currentBalance < amountNum) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({
      userId,
      currency,
      amount: String(amountNum),
      fee: String(fee.toFixed(9)),
      netAmount: String(netAmount.toFixed(9)),
      method,
      address: address ?? null,
      status: "pending",
    })
    .returning();

  logger.info({ withdrawalId: withdrawal.id, userId, amount, currency }, "Withdrawal request created");
  res.status(201).json(withdrawal);
});

router.post("/withdrawals/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { txHash } = req.body as { txHash: string };

  const [withdrawal] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.id, id));

  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "Can only approve pending withdrawals" });
    return;
  }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "approved", txHash, processedAt: new Date() })
    .where(eq(withdrawalsTable.id, id))
    .returning();

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, withdrawal.userId));
  if (wallet) {
    const amountNum = parseFloat(withdrawal.amount);
    if (withdrawal.currency === "stars") {
      await db.update(walletsTable).set({
        balanceStars: String(parseFloat(wallet.balanceStars) - amountNum),
        totalWithdrawn: String(parseFloat(wallet.totalWithdrawn) + amountNum),
      }).where(eq(walletsTable.id, wallet.id));
    } else if (withdrawal.currency === "usdt") {
      await db.update(walletsTable).set({
        balanceUsdt: String(parseFloat(wallet.balanceUsdt) - amountNum),
        totalWithdrawn: String(parseFloat(wallet.totalWithdrawn) + amountNum),
      }).where(eq(walletsTable.id, wallet.id));
    } else if (withdrawal.currency === "ton") {
      await db.update(walletsTable).set({
        balanceTon: String(parseFloat(wallet.balanceTon) - amountNum),
        totalWithdrawn: String(parseFloat(wallet.totalWithdrawn) + amountNum),
      }).where(eq(walletsTable.id, wallet.id));
    }
  }

  res.json(updated);
});

router.post("/withdrawals/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { reason } = req.body as { reason: string };

  const [withdrawal] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.id, id));

  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "rejected", rejectedReason: reason, processedAt: new Date() })
    .where(eq(withdrawalsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
