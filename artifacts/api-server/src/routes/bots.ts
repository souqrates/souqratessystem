import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { botsTable } from "@workspace/db";
import { randomBytes } from "crypto";

const router: IRouter = Router();

router.get("/bots", async (_req, res): Promise<void> => {
  const [bots, countResult] = await Promise.all([
    db.select().from(botsTable).orderBy(botsTable.name),
    db.select({ count: sql<number>`count(*)` }).from(botsTable),
  ]);

  const safeBots = bots.map(({ apiKey: _k, webhookSecret: _s, ...rest }) => rest);

  res.json({
    data: safeBots,
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.get("/bots/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(eq(botsTable.slug, raw));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const { apiKey: _k, webhookSecret: _s, ...safeBot } = bot;
  res.json(safeBot);
});

router.post("/bots", async (req, res): Promise<void> => {
  const { slug, name, description, commissionRate } = req.body as {
    slug: string;
    name: string;
    description?: string;
    commissionRate?: string;
  };

  if (!slug || !name) {
    res.status(400).json({ error: "slug and name are required" });
    return;
  }

  const apiKey = randomBytes(32).toString("hex");
  const webhookSecret = randomBytes(32).toString("hex");

  const [bot] = await db
    .insert(botsTable)
    .values({
      slug,
      name,
      description: description ?? null,
      commissionRate: commissionRate ?? "0.1000",
      apiKey,
      webhookSecret,
    })
    .returning();

  const { webhookSecret: _s, ...safeBot } = bot;
  res.status(201).json({ ...safeBot, apiKey: bot.apiKey });
});

export default router;
