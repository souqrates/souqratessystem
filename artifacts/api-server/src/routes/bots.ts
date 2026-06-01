import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { botsTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { requireAdmin } from "../lib/admin-auth";

const router: IRouter = Router();

router.get("/bots", async (_req, res): Promise<void> => {
  const [bots, countResult] = await Promise.all([
    db.select().from(botsTable).orderBy(botsTable.name),
    db.select({ count: sql<number>`count(*)` }).from(botsTable),
  ]);

  const safeBots = bots.map(({ webhookSecret: _s, apiKey: _k, ...rest }) => rest);

  res.json({
    data: safeBots,
    total: Number(countResult[0]?.count ?? 0),
  });
});

// Public endpoint: returns bot hub info (slug, name, botUsername, miniAppName)
// Used by mother-bot-web bots.html to build t.me links without auth.
router.get("/public/bots-hub", async (_req, res): Promise<void> => {
  const bots = await db
    .select({
      slug: botsTable.slug,
      name: botsTable.name,
      botUsername: botsTable.botUsername,
      miniAppName: botsTable.miniAppName,
      isActive: botsTable.isActive,
    })
    .from(botsTable)
    .orderBy(botsTable.id);

  res.json({ data: bots });
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

/**
 * POST /api/bots — register a new bot (admin-only).
 *
 * Idempotent: if a bot with the same slug already exists, we return 409
 * with the existing record (without apiKey) rather than minting a fresh
 * apiKey and silently breaking the running deployment.
 */
router.post("/bots", requireAdmin, async (req, res): Promise<void> => {
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

  const [existing] = await db
    .select()
    .from(botsTable)
    .where(eq(botsTable.slug, slug));

  if (existing) {
    const { apiKey: _k, webhookSecret: _s, ...safeBot } = existing;
    res.status(409).json({
      error: "Bot with this slug already exists",
      bot: safeBot,
    });
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

  // Only echo apiKey on first creation — never again.
  const { webhookSecret: _s, ...safeBot } = bot;
  res.status(201).json({ ...safeBot, apiKey: bot.apiKey });
});

router.patch("/bots/:slug", requireAdmin, async (req, res): Promise<void> => {
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
