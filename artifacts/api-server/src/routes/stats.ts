import { Router, type IRouter } from "express";
import { eq, sql, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  transactionsTable,
  botsTable,
  withdrawalsTable,
  platformSettingsTable,
} from "@workspace/db";

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
    skzVolumeStats,
    skzSettings,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({
      totalVolume: sql<string>`coalesce(sum(total_volume_usdt), 0)`,
      totalCommission: sql<string>`coalesce(sum(total_commission_usdt), 0)`,
    }).from(botsTable),
    db.select({ count: sql<number>`count(*)` }).from(botsTable).where(eq(botsTable.isActive, true)),
    db.select({
      count: sql<number>`count(*)`,
    }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(gte(transactionsTable.createdAt, todayStart)),
    db.select({
      totalSkzVolume: sql<string>`coalesce(sum(CASE WHEN currency = 'skz' AND type = 'credit' THEN amount::numeric ELSE 0 END), 0)`,
      totalSkzCommission: sql<string>`coalesce(sum(CASE WHEN currency = 'skz' THEN fee::numeric ELSE 0 END), 0)`,
      todaySkzVolume: sql<string>`coalesce(sum(CASE WHEN currency = 'skz' AND type = 'credit' AND created_at >= ${todayStart} THEN amount::numeric ELSE 0 END), 0)`,
    }).from(transactionsTable),
    db.select().from(platformSettingsTable)
      .where(sql`key IN ('skz_per_usdt', 'skz_per_star', 'skz_per_ton')`),
  ]);

  const rateMap: Record<string, string> = {};
  for (const s of skzSettings) rateMap[s.key] = s.value;

  res.json({
    totalUsers: Number(usersCount[0]?.count ?? 0),
    totalVolumeSkz: String(skzVolumeStats[0]?.totalSkzVolume ?? "0"),
    totalVolumeUsdt: String(botsStats[0]?.totalVolume ?? "0"),
    totalCommissionsSkz: String(skzVolumeStats[0]?.totalSkzCommission ?? "0"),
    totalCommissionsUsdt: String(botsStats[0]?.totalCommission ?? "0"),
    pendingWithdrawals: Number(pendingWithdrawals[0]?.count ?? 0),
    activeBots: Number(activeBots[0]?.count ?? 0),
    todayTransactions: Number(todayTransactions[0]?.count ?? 0),
    skzRates: {
      skzPerUsdt: rateMap["skz_per_usdt"] ?? "100",
      skzPerStar: rateMap["skz_per_star"] ?? "1",
      skzPerTon: rateMap["skz_per_ton"] ?? "500",
      updatedAt: new Date().toISOString(),
    },
  });
});

export default router;
