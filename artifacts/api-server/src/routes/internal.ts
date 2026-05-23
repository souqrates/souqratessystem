import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  commissionsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getBotByApiKey(apiKey: string) {
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(eq(botsTable.apiKey, apiKey));
  return bot ?? null;
}

async function requireBot(req: Parameters<Parameters<typeof router.post>[1]>[0], res: Parameters<Parameters<typeof router.post>[1]>[1]): Promise<typeof botsTable.$inferSelect | null> {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Bot-Api-Key header" });
    return null;
  }
  const bot = await getBotByApiKey(apiKey);
  if (!bot || !bot.isActive) {
    res.status(403).json({ error: "Invalid or inactive bot API key" });
    return null;
  }
  return bot;
}

router.post("/internal/users/upsert", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, username, firstName, lastName, languageCode, isPremium, referrerTelegramId } = req.body as {
    telegramId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    languageCode?: string;
    isPremium?: boolean;
    referrerTelegramId?: string;
  };

  if (!telegramId || !firstName) {
    res.status(400).json({ error: "telegramId and firstName are required" });
    return;
  }

  let referrerId: number | null = null;
  if (referrerTelegramId && referrerTelegramId !== telegramId) {
    const [referrer] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.telegramId, BigInt(referrerTelegramId)));
    referrerId = referrer?.id ?? null;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      telegramId: BigInt(telegramId),
      username: username ?? null,
      firstName,
      lastName: lastName ?? null,
      languageCode: languageCode ?? "ar",
      isPremium: isPremium ?? false,
      referrerId,
    })
    .onConflictDoUpdate({
      target: usersTable.telegramId,
      set: {
        username: username ?? null,
        firstName,
        lastName: lastName ?? null,
        isPremium: isPremium ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();

  const [wallet] = await db
    .insert(walletsTable)
    .values({ userId: user.id })
    .onConflictDoNothing()
    .returning();

  const finalWallet = wallet ?? (await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id)))[0];

  req.log.info({ telegramId, botSlug: bot.slug }, "User upserted via internal API");
  res.json({ user, wallet: finalWallet });
});

router.post("/internal/credit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, currency, amount, description, referenceId } = req.body as {
    telegramId: string;
    currency: "stars" | "usdt" | "ton";
    amount: string;
    description: string;
    referenceId?: string;
  };

  if (!telegramId || !currency || !amount || !description) {
    res.status(400).json({ error: "telegramId, currency, amount, and description are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found — call /internal/users/upsert first" });
    return;
  }

  const commissionRate = parseFloat(String(bot.commissionRate));
  const commissionAmount = amountNum * commissionRate;
  const netAmount = amountNum - commissionAmount;

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId: user.id,
      type: "credit",
      currency,
      amount: String(amountNum),
      fee: String(commissionAmount.toFixed(9)),
      status: "completed",
      sourceBot: bot.slug,
      referenceId: referenceId ?? null,
      description,
    })
    .returning();

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }

  let newBalance: string;
  if (currency === "stars") {
    newBalance = String(parseFloat(wallet.balanceStars) + netAmount);
    await db.update(walletsTable).set({
      balanceStars: newBalance,
      totalEarned: String(parseFloat(wallet.totalEarned) + netAmount),
    }).where(eq(walletsTable.id, wallet.id));
  } else if (currency === "usdt") {
    newBalance = String((parseFloat(wallet.balanceUsdt) + netAmount).toFixed(6));
    await db.update(walletsTable).set({
      balanceUsdt: newBalance,
      totalEarned: String((parseFloat(wallet.totalEarned) + netAmount).toFixed(6)),
    }).where(eq(walletsTable.id, wallet.id));
  } else {
    newBalance = String((parseFloat(wallet.balanceTon) + netAmount).toFixed(9));
    await db.update(walletsTable).set({
      balanceTon: newBalance,
      totalEarned: String((parseFloat(wallet.totalEarned) + netAmount).toFixed(9)),
    }).where(eq(walletsTable.id, wallet.id));
  }

  await db.insert(commissionsTable).values({
    transactionId: transaction.id,
    botSlug: bot.slug,
    userId: user.id,
    grossAmount: String(amountNum),
    commissionRate: String(commissionRate),
    commissionAmount: String(commissionAmount.toFixed(9)),
    netAmount: String(netAmount.toFixed(9)),
    currency,
  });

  await db.update(botsTable).set({
    totalVolumeUsdt: sql`${botsTable.totalVolumeUsdt} + ${amountNum}`,
    totalCommissionUsdt: sql`${botsTable.totalCommissionUsdt} + ${commissionAmount}`,
  }).where(eq(botsTable.id, bot.id));

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, userId: user.id, amount, currency }, "Credit applied");

  res.json({
    success: true,
    transactionId: transaction.id,
    newBalance,
    commissionDeducted: String(commissionAmount.toFixed(9)),
  });
});

router.post("/internal/debit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, currency, amount, description, referenceId } = req.body as {
    telegramId: string;
    currency: "stars" | "usdt" | "ton";
    amount: string;
    description: string;
    referenceId?: string;
  };

  if (!telegramId || !currency || !amount || !description) {
    res.status(400).json({ error: "telegramId, currency, amount, and description are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }

  let currentBalance = 0;
  if (currency === "stars") currentBalance = parseFloat(wallet.balanceStars);
  else if (currency === "usdt") currentBalance = parseFloat(wallet.balanceUsdt);
  else if (currency === "ton") currentBalance = parseFloat(wallet.balanceTon);

  if (currentBalance < amountNum) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId: user.id,
      type: "debit",
      currency,
      amount: String(-amountNum),
      fee: "0",
      status: "completed",
      sourceBot: bot.slug,
      referenceId: referenceId ?? null,
      description,
    })
    .returning();

  let newBalance: string;
  if (currency === "stars") {
    newBalance = String(parseFloat(wallet.balanceStars) - amountNum);
    await db.update(walletsTable).set({ balanceStars: newBalance }).where(eq(walletsTable.id, wallet.id));
  } else if (currency === "usdt") {
    newBalance = String((parseFloat(wallet.balanceUsdt) - amountNum).toFixed(6));
    await db.update(walletsTable).set({ balanceUsdt: newBalance }).where(eq(walletsTable.id, wallet.id));
  } else {
    newBalance = String((parseFloat(wallet.balanceTon) - amountNum).toFixed(9));
    await db.update(walletsTable).set({ balanceTon: newBalance }).where(eq(walletsTable.id, wallet.id));
  }

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, userId: user.id, amount, currency }, "Debit applied");

  res.json({
    success: true,
    transactionId: transaction.id,
    newBalance,
  });
});

export default router;
