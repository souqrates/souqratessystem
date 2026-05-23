import { Router, type IRouter } from "express";
import { eq, sql, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, botsTable, withdrawalsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats/overview", async (_req, res): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    usersCount,
    botsStats,
    activeBots,
    pendingWithdrawals,
    todayTransactions,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db
      .select({
        totalVolume: sql<string>`coalesce(sum(total_volume_usdt), 0)`,
        totalCommission: sql<string>`coalesce(sum(total_commission_usdt), 0)`,
      })
      .from(botsTable),
    db.select({ count: sql<number>`count(*)` }).from(botsTable).where(eq(botsTable.isActive, true)),
    db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`coalesce(sum(CASE WHEN currency = 'usdt' THEN amount::numeric ELSE 0 END), 0)`,
      })
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(gte(transactionsTable.createdAt, todayStart)),
  ]);

  const todayVolume = await db
    .select({
      total: sql<string>`coalesce(sum(CASE WHEN currency = 'usdt' AND type = 'credit' THEN amount::numeric ELSE 0 END), 0)`,
    })
    .from(transactionsTable)
    .where(gte(transactionsTable.createdAt, todayStart));

  res.json({
    totalUsers: Number(usersCount[0]?.count ?? 0),
    totalVolumeUsdt: String(botsStats[0]?.totalVolume ?? "0"),
    totalCommissionsUsdt: String(botsStats[0]?.totalCommission ?? "0"),
    pendingWithdrawals: Number(pendingWithdrawals[0]?.count ?? 0),
    pendingWithdrawalsAmountUsdt: String(pendingWithdrawals[0]?.totalAmount ?? "0"),
    activeBots: Number(activeBots[0]?.count ?? 0),
    todayTransactions: Number(todayTransactions[0]?.count ?? 0),
    todayVolumeUsdt: String(todayVolume[0]?.total ?? "0"),
  });
});

export default router;
