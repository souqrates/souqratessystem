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

  const safeBots = bots.map(({ webhookSecret: _s, ...rest }) => rest);

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

router.patch("/bots/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const { name, description, commissionRate, isActive } = req.body as {
    name?: string;
    description?: string;
    commissionRate?: string;
    isActive?: boolean;
  };

  const [existing] = await db
    .select({ id: botsTable.id })
    .from(botsTable)
    .where(eq(botsTable.slug, raw));

  if (!existing) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const updates: Partial<typeof botsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (commissionRate !== undefined) {
    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      res.status(400).json({ error: "commissionRate must be a decimal between 0 and 1 (e.g. 0.05 = 5%)" });
      return;
    }
    updates.commissionRate = rate.toFixed(4);
  }
  if (isActive !== undefined) updates.isActive = isActive;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(botsTable)
    .set(updates)
    .where(eq(botsTable.slug, raw))
    .returning();

  const { apiKey: _k, webhookSecret: _s, ...safeBot } = updated;
  req.log.info({ slug: raw, updates }, "Bot updated");
  res.json(safeBot);
});

export default router;
