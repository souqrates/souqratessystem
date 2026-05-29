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
  commissionOverridesTable,
  botTextsTable,
  gameConfigsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { perUserCreateLimiter } from "../lib/rate-limit";
import { getSkzRates, getReferralRates, distributeReferralBonuses, getEffectiveCommissionRate } from "../lib/finance";
import { normalizeTiers } from "../lib/game-tiers";
import {
  readIdempotencyKey,
  findExistingByIdempotencyKey,
  idempotencyFingerprintMatches,
  PG_UNIQUE_VIOLATION,
} from "../lib/idempotency";
import { notifyUser } from "../lib/notify-user";
import { capture } from "../lib/analytics";
import { notifyAdmin } from "../lib/email";
import { checkAndRegisterWithdrawalAddress } from "../lib/withdrawal-whitelist";
import { validateCryptoAddress } from "../lib/crypto-address";

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

/**
 * POST /internal/wallets/transfer-referral
 * Body: { telegramId, amount? }   // amount omitted = transfer entire referral balance
 *
 * Auth: requireBot (X-Bot-Api-Key). The mother-bot calls this on behalf of
 * the user from a button click; the API key proves the request came from a
 * trusted bot service, not arbitrary internet traffic.
 *
 * Atomically moves SKZ from the user's referral sub-balance into their
 * main spendable balance. The guarded UPDATE (WHERE referralBalanceSkz >= amt)
 * + ledger insert run inside one db.transaction, so concurrent clicks cannot
 * double-transfer and the wallet/ledger never drift apart.
 */
router.post("/internal/wallets/transfer-referral", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amount } = req.body as { telegramId?: string | number; amount?: number };
  if (!telegramId) {
    res.status(400).json({ error: "telegramId is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(String(telegramId))));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (rejectIfBlocked(user, res)) return;

  // ── Idempotency: a retried referral-transfer with the same key returns
  //    the original transaction instead of double-moving funds. Without
  //    this, a stuck client retrying the button click would empty the
  //    referral sub-balance multiple times into the main balance.
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  const available = parseFloat(wallet.referralBalanceSkz);
  const requested = amount != null ? Number(amount) : available;
  if (!isFinite(requested) || requested <= 0) {
    res.status(400).json({ error: "Amount must be > 0" });
    return;
  }
  if (requested > available + 1e-9) {
    res.status(400).json({ error: "Insufficient referral balance", available });
    return;
  }
  const amt = parseFloat(requested.toFixed(2));

  // ── Idempotency: a retried referral-transfer with the same key returns
  //    the original transaction. We validate the fingerprint (type + user +
  //    amount) so a key reused for a *different* operation never returns
  //    success — that would silently drop the new write AND could leak
  //    another user's balance if the key was guessed/reused.
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    const existing = await findExistingByIdempotencyKey(bot.slug, idemKey);
    if (existing) {
      if (!idempotencyFingerprintMatches(existing, { type: "credit", userId: user.id, amount: amt })) {
        res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
        return;
      }
      res.json({
        success: true,
        transferred: existing.amount,
        newBalanceSkz: wallet.balanceSkz,
        newReferralBalanceSkz: wallet.referralBalanceSkz,
        replayed: true,
      });
      return;
    }
  }

  let updatedWallet: typeof walletsTable.$inferSelect | undefined;
  try {
    updatedWallet = await db.transaction(async (tx) => {
      const [w] = await tx
        .update(walletsTable)
        .set({
          referralBalanceSkz: sql`${walletsTable.referralBalanceSkz} - ${amt}`,
          balanceSkz:         sql`${walletsTable.balanceSkz}         + ${amt}`,
          totalEarnedSkz:     sql`${walletsTable.totalEarnedSkz}     + ${amt}`,
        })
        .where(and(
          eq(walletsTable.userId, user.id),
          sql`${walletsTable.referralBalanceSkz} >= ${amt}`,
        ))
        .returning();
      if (!w) throw Object.assign(new Error("INSUFFICIENT"), { status: 400 });

      await tx.insert(transactionsTable).values({
        userId:      user.id,
        type:        "credit",
        currency:    "skz",
        amount:      String(amt),
        fee:         "0",
        status:      "completed",
        sourceBot:   bot.slug,
        referenceId: `referral_transfer_${user.id}_${Date.now()}`,
        idempotencyKey: idemKey,
        description: `تحويل أرباح الإحالة إلى المحفظة الرئيسية`,
        metadata:    JSON.stringify({ action: "referral_transfer", amount: amt }),
      });
      return w;
    });
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION && idemKey) {
      const winner = await findExistingByIdempotencyKey(bot.slug, idemKey);
      if (winner) {
        if (!idempotencyFingerprintMatches(winner, { type: "credit", userId: user.id, amount: amt })) {
          res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
          return;
        }
        const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, winner.userId));
        res.json({
          success: true,
          transferred: winner.amount,
          newBalanceSkz: w?.balanceSkz ?? "0",
          newReferralBalanceSkz: w?.referralBalanceSkz ?? "0",
          replayed: true,
        });
        return;
      }
    }
    const e = err as Error;
    if (e.message === "INSUFFICIENT") {
      res.status(400).json({ error: "Insufficient referral balance (race condition)" });
      return;
    }
    req.log.error({ err }, "referral transfer failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  res.json({
    success:               true,
    transferred:           String(amt.toFixed(2)),
    newBalanceSkz:         updatedWallet.balanceSkz,
    newReferralBalanceSkz: updatedWallet.referralBalanceSkz,
  });
});

// ── Effective settings helpers (panel → live) ──────────────────────────────
// Every financial route uses these so any change made in the super-admin
// panel takes effect on the very next request — no restart, no cache.

/**
 * Rejects the request with 403 if the user is blocked.
 * Returns `true` when blocked (caller should `return` immediately).
 */
function rejectIfBlocked(
  user: { isBlocked: boolean | null },
  res: Parameters<Parameters<typeof router.post>[1]>[1],
): boolean {
  if (user.isBlocked === true) {
    res.status(403).json({ error: "هذا المستخدم محظور — لا يمكن إجراء عمليات مالية" });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/bot-texts?botSlug=... — fetch all PUBLISHED texts for a bot
// Returns: { texts: { [key]: publishedValue } }
// Used by bots (Python SDK) to render dynamic strings edited from the panel.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/internal/bot-texts", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  // A bot may only read its own texts. Cross-bot reads are rejected to
  // prevent any compromised child-bot key from exfiltrating another bot's
  // copy (which could leak product strategy or partner-branded content).
  const requestedSlug = req.query.botSlug as string | undefined;
  if (requestedSlug && requestedSlug !== bot.slug) {
    res.status(403).json({ error: "A bot may only read its own texts" });
    return;
  }
  const slug = bot.slug;

  const rows = await db
    .select({ key: botTextsTable.key, value: botTextsTable.publishedValue })
    .from(botTextsTable)
    .where(eq(botTextsTable.botSlug, slug));

  const texts: Record<string, string> = {};
  for (const r of rows) {
    // Only expose published, non-empty values. Empty published → use Python default.
    if (r.value && r.value.length > 0) texts[r.key] = r.value;
  }

  res.json({ botSlug: slug, texts });
});

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
        // Only overwrite languageCode when the caller explicitly sent one.
        // This lets the /lang command persist the user's choice via upsert
        // without other code paths (e.g. games-bot upsert from web init data)
        // accidentally resetting it back to the Telegram client locale.
        ...(languageCode ? { languageCode } : {}),
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

  // Blocked users must not be able to keep refreshing their record through
  // child bots — block enforcement covers identity, not just money.
  if (rejectIfBlocked(user, res)) return;

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
router.post("/internal/deposit", perUserCreateLimiter, async (req, res): Promise<void> => {
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
  if (rejectIfBlocked(user, res)) return;

  const rates = await getSkzRates();
  const rateMap: Record<string, number> = {
    usdt: rates.perUsdt,
    stars: rates.perStar,
    ton: rates.perTon,
  };
  const skzRate = rateMap[currency]!;
  const skzAmount = amountNum * skzRate;

  // ── Idempotency: a retried deposit with the same key returns the original
  //    transaction instead of double-crediting. A *different* operation
  //    reusing the same key is rejected (409) — silently replaying would
  //    drop the intended write. ───────────────────────────────────────────
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    const existing = await findExistingByIdempotencyKey(bot.slug, idemKey);
    if (existing) {
      if (!idempotencyFingerprintMatches(existing, { type: "deposit", userId: user.id, amount: skzAmount })) {
        res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
        return;
      }
      const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, existing.userId));
      res.json({
        success: true,
        transactionId: existing.id,
        skzCredited: existing.amount,
        newSkzBalance: w?.balanceSkz ?? "0",
        rateUsed: String(skzRate),
        replayed: true,
      });
      return;
    }
  }

  // ── Single transaction: ledger insert + wallet update commit atomically.
  //    If either fails the other rolls back — wallet/ledger can never drift.
  let transaction: typeof transactionsTable.$inferSelect;
  let newSkzBalance: string;
  try {
    const result = await db.transaction(async (tx) => {
      const [txn] = await tx
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
          idempotencyKey: idemKey,
          description: description ?? `إيداع ${amountNum} ${currency.toUpperCase()} = ${skzAmount.toFixed(0)} SKZ`,
          metadata: JSON.stringify({ originalCurrency: currency, originalAmount: amountNum, skzRate }),
        })
        .returning();

      const [w] = await tx.update(walletsTable).set({
        balanceSkz:     sql`${walletsTable.balanceSkz}     + ${skzAmount}`,
        totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${skzAmount}`,
      }).where(eq(walletsTable.userId, user.id)).returning();
      if (!w) throw Object.assign(new Error("WALLET_NOT_FOUND"), { status: 500 });
      return { txn, balance: w.balanceSkz };
    });
    transaction   = result.txn;
    newSkzBalance = result.balance;
  } catch (err) {
    // Concurrent retry won the idempotency race — replay the winner.
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION && idemKey) {
      const winner = await findExistingByIdempotencyKey(bot.slug, idemKey);
      if (winner) {
        const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, winner.userId));
        res.json({
          success: true,
          transactionId: winner.id,
          skzCredited: winner.amount,
          newSkzBalance: w?.balanceSkz ?? "0",
          rateUsed: String(skzRate),
          replayed: true,
        });
        return;
      }
    }
    if ((err as Error).message === "WALLET_NOT_FOUND") {
      res.status(500).json({ error: "Wallet not found" });
      return;
    }
    req.log.error({ err }, "deposit tx failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  req.log.info({ transactionId: transaction.id, botSlug: bot.slug, currency, amount, skzAmount }, "Deposit processed");

  // Best-effort confirmation to the user via Telegram.
  void notifyUser(
    telegramId,
    `✅ تم إيداع ${amountNum} ${currency.toUpperCase()}\nأُضيف إلى محفظتك: ${skzAmount.toFixed(2)} SKZ\nالرصيد الجديد: ${newSkzBalance} SKZ`,
  );

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
  if (rejectIfBlocked(user, res)) return;

  // Effective rate honors per-user overrides set in the super-admin panel.
  const commissionRate = await getEffectiveCommissionRate(user.telegramId, bot.slug, bot.commissionRate);
  const commissionAmount = amountNum * commissionRate;
  const netAmount = amountNum - commissionAmount;

  // ── Idempotency replay (avoid double-credit on bot retries) — key reuse
  //    with a *different* operation is rejected. ──────────────────────────
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    const existing = await findExistingByIdempotencyKey(bot.slug, idemKey);
    if (existing) {
      if (!idempotencyFingerprintMatches(existing, { type: "credit", userId: user.id, amount: amountNum })) {
        res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
        return;
      }
      const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, existing.userId));
      res.json({
        success: true,
        transactionId: existing.id,
        newSkzBalance: w?.balanceSkz ?? "0",
        commissionDeducted: existing.fee,
        referralBonuses: [],
        replayed: true,
      });
      return;
    }
  }

  // ── Atomic: ledger + wallet + commission row all commit together ────────
  let transaction: typeof transactionsTable.$inferSelect;
  let newSkzBalance: string;
  try {
    const result = await db.transaction(async (tx) => {
      const [txn] = await tx
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
          idempotencyKey: idemKey,
          description,
          metadata: metadata ? JSON.stringify(metadata) : null,
        })
        .returning();

      const [w] = await tx.update(walletsTable).set({
        balanceSkz:     sql`${walletsTable.balanceSkz}     + ${netAmount}`,
        totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${netAmount}`,
      }).where(eq(walletsTable.userId, user.id)).returning();
      if (!w) throw Object.assign(new Error("WALLET_NOT_FOUND"), { status: 500 });

      await tx.insert(commissionsTable).values({
        transactionId:    txn.id,
        botSlug:          bot.slug,
        userId:           user.id,
        grossAmount:      String(amountNum.toFixed(2)),
        commissionRate:   String(commissionRate),
        commissionAmount: String(commissionAmount.toFixed(2)),
        netAmount:        String(netAmount.toFixed(2)),
        currency:         "skz",
      });

      await tx.update(botsTable).set({
        totalVolumeUsdt:     sql`${botsTable.totalVolumeUsdt}     + ${amountNum}`,
        totalCommissionUsdt: sql`${botsTable.totalCommissionUsdt} + ${commissionAmount}`,
      }).where(eq(botsTable.id, bot.id));

      return { txn, balance: w.balanceSkz };
    });
    transaction   = result.txn;
    newSkzBalance = result.balance;
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION && idemKey) {
      const winner = await findExistingByIdempotencyKey(bot.slug, idemKey);
      if (winner) {
        const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, winner.userId));
        res.json({
          success: true,
          transactionId: winner.id,
          newSkzBalance: w?.balanceSkz ?? "0",
          commissionDeducted: winner.fee,
          referralBonuses: [],
          replayed: true,
        });
        return;
      }
    }
    if ((err as Error).message === "WALLET_NOT_FOUND") {
      res.status(500).json({ error: "Wallet not found" });
      return;
    }
    req.log.error({ err }, "credit tx failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // Referral payouts are intentionally OUTSIDE the main tx. Failure here MUST
  // NOT surface to the caller — the primary credit already committed and the
  // user has been paid. We log the failure and rely on a reconciliation job
  // to retry missing bonuses; returning 500 here would make the caller think
  // the whole credit failed and trigger a destructive retry.
  let referralBonuses: Awaited<ReturnType<typeof distributeReferralBonuses>> = [];
  let referralRates: Awaited<ReturnType<typeof getReferralRates>> = [];
  try {
    referralRates = await getReferralRates();
    referralBonuses = await distributeReferralBonuses(
      user.id,
      netAmount,
      transaction.id,
      bot.slug,
      referralRates
    );
  } catch (err) {
    req.log.error(
      { err, transactionId: transaction.id, userId: user.id, botSlug: bot.slug, netAmount },
      "referral_payout_failed (primary credit committed; needs reconciliation)",
    );
  }

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
  if (rejectIfBlocked(user, res)) return;

  // ── Idempotency replay (reject mismatched payload reusing same key) ─────
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    const existing = await findExistingByIdempotencyKey(bot.slug, idemKey);
    if (existing) {
      if (!idempotencyFingerprintMatches(existing, { type: "debit", userId: user.id, amount: amountNum })) {
        res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
        return;
      }
      const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, existing.userId));
      res.json({
        success: true,
        transactionId: existing.id,
        newSkzBalance: w?.balanceSkz ?? "0",
        replayed: true,
      });
      return;
    }
  }

  // ── Atomic conditional debit + ledger insert in one transaction ─────────
  //    The WHERE-balance clause defeats the time-of-check/time-of-use race
  //    that would let two concurrent debits both pass an in-memory check.
  let transaction: typeof transactionsTable.$inferSelect;
  let newSkzBalance: string;
  try {
    const result = await db.transaction(async (tx) => {
      const [w] = await tx.update(walletsTable).set({
        balanceSkz: sql`${walletsTable.balanceSkz} - ${amountNum}`,
      }).where(and(
        eq(walletsTable.userId, user.id),
        sql`${walletsTable.balanceSkz} >= ${amountNum}`,
      )).returning();
      if (!w) throw Object.assign(new Error("INSUFFICIENT"), { status: 400 });

      const [txn] = await tx
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
          idempotencyKey: idemKey,
          description,
          metadata: metadata ? JSON.stringify(metadata) : null,
        })
        .returning();

      return { txn, balance: w.balanceSkz };
    });
    transaction   = result.txn;
    newSkzBalance = result.balance;
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION && idemKey) {
      const winner = await findExistingByIdempotencyKey(bot.slug, idemKey);
      if (winner) {
        const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, winner.userId));
        res.json({
          success: true,
          transactionId: winner.id,
          newSkzBalance: w?.balanceSkz ?? "0",
          replayed: true,
        });
        return;
      }
    }
    if ((err as Error).message === "INSUFFICIENT") {
      res.status(400).json({ error: "Insufficient SKZ balance" });
      return;
    }
    req.log.error({ err }, "debit tx failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

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
router.post("/internal/game/charge-entry", perUserCreateLimiter, async (req, res): Promise<void> => {
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

  // ── Validate amount against per-game published tiers (from super-admin) ──
  // Priority order:
  //   1. If game_configs has published_price_tiers for this gameId → enforce
  //      that the amount matches one of those tier entry fees, and use the
  //      tier's winAmount as the prize. This is the live admin-controlled path.
  //   2. Fallback to global platform_settings tiers (legacy) — only used if
  //      game_configs has no per-game tiers (e.g. game not yet seeded).
  const gameIdNum = parseInt(String(gameId), 10);
  let entryFee: number;
  let expectedPrize: number;
  let multiplier: number;
  let perGameDurationSeconds: number | null = null;

  const [gameCfg] = Number.isInteger(gameIdNum)
    ? await db.select().from(gameConfigsTable).where(eq(gameConfigsTable.gameId, gameIdNum))
    : [];

  // CRITICAL: must normalize tiers the SAME way /games/configs does
  // (./superadmin-games.ts uses normalizeTiers from ../lib/game-tiers).
  // The client reads the normalized 5-tier set and offers the user any of
  // them; if we validated against the raw stored array instead, games that
  // were never edited in super-admin would have empty/partial publishedPriceTiers
  // and fall through to the legacy global tier path — accepting only [5,10,15]
  // while the client offers [×1, ×5, ×10, ×25, ×100] of the base fee. That
  // mismatch caused "only the first tier works" (only tier 0 ever coincides).
  type Tier = { label: string; entryFee: number; winAmount: number };
  const perGameTiers: Tier[] = gameCfg
    ? normalizeTiers(
        gameCfg.publishedPriceTiers,
        Number(gameCfg.publishedEntryFee),
        Number(gameCfg.publishedWinAmount),
      )
    : [];

  if (perGameTiers.length > 0) {
    const matched = perGameTiers.find((t) => Math.abs(t.entryFee - amountNum) < 0.001);
    if (!matched) {
      const list = perGameTiers.map((t) => `${t.label}=${t.entryFee}`).join(", ");
      req.log.warn({ telegramId, gameId, amountNum, perGameTiers: list }, "charge-entry rejected: tier mismatch (per-game)");
      res.status(400).json({ error: `amount must match one of the game's tier fees: ${list} SKZ` });
      return;
    }
    entryFee      = matched.entryFee;
    expectedPrize = parseFloat(matched.winAmount.toFixed(2));
    multiplier    = entryFee > 0 ? parseFloat((matched.winAmount / entryFee).toFixed(4)) : 0;
    perGameDurationSeconds = gameCfg?.publishedDurationSeconds ?? null;
  } else {
    const tierSettings = await db.select().from(platformSettingsTable)
      .where(inArray(platformSettingsTable.key, [
        "solo_entry_fee_easy", "solo_entry_fee_medium", "solo_entry_fee_hard", "solo_multiplier",
      ]));
    const tsMap: Record<string, string> = {};
    for (const r of tierSettings) tsMap[r.key] = r.value;
    multiplier   = parseFloat(tsMap["solo_multiplier"] ?? "3");
    const allowedFees  = [
      parseFloat(tsMap["solo_entry_fee_easy"]   ?? "5"),
      parseFloat(tsMap["solo_entry_fee_medium"] ?? "10"),
      parseFloat(tsMap["solo_entry_fee_hard"]   ?? "15"),
    ];
    const matchedFee = allowedFees.find(f => Math.abs(f - amountNum) < 0.001);
    if (matchedFee === undefined) {
      req.log.warn({ telegramId, gameId, amountNum, allowedFees }, "charge-entry rejected: tier mismatch (global)");
      res.status(400).json({ error: `amount must be one of the configured tier fees: ${allowedFees.join(", ")} SKZ` });
      return;
    }
    entryFee      = matchedFee;
    expectedPrize = parseFloat((entryFee * multiplier).toFixed(2));
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (rejectIfBlocked(user, res)) return;

  // Determine minimum game duration:
  //   - If the per-game admin panel set durationSeconds, use it (with a small
  //     5s grace so legit fast players aren't rejected by edge timing).
  //   - Otherwise fall back to legacy difficulty-based defaults.
  const difficulty = gameCfg?.difficulty || "Medium";
  let minDurationMs: number;
  if (perGameDurationSeconds !== null && perGameDurationSeconds > 0) {
    // Require at least 50% of the configured round duration to be elapsed —
    // prevents instant farming while tolerating quick legitimate wins.
    minDurationMs = Math.max(5_000, Math.floor(perGameDurationSeconds * 1000 * 0.5));
  } else {
    minDurationMs = difficulty === "Easy" ? 25_000 : difficulty === "Hard" ? 45_000 : 35_000;
  }
  const minWinScore   = 1; // any positive score proves the game was actually played
  // Per-game maximum allowed score (anti-cheat ceiling). Captured at charge
  // time so a later admin edit cannot retroactively invalidate a session.
  const maxScoreCap   = gameCfg?.publishedMaxScore != null && Number(gameCfg.publishedMaxScore) > 0
    ? Number(gameCfg.publishedMaxScore)
    : null;

  // Atomic: wallet debit (with conditional WHERE to prevent overdraw),
  // entry ledger row, and participation XP all commit together — or
  // not at all. A crash between any two leaves no orphan state.
  let transaction: typeof transactionsTable.$inferSelect;
  let newSkzBalance: string;
  try {
    const result = await db.transaction(async (tx) => {
      const [w] = await tx.update(walletsTable).set({
        balanceSkz: sql`${walletsTable.balanceSkz} - ${entryFee}`,
      }).where(and(
        eq(walletsTable.userId, user.id),
        sql`${walletsTable.balanceSkz} >= ${entryFee}`,
      )).returning();
      if (!w) throw Object.assign(new Error("INSUFFICIENT"), { status: 400 });

      const [txn] = await tx.insert(transactionsTable).values({
        userId:      user.id,
        type:        "debit",
        currency:    "skz",
        amount:      String(-entryFee),
        fee:         "0",
        status:      "completed",
        sourceBot:   bot.slug,
        // Deterministic per (user, game) — second attempt from the same client
        // hits the partial unique index below as soon as we add one. For now,
        // suffix is monotonic via nanosecond timestamp so a *replayed* request
        // doesn't collide with a *separate* play of the same game.
        referenceId: `game_entry_${user.id}_${gameId}_${process.hrtime.bigint()}`,
        description: `رسوم دخول لعبة #${gameId}`,
        metadata:    JSON.stringify({
          gameId:         String(gameId),
          action:         "entry",
          entryFee,
          expectedPrize,
          multiplier,
          difficulty,
          minDurationMs,
          minWinScore,
          maxScoreCap,
        }),
      }).returning();

      // +10 participation XP — counts toward the unified profile even
      // if the user loses. Win bonus (+40) is added in /credit-reward.
      await tx.update(usersTable).set({
        xp:               sql`${usersTable.xp} + 10`,
        level:            sql`GREATEST(1, FLOOR(SQRT((${usersTable.xp} + 10) / 100.0))::int + 1)`,
        totalGamesPlayed: sql`${usersTable.totalGamesPlayed} + 1`,
      }).where(eq(usersTable.id, user.id));

      return { txn, newBalance: w.balanceSkz };
    });
    transaction   = result.txn;
    newSkzBalance = result.newBalance;
  } catch (err) {
    const e = err as Error;
    if (e.message === "INSUFFICIENT") {
      req.log.warn({ telegramId, gameId, entryFee }, "charge-entry rejected: insufficient_balance");
      res.status(400).json({ error: "insufficient_balance" });
      return;
    }
    req.log.error({ err }, "charge-entry tx failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

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
  const maxScoreCap   = typeof meta.maxScoreCap   === "number" ? meta.maxScoreCap   : null;

  // 1. Score must meet server-stored win threshold
  if (isNaN(scoreNum) || scoreNum < minWinScore) {
    res.status(403).json({
      error: `Win condition not met: score must be at least ${minWinScore}`,
      minWinScore,
    });
    return;
  }

  // 1b. Score must NOT exceed per-game maximum (anti-cheat ceiling).
  // Caps a tampered client from submitting absurd values that would alarm
  // analytics or top leaderboards with fake scores.
  if (maxScoreCap !== null && scoreNum > maxScoreCap) {
    res.status(403).json({
      error: `Score exceeds the maximum allowed for this game (${maxScoreCap})`,
      maxScoreCap,
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
router.post("/internal/game/credit-reward", perUserCreateLimiter, async (req, res): Promise<void> => {
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
  if (rejectIfBlocked(user, res)) return;

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

  // ── 4. Commission (honors per-user override from super-admin panel) ───────
  const commissionRate   = await getEffectiveCommissionRate(user.telegramId, bot.slug, bot.commissionRate);
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

      // Atomic SQL increment — matches the pattern used by /credit and /deposit
      // so wallet balance stays exact (numeric(18,2)) without JS rounding drift.
      const [updated] = await tx.update(walletsTable).set({
        balanceSkz:     sql`${walletsTable.balanceSkz}     + ${netAmount}`,
        totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${netAmount}`,
      }).where(eq(walletsTable.userId, user.id)).returning();
      if (!updated) throw new Error("WALLET_NOT_FOUND");

      // ── commission row + XP/won counter live INSIDE the same tx as the
      //    wallet credit, so a crash between them cannot leave money settled
      //    without commission accounting or without the profile being updated.
      const gameIdNumForCommission = typeof meta.gameId === "number"
        ? meta.gameId
        : (typeof meta.gameId === "string" && /^\d+$/.test(meta.gameId)
            ? parseInt(meta.gameId, 10)
            : null);
      await tx.insert(commissionsTable).values({
        transactionId:    txn.id,
        botSlug:          bot.slug,
        userId:           user.id,
        gameId:           gameIdNumForCommission,
        grossAmount:      String(grossPrize.toFixed(2)),
        commissionRate:   String(commissionRate),
        commissionAmount: String(commissionAmount.toFixed(2)),
        netAmount:        String(netAmount.toFixed(2)),
        currency:         "skz",
      });
      // +40 XP for a win on the unified profile (single telegramId across all bots).
      await tx.update(usersTable).set({
        xp:            sql`${usersTable.xp} + 40`,
        level:         sql`GREATEST(1, FLOOR(SQRT((${usersTable.xp} + 40) / 100.0))::int + 1)`,
        totalGamesWon: sql`${usersTable.totalGamesWon} + 1`,
      }).where(eq(usersTable.id, user.id));

      return { txn, newBalance: updated.balanceSkz };
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

  // ── 6. (commission + XP/won are now part of the credit-reward tx above) ──

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
router.get("/internal/game/tiers", async (req, res): Promise<void> => {
  try {
    const gameIdParam = req.query.gameId ? parseInt(String(req.query.gameId), 10) : null;

    // If a specific gameId is requested, return its admin-configured tiers from game_configs.
    // This is the live path used by the front-end before presenting tier choices to the user.
    if (gameIdParam && Number.isInteger(gameIdParam)) {
      const [gameCfg] = await db.select().from(gameConfigsTable).where(eq(gameConfigsTable.gameId, gameIdParam));
      if (gameCfg) {
        const perGameTiers = normalizeTiers(
          gameCfg.publishedPriceTiers,
          Number(gameCfg.publishedEntryFee),
          Number(gameCfg.publishedWinAmount),
        );
        if (perGameTiers.length > 0) {
          res.json({ tiers: perGameTiers, source: "game_configs" });
          return;
        }
      }
    }

    // Fallback: global platform_settings tiers (legacy — used when game_configs has no tiers)
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
    res.json({ tiers, source: "platform_settings" });
  } catch (err) {
    logger.error({ err }, "internal: game tiers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/stars-invoice — create Telegram Stars deposit invoice
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/stars-invoice", perUserCreateLimiter, async (req, res): Promise<void> => {
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
  if (rejectIfBlocked(user, res)) return;

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
// POST /internal/stars-confirm — credit user after a `successful_payment`
// update arrives in the bot. Idempotent on telegramChargeId so duplicate
// webhook deliveries from Telegram never double-credit the wallet.
//
// Trust model: only mother-bot calls this (with its own X-Bot-Api-Key). It
// receives `successful_payment` from Telegram's secure HTTPS push, which is
// only delivered after Telegram has actually charged the user's Stars. We do
// NOT credit on `pre_checkout_query` — that is only an approval to charge.
//
// We trust `metadata.expectedSkz` snapshotted at invoice time rather than
// re-deriving from the current rate: this guarantees the user is credited
// exactly what they were shown when they paid, even if rates moved mid-flight.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/stars-confirm", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  // Mother-bot is the only entity that owns the Telegram payment flow for the
  // platform wallet. Forbid any other bot key from confirming Stars deposits —
  // even a leaked child-bot key cannot mint balances this way.
  if (bot.slug !== "mother-bot") {
    res.status(403).json({ error: "stars_confirm_requires_mother_bot" });
    return;
  }

  // Request body is treated as a routing hint ONLY. The actual credited amounts
  // are derived from the pending transaction that we created server-side at
  // /stars-invoice time — never from caller-supplied numbers.
  const { telegramId, payload, telegramChargeId, providerChargeId } = req.body as {
    telegramId?: string;
    payload?: string;
    telegramChargeId?: string;
    providerChargeId?: string;
  };

  if (!telegramId || !payload || !telegramChargeId) {
    res.status(400).json({ error: "telegramId, payload, telegramChargeId are required" });
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
  // NOTE: deliberately NOT calling rejectIfBlocked — if a user paid Stars
  // and then got blocked, we must still credit (or we'd owe them money).

  // ── Idempotency: look up the pending tx for THIS payload.
  //    If it's already completed (duplicate webhook), return success with
  //    the original tx so the bot still shows a confirmation message.
  const [existing] = await db
    .select()
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, user.id),
      eq(transactionsTable.referenceId, payload),
      eq(transactionsTable.type, "deposit"),
      eq(transactionsTable.currency, "stars"),
    ));

  if (!existing) {
    req.log.warn({ telegramId, payload }, "Stars-confirm: no matching pending tx");
    res.status(404).json({ error: "no_pending_invoice_for_payload" });
    return;
  }

  if (existing.status === "completed") {
    // Already credited — duplicate Telegram delivery. Return ok so the bot
    // can still render its "تم الشحن" confirmation.
    req.log.info({ txId: existing.id, telegramChargeId }, "Stars-confirm: replay (already completed)");
    res.json({ ok: true, replay: true, transactionId: existing.id });
    return;
  }

  // Derive both credit amounts from the pending tx ONLY — never from the
  // caller. Stars is the integer count stored on the tx row at invoice time;
  // SKZ is the rate-snapshot saved into metadata.expectedSkz. If either is
  // missing/malformed we refuse the confirm rather than guess: a corrupted
  // metadata blob is an operational bug, not a user-recoverable condition.
  const starsToCredit = Number(existing.amount);
  let skzToCredit = 0;
  try {
    const meta = existing.metadata ? JSON.parse(existing.metadata) as { expectedSkz?: number } : null;
    skzToCredit = meta?.expectedSkz != null ? Number(meta.expectedSkz) : 0;
  } catch {
    skzToCredit = 0;
  }
  if (!Number.isFinite(starsToCredit) || starsToCredit <= 0 ||
      !Number.isFinite(skzToCredit)   || skzToCredit  <= 0) {
    req.log.error(
      { txId: existing.id, starsToCredit, skzToCredit },
      "Stars-confirm: pending tx has invalid amount/metadata",
    );
    res.status(500).json({ error: "invoice_metadata_corrupt" });
    return;
  }

  // CAS the tx to completed FIRST (atomic guard against concurrent webhooks),
  // then credit the wallet only if WE were the ones who flipped it.
  const result = await db.transaction(async (tx) => {
    const flipped = await tx
      .update(transactionsTable)
      .set({
        status: "completed",
        metadata: JSON.stringify({
          ...(existing.metadata ? JSON.parse(existing.metadata) : {}),
          telegramChargeId,
          providerChargeId: providerChargeId ?? null,
          confirmedAt: new Date().toISOString(),
        }),
      })
      .where(and(
        eq(transactionsTable.id, existing.id),
        eq(transactionsTable.status, "pending"),
      ))
      .returning({ id: transactionsTable.id });

    if (flipped.length === 0) {
      // Another coroutine completed it between our SELECT and UPDATE.
      // Safe replay — do NOT credit again.
      return { replay: true as const, txId: existing.id, newSkzBalance: null as string | null };
    }

    const [w] = await tx
      .update(walletsTable)
      .set({
        balanceStars:   sql`${walletsTable.balanceStars}   + ${starsToCredit}`,
        balanceSkz:     sql`${walletsTable.balanceSkz}     + ${skzToCredit}`,
        totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${skzToCredit}`,
      })
      .where(eq(walletsTable.userId, user.id))
      .returning({ balanceSkz: walletsTable.balanceSkz });

    return { replay: false as const, txId: existing.id, newSkzBalance: w?.balanceSkz ?? null };
  });

  req.log.info(
    { txId: result.txId, telegramId, starsToCredit, skzToCredit, telegramChargeId, replay: result.replay },
    result.replay ? "Stars-confirm replay (CAS lost)" : "Stars deposit credited",
  );

  res.json({
    ok: true,
    replay: result.replay,
    transactionId: result.txId,
    creditedSkz: skzToCredit.toFixed(2),
    newSkzBalance: result.newSkzBalance,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/ton-deposit-intent — create TON deposit intent with unique memo
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/ton-deposit-intent", perUserCreateLimiter, async (req, res): Promise<void> => {
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
  if (rejectIfBlocked(user, res)) return;

  const rates = await getSkzRates();
  const expectedSkz = tonNum * rates.perTon;

  const memo = `SKZ${user.id}T${Date.now().toString(36).toUpperCase()}`;
  const depositAddress = process.env.TON_WALLET_ADDRESS ?? process.env.TON_HOT_WALLET ?? "";
  if (!depositAddress) {
    res.status(503).json({ error: "TON wallet not configured" });
    return;
  }

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
// POST /internal/usdt-deposit-intent — USDT-Jetton (on TON) deposit intent
//
// Mirrors /internal/ton-deposit-intent but for Tether USDT on the TON network
// (the asset @wallet sells when users pay by card). Returns the same TON
// receiving address: USDT-Jetton wallets live on a per-Jetton sub-contract
// derived from the owner address, so users send to the TON owner address and
// the network routes the Jetton transfer automatically.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/internal/usdt-deposit-intent", perUserCreateLimiter, async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, amountUsdt } = req.body as {
    telegramId: string;
    amountUsdt: number;
  };

  if (!telegramId || !amountUsdt) {
    res.status(400).json({ error: "telegramId and amountUsdt are required" });
    return;
  }

  const usdtNum = parseFloat(String(amountUsdt));
  if (isNaN(usdtNum) || usdtNum <= 0) {
    res.status(400).json({ error: "Invalid amountUsdt" });
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
  if (rejectIfBlocked(user, res)) return;

  const rates = await getSkzRates();
  const expectedSkz = usdtNum * rates.perUsdt;

  const memo = `SKZ${user.id}U${Date.now().toString(36).toUpperCase()}`;
  const depositAddress = process.env.TON_WALLET_ADDRESS ?? process.env.TON_HOT_WALLET ?? "";
  if (!depositAddress) {
    res.status(503).json({ error: "TON wallet not configured" });
    return;
  }

  const [transaction] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    currency: "usdt",
    amount: String(usdtNum),
    fee: "0",
    status: "pending",
    sourceBot: bot.slug,
    referenceId: memo,
    description: `USDT إيداع: ${usdtNum} USDT → ${expectedSkz.toFixed(0)} SKZ`,
    metadata: JSON.stringify({ amountUsdt: usdtNum, expectedSkz, memo, depositAddress, network: "ton-jetton" }),
  }).returning();

  req.log.info({ telegramId, usdtNum, expectedSkz, memo }, "USDT deposit intent created");

  res.json({
    ok: true,
    intentId: transaction.id,
    memo,
    depositAddress,
    amountUsdt: usdtNum,
    expectedSkz: String(expectedSkz.toFixed(2)),
    network: "ton-jetton",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/withdraw — create a pending withdrawal request for a user
// Accepts: { telegramId, methodCode, amountSkz, destination? }
// ─────────────────────────────────────────────────────────────────────────────
// Whitelist of accepted withdrawal method codes. New methods MUST be added
// here before the route accepts them — prevents typos and forged codes from
// reaching the admin queue.
const ALLOWED_WITHDRAW_METHODS = new Set<string>([
  "usdt_trc20",
  "usdt_bep20",
  "ton",
]);

router.post("/internal/withdraw", perUserCreateLimiter, async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const body = req.body as {
    telegramId?: string;
    methodCode?: string;
    amountSkz?: string | number;
    destination?: Record<string, unknown>;
    address?: string; // legacy/flat shape — normalised into destination below
  };
  const { telegramId, methodCode, amountSkz } = body;

  if (!telegramId || !methodCode || amountSkz === undefined || amountSkz === null) {
    res.status(400).json({ error: "telegramId, methodCode, amountSkz are required" });
    return;
  }

  if (!ALLOWED_WITHDRAW_METHODS.has(methodCode)) {
    res.status(400).json({
      error: "invalid_method_code",
      allowed: Array.from(ALLOWED_WITHDRAW_METHODS),
    });
    return;
  }

  // Normalise destination: accept either `destination.address` (canonical) or
  // a top-level `address` string (legacy). Reject if neither is present —
  // an admin cannot pay out without knowing where to send funds.
  const destination: Record<string, unknown> = body.destination && typeof body.destination === "object"
    ? { ...body.destination }
    : {};
  if (typeof destination.address !== "string" && typeof body.address === "string") {
    destination.address = body.address;
  }
  if (typeof destination.address !== "string" || destination.address.trim().length === 0) {
    res.status(400).json({ error: "destination_address_required" });
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
  if (rejectIfBlocked(user, res)) return;

  // ── Idempotency: a retried withdraw with the same key returns the
  //    original pending request. We validate (userId, amount, method) so
  //    a reused key for a *different* withdraw is rejected with 409
  //    instead of silently confirming success on the wrong row.
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    const [existing] = await db
      .select()
      .from(withdrawalsTable)
      .where(and(
        eq(withdrawalsTable.sourceBot, bot.slug),
        eq(withdrawalsTable.idempotencyKey, idemKey),
      ))
      .limit(1);
    if (existing) {
      const amtMatch = Math.abs(parseFloat(existing.amount) - amountNum) < 0.0001;
      if (existing.userId !== user.id || existing.method !== methodCode || !amtMatch) {
        res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
        return;
      }
      res.status(200).json({
        success: true,
        withdrawalId: existing.id,
        status: existing.status,
        replayed: true,
      });
      return;
    }
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

  // ── New-address cooldown: any never-seen (user, network, address) tuple
  //    gets auto-registered with usableAt = now() + 24h and this withdrawal
  //    is refused. The legitimate user is told to wait 24h; an attacker
  //    who hijacked the session cannot drain to their own address in real time.
  //    `destination.address` is guaranteed non-empty by the validation above —
  //    no withdraw reaches this point without a target.
  const destAddr = (destination.address as string).trim();
  // ── Network derived ONLY from server-trusted methodCode. ───────────────
  // Earlier draft accepted `destination.network` from the request body,
  // which let a caller send methodCode="usdt_trc20" with network="eth"
  // and bypass the per-network address checksum guard. We always
  // resolve the network from the bot-chosen method instead, so the
  // checksum validator runs against the correct chain.
  const destNetwork = (() => {
    if (methodCode.startsWith("usdt") || methodCode.includes("trc20") || methodCode === "tron") return "trc20";
    if (methodCode.startsWith("ton")) return "ton";
    return methodCode;
  })();

  // ── Address format + checksum guard. Runs BEFORE the cooldown registration
  //    so a typo doesn't burn the user a 24h wait. Offline-only (no RPC) —
  //    catches > 99.99% of typos via the per-network checksum embedded in
  //    the address itself. See lib/crypto-address.ts.
  {
    const fmt = validateCryptoAddress(destNetwork, destAddr);
    if (!fmt.ok) {
      res.status(400).json({
        error: "invalid_address_format",
        reason: fmt.reason ?? "bad_checksum",
        message: "عنوان السحب غير صالح — تحقّق من نسخه كاملاً وحاول مرة أخرى",
      });
      return;
    }
  }

  {
    const check = await checkAndRegisterWithdrawalAddress(user.id, destNetwork, destAddr);
    if (!check.ok) {
      if (check.reason === "new_address_cooldown") {
        const hoursLeft = Math.ceil((check.usableAt.getTime() - Date.now()) / (60 * 60 * 1000));
        res.status(429).json({
          error: "new_withdrawal_address_cooldown",
          message: `لأمانك، يجب الانتظار ${hoursLeft} ساعة قبل السحب إلى عنوان جديد`,
          usableAt: check.usableAt.toISOString(),
        });
        // Best-effort security alert — a fresh withdrawal address is the
        // strongest signal of account takeover we have.
        void notifyUser(
          telegramId,
          `⚠️ تنبيه أمني\nتم تسجيل عنوان سحب جديد على حسابك (${destNetwork}). إن لم تكن أنت، غيّر كلمة المرور وراجع نشاطك فوراً.\nالعنوان يصبح صالحاً بعد ${hoursLeft} ساعة.`,
        );
        return;
      }
      if (check.reason === "address_revoked") {
        res.status(403).json({ error: "withdrawal_address_revoked" });
        return;
      }
    }
  }

  // Do NOT pre-deduct — balance is deducted when admin approves the withdrawal.
  // This prevents permanent fund loss if the withdrawal is rejected.
  const addressStr = destination && Object.keys(destination).length > 0
    ? JSON.stringify(destination)
    : null;

  let withdrawal: typeof withdrawalsTable.$inferSelect;
  try {
    [withdrawal] = await db
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
        sourceBot: bot.slug,
        idempotencyKey: idemKey,
      })
      .returning();
  } catch (err) {
    // Race: a concurrent retry won the idempotency insert.
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION && idemKey) {
      const [winner] = await db
        .select()
        .from(withdrawalsTable)
        .where(and(
          eq(withdrawalsTable.sourceBot, bot.slug),
          eq(withdrawalsTable.idempotencyKey, idemKey),
        ))
        .limit(1);
      if (winner) {
        const amtMatch = Math.abs(parseFloat(winner.amount) - amountNum) < 0.0001;
        if (winner.userId !== user.id || winner.method !== methodCode || !amtMatch) {
          res.status(409).json({ error: "idempotency_key_reused_with_different_payload" });
          return;
        }
        res.status(200).json({
          success: true,
          withdrawalId: winner.id,
          status: winner.status,
          replayed: true,
        });
        return;
      }
    }
    throw err;
  }

  req.log.info(
    { withdrawalId: withdrawal.id, botSlug: bot.slug, telegramId, amountNum, methodCode },
    "Internal withdrawal request created"
  );

  // Confirm to the user that the request was received and is pending review.
  void notifyUser(
    telegramId,
    `📤 طلب سحب قيد المراجعة\nالمبلغ: ${amountNum.toFixed(2)} SKZ\nطريقة: ${methodCode}\nسيتم إعلامك فور الموافقة أو الرفض.`,
  );

  // Analytics + admin alert. Both are fire-and-forget — must not block
  // the success response or fail the request if external services hiccup.
  capture("withdraw_requested", telegramId, {
    withdrawal_id: withdrawal.id,
    amount_skz: amountNum,
    method: methodCode,
    bot_slug: bot.slug,
  });
  notifyAdmin(
    `طلب سحب جديد #${withdrawal.id}`,
    `<p>طلب سحب جديد قيد المراجعة.</p>
     <ul>
       <li>المعرّف: <b>#${withdrawal.id}</b></li>
       <li>المستخدم (Telegram): <b>${telegramId}</b></li>
       <li>المبلغ: <b>${amountNum.toFixed(2)} SKZ</b></li>
       <li>الطريقة: <b>${methodCode}</b></li>
       <li>البوت المصدر: <b>${bot.slug}</b></li>
     </ul>`,
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
  // Note: refund-entry intentionally does NOT block when isBlocked=true —
  // a blocked user should still be made whole if their game wasn't actually
  // played. Block enforcement happens on entry/credit, not on refund.

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
