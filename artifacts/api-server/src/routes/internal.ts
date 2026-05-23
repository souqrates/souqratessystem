import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  commissionsTable,
  platformSettingsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getBotByApiKey(apiKey: string) {
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  return bot ?? null;
}

async function requireBot(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1]
): Promise<typeof botsTable.$inferSelect | null> {
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

async function getSkzRates(): Promise<{ perUsdt: number; perStar: number; perTon: number }> {
  const settings = await db.select().from(platformSettingsTable)
    .where(sql`key IN ('skz_per_usdt', 'skz_per_star', 'skz_per_ton')`);
  const map: Record<string, number> = {};
  for (const s of settings) map[s.key] = parseFloat(s.value);
  return {
    perUsdt: map["skz_per_usdt"] ?? 100,
    perStar: map["skz_per_star"] ?? 1,
    perTon: map["skz_per_ton"] ?? 500,
  };
}

// Upsert user (called by child bots on each interaction)
router.post("/internal/users/upsert", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, username, firstName, lastName, languageCode, isPremium, referrerTelegramId } =
    req.body as {
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

  const finalWallet =
    wallet ??
    (await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id)))[0];

  req.log.info({ telegramId, botSlug: bot.slug }, "User upserted");
  res.json({ user, wallet: finalWallet });
});

// Deposit real currency → convert to SKZ (called by mother bot when user deposits)
router.post("/internal/deposit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, realCurrency, realAmount, description } = req.body as {
    telegramId: string;
    realCurrency: "usdt" | "stars" | "ton";
    realAmount: string;
    description: string;
  };

  if (!telegramId || !realCurrency || !realAmount || !description) {
    res.status(400).json({ error: "telegramId, realCurrency, realAmount, description are required" });
    return;
  }

  const realAmountNum = parseFloat(realAmount);
  if (isNaN(realAmountNum) || realAmountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found — call /internal/users/upsert first" });
    return;
  }

  const rates = await getSkzRates();
  let skzRate: number;
  if (realCurrency === "usdt") skzRate = rates.perUsdt;
  else if (realCurrency === "stars") skzRate = rates.perStar;
  else skzRate = rates.perTon;

  const skzAmount = realAmountNum * skzRate;

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId: user.id,
      type: "credit",
      currency: "skz",
      amount: String(skzAmount.toFixed(2)),
      fee: "0",
      status: "completed",
      sourceBot: bot.slug,
      description: `${description} (${realAmountNum} ${realCurrency.toUpperCase()} → ${skzAmount.toFixed(2)} SKZ)`,
    })
    .returning();

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id));
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }

  const newSkzBalance = (parseFloat(wallet.balanceSkz) + skzAmount).toFixed(2);
  const newTotalEarned = (parseFloat(wallet.totalEarnedSkz) + skzAmount).toFixed(2);

  // Also store real currency deposit
  let realBalanceUpdate = {};
  if (realCurrency === "usdt") {
    realBalanceUpdate = { balanceUsdt: String((parseFloat(wallet.balanceUsdt) + realAmountNum).toFixed(6)) };
  } else if (realCurrency === "stars") {
    realBalanceUpdate = { balanceStars: String(parseFloat(wallet.balanceStars) + realAmountNum) };
  } else {
    realBalanceUpdate = { balanceTon: String((parseFloat(wallet.balanceTon) + realAmountNum).toFixed(9)) };
  }

  await db.update(walletsTable).set({
    balanceSkz: newSkzBalance,
    totalEarnedSkz: newTotalEarned,
    ...realBalanceUpdate,
  }).where(eq(walletsTable.id, wallet.id));

  req.log.info({ telegramId, realCurrency, realAmount, skzAmount }, "Deposit converted to SKZ");

  res.json({
    success: true,
    transactionId: transaction.id,
    skzCredited: String(skzAmount.toFixed(2)),
    newSkzBalance,
    rateUsed: String(skzRate),
  });
});

// Credit SKZ to user (child bots give user SKZ for completing tasks/earning)
router.post("/internal/credit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amount, description, referenceId } = req.body as {
    telegramId: string;
    amount: string;
    description: string;
    referenceId?: string;
  };

  if (!telegramId || !amount || !description) {
    res.status(400).json({ error: "telegramId, amount, description are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
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
      currency: "skz",
      amount: String(amountNum.toFixed(2)),
      fee: String(commissionAmount.toFixed(2)),
      status: "completed",
      sourceBot: bot.slug,
      referenceId: referenceId ?? null,
      description,
    })
    .returning();

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id));
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }

  const newSkzBalance = (parseFloat(wallet.balanceSkz) + netAmount).toFixed(2);
  await db.update(walletsTable).set({
    balanceSkz: newSkzBalance,
    totalEarnedSkz: String((parseFloat(wallet.totalEarnedSkz) + netAmount).toFixed(2)),
  }).where(eq(walletsTable.id, wallet.id));

  await db.insert(commissionsTable).values({
    transactionId: transaction.id,
    botSlug: bot.slug,
    userId: user.id,
    grossAmount: String(amountNum.toFixed(2)),
    commissionRate: String(commissionRate),
    commissionAmount: String(commissionAmount.toFixed(2)),
    netAmount: String(netAmount.toFixed(2)),
    currency: "skz",
  });

  await db.update(botsTable).set({
    totalVolumeUsdt: sql`${botsTable.totalVolumeUsdt} + ${amountNum}`,
    totalCommissionUsdt: sql`${botsTable.totalCommissionUsdt} + ${commissionAmount}`,
  }).where(eq(botsTable.id, bot.id));

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, amount, skzNet: netAmount }, "SKZ credited");

  res.json({
    success: true,
    transactionId: transaction.id,
    newSkzBalance,
    commissionDeducted: String(commissionAmount.toFixed(2)),
  });
});

// Debit SKZ from user (child bots charge user SKZ for purchases/games)
router.post("/internal/debit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amount, description, referenceId } = req.body as {
    telegramId: string;
    amount: string;
    description: string;
    referenceId?: string;
  };

  if (!telegramId || !amount || !description) {
    res.status(400).json({ error: "telegramId, amount, description are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id));
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }

  const currentSkz = parseFloat(wallet.balanceSkz);
  if (currentSkz < amountNum) {
    res.status(400).json({ error: "Insufficient SKZ balance" });
    return;
  }

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId: user.id,
      type: "debit",
      currency: "skz",
      amount: String(-amountNum),
      fee: "0",
      status: "completed",
      sourceBot: bot.slug,
      referenceId: referenceId ?? null,
      description,
    })
    .returning();

  const newSkzBalance = (currentSkz - amountNum).toFixed(2);
  await db.update(walletsTable).set({ balanceSkz: newSkzBalance }).where(eq(walletsTable.id, wallet.id));

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, amount }, "SKZ debited");

  res.json({
    success: true,
    transactionId: transaction.id,
    newSkzBalance,
  });
});

export default router;
