import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, walletsTable, commissionsTable, botsTable, gameConfigsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const search = req.query.search as string | undefined;
  const offset = (page - 1) * limit;

  let query = db.select().from(usersTable).$dynamic();
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(usersTable).$dynamic();

  if (search) {
    const condition = or(
      ilike(usersTable.username, `%${search}%`),
      ilike(usersTable.firstName, `%${search}%`),
    );
    query = query.where(condition);
    countQuery = countQuery.where(condition);
  }

  const [users, countResult] = await Promise.all([
    query.orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  res.json({
    data: users,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

router.get("/users/:telegramId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.telegramId)
    ? req.params.telegramId[0]
    : req.params.telegramId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(raw)));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id));

  res.json({ user, wallet: wallet ?? null });
});

/**
 * GET /api/users/:telegramId/earnings-breakdown
 *
 * Returns this user's lifetime earnings split:
 *   - by bot   (totals per source bot — games, video, voice, …)
 *   - by game  (totals per specific gameId within games-bot)
 * Built from the `commissions` table where every row already carries
 * userId + botSlug + (optional) gameId + netAmount. The user message
 * "from this game I earned X, from this bot I earned Y" is rendered
 * straight from this single endpoint.
 */
router.get("/users/:telegramId/earnings-breakdown", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.telegramId) ? req.params.telegramId[0] : req.params.telegramId;

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(raw)));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const byBotRows = await db
    .select({
      botSlug:     commissionsTable.botSlug,
      totalNet:    sql<string>`COALESCE(SUM(${commissionsTable.netAmount}),    0)`,
      totalGross:  sql<string>`COALESCE(SUM(${commissionsTable.grossAmount}),  0)`,
      eventCount:  sql<number>`COUNT(*)::int`,
    })
    .from(commissionsTable)
    .where(eq(commissionsTable.userId, user.id))
    .groupBy(commissionsTable.botSlug);

  const byGameRows = await db
    .select({
      botSlug:    commissionsTable.botSlug,
      gameId:     commissionsTable.gameId,
      gameName:   gameConfigsTable.name,
      totalNet:   sql<string>`COALESCE(SUM(${commissionsTable.netAmount}),   0)`,
      totalGross: sql<string>`COALESCE(SUM(${commissionsTable.grossAmount}), 0)`,
      eventCount: sql<number>`COUNT(*)::int`,
    })
    .from(commissionsTable)
    .leftJoin(gameConfigsTable, eq(gameConfigsTable.gameId, commissionsTable.gameId))
    .where(and(
      eq(commissionsTable.userId, user.id),
      sql`${commissionsTable.gameId} IS NOT NULL`,
    ))
    .groupBy(commissionsTable.botSlug, commissionsTable.gameId, gameConfigsTable.name)
    .orderBy(desc(sql`SUM(${commissionsTable.netAmount})`));

  res.json({
    byBot: byBotRows.map(r => ({
      botSlug:    r.botSlug,
      totalNet:   r.totalNet,
      totalGross: r.totalGross,
      eventCount: r.eventCount,
    })),
    byGame: byGameRows.map(r => ({
      botSlug:    r.botSlug,
      gameId:     r.gameId,
      gameName:   r.gameName,
      totalNet:   r.totalNet,
      totalGross: r.totalGross,
      eventCount: r.eventCount,
    })),
  });
});

export default router;
