import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, walletsTable } from "@workspace/db";
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

export default router;
