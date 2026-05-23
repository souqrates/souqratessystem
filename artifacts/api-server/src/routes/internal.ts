import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, sql, inArray, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  commissionsTable,
  platformSettingsTable,
  withdrawalsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { getSkzRates, getReferralRates, distributeReferralBonuses } from "../lib/finance";

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

// getSkzRates, getReferralRates, distributeReferralBonuses are imported from ../lib/finance

// ─────────────────────────────────────────────────────────────────────────────
// Upsert user (called by child bots on each interaction)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/balance/:telegramId — fetch wallet balances by Telegram ID
// ─────────────────────────────────────────────────────────────────────────────
router.get("/internal/balance/:telegramId", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const rawId = Array.isArray(req.params.telegramId) ? req.params.telegramId[0] : req.params.telegramId;

  let bigId: bigint;
  try { bigId = BigInt(rawId); } catch {
    res.status(400).json({ error: "Invalid telegramId" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, bigId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.json({
    telegramId: String(user.telegramId),
    userId: user.id,
    balanceSkz: wallet.balanceSkz,
    balanceStars: wallet.balanceStars,
    balanceTon: wallet.balanceTon,
    balanceUsdt: wallet.balanceUsdt,
    totalEarnedSkz: wallet.totalEarnedSkz,
    totalWithdrawnSkz: wallet.totalWithdrawnSkz,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/ledger/:telegramId — transaction history by Telegram ID
// ─────────────────────────────────────────────────────────────────────────────
router.get("/internal/ledger/:telegramId", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const rawId = Array.isArray(req.params.telegramId) ? req.params.telegramId[0] : req.params.telegramId;

  let bigId: bigint;
  try { bigId = BigInt(rawId); } catch {
    res.status(400).json({ error: "Invalid telegramId" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.telegramId, bigId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const conditions = [
    eq(transactionsTable.userId, user.id),
    eq(transactionsTable.sourceBot, bot.slug),
  ];

  const transactions = await db.select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: transactions, limit, offset });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/deposit — deposit real currency → SKZ
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/deposit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, currency, amount, description, referenceId } = req.body as {
    telegramId: string;
    currency: "usdt" | "stars" | "ton";
    amount: string;
    description?: string;
    referenceId?: string;
  };

  if (!telegramId || !currency || !amount) {
    res.status(400).json({ error: "telegramId, currency, amount are required" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const validCurrencies = ["usdt", "stars", "ton"];
  if (!validCurrencies.includes(currency)) {
    res.status(400).json({ error: "currency must be usdt, stars, or ton" });
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

  const rates = await getSkzRates();
  const rateMap: Record<string, number> = {
    usdt: rates.perUsdt,
    stars: rates.perStar,
    ton: rates.perTon,
  };
  const skzRate = rateMap[currency]!;
  const skzAmount = amountNum * skzRate;

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId: user.id,
      type: "deposit",
      currency: "skz",
      amount: String(skzAmount.toFixed(2)),
      fee: "0",
      status: "completed",
      sourceBot: bot.slug,
      referenceId: referenceId ?? null,
      description: description ?? `إيداع ${amountNum} ${currency.toUpperCase()} = ${skzAmount.toFixed(0)} SKZ`,
      metadata: JSON.stringify({ originalCurrency: currency, originalAmount: amountNum, skzRate }),
    })
    .returning();

  // Atomic balance increment via SQL — defeats lost-update races between
  // concurrent deposits/credits/debits on the same wallet row.
  const [wallet] = await db.update(walletsTable).set({
    balanceSkz:     sql`${walletsTable.balanceSkz}     + ${skzAmount}`,
    totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${skzAmount}`,
  }).where(eq(walletsTable.userId, user.id)).returning();
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }
  const newSkzBalance = wallet.balanceSkz;

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, currency, amount, skzAmount }, "Deposit processed");

  res.json({
    success: true,
    transactionId: transaction.id,
    skzCredited: String(skzAmount.toFixed(2)),
    newSkzBalance,
    rateUsed: String(skzRate),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/credit — credit SKZ with commission + referral bonuses
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/credit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amount, description, referenceId, metadata } = req.body as {
    telegramId: string;
    amount: string;
    description: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
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
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning();

  // Atomic SQL increment — safe under concurrent credits.
  const [wallet] = await db.update(walletsTable).set({
    balanceSkz:     sql`${walletsTable.balanceSkz}     + ${netAmount}`,
    totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${netAmount}`,
  }).where(eq(walletsTable.userId, user.id)).returning();
  if (!wallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }
  const newSkzBalance = wallet.balanceSkz;

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

  const referralRates = await getReferralRates();
  const referralBonuses = await distributeReferralBonuses(
    user.id,
    netAmount,
    transaction.id,
    bot.slug,
    referralRates
  );

  req.log.info(
    { transactionId: transaction.id, botSlug: bot.slug, amount, skzNet: netAmount, referralBonuses },
    "SKZ credited with referral bonuses distributed"
  );

  res.json({
    success: true,
    transactionId: transaction.id,
    newSkzBalance,
    commissionDeducted: String(commissionAmount.toFixed(2)),
    referralBonuses: referralBonuses.map((b) => ({
      level: b.level,
      bonusSkz: String(b.bonus),
      percent: String((referralRates[b.level - 1]! * 100).toFixed(1)),
    })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/debit — debit SKZ from user wallet
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/debit", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amount, description, referenceId, metadata } = req.body as {
    telegramId: string;
    amount: string;
    description: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
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

  // Atomic conditional debit: only succeeds when balance is sufficient.
  // This single SQL statement defeats the time-of-check/time-of-use race
  // that would otherwise let two concurrent debits both pass an in-memory
  // balance check and overdraw the wallet.
  const [wallet] = await db.update(walletsTable).set({
    balanceSkz: sql`${walletsTable.balanceSkz} - ${amountNum}`,
  }).where(and(
    eq(walletsTable.userId, user.id),
    sql`${walletsTable.balanceSkz} >= ${amountNum}`,
  )).returning();
  if (!wallet) {
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
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning();

  const newSkzBalance = wallet.balanceSkz;

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, amount }, "SKZ debited");

  res.json({
    success: true,
    transactionId: transaction.id,
    newSkzBalance,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/game/charge-entry — debit for game entry with game metadata
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /internal/game/charge-entry
 * Body: { telegramId, gameId, amount }
 *
 * Security: `amount` must match one of the server-configured tier fees.
 * The expected prize (entryFee × multiplier) is stored in metadata so the
 * credit-reward endpoint can look it up — the client never supplies the prize.
 */
router.post("/internal/game/charge-entry", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, gameId, amount } = req.body as {
    telegramId: string;
    gameId: string | number;
    amount: string | number;
  };

  if (!telegramId || gameId === undefined || gameId === null || amount === undefined) {
    res.status(400).json({ error: "telegramId, gameId, amount are required" });
    return;
  }

  const amountNum = parseFloat(String(amount));
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  // ── Validate amount against server-configured tier fees ──────────────────
  const tierSettings = await db.select().from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, [
      "solo_entry_fee_easy", "solo_entry_fee_medium", "solo_entry_fee_hard", "solo_multiplier",
    ]));
  const tsMap: Record<string, string> = {};
  for (const r of tierSettings) tsMap[r.key] = r.value;
  const multiplier   = parseFloat(tsMap["solo_multiplier"] ?? "3");
  const allowedFees  = [
    parseFloat(tsMap["solo_entry_fee_easy"]   ?? "5"),
    parseFloat(tsMap["solo_entry_fee_medium"] ?? "10"),
    parseFloat(tsMap["solo_entry_fee_hard"]   ?? "15"),
  ];
  const matchedFee   = allowedFees.find(f => Math.abs(f - amountNum) < 0.001);
  if (matchedFee === undefined) {
    res.status(400).json({ error: `amount must be one of the configured tier fees: ${allowedFees.join(", ")} SKZ` });
    return;
  }
  const entryFee      = matchedFee;
  const expectedPrize = parseFloat((entryFee * multiplier).toFixed(2));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Atomic conditional debit for entry fee — fails fast with
  // insufficient_balance if the wallet can't cover the fee, with no
  // window for a concurrent debit to overdraw.
  const [wallet] = await db.update(walletsTable).set({
    balanceSkz: sql`${walletsTable.balanceSkz} - ${entryFee}`,
  }).where(and(
    eq(walletsTable.userId, user.id),
    sql`${walletsTable.balanceSkz} >= ${entryFee}`,
  )).returning();
  if (!wallet) {
    res.status(400).json({ error: "insufficient_balance" });
    return;
  }

  // Determine minimum game duration from tier difficulty (stored server-side, immutable)
  const easyFee   = parseFloat(tsMap["solo_entry_fee_easy"]   ?? "5");
  const hardFee   = parseFloat(tsMap["solo_entry_fee_hard"]   ?? "15");
  const difficulty = Math.abs(entryFee - easyFee) < 0.001 ? "Easy"
                   : Math.abs(entryFee - hardFee) < 0.001 ? "Hard"
                   : "Medium";
  const minDurationMs = difficulty === "Easy" ? 25_000 : difficulty === "Hard" ? 45_000 : 35_000;
  const minWinScore   = 1; // any positive score proves the game was actually played

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId:      user.id,
      type:        "debit",
      currency:    "skz",
      amount:      String(-entryFee),
      fee:         "0",
      status:      "completed",
      sourceBot:   bot.slug,
      referenceId: `game_entry_${gameId}_${Date.now()}`,
      description: `رسوم دخول لعبة #${gameId}`,
      metadata:    JSON.stringify({
        gameId:         String(gameId),
        action:         "entry",
        entryFee,
        expectedPrize,
        multiplier,
        difficulty,
        minDurationMs, // minimum elapsed time before result can be validated
        minWinScore,   // minimum score (server-side win condition)
      }),
    })
    .returning();

  const newSkzBalance = wallet.balanceSkz;

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, gameId, entryFee, expectedPrize }, "Game entry charged");

  res.json({
    success:       true,
    transactionId: transaction.id,
    entryFee,
    expectedPrize,
    newSkzBalance,
  });
});

// ─── Result token helpers (bind a game win to a specific charge + user) ──────

function getResultTokenSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw Object.assign(new Error("SESSION_SECRET is not configured"), { status: 503 });
  return s;
}

function issueResultToken(chargeId: number, userId: number): string {
  const secret = getResultTokenSecret();
  const exp = Date.now() + 10 * 60 * 1000; // 10-minute window
  const payload = `${chargeId}:${userId}:${exp}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

function verifyResultToken(token: string, chargeId: number, userId: number): boolean {
  try {
    const secret = getResultTokenSecret();
    const parts = token.split(":");
    if (parts.length !== 4) return false;
    const [cStr, uStr, expStr, hmac] = parts;
    if (parseInt(cStr, 10) !== chargeId) return false;
    if (parseInt(uStr, 10) !== userId) return false;
    if (Date.now() > parseInt(expStr, 10)) return false; // expired
    const expected = crypto.createHmac("sha256", secret).update(`${cStr}:${uStr}:${expStr}`).digest("hex");
    const hBuf = Buffer.from(hmac, "hex");
    const eBuf = Buffer.from(expected, "hex");
    if (hBuf.length !== eBuf.length) return false;
    return crypto.timingSafeEqual(hBuf, eBuf);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/game/validate-result
// Body: { telegramId, chargeTransactionId, score? }
//
// Called by the game client after the game ends. Verifies the charge belongs
// to the user and has not already been credited, then issues a short-lived
// signed resultToken that is required by /internal/game/credit-reward.
// Without this token, credit-reward rejects the request.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/game/validate-result", async (req, res): Promise<void> => {
  // Fail closed if SESSION_SECRET is missing — no financial ops without it
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({ error: "Server misconfiguration: SESSION_SECRET is required" });
    return;
  }

  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, chargeTransactionId, score } = req.body as {
    telegramId: string;
    chargeTransactionId: number | string;
    score?: number | string;
  };

  if (!telegramId || chargeTransactionId === undefined || chargeTransactionId === null) {
    res.status(400).json({ error: "telegramId and chargeTransactionId are required" });
    return;
  }
  const chargeId    = parseInt(String(chargeTransactionId), 10);
  const scoreNum    = score !== undefined && score !== null ? parseInt(String(score), 10) : NaN;
  if (isNaN(chargeId) || chargeId <= 0) {
    res.status(400).json({ error: "Invalid chargeTransactionId" });
    return;
  }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [chargeTxn] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.id, chargeId));
  if (!chargeTxn) {
    res.status(404).json({ error: "Charge transaction not found" });
    return;
  }
  if (chargeTxn.userId !== user.id) {
    res.status(403).json({ error: "Transaction does not belong to calling user" });
    return;
  }
  if (chargeTxn.sourceBot !== bot.slug) {
    res.status(400).json({ error: "Transaction is not from this bot" });
    return;
  }

  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(chargeTxn.metadata ?? "{}"); } catch { /* ignore */ }
  if (meta.action !== "entry") {
    res.status(400).json({ error: "Transaction is not a game entry charge" });
    return;
  }

  // ── Server-side win conditions (values stored at charge time, immutable) ──
  const minWinScore   = typeof meta.minWinScore   === "number" ? meta.minWinScore   : 1;
  const minDurationMs = typeof meta.minDurationMs === "number" ? meta.minDurationMs : 25_000;

  // 1. Score must meet server-stored win threshold
  if (isNaN(scoreNum) || scoreNum < minWinScore) {
    res.status(403).json({
      error: `Win condition not met: score must be at least ${minWinScore}`,
      minWinScore,
    });
    return;
  }

  // 2. Minimum game duration must have elapsed since charge (prevents instant farming)
  const chargeAgeMs = Date.now() - new Date(chargeTxn.createdAt).getTime();
  if (chargeAgeMs < minDurationMs) {
    const remainingMs = minDurationMs - chargeAgeMs;
    res.status(403).json({
      error: `Game duration not met: ${Math.ceil(remainingMs / 1000)}s remaining`,
      remainingMs,
    });
    return;
  }

  // 3. Not already credited
  const creditRefId = `game_reward_ref_${chargeId}`;
  const [alreadyCredited] = await db.select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.referenceId, creditRefId)))
    .limit(1);
  if (alreadyCredited) {
    res.status(409).json({ error: "Game session already credited" });
    return;
  }

  const resultToken = issueResultToken(chargeId, user.id);
  req.log.info(
    { chargeId, userId: user.id, botSlug: bot.slug, score: scoreNum, chargeAgeMs },
    "Game result token issued",
  );
  res.json({ ok: true, resultToken });
});

/**
 * POST /internal/game/credit-reward
 * Body: { telegramId, chargeTransactionId, score?, resultToken }
 *
 * Security guards:
 *   1. resultToken must be a valid HMAC-signed token from /validate-result (10-min TTL).
 *   2. chargeTransactionId must belong to telegramId's user account.
 *   3. Transaction must be a game "entry" debit with expectedPrize in metadata.
 *   4. Atomic: double-claim prevented with pg_advisory_xact_lock + db.transaction().
 *
 * Prize is read from stored charge metadata — never from the client.
 * Commission and referral bonuses applied automatically.
 */
router.post("/internal/game/credit-reward", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, chargeTransactionId, score, resultToken } = req.body as {
    telegramId: string;
    chargeTransactionId: number | string;
    score?: number;
    resultToken?: string;
  };

  if (!telegramId || chargeTransactionId === undefined || chargeTransactionId === null) {
    res.status(400).json({ error: "telegramId and chargeTransactionId are required" });
    return;
  }
  if (!resultToken) {
    res.status(400).json({ error: "resultToken is required — call /internal/game/validate-result first to prove game completion" });
    return;
  }

  const chargeId = parseInt(String(chargeTransactionId), 10);
  if (isNaN(chargeId) || chargeId <= 0) {
    res.status(400).json({ error: "Invalid chargeTransactionId" });
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

  // ── 1. Verify result token (proves game completed, binds chargeId + userId) ─
  if (!verifyResultToken(resultToken, chargeId, user.id)) {
    res.status(403).json({ error: "Invalid or expired resultToken" });
    return;
  }

  // ── 2. Fetch + validate charge transaction ────────────────────────────────
  const [chargeTxn] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.id, chargeId));

  if (!chargeTxn) {
    res.status(404).json({ error: "Charge transaction not found" });
    return;
  }
  if (chargeTxn.userId !== user.id) {
    res.status(403).json({ error: "Transaction does not belong to calling user" });
    return;
  }
  if (chargeTxn.sourceBot !== bot.slug) {
    res.status(400).json({ error: "Transaction is not from this bot" });
    return;
  }

  // ── 3. Extract server-stored prize from metadata ──────────────────────────
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(chargeTxn.metadata ?? "{}"); } catch { /* ignore */ }
  if (meta.action !== "entry" || typeof meta.expectedPrize !== "number") {
    res.status(400).json({ error: "Transaction is not a valid game entry charge" });
    return;
  }
  const grossPrize = meta.expectedPrize as number;
  const gameId     = meta.gameId ?? "?";

  // ── 4. Commission ─────────────────────────────────────────────────────────
  const commissionRate   = parseFloat(String(bot.commissionRate));
  const commissionAmount = parseFloat((grossPrize * commissionRate).toFixed(2));
  const netAmount        = parseFloat((grossPrize - commissionAmount).toFixed(2));

  const creditRefId = `game_reward_ref_${chargeId}`;

  // ── 5. Atomic check + insert + wallet update (advisory lock prevents races) ─
  let transaction: typeof transactionsTable.$inferSelect;
  let newSkzBalance: string;

  try {
    const result = await db.transaction(async (tx) => {
      // Serialize concurrent credits for the same game session
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${chargeId})`);

      const [existing] = await tx.select({ id: transactionsTable.id })
        .from(transactionsTable)
        .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.referenceId, creditRefId)))
        .limit(1);
      if (existing) throw Object.assign(new Error("ALREADY_CREDITED"), { status: 409 });

      // Symmetric guard: if the entry was already refunded for this
      // charge, the game session is terminal and may not be rewarded.
      // Pairs with the analogous check in /internal/game/refund-entry
      // so neither (reward→refund) nor (refund→reward) can double-pay.
      const refundRefId = `refund_${chargeId}`;
      const [refunded] = await tx.select({ id: transactionsTable.id })
        .from(transactionsTable)
        .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.referenceId, refundRefId)))
        .limit(1);
      if (refunded) throw Object.assign(new Error("ALREADY_REFUNDED"), { status: 409 });

      const [txn] = await tx
        .insert(transactionsTable)
        .values({
          userId:      user.id,
          type:        "credit",
          currency:    "skz",
          amount:      String(grossPrize.toFixed(2)),
          fee:         String(commissionAmount.toFixed(2)),
          status:      "completed",
          sourceBot:   bot.slug,
          referenceId: creditRefId,
          description: `جائزة لعبة #${gameId}${score != null ? ` — نقاط: ${score}` : ""}`,
          metadata:    JSON.stringify({
            gameId, action: "reward",
            grossPrize, commissionRate, commissionAmount, netAmount,
            score: score ?? null, chargeTransactionId: chargeId,
          }),
        })
        .returning();

      const [wlt] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
      if (!wlt) throw new Error("WALLET_NOT_FOUND");

      const bal = (parseFloat(wlt.balanceSkz) + netAmount).toFixed(2);
      await tx.update(walletsTable).set({
        balanceSkz:     bal,
        totalEarnedSkz: String((parseFloat(wlt.totalEarnedSkz) + netAmount).toFixed(2)),
      }).where(eq(walletsTable.id, wlt.id));

      return { txn, newBalance: bal };
    });

    transaction   = result.txn;
    newSkzBalance = result.newBalance;
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    if (e.message === "ALREADY_CREDITED") {
      res.status(409).json({ error: "Reward already credited for this game session" });
      return;
    }
    if (e.message === "ALREADY_REFUNDED") {
      res.status(409).json({ error: "Game session already refunded — reward refused" });
      return;
    }
    req.log.error({ err }, "credit-reward transaction failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // ── 6. Record commission ──────────────────────────────────────────────────
  await db.insert(commissionsTable).values({
    transactionId:    transaction.id,
    botSlug:          bot.slug,
    userId:           user.id,
    grossAmount:      String(grossPrize.toFixed(2)),
    commissionRate:   String(commissionRate),
    commissionAmount: String(commissionAmount.toFixed(2)),
    netAmount:        String(netAmount.toFixed(2)),
    currency:         "skz",
  });

  await db.update(botsTable).set({
    totalVolumeUsdt:     sql`${botsTable.totalVolumeUsdt}     + ${grossPrize}`,
    totalCommissionUsdt: sql`${botsTable.totalCommissionUsdt} + ${commissionAmount}`,
  }).where(eq(botsTable.id, bot.id));

  // ── 7. Distribute referral bonuses ────────────────────────────────────────
  const referralRates   = await getReferralRates();
  const referralBonuses = await distributeReferralBonuses(
    user.id, netAmount, transaction.id, bot.slug, referralRates,
  );

  req.log.info(
    { transactionId: transaction.id, botSlug: bot.slug, gameId, grossPrize, netAmount, score, referralBonuses: referralBonuses.length },
    "Game reward credited",
  );

  res.json({
    success:            true,
    transactionId:      transaction.id,
    newSkzBalance,
    commissionDeducted: String(commissionAmount.toFixed(2)),
    netRewarded:        String(netAmount.toFixed(2)),
    referralBonuses:    referralBonuses.map(b => ({ level: b.level, bonusSkz: String(b.bonus) })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/game/tiers — solo fee tiers (no bot auth required — public info)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/internal/game/tiers", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(platformSettingsTable)
      .where(inArray(platformSettingsTable.key, [
        "solo_entry_fee_easy", "solo_entry_fee_medium", "solo_entry_fee_hard", "solo_multiplier",
      ]));
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    const multiplier = parseFloat(map["solo_multiplier"] ?? "3");
    const tiers = [
      { difficulty: "Easy",   entryFee: parseFloat(map["solo_entry_fee_easy"]   ?? "5"),  multiplier, isDefault: false },
      { difficulty: "Medium", entryFee: parseFloat(map["solo_entry_fee_medium"] ?? "10"), multiplier, isDefault: true  },
      { difficulty: "Hard",   entryFee: parseFloat(map["solo_entry_fee_hard"]   ?? "15"), multiplier, isDefault: false },
    ];
    res.json({ tiers });
  } catch (err) {
    logger.error({ err }, "internal: game tiers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/stars-invoice — create Telegram Stars deposit invoice
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/stars-invoice", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amountStars } = req.body as {
    telegramId: string;
    amountStars: number;
  };

  if (!telegramId || !amountStars) {
    res.status(400).json({ error: "telegramId and amountStars are required" });
    return;
  }

  const starsNum = parseInt(String(amountStars), 10);
  if (isNaN(starsNum) || starsNum <= 0) {
    res.status(400).json({ error: "Invalid amountStars" });
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

  const botToken = process.env.MOTHER_BOT_TOKEN;
  if (!botToken) {
    res.status(503).json({ error: "Bot token not configured" });
    return;
  }

  const rates = await getSkzRates();
  const skzAmount = starsNum * rates.perStar;

  const payload = `stars_dep_${user.id}_${Date.now()}`;
  const invoiceBody = {
    chat_id: String(telegramId),
    title: "SKZ Top-up",
    description: `${starsNum} Telegram Stars → ${skzAmount.toFixed(0)} SKZ`,
    payload,
    currency: "XTR",
    prices: [{ label: "SKZ Top-up", amount: starsNum }],
  };

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoiceBody),
    });
    const tgData = await tgRes.json() as { ok: boolean; result?: string; description?: string };
    if (!tgData.ok) {
      req.log.warn({ tgError: tgData.description }, "Failed to create Telegram Stars invoice");
      res.status(502).json({ error: tgData.description ?? "Failed to create invoice" });
      return;
    }

    await db.insert(transactionsTable).values({
      userId: user.id,
      type: "deposit",
      currency: "stars",
      amount: String(starsNum),
      fee: "0",
      status: "pending",
      sourceBot: bot.slug,
      referenceId: payload,
      description: `فاتورة Stars: ${starsNum} نجمة → ${skzAmount.toFixed(0)} SKZ`,
      metadata: JSON.stringify({ amountStars: starsNum, expectedSkz: skzAmount, payload }),
    });

    req.log.info({ telegramId, starsNum, skzAmount, payload }, "Stars invoice created");

    res.json({
      ok: true,
      invoiceLink: tgData.result,
      payload,
      expectedSkz: String(skzAmount.toFixed(2)),
    });
  } catch (err) {
    req.log.error({ err }, "Stars invoice creation failed");
    res.status(500).json({ error: "Failed to create Stars invoice" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/ton-deposit-intent — create TON deposit intent with unique memo
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/ton-deposit-intent", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amountTon } = req.body as {
    telegramId: string;
    amountTon: number;
  };

  if (!telegramId || !amountTon) {
    res.status(400).json({ error: "telegramId and amountTon are required" });
    return;
  }

  const tonNum = parseFloat(String(amountTon));
  if (isNaN(tonNum) || tonNum <= 0) {
    res.status(400).json({ error: "Invalid amountTon" });
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

  const rates = await getSkzRates();
  const expectedSkz = tonNum * rates.perTon;

  const memo = `SKZ${user.id}T${Date.now().toString(36).toUpperCase()}`;
  const depositAddress = process.env.TON_HOT_WALLET ?? "";

  const [transaction] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    currency: "ton",
    amount: String(tonNum),
    fee: "0",
    status: "pending",
    sourceBot: bot.slug,
    referenceId: memo,
    description: `TON إيداع: ${tonNum} TON → ${expectedSkz.toFixed(0)} SKZ`,
    metadata: JSON.stringify({ amountTon: tonNum, expectedSkz, memo, depositAddress }),
  }).returning();

  req.log.info({ telegramId, tonNum, expectedSkz, memo }, "TON deposit intent created");

  res.json({
    ok: true,
    intentId: transaction.id,
    memo,
    depositAddress,
    amountTon: tonNum,
    expectedSkz: String(expectedSkz.toFixed(2)),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/withdraw — create a pending withdrawal request for a user
// Accepts: { telegramId, methodCode, amountSkz, destination? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/withdraw", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, methodCode, amountSkz, destination } = req.body as {
    telegramId: string;
    methodCode: string;
    amountSkz: string | number;
    destination?: Record<string, unknown>;
  };

  if (!telegramId || !methodCode || amountSkz === undefined || amountSkz === null) {
    res.status(400).json({ error: "telegramId, methodCode, amountSkz are required" });
    return;
  }

  const amountNum = parseFloat(String(amountSkz));
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amountSkz" });
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

  // Do NOT pre-deduct — balance is deducted when admin approves the withdrawal.
  // This prevents permanent fund loss if the withdrawal is rejected.
  const addressStr = destination && Object.keys(destination).length > 0
    ? JSON.stringify(destination)
    : null;

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({
      userId: user.id,
      currency: "skz",
      amount: String(amountNum.toFixed(2)),
      fee: "0",
      netAmount: String(amountNum.toFixed(2)),
      method: methodCode,
      address: addressStr,
      status: "pending",
    })
    .returning();

  req.log.info(
    { withdrawalId: withdrawal.id, botSlug: bot.slug, telegramId, amountNum, methodCode },
    "Internal withdrawal request created"
  );

  res.status(201).json({
    success: true,
    withdrawalId: withdrawal.id,
    status: "pending",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/game/refund-entry — refund a game entry fee
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /internal/game/refund-entry
 * Body: { telegramId, chargeTransactionId }
 *
 * Refunds an entry fee back to the user's SKZ wallet. Used by the client
 * when the player legitimately won but the server failed to credit the
 * reward (validate succeeded → no token, or credit retries exhausted).
 *
 * Safety:
 *   - Verifies the charge transaction belongs to the calling bot AND the
 *     calling Telegram user.
 *   - Verifies the charge was actually a game entry (type=debit,
 *     currency=skz, metadata.action='entry').
 *   - Idempotent: a unique referenceId (`refund_${chargeTransactionId}`)
 *     means duplicate calls return the existing refund instead of
 *     double-paying. We probe for the existing refund up-front AND rely
 *     on the unique-violation as the last line of defence.
 *   - Atomic: wallet credit is a single SQL increment.
 */
router.post("/internal/game/refund-entry", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, chargeTransactionId } = req.body as {
    telegramId: string;
    chargeTransactionId: number | string;
  };

  if (!telegramId || chargeTransactionId === undefined || chargeTransactionId === null) {
    res.status(400).json({ error: "telegramId and chargeTransactionId are required" });
    return;
  }

  const chargeId = parseInt(String(chargeTransactionId), 10);
  if (isNaN(chargeId)) {
    res.status(400).json({ error: "Invalid chargeTransactionId" });
    return;
  }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [charge] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.id, chargeId));
  if (!charge) {
    res.status(404).json({ error: "Charge transaction not found" });
    return;
  }

  if (charge.userId !== user.id || charge.sourceBot !== bot.slug) {
    res.status(403).json({ error: "Charge does not belong to this user/bot" });
    return;
  }
  if (charge.type !== "debit" || charge.currency !== "skz") {
    res.status(400).json({ error: "Charge is not a SKZ debit" });
    return;
  }

  let meta: Record<string, unknown> = {};
  try { meta = charge.metadata ? JSON.parse(charge.metadata) : {}; }
  catch { meta = {}; }
  if (meta.action !== "entry") {
    res.status(400).json({ error: "Charge is not a game entry" });
    return;
  }

  const entryFee = parseFloat(String(meta.entryFee ?? Math.abs(parseFloat(charge.amount))));
  if (isNaN(entryFee) || entryFee <= 0) {
    res.status(400).json({ error: "Could not determine entry fee for refund" });
    return;
  }

  const refundRef = `refund_${chargeId}`;
  const rewardRef = `game_reward_ref_${chargeId}`;

  try {
    // All refund logic runs inside a transaction guarded by a
    // pg_advisory_xact_lock keyed on the charge id. Two concurrent
    // refund requests for the same charge will serialize on this lock,
    // so the "no existing refund / no existing reward" checks below are
    // race-safe even without a dedicated unique constraint on
    // transactions.reference_id.
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${chargeId})`);

      // (a) Already refunded? Idempotent return.
      const [existingRefund] = await tx.select().from(transactionsTable)
        .where(and(
          eq(transactionsTable.userId, user.id),
          eq(transactionsTable.referenceId, refundRef),
        ));
      if (existingRefund) {
        const [w] = await tx.select({ balanceSkz: walletsTable.balanceSkz })
          .from(walletsTable).where(eq(walletsTable.userId, user.id));
        return {
          kind: "already" as const,
          transactionId: existingRefund.id,
          newSkzBalance: w?.balanceSkz ?? "0",
        };
      }

      // (b) CRITICAL: refuse refund if the reward was already credited
      // for this charge — otherwise a winning user could pocket both
      // the prize AND their entry fee back.
      const [alreadyCredited] = await tx.select({ id: transactionsTable.id })
        .from(transactionsTable)
        .where(and(
          eq(transactionsTable.userId, user.id),
          eq(transactionsTable.referenceId, rewardRef),
        ));
      if (alreadyCredited) {
        return { kind: "rewarded" as const };
      }

      // (c) Insert refund + credit wallet atomically.
      const [refund] = await tx.insert(transactionsTable).values({
        userId:      user.id,
        type:        "credit",
        currency:    "skz",
        amount:      String(entryFee.toFixed(2)),
        fee:         "0",
        status:      "completed",
        sourceBot:   bot.slug,
        referenceId: refundRef,
        description: `استرداد رسوم لعبة #${meta.gameId ?? ""}`,
        metadata:    JSON.stringify({ action: "refund", chargeTransactionId: chargeId, ...meta }),
      }).returning();

      const [wallet] = await tx.update(walletsTable).set({
        balanceSkz: sql`${walletsTable.balanceSkz} + ${entryFee}`,
      }).where(eq(walletsTable.userId, user.id)).returning();
      if (!wallet) throw new Error("Wallet not found");

      return { kind: "new" as const, refund, wallet };
    });

    if (result.kind === "rewarded") {
      res.status(409).json({ error: "Game session already credited — refund refused" });
      return;
    }

    if (result.kind === "already") {
      res.json({
        success: true,
        alreadyRefunded: true,
        transactionId: result.transactionId,
        refundedAmount: entryFee,
        newSkzBalance: result.newSkzBalance,
      });
      return;
    }

    req.log.info(
      { chargeId, refundId: result.refund.id, botSlug: bot.slug, entryFee },
      "Game entry refunded"
    );

    res.json({
      success: true,
      transactionId: result.refund.id,
      refundedAmount: entryFee,
      newSkzBalance: result.wallet.balanceSkz,
    });
  } catch (err) {
    req.log.error({ err, chargeId }, "Refund failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Refund failed" });
  }
});

export default router;
