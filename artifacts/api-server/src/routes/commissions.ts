import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { commissionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/commissions", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const offset = (page - 1) * limit;
  const botSlug = req.query.botSlug as string | undefined;
  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;

  const conditions = [];
  if (botSlug) conditions.push(eq(commissionsTable.botSlug, botSlug));
  if (userId !== undefined && !isNaN(userId)) conditions.push(eq(commissionsTable.userId, userId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [commissions, countResult] = await Promise.all([
    db.select().from(commissionsTable)
      .where(whereClause)
      .orderBy(desc(commissionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(commissionsTable).where(whereClause),
  ]);

  res.json({
    data: commissions,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

export default router;
