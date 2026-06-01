import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { withdrawalsTable, walletsTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdmin } from "../lib/admin-auth";
import { logAdminAction } from "../lib/audit-log";
import { notifyUser } from "../lib/notify-user";

const router: IRouter = Router();

router.get("/withdrawals", requireAdmin, async (req, res): Promise<void> => {
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

// Note: end-users create withdrawal requests via the bot-scoped
// /internal/withdraw endpoint (authed with X-Bot-Api-Key). The raw
// /withdrawals POST below is an admin-only convenience for manual
// adjustments — gated with requireAdmin.
router.post("/withdrawals", requireAdmin, async (req, res): Promise<void> => {
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
  else if (currency === "skz") currentBalance = parseFloat(wallet.balanceSkz);

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

/**
 * POST /withdrawals/:id/approve (admin-only).
 *
 * Atomically transitions a pending withdrawal → approved AND debits the
 * user's wallet. Wrapped in a transaction so a partial failure can never
 * leave a row marked "approved" with funds still in the user's wallet.
 *
 * The status guard runs inside the transaction to defeat double-approve
 * races between two concurrent admin clicks.
 */
router.post("/withdrawals/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { txHash } = req.body as { txHash: string };

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid withdrawal id" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Atomic state transition: only succeeds if status is still pending.
      const [updated] = await tx
        .update(withdrawalsTable)
        .set({ status: "approved", txHash, processedAt: new Date() })
        .where(
          and(
            eq(withdrawalsTable.id, id),
            eq(withdrawalsTable.status, "pending"),
          ),
        )
        .returning();

      if (!updated) {
        // Either not found or not pending — distinguish with a follow-up read.
        const [exists] = await tx
          .select({ id: withdrawalsTable.id, status: withdrawalsTable.status })
          .from(withdrawalsTable)
          .where(eq(withdrawalsTable.id, id));
        return { error: exists ? "Can only approve pending withdrawals" : "Withdrawal not found", updated: null };
      }

      const amountNum = parseFloat(updated.amount);

      // Debit the user's wallet atomically using SQL arithmetic. The
      // `WHERE balance >= amount` guard makes this safe against any
      // racing debit elsewhere — if the row doesn't update we abort the
      // transaction so the status flip is rolled back.
      let walletUpdated;
      if (updated.currency === "stars") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceStars:   sql`${walletsTable.balanceStars}   - ${amountNum}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amountNum}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceStars} >= ${amountNum}`,
        )).returning();
      } else if (updated.currency === "usdt") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceUsdt:    sql`${walletsTable.balanceUsdt}    - ${amountNum}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amountNum}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceUsdt} >= ${amountNum}`,
        )).returning();
      } else if (updated.currency === "ton") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceTon:     sql`${walletsTable.balanceTon}     - ${amountNum}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} + ${amountNum}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceTon} >= ${amountNum}`,
        )).returning();
      } else if (updated.currency === "skz") {
        [walletUpdated] = await tx.update(walletsTable).set({
          balanceSkz:        sql`${walletsTable.balanceSkz}        - ${amountNum}`,
          totalWithdrawnSkz: sql`${walletsTable.totalWithdrawnSkz} + ${amountNum}`,
        }).where(and(
          eq(walletsTable.userId, updated.userId),
          sql`${walletsTable.balanceSkz} >= ${amountNum}`,
        )).returning();
      } else {
        throw new Error(`Unsupported currency: ${updated.currency}`);
      }

      if (!walletUpdated) {
        throw new Error("Insufficient wallet balance at approval time");
      }

      return { error: null, updated };
    });

    if (result.error || !result.updated) {
      const status = result.error === "Withdrawal not found" ? 404 : 400;
      await logAdminAction(req, "admin", {
        action: "withdrawal.approve",
        targetType: "withdrawal",
        targetId: id,
        payload: { txHash },
        success: false,
        errorMessage: result.error ?? "Approval failed",
      });
      res.status(status).json({ error: result.error ?? "Approval failed" });
      return;
    }

    await logAdminAction(req, "admin", {
      action: "withdrawal.approve",
      targetType: "withdrawal",
      targetId: id,
      payload: {
        amount: result.updated.amount,
        currency: result.updated.currency,
        method: result.updated.method,
        txHash,
      },
    });

    // Tell the user their funds went out.
    void (async () => {
      const [u] = await db.select({ tid: usersTable.telegramId })
        .from(usersTable).where(eq(usersTable.id, result.updated.userId));
      if (u) {
        await notifyUser(
          String(u.tid),
          `✅ تمت الموافقة على طلب السحب #${id}\nالمبلغ: ${result.updated.amount} ${result.updated.currency.toUpperCase()}${txHash ? `\nهاش العملية: ${txHash}` : ""}`,
        );
      }
    })();

    res.json(result.updated);
  } catch (err) {
    await logAdminAction(req, "admin", {
      action: "withdrawal.approve",
      targetType: "withdrawal",
      targetId: id,
      payload: { txHash },
      success: false,
      errorMessage: err instanceof Error ? err.message : "Approval failed",
    });
    req.log.error({ err, id }, "Withdrawal approve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/withdrawals/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { reason } = req.body as { reason: string };

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid withdrawal id" });
    return;
  }

  // Atomic transition: only pending rows may be rejected.
  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "rejected", rejectedReason: reason, processedAt: new Date() })
    .where(
      and(
        eq(withdrawalsTable.id, id),
        eq(withdrawalsTable.status, "pending"),
      ),
    )
    .returning();

  if (!updated) {
    const [exists] = await db
      .select({ id: withdrawalsTable.id })
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, id));
    await logAdminAction(req, "admin", {
      action: "withdrawal.reject",
      targetType: "withdrawal",
      targetId: id,
      payload: { reason },
      success: false,
      errorMessage: exists ? "not_pending" : "not_found",
    });
    res.status(exists ? 400 : 404).json({
      error: exists ? "Can only reject pending withdrawals" : "Withdrawal not found",
    });
    return;
  }

  await logAdminAction(req, "admin", {
    action: "withdrawal.reject",
    targetType: "withdrawal",
    targetId: id,
    payload: { reason, amount: updated.amount, currency: updated.currency },
  });

  void (async () => {
    const [u] = await db.select({ tid: usersTable.telegramId })
      .from(usersTable).where(eq(usersTable.id, updated.userId));
    if (u) {
      await notifyUser(
        String(u.tid),
        `❌ تم رفض طلب السحب #${id}\nالمبلغ: ${updated.amount} ${updated.currency.toUpperCase()}${reason ? `\nالسبب: ${reason}` : ""}\nالرصيد لم يُخصم من محفظتك.`,
      );
    }
  })();

  res.json(updated);
});

export default router;
