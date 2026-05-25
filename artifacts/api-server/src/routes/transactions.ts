import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { transactionsTable, botsTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * GET /transactions — list/filter the ledger.
 *
 * Auth: requires X-Bot-Api-Key (any active bot). The ledger contains private
 * financial data; without auth any visitor could enumerate every user's
 * transactions by iterating userId. Bots that need this on behalf of a user
 * (e.g. mother-bot "History" button) must forward the header.
 */
router.get("/transactions", async (req, res): Promise<void> => {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Bot-Api-Key header" });
    return;
  }
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  if (!bot || !bot.isActive) {
    res.status(403).json({ error: "Invalid or inactive bot API key" });
    return;
  }

  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const offset = (page - 1) * limit;
  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
  const sourceBot = req.query.sourceBot as string | undefined;
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (userId !== undefined && !isNaN(userId)) conditions.push(eq(transactionsTable.userId, userId));
  if (sourceBot) conditions.push(eq(transactionsTable.sourceBot, sourceBot));
  if (type) conditions.push(eq(transactionsTable.type, type));
  if (status) conditions.push(eq(transactionsTable.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [transactions, countResult] = await Promise.all([
    db.select().from(transactionsTable)
      .where(whereClause)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(whereClause),
  ]);

  res.json({
    data: transactions,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

export default router;
