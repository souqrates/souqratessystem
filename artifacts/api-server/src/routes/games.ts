/**
 * /api/games/* — Secure BFF proxy for the Games-Bot (SOUQRATES SKILLZ) frontend.
 *
 * Authentication: Every request must carry the `X-Telegram-Init-Data` header
 * with the raw Telegram Mini App initData string. The server verifies the
 * HMAC-SHA256 signature using GAMES_BOT_TOKEN before touching any financial op.
 *
 * If GAMES_BOT_TOKEN is not set (local dev) verification is skipped with a
 * warning — callers must still provide a syntactically valid telegramId.
 *
 * Financial write operations (charge-entry, credit-reward, stars-invoice,
 * ton-deposit-intent, withdraw) are forwarded server-side to the corresponding
 * /internal/* endpoints using the games-bot's stored API key. This means:
 *   1. The bot API key never leaves the server.
 *   2. All financial logic (commission, referrals, double-claim) lives in one
 *      place — the /internal/* handlers are the single source of truth.
 *   3. The /api/games/* layer is purely an authentication adapter.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  platformSettingsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GAMES_BOT_SLUG = "games-bot";

// ─── Telegram initData verification ──────────────────────────────────────────

function verifyInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

function parseInitData(initData: string): { telegramId: bigint; tgUser: TelegramUser } | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    const tgUser: TelegramUser = JSON.parse(userStr);
    if (!tgUser?.id) return null;
    return { telegramId: BigInt(tgUser.id), tgUser };
  } catch {
    return null;
  }
}

type AuthedRequest = Request & { telegramId: bigint; tgUser: TelegramUser };

/**
 * Maximum age of a valid Telegram initData payload (24 hours).
 *
 * Telegram's `window.Telegram.WebApp.initData` is set once when the Mini App
 * opens and does NOT auto-refresh while the app stays open. A short TTL here
 * (e.g. 5 minutes) breaks the entire app after a few minutes of idle play:
 * every charge/credit/balance call returns 403 "initData has expired" and the
 * user can't open any game until they close and reopen the bot.
 *
 * 24h is the standard Telegram-recommended freshness window and matches what
 * official Telegram WebApp examples and the official docs use.
 */
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

function requireTelegramAuth(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  if (!initData) {
    res.status(401).json({ error: "Missing X-Telegram-Init-Data header" });
    return;
  }

  const candidateTokens = [
    process.env.GAMES_BOT_TOKEN,
    process.env.MOTHER_BOT_TOKEN,
  ].filter((t): t is string => typeof t === "string" && t.length > 0);

  if (candidateTokens.length === 0) {
    res.status(503).json({ error: "No bot token configured on this server. Financial operations are disabled." });
    return;
  }
  const matched = candidateTokens.some((tok) => verifyInitData(initData, tok));
  if (!matched) {
    res.status(403).json({ error: "Invalid Telegram initData signature" });
    return;
  }

  // Enforce auth_date freshness — reject replayed initData older than 24 hours
  const params = new URLSearchParams(initData);
  const authDateStr = params.get("auth_date");
  if (!authDateStr) {
    res.status(403).json({ error: "initData is missing auth_date" });
    return;
  }
  const authDateSeconds = parseInt(authDateStr, 10);
  if (isNaN(authDateSeconds)) {
    res.status(403).json({ error: "initData has invalid auth_date" });
    return;
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - authDateSeconds;
  if (ageSeconds > INIT_DATA_MAX_AGE_SECONDS) {
    res.status(403).json({ error: "initData has expired — re-open the Mini App to refresh" });
    return;
  }

  const parsed = parseInitData(initData);
  if (!parsed) {
    res.status(400).json({ error: "Could not parse user from initData" });
    return;
  }

  (req as AuthedRequest).telegramId = parsed.telegramId;
  (req as AuthedRequest).tgUser     = parsed.tgUser;
  next();
}

// ─── Shared DB helpers (read-only routes only) ────────────────────────────────

async function getOrUpsertUser(telegramId: bigint, tgUser: TelegramUser, referrerTelegramId?: string) {
  let referrerId: number | null = null;
  if (referrerTelegramId) {
    try {
      const refTid = BigInt(referrerTelegramId);
      if (refTid !== telegramId) {
        const [ref] = await db.select({ id: usersTable.id }).from(usersTable)
          .where(eq(usersTable.telegramId, refTid));
        referrerId = ref?.id ?? null;
      }
    } catch { /* invalid referrer id */ }
  }

  const [user] = await db.insert(usersTable).values({
    telegramId,
    username:     tgUser.username    ?? null,
    firstName:    tgUser.first_name  ?? "Player",
    lastName:     tgUser.last_name   ?? null,
    languageCode: tgUser.language_code ?? "en",
    isPremium:    tgUser.is_premium  ?? false,
    referrerId,
  }).onConflictDoUpdate({
    target: usersTable.telegramId,
    set: {
      username:  tgUser.username   ?? null,
      firstName: tgUser.first_name ?? "Player",
      lastName:  tgUser.last_name  ?? null,
      isPremium: tgUser.is_premium ?? false,
      updatedAt: new Date(),
    },
  }).returning();

  const [wallet] = await db.insert(walletsTable).values({ userId: user.id })
    .onConflictDoNothing().returning();
  const finalWallet = wallet ??
    (await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id)))[0];

  return { user, wallet: finalWallet! };
}

/** Load solo tiers from platform_settings for the public /tiers endpoint. */
async function loadSoloTiers() {
  const rows = await db.select().from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, [
      "solo_entry_fee_easy", "solo_entry_fee_medium", "solo_entry_fee_hard", "solo_multiplier",
    ]));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  const multiplier = parseFloat(map["solo_multiplier"] ?? "3");
  return {
    tiers: [
      { difficulty: "Easy",   entryFee: parseFloat(map["solo_entry_fee_easy"]   ?? "5"),  multiplier, isDefault: false },
      { difficulty: "Medium", entryFee: parseFloat(map["solo_entry_fee_medium"] ?? "10"), multiplier, isDefault: true  },
      { difficulty: "Hard",   entryFee: parseFloat(map["solo_entry_fee_hard"]   ?? "15"), multiplier, isDefault: false },
    ],
  };
}

// ─── Internal proxy helpers ───────────────────────────────────────────────────

/** Cached games-bot API key (looked up once from DB, then reused). */
let _gamesBotApiKey: string | null = null;

async function getGamesBotApiKey(): Promise<string | null> {
  if (_gamesBotApiKey) return _gamesBotApiKey;
  const [bot] = await db
    .select({ apiKey: botsTable.apiKey })
    .from(botsTable)
    .where(eq(botsTable.slug, GAMES_BOT_SLUG));
  if (bot?.apiKey) _gamesBotApiKey = bot.apiKey;
  return _gamesBotApiKey ?? null;
}

function internalUrl(path: string): string {
  const port = process.env.PORT ?? "5000";
  return `http://localhost:${port}/api${path}`;
}

/**
 * Forward a POST to an /internal/* endpoint using the games-bot API key.
 * The calling user's telegramId must already be present in `body`.
 */
async function forwardPost(
  req: Request,
  res: Response,
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const apiKey = await getGamesBotApiKey();
  if (!apiKey) {
    res.status(503).json({
      error: "Games bot is not yet registered on this platform. POST /api/bots with slug=games-bot first.",
    });
    return;
  }
  try {
    const r = await fetch(internalUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json() as Record<string, unknown>;
    res.status(r.status).json(data);
  } catch (err) {
    req.log.error({ err, path }, "games: forward to internal endpoint failed");
    res.status(502).json({ error: "Internal service unavailable" });
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/games/upsert-user
 * Idempotent user + wallet provisioning from Telegram initData.
 */
router.post("/games/upsert-user", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedRequest;
  const { referrerTelegramId } = req.body as { referrerTelegramId?: string };
  try {
    const { user, wallet } = await getOrUpsertUser(telegramId, tgUser, referrerTelegramId);
    req.log.info({ telegramId: String(telegramId) }, "games: user upserted");
    res.json({ ok: true, userId: user.id, walletId: wallet.id });
  } catch (err) {
    req.log.error({ err }, "games: upsert-user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/games/balance
 * Return wallet balances for the calling user (auto-provisions if new).
 */
router.get("/games/balance", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedRequest;
  try {
    const { wallet } = await getOrUpsertUser(telegramId, tgUser);
    res.json({
      telegramId:        String(telegramId),
      balanceSkz:        wallet.balanceSkz,
      balanceStars:      wallet.balanceStars,
      balanceTon:        wallet.balanceTon,
      balanceUsdt:       wallet.balanceUsdt,
      totalEarnedSkz:    wallet.totalEarnedSkz,
      totalWithdrawnSkz: wallet.totalWithdrawnSkz,
    });
  } catch (err) {
    req.log.error({ err }, "games: balance failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/games/ledger
 * Transaction history for the calling user, scoped to games-bot.
 */
router.get("/games/ledger", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedRequest;
  const limit  = Math.min(parseInt(String(req.query.limit  ?? "50"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);
  try {
    const { user } = await getOrUpsertUser(telegramId, tgUser);
    const transactions = await db.select().from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId,    user.id),
        eq(transactionsTable.sourceBot, GAMES_BOT_SLUG),
      ))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit).offset(offset);
    res.json({ data: transactions, limit, offset });
  } catch (err) {
    req.log.error({ err }, "games: ledger failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/games/tiers
 * Return solo fee tiers from platform settings (no auth required).
 */
router.get("/games/tiers", async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tiers } = await loadSoloTiers();
    res.json({ tiers });
  } catch (err) {
    logger.error({ err }, "games: tiers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Financial write routes — all forwarded to /internal/* ───────────────────

/**
 * POST /api/games/charge-entry
 * Deduct entry fee for a solo game. Forwards to /internal/game/charge-entry.
 * Body: { gameId, amount }   (amount validated server-side against tier config)
 * Returns: { success, transactionId, entryFee, expectedPrize, newSkzBalance }
 */
router.post("/games/charge-entry", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { gameId, amount } = req.body as { gameId?: string | number; amount?: string | number };
  if (gameId === undefined || gameId === null || amount === undefined || amount === null) {
    res.status(400).json({ error: "gameId and amount are required" });
    return;
  }
  await forwardPost(req, res, "/internal/game/charge-entry", {
    telegramId: String(telegramId),
    gameId:     String(gameId),
    amount:     String(amount),
  });
});

/**
 * POST /api/games/validate-result
 * Validate game completion and issue a short-lived signed resultToken.
 * Must be called after a win, before credit-reward.
 * Forwards to /internal/game/validate-result.
 * Body: { chargeTransactionId, score? }
 * Returns: { ok, resultToken }
 */
router.post("/games/validate-result", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { chargeTransactionId, score } = req.body as {
    chargeTransactionId?: number | string;
    score?: number | string;
  };
  if (chargeTransactionId === undefined || chargeTransactionId === null) {
    res.status(400).json({ error: "chargeTransactionId is required" });
    return;
  }
  if (score === undefined || score === null) {
    res.status(400).json({ error: "score is required" });
    return;
  }
  await forwardPost(req, res, "/internal/game/validate-result", {
    telegramId:          String(telegramId),
    chargeTransactionId,
    score:               Math.round(Number(score)),
  });
});

/**
 * POST /api/games/credit-reward
 * Credit game-win reward. Forwards to /internal/game/credit-reward.
 * Body: { chargeTransactionId, score? }
 *   - Prize is derived server-side from stored charge metadata — never from client.
 *   - Double-claim and ownership validated in /internal/game/credit-reward.
 * Returns: { success, transactionId, newSkzBalance, commissionDeducted, netRewarded }
 */
router.post("/games/credit-reward", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { chargeTransactionId, score, resultToken } = req.body as {
    chargeTransactionId?: number | string;
    score?: number;
    resultToken?: string;
  };
  if (chargeTransactionId === undefined || chargeTransactionId === null) {
    res.status(400).json({ error: "chargeTransactionId is required" });
    return;
  }
  if (!resultToken) {
    res.status(400).json({ error: "resultToken is required — call /api/games/validate-result first" });
    return;
  }
  const body: Record<string, unknown> = {
    telegramId:          String(telegramId),
    chargeTransactionId,
    resultToken,
  };
  if (score != null) body.score = Math.round(Number(score));
  await forwardPost(req, res, "/internal/game/credit-reward", body);
});

/**
 * POST /api/games/refund-entry
 * Refund a game entry fee — used when the user legitimately won but the
 * server could not credit the reward. Forwards to /internal/game/refund-entry.
 * Body: { chargeTransactionId }
 * Returns: { success, transactionId, refundedAmount, newSkzBalance, alreadyRefunded? }
 */
router.post("/games/refund-entry", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { chargeTransactionId } = req.body as { chargeTransactionId?: number | string };
  if (chargeTransactionId === undefined || chargeTransactionId === null) {
    res.status(400).json({ error: "chargeTransactionId is required" });
    return;
  }
  await forwardPost(req, res, "/internal/game/refund-entry", {
    telegramId: String(telegramId),
    chargeTransactionId,
  });
});

/**
 * POST /api/games/stars-invoice
 * Create a Telegram Stars deposit invoice. Forwards to /internal/stars-invoice.
 * Body: { amountStars }
 * Returns: { ok, invoiceLink, payload, expectedSkz }
 */
router.post("/games/stars-invoice", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { amountStars } = req.body as { amountStars?: number | string };
  const starsNum = parseInt(String(amountStars ?? 0), 10);
  if (isNaN(starsNum) || starsNum <= 0) {
    res.status(400).json({ error: "amountStars must be a positive integer" });
    return;
  }
  await forwardPost(req, res, "/internal/stars-invoice", {
    telegramId:  String(telegramId),
    amountStars: starsNum,
  });
});

/**
 * POST /api/games/ton-deposit-intent
 * Create a TON deposit intent with a unique memo. Forwards to /internal/ton-deposit-intent.
 * Body: { amountTon }
 * Returns: { ok, intentId, memo, depositAddress, amountTon, expectedSkz, expiresAt }
 */
router.post("/games/ton-deposit-intent", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { amountTon } = req.body as { amountTon?: number | string };
  const tonNum = parseFloat(String(amountTon ?? 0));
  if (isNaN(tonNum) || tonNum <= 0) {
    res.status(400).json({ error: "amountTon must be a positive number" });
    return;
  }
  await forwardPost(req, res, "/internal/ton-deposit-intent", {
    telegramId: String(telegramId),
    amountTon:  tonNum,
  });
});

/**
 * POST /api/games/usdt-deposit-intent
 * Create a USDT-Jetton (on TON) deposit intent with a unique memo.
 * Forwards to /internal/usdt-deposit-intent.
 * Body: { amountUsdt }
 * Returns: { ok, intentId, memo, depositAddress, amountUsdt, expectedSkz, network, expiresAt }
 */
router.post("/games/usdt-deposit-intent", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { amountUsdt } = req.body as { amountUsdt?: number | string };
  const usdtNum = parseFloat(String(amountUsdt ?? 0));
  if (isNaN(usdtNum) || usdtNum <= 0) {
    res.status(400).json({ error: "amountUsdt must be a positive number" });
    return;
  }
  await forwardPost(req, res, "/internal/usdt-deposit-intent", {
    telegramId: String(telegramId),
    amountUsdt: usdtNum,
  });
});

/**
 * POST /api/games/withdraw
 * Create a pending SKZ withdrawal request. Forwards to /internal/withdraw.
 * Body: { methodCode, amountSkz, destination? }
 * Returns: { success, withdrawalId, newSkzBalance, status }
 */
router.post("/games/withdraw", requireTelegramAuth, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req as AuthedRequest;
  const { methodCode, amountSkz, destination } = req.body as {
    methodCode?: string;
    amountSkz?: string | number;
    destination?: Record<string, unknown>;
  };
  if (!methodCode || amountSkz === undefined || amountSkz === null) {
    res.status(400).json({ error: "methodCode and amountSkz are required" });
    return;
  }
  const body: Record<string, unknown> = {
    telegramId: String(telegramId),
    methodCode,
    amountSkz:  String(amountSkz),
  };
  if (destination && Object.keys(destination).length > 0) body.destination = destination;
  await forwardPost(req, res, "/internal/withdraw", body);
});

export default router;
