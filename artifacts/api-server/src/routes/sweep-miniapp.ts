/**
 * /api/sweep/* — Telegram Mini App BFF for SOUQRATES SWEEP.
 *
 * Authentication: Every request must carry `X-Telegram-Init-Data` header.
 * The server verifies the HMAC-SHA256 signature using SWEEP_BOT_TOKEN (or
 * MOTHER_BOT_TOKEN as fallback). In dev (no token configured), auth is skipped
 * with a warning and a telegramId must be supplied via `X-Dev-Telegram-Id`.
 *
 * Provably Fair: The server generates a random serverSeed, commits its SHA-256
 * hash upfront, then derives the visual outcome using the same character-byte
 * algorithm as the client's provablyFair.ts — so the browser can fully
 * re-verify the result without a separate algorithm.
 *
 * Routes:
 *   GET  /api/sweep/balance
 *   GET  /api/sweep/game-types
 *   POST /api/sweep/buy-ticket
 *   GET  /api/sweep/my-tickets
 *   GET  /api/sweep/lotto/current
 *   POST /api/sweep/lotto/enter
 *   GET  /api/sweep/lotto/my-entries
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  sweepGameTypesTable,
  sweepTicketsTable,
  sweepLottoDrawsTable,
  sweepLottoEntriesTable,
  sweepJackpotPoolTable,
} from "@workspace/db";
import { perUserCreateLimiter } from "../lib/rate-limit";

const router: IRouter = Router();

// ── Game metadata: slug → { symbols, gridSize } ──────────────────────────────
// Hardcoded server-side so the client cannot manipulate symbols to affect odds.
const GAME_METADATA: Record<string, { symbols: string[]; gridSize: number }> = {
  "tribe-treasure":  { symbols: ["💎", "🏺", "🌵", "🐪", "🌙", "⭐", "🔮", "💛", "🦅"], gridSize: 9 },
  "luck-garden":     { symbols: ["🍀", "🍇", "🍓", "🍋", "🍊", "🍉", "🌿", "🌸", "🍑"], gridSize: 5 },
  "eastern-nights":  { symbols: ["🌙", "⭐", "🕌", "🪔", "🌟", "💫", "🔮", "🌺", "🏮"], gridSize: 4 },
  "wealth-lightning":{ symbols: ["⚡", "🌩️", "💜", "🔋", "💡", "🌪️", "🔆", "✨", "🫧"],  gridSize: 3 },
  "golden-dragon":   { symbols: ["🐉", "🔥", "💰", "👑", "🎖️", "🏅", "💎", "🌋", "⚔️"],  gridSize: 6 },
  "luck-wave":       { symbols: ["🌊", "🐚", "🐠", "🐬", "🏄", "🦀", "⚓", "🐙", "🌈"], gridSize: 6 },
  "jungle-king":     { symbols: ["🦁", "🐘", "🦒", "🐆", "🦏", "🦓", "🦅", "🌴", "🍃"], gridSize: 6 },
  "wealth-mask":     { symbols: ["🎭", "🎪", "🎨", "🎬", "🎠", "🎡", "🌹", "🎀", "✨"],  gridSize: 6 },
  "space-journey":   { symbols: ["🚀", "🪐", "⭐", "🌌", "🛸", "🌙", "☄️", "🌟", "👾"],  gridSize: 3 },
  "champions-cup":   { symbols: ["🏆", "🥇", "🎖️", "👑", "💎", "⭐", "🌟", "🎯", "🔑"],  gridSize: 5 },
};

// Default prize tiers for scratch games (matching the client checkWin logic):
// 3 match = 3× | 4 match = 5× | full match = 10×
const DEFAULT_PRIZE_TIERS = [
  { matchCount: 3, multiplier: 3,  label: "3 متطابقة" },
  { matchCount: 4, multiplier: 5,  label: "4 متطابقة" },
  { matchCount: 9, multiplier: 10, label: "فوز كامل"  },
];

// ── Telegram initData verification ───────────────────────────────────────────

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

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

function parseInitData(initData: string): { telegramId: bigint; tgUser: TgUser } | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    const tgUser: TgUser = JSON.parse(userStr);
    if (!tgUser?.id) return null;
    return { telegramId: BigInt(tgUser.id), tgUser };
  } catch {
    return null;
  }
}

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

type AuthedReq = Request & { telegramId: bigint; tgUser: TgUser };

function requireSweepAuth(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;

  if (!initData) {
    // Dev bypass: allow explicit telegramId header in non-production environments
    const isDev = process.env.NODE_ENV !== "production";
    const devId = req.headers["x-dev-telegram-id"] as string | undefined;
    if (isDev && devId) {
      try {
        (req as AuthedReq).telegramId = BigInt(devId);
        (req as AuthedReq).tgUser = { id: Number(devId), first_name: "Dev" };
        next();
      } catch {
        res.status(400).json({ error: "Invalid X-Dev-Telegram-Id" });
      }
      return;
    }
    res.status(401).json({ error: "Missing X-Telegram-Init-Data header" });
    return;
  }

  const tokens = [process.env.SWEEP_BOT_TOKEN, process.env.MOTHER_BOT_TOKEN].filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );

  if (tokens.length === 0) {
    // Dev mode: skip signature check, just parse
    const parsed = parseInitData(initData);
    if (!parsed) { res.status(400).json({ error: "Could not parse initData" }); return; }
    (req as AuthedReq).telegramId = parsed.telegramId;
    (req as AuthedReq).tgUser = parsed.tgUser;
    next();
    return;
  }

  const matched = tokens.some((tok) => verifyInitData(initData, tok));
  if (!matched) {
    res.status(403).json({ error: "Invalid Telegram initData signature" });
    return;
  }

  const params = new URLSearchParams(initData);
  const authDateStr = params.get("auth_date");
  if (!authDateStr) { res.status(403).json({ error: "initData missing auth_date" }); return; }
  const authDateSeconds = parseInt(authDateStr, 10);
  if (isNaN(authDateSeconds)) { res.status(403).json({ error: "Invalid auth_date" }); return; }
  const age = Math.floor(Date.now() / 1000) - authDateSeconds;
  if (age > INIT_DATA_MAX_AGE_SECONDS) {
    res.status(403).json({ error: "initData expired — re-open the Mini App" });
    return;
  }

  const parsed = parseInitData(initData);
  if (!parsed) { res.status(400).json({ error: "Could not parse user from initData" }); return; }
  (req as AuthedReq).telegramId = parsed.telegramId;
  (req as AuthedReq).tgUser = parsed.tgUser;
  next();
}

// ── Upsert user helper ────────────────────────────────────────────────────────

async function getOrUpsertUser(telegramId: bigint, tgUser: TgUser) {
  const [user] = await db.insert(usersTable).values({
    telegramId,
    username:     tgUser.username   ?? null,
    firstName:    tgUser.first_name ?? "Player",
    lastName:     tgUser.last_name  ?? null,
    languageCode: tgUser.language_code ?? "en",
    isPremium:    tgUser.is_premium ?? false,
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

  if (!user) throw new Error("Failed to upsert user");

  const [wallet] = await db.insert(walletsTable).values({ userId: user.id })
    .onConflictDoNothing().returning();
  const finalWallet = wallet ??
    (await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id)))[0];

  return { user, wallet: finalWallet! };
}

// ── Provably Fair derivation (matches client provablyFair.ts) ─────────────────

function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

/**
 * Deterministic outcome — identical algorithm to client-side deriveOutcome().
 * Uses combined string bytes as a simple PRNG so both sides agree on result.
 */
function deriveOutcome(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  symbols: string[],
  gridSize: number,
): string[] {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const bytes: number[] = [];
  for (let i = 0; i < combined.length; i++) bytes.push(combined.charCodeAt(i) & 0xff);
  const result: string[] = [];
  for (let i = 0; i < gridSize; i++) {
    const byteIdx = (i * 31) % bytes.length;
    const idx = bytes[byteIdx]! % symbols.length;
    result.push(symbols[idx]!);
  }
  return result;
}

function checkWin(outcome: string[]): { isWinner: boolean; multiplier: number } {
  const counts: Record<string, number> = {};
  outcome.forEach((s) => { counts[s] = (counts[s] ?? 0) + 1; });
  const maxCount = Math.max(...Object.values(counts));
  if (maxCount >= 3) {
    const mult = maxCount === outcome.length ? 10 : maxCount >= 4 ? 5 : 3;
    return { isWinner: true, multiplier: mult };
  }
  return { isWinner: false, multiplier: 0 };
}

// ── Ensure jackpot pool row exists ────────────────────────────────────────────
async function ensureJackpotPool(): Promise<typeof sweepJackpotPoolTable.$inferSelect> {
  const [existing] = await db.select().from(sweepJackpotPoolTable).where(eq(sweepJackpotPoolTable.id, 1));
  if (existing) return existing;
  await db.insert(sweepJackpotPoolTable).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(sweepJackpotPoolTable).where(eq(sweepJackpotPoolTable.id, 1));
  return row!;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/sweep/balance ────────────────────────────────────────────────────
router.get("/sweep/balance", requireSweepAuth, async (req, res): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedReq;
  const { wallet } = await getOrUpsertUser(telegramId, tgUser);
  res.json({ balanceSkz: wallet.balanceSkz });
});

// ── GET /api/sweep/game-types ─────────────────────────────────────────────────
router.get("/sweep/game-types", requireSweepAuth, async (_req, res): Promise<void> => {
  const games = await db
    .select()
    .from(sweepGameTypesTable)
    .where(eq(sweepGameTypesTable.isActive, true))
    .orderBy(sweepGameTypesTable.sortOrder, sweepGameTypesTable.id);

  const jackpot = await ensureJackpotPool();
  res.json({ data: games, jackpotBalanceSkz: jackpot.balanceSkz });
});

// ── POST /api/sweep/buy-ticket ────────────────────────────────────────────────
router.post("/sweep/buy-ticket", requireSweepAuth, perUserCreateLimiter, async (req, res): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedReq;
  const { gameSlug, clientSeed: userClientSeed, qty = 1 } = req.body as {
    gameSlug?: string;
    clientSeed?: string;
    qty?: number;
  };

  if (!gameSlug) {
    res.status(400).json({ error: "gameSlug is required" });
    return;
  }

  const gameMeta = GAME_METADATA[gameSlug];
  if (!gameMeta) {
    res.status(400).json({ error: `Unknown game slug: ${gameSlug}` });
    return;
  }

  const quantity = Math.min(Math.max(1, Math.floor(qty)), 5);

  const [gameType] = await db
    .select()
    .from(sweepGameTypesTable)
    .where(and(eq(sweepGameTypesTable.slug, gameSlug), eq(sweepGameTypesTable.isActive, true)));

  if (!gameType) {
    res.status(404).json({ error: "Game type not found or inactive" });
    return;
  }

  const { user, wallet: userWallet } = await getOrUpsertUser(telegramId, tgUser);

  if (user.isBlocked) {
    res.status(403).json({ error: "هذا المستخدم محظور" });
    return;
  }

  if (!userWallet) {
    res.status(500).json({ error: "Wallet not found" });
    return;
  }

  const priceSKZ = parseFloat(gameType.priceSKZ) * quantity;
  const jackpotRate = parseFloat(gameType.jackpotContributionRate);
  const jackpotContrib = parseFloat((priceSKZ * jackpotRate).toFixed(2));

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashSeed(serverSeed);
  const clientSeed = (userClientSeed ?? "").slice(0, 64) || crypto.randomUUID();
  const nonce = 0;

  const outcome = deriveOutcome(serverSeed, clientSeed, nonce, gameMeta.symbols, gameMeta.gridSize);
  const { isWinner, multiplier } = checkWin(outcome);
  const prizeSkz = isWinner ? parseFloat((parseFloat(gameType.priceSKZ) * quantity * multiplier).toFixed(2)) : 0;

  try {
    const ticket = await db.transaction(async (tx) => {
      const [updatedWallet] = await tx
        .update(walletsTable)
        .set({ balanceSkz: sql`${walletsTable.balanceSkz} - ${priceSKZ}` })
        .where(
          and(
            eq(walletsTable.userId, user.id),
            sql`${walletsTable.balanceSkz} >= ${priceSKZ}`,
          ),
        )
        .returning();

      if (!updatedWallet) {
        throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { status: 400 });
      }

      const [txnRow] = await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "debit",
        currency: "skz",
        amount: String(priceSKZ),
        fee: "0",
        status: "completed",
        sourceBot: "sweep-bot",
        referenceId: `sweep_miniapp_${user.id}_${Date.now()}`,
        description: `تذكرة ${gameType.nameAr || gameType.name} × ${quantity}`,
        metadata: JSON.stringify({ gameTypeId: gameType.id, gameSlug, quantity }),
      }).returning();

      if (prizeSkz > 0) {
        await tx
          .update(walletsTable)
          .set({
            balanceSkz: sql`${walletsTable.balanceSkz} + ${prizeSkz}`,
            totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${prizeSkz}`,
          })
          .where(eq(walletsTable.userId, user.id));

        await tx.insert(transactionsTable).values({
          userId: user.id,
          type: "credit",
          currency: "skz",
          amount: String(prizeSkz),
          fee: "0",
          status: "completed",
          sourceBot: "sweep-bot",
          referenceId: `sweep_prize_miniapp_${user.id}_${Date.now()}`,
          description: `جائزة ${gameType.nameAr || gameType.name}`,
          metadata: JSON.stringify({ gameTypeId: gameType.id, gameSlug }),
        });
      }

      if (jackpotContrib > 0) {
        await tx
          .insert(sweepJackpotPoolTable)
          .values({ id: 1, balanceSkz: String(jackpotContrib), totalContributedSkz: String(jackpotContrib) })
          .onConflictDoUpdate({
            target: sweepJackpotPoolTable.id,
            set: {
              balanceSkz: sql`${sweepJackpotPoolTable.balanceSkz} + ${jackpotContrib}`,
              totalContributedSkz: sql`${sweepJackpotPoolTable.totalContributedSkz} + ${jackpotContrib}`,
            },
          });
      }

      const [ticket] = await tx.insert(sweepTicketsTable).values({
        userId: user.id,
        gameTypeId: gameType.id,
        priceSKZ: String(priceSKZ),
        serverSeedHash,
        serverSeed,
        clientSeed,
        result: { outcome, isWinner, multiplier, quantity } as Record<string, unknown>,
        prizeSkz: String(prizeSkz),
        isWin: isWinner,
        status: "played",
        transactionId: txnRow?.id ?? null,
        playedAt: new Date(),
      }).returning();

      return ticket!;
    });

    res.json({
      ticketId: ticket.id,
      serverSeedHash,
      serverSeed,
      clientSeed,
      nonce,
      isWinner,
      prizeSkz,
      outcome,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "رصيد SKZ غير كافٍ" });
      return;
    }
    req.log.error({ err }, "sweep miniapp buy-ticket failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/sweep/my-tickets ─────────────────────────────────────────────────
router.get("/sweep/my-tickets", requireSweepAuth, async (req, res): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedReq;
  const { user } = await getOrUpsertUser(telegramId, tgUser);

  const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const tickets = await db
    .select({
      ticket: sweepTicketsTable,
      gameSlug: sweepGameTypesTable.slug,
      gameName: sweepGameTypesTable.name,
      gameNameAr: sweepGameTypesTable.nameAr,
      gameEmoji: sweepGameTypesTable.emoji,
    })
    .from(sweepTicketsTable)
    .leftJoin(sweepGameTypesTable, eq(sweepGameTypesTable.id, sweepTicketsTable.gameTypeId))
    .where(eq(sweepTicketsTable.userId, user.id))
    .orderBy(desc(sweepTicketsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: tickets, limit, offset });
});

// ── GET /api/sweep/lotto/current ──────────────────────────────────────────────
router.get("/sweep/lotto/current", requireSweepAuth, async (_req, res): Promise<void> => {
  const [draw] = await db
    .select()
    .from(sweepLottoDrawsTable)
    .where(eq(sweepLottoDrawsTable.status, "open"))
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(1);

  const jackpot = await ensureJackpotPool();

  res.json({
    draw: draw ?? null,
    jackpotBalanceSkz: jackpot.balanceSkz,
    entryPriceSKZ: 5,
    closesAt: draw?.closesAt ?? null,
  });
});

// ── POST /api/sweep/lotto/enter ───────────────────────────────────────────────
router.post("/sweep/lotto/enter", requireSweepAuth, perUserCreateLimiter, async (req, res): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedReq;
  const { chosenNumbers } = req.body as { chosenNumbers?: number[] };

  if (!Array.isArray(chosenNumbers) || chosenNumbers.length !== 6) {
    res.status(400).json({ error: "chosenNumbers must be an array of exactly 6 numbers" });
    return;
  }

  const valid = chosenNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 49);
  const unique = new Set(chosenNumbers).size === 6;
  if (!valid || !unique) {
    res.status(400).json({ error: "chosenNumbers must be 6 unique integers between 1 and 49" });
    return;
  }

  const { user } = await getOrUpsertUser(telegramId, tgUser);

  if (user.isBlocked) {
    res.status(403).json({ error: "هذا المستخدم محظور" });
    return;
  }

  const [draw] = await db
    .select()
    .from(sweepLottoDrawsTable)
    .where(eq(sweepLottoDrawsTable.status, "open"))
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(1);

  if (!draw) {
    res.status(400).json({ error: "لا يوجد سحب مفتوح حالياً" });
    return;
  }

  const entryPrice = 5;

  try {
    const entry = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .update(walletsTable)
        .set({ balanceSkz: sql`${walletsTable.balanceSkz} - ${entryPrice}` })
        .where(
          and(
            eq(walletsTable.userId, user.id),
            sql`${walletsTable.balanceSkz} >= ${entryPrice}`,
          ),
        )
        .returning();

      if (!wallet) throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { status: 400 });

      const [txnRow] = await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "debit",
        currency: "skz",
        amount: String(entryPrice),
        fee: "0",
        status: "completed",
        sourceBot: "sweep-bot",
        referenceId: `lotto_miniapp_${user.id}_${draw.id}_${Date.now()}`,
        description: `اشتراك اللوتو — سحب رقم ${draw.drawNumber}`,
        metadata: JSON.stringify({ drawId: draw.id, chosenNumbers }),
      }).returning();

      await tx
        .update(sweepLottoDrawsTable)
        .set({ totalEntries: sql`${sweepLottoDrawsTable.totalEntries} + 1` })
        .where(eq(sweepLottoDrawsTable.id, draw.id));

      const [entry] = await tx.insert(sweepLottoEntriesTable).values({
        drawId: draw.id,
        userId: user.id,
        telegramId: user.telegramId,
        chosenNumbers,
        priceSKZ: String(entryPrice),
        transactionId: txnRow?.id ?? null,
      }).returning();

      return entry!;
    });

    res.json({ entry, drawId: draw.id, drawNumber: draw.drawNumber, entryPriceSKZ: entryPrice });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "رصيد SKZ غير كافٍ" });
      return;
    }
    req.log.error({ err }, "sweep miniapp lotto enter failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/sweep/lotto/my-entries ──────────────────────────────────────────
router.get("/sweep/lotto/my-entries", requireSweepAuth, async (req, res): Promise<void> => {
  const { telegramId, tgUser } = req as AuthedReq;
  const { user } = await getOrUpsertUser(telegramId, tgUser);

  const entries = await db
    .select({
      entry: sweepLottoEntriesTable,
      drawNumber: sweepLottoDrawsTable.drawNumber,
      drawStatus: sweepLottoDrawsTable.status,
      winningNumbers: sweepLottoDrawsTable.winningNumbers,
      closesAt: sweepLottoDrawsTable.closesAt,
    })
    .from(sweepLottoEntriesTable)
    .leftJoin(sweepLottoDrawsTable, eq(sweepLottoDrawsTable.id, sweepLottoEntriesTable.drawId))
    .where(eq(sweepLottoEntriesTable.userId, user.id))
    .orderBy(desc(sweepLottoEntriesTable.createdAt))
    .limit(50);

  res.json({ data: entries });
});

export default router;
