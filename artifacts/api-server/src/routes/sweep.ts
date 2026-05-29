/**
 * SOUQRATES SWEEP — internal + superadmin routes.
 *
 * Internal routes (X-Bot-Api-Key):
 *   GET  /internal/sweep/game-types
 *   POST /internal/sweep/play
 *   GET  /internal/sweep/ticket/:id
 *   GET  /internal/sweep/my-tickets
 *   GET  /internal/sweep/lotto/current
 *   POST /internal/sweep/lotto/enter
 *   GET  /internal/sweep/lotto/my-entries
 *
 * Superadmin routes (requireSuperAdmin):
 *   GET    /superadmin/sweep/game-types
 *   POST   /superadmin/sweep/game-types
 *   PATCH  /superadmin/sweep/game-types/:id
 *   DELETE /superadmin/sweep/game-types/:id
 *   GET    /superadmin/sweep/tickets
 *   GET    /superadmin/sweep/lotto/draws
 *   PATCH  /superadmin/sweep/lotto/draws/:id
 *   POST   /superadmin/sweep/lotto/trigger-draw
 *   GET    /superadmin/sweep/jackpot
 *   PATCH  /superadmin/sweep/jackpot
 *   GET    /superadmin/sweep/stats
 */
import { Router, type IRouter } from "express";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  botsTable,
  usersTable,
  walletsTable,
  transactionsTable,
  sweepGameTypesTable,
  sweepTicketsTable,
  sweepLottoDrawsTable,
  sweepLottoEntriesTable,
  sweepJackpotPoolTable,
} from "@workspace/db";
import { requireSuperAdmin } from "../lib/super-admin-auth";
import { logAdminAction } from "../lib/audit-log";
import { perUserCreateLimiter } from "../lib/rate-limit";
import {
  generateServerSeed,
  hashSeed,
  deriveResult,
  deriveUniqueNumbers,
  countLottoMatches,
  type PrizeTier,
} from "../lib/sweep-fair";

const router: IRouter = Router();

// ── Auth helper (mirrors internal.ts) ────────────────────────────────────────
async function requireBot(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1],
): Promise<typeof botsTable.$inferSelect | null> {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Bot-Api-Key header" });
    return null;
  }
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  if (!bot || !bot.isActive) {
    res.status(403).json({ error: "Invalid or inactive bot API key" });
    return null;
  }
  return bot;
}

function rejectIfBlocked(
  user: { isBlocked: boolean | null },
  res: Parameters<Parameters<typeof router.post>[1]>[1],
): boolean {
  if (user.isBlocked === true) {
    res.status(403).json({ error: "هذا المستخدم محظور" });
    return true;
  }
  return false;
}

// ── Ensure jackpot pool row exists ────────────────────────────────────────────
async function ensureJackpotPool(): Promise<typeof sweepJackpotPoolTable.$inferSelect> {
  const [existing] = await db.select().from(sweepJackpotPoolTable).where(eq(sweepJackpotPoolTable.id, 1));
  if (existing) return existing;
  const [created] = await db.insert(sweepJackpotPoolTable).values({ id: 1 }).onConflictDoNothing().returning();
  if (created) return created;
  const [row] = await db.select().from(sweepJackpotPoolTable).where(eq(sweepJackpotPoolTable.id, 1));
  return row!;
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no auth required
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /sweep/jackpot ────────────────────────────────────────────────────────
// Returns the live jackpot amount + next draw time. Called by the Mini App
// every 30 s so users see the growing pot in real time. No auth required.
router.get("/sweep/jackpot", async (_req, res): Promise<void> => {
  const [pool, openDraw] = await Promise.all([
    ensureJackpotPool(),
    db
      .select({
        closesAt: sweepLottoDrawsTable.closesAt,
        totalEntries: sweepLottoDrawsTable.totalEntries,
        drawNumber: sweepLottoDrawsTable.drawNumber,
      })
      .from(sweepLottoDrawsTable)
      .where(eq(sweepLottoDrawsTable.status, "open"))
      .orderBy(desc(sweepLottoDrawsTable.drawNumber))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  // If the draw has an explicit closesAt, surface it; otherwise compute the
  // upcoming Saturday at 20:00 (local server time) as the default countdown target.
  let nextDrawAt: string | null = openDraw?.closesAt?.toISOString() ?? null;
  if (!nextDrawAt) {
    const now = new Date();
    const sat = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
    const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
    sat.setDate(now.getDate() + daysUntilSat);
    sat.setHours(20, 0, 0, 0);
    nextDrawAt = sat.toISOString();
  }

  res.json({
    jackpotBalanceSkz: parseFloat(pool.balanceSkz),
    nextDrawAt,
    totalEntries: openDraw?.totalEntries ?? 0,
    drawNumber: openDraw?.drawNumber ?? null,
  });
});

// ── GET /sweep/draws/history ──────────────────────────────────────────────────
// Public endpoint — returns completed draws for transparency / Provably Fair
// display. Includes winning numbers, jackpot, entry count, and winner count.
// Optional ?detail=true adds a per-draw prize tier breakdown grouped by matchCount.
router.get("/sweep/draws/history", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10), 0);
  const detail = String(req.query.detail ?? "") === "true";

  const draws = await db
    .select({
      id: sweepLottoDrawsTable.id,
      drawNumber: sweepLottoDrawsTable.drawNumber,
      winningNumbers: sweepLottoDrawsTable.winningNumbers,
      jackpotAmountSkz: sweepLottoDrawsTable.jackpotAmountSkz,
      totalEntries: sweepLottoDrawsTable.totalEntries,
      totalPaidOutSkz: sweepLottoDrawsTable.totalPaidOutSkz,
      drawnAt: sweepLottoDrawsTable.drawnAt,
      serverSeedHash: sweepLottoDrawsTable.serverSeedHash,
      serverSeed: sweepLottoDrawsTable.serverSeed,
    })
    .from(sweepLottoDrawsTable)
    .where(eq(sweepLottoDrawsTable.status, "drawn"))
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(limit)
    .offset(offset);

  const drawIds = draws.map((d) => d.id);

  // Count jackpot winners per draw
  let winnerCounts: Record<number, number> = {};
  // Prize tier breakdown per draw (only when ?detail=true)
  type TierRow = { matchCount: number; winners: number; prizePerWinner: number };
  let tiersByDraw: Record<number, TierRow[]> = {};

  if (drawIds.length > 0) {
    const inClause = sql.raw(`ARRAY[${drawIds.join(",")}]::int[]`);

    // Jackpot winners count (matchCount = 6 / isJackpot = true)
    const winnerRows = await db
      .select({
        drawId: sweepLottoEntriesTable.drawId,
        winnerCount: sql<number>`cast(count(*) as int)`,
      })
      .from(sweepLottoEntriesTable)
      .where(
        and(
          sql`${sweepLottoEntriesTable.drawId} = ANY(${inClause})`,
          eq(sweepLottoEntriesTable.isJackpot, true),
        ),
      )
      .groupBy(sweepLottoEntriesTable.drawId);
    winnerCounts = Object.fromEntries(winnerRows.map((r) => [r.drawId, r.winnerCount]));

    // Full tier breakdown — only fetch when client requests it
    if (detail) {
      const tierRows = await db
        .select({
          drawId: sweepLottoEntriesTable.drawId,
          matchCount: sweepLottoEntriesTable.matchCount,
          winners: sql<number>`cast(count(*) as int)`,
          totalPrize: sql<string>`cast(coalesce(sum(${sweepLottoEntriesTable.prizeSkz}), 0) as text)`,
        })
        .from(sweepLottoEntriesTable)
        .where(
          and(
            sql`${sweepLottoEntriesTable.drawId} = ANY(${inClause})`,
            sql`${sweepLottoEntriesTable.matchCount} IS NOT NULL`,
            sql`${sweepLottoEntriesTable.matchCount} >= 3`,
          ),
        )
        .groupBy(sweepLottoEntriesTable.drawId, sweepLottoEntriesTable.matchCount);

      for (const row of tierRows) {
        if (!tiersByDraw[row.drawId]) tiersByDraw[row.drawId] = [];
        const totalPrize = parseFloat(row.totalPrize ?? "0");
        const winners = row.winners ?? 0;
        tiersByDraw[row.drawId].push({
          matchCount: row.matchCount!,
          winners,
          prizePerWinner: winners > 0 ? parseFloat((totalPrize / winners).toFixed(2)) : 0,
        });
      }

      // Sort tiers descending by matchCount within each draw
      for (const id of Object.keys(tiersByDraw)) {
        tiersByDraw[Number(id)].sort((a, b) => b.matchCount - a.matchCount);
      }
    }
  }

  const data = draws.map((d) => ({
    ...d,
    jackpotAmountSkz: parseFloat(d.jackpotAmountSkz),
    totalPaidOutSkz: parseFloat(d.totalPaidOutSkz),
    winnerCount: winnerCounts[d.id] ?? 0,
    ...(detail ? { prizeTiers: tiersByDraw[d.id] ?? [] } : {}),
  }));

  res.json({ data, limit, offset, total: data.length });
});

// ═════════════════════════════════════════════════════════════════════════════
// INTERNAL ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /internal/sweep/game-types ────────────────────────────────────────────
router.get("/internal/sweep/game-types", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const games = await db
    .select()
    .from(sweepGameTypesTable)
    .where(eq(sweepGameTypesTable.isActive, true))
    .orderBy(sweepGameTypesTable.sortOrder, sweepGameTypesTable.id);

  const jackpot = await ensureJackpotPool();

  res.json({
    data: games,
    jackpotBalanceSkz: jackpot.balanceSkz,
  });
});

// ── POST /internal/sweep/play ─────────────────────────────────────────────────
router.post("/internal/sweep/play", perUserCreateLimiter, async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, gameTypeId, clientSeed } = req.body as {
    telegramId?: string | number;
    gameTypeId?: number;
    clientSeed?: string;
  };

  if (!telegramId || !gameTypeId) {
    res.status(400).json({ error: "telegramId and gameTypeId are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(String(telegramId))));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (rejectIfBlocked(user, res)) return;

  const [gameType] = await db
    .select()
    .from(sweepGameTypesTable)
    .where(and(eq(sweepGameTypesTable.id, gameTypeId), eq(sweepGameTypesTable.isActive, true)));
  if (!gameType) { res.status(404).json({ error: "Game type not found or inactive" }); return; }

  const priceSKZ = parseFloat(gameType.priceSKZ);
  const jackpotRate = parseFloat(gameType.jackpotContributionRate);
  const jackpotContrib = parseFloat((priceSKZ * jackpotRate).toFixed(2));

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashSeed(serverSeed);
  const effectiveClientSeed = (clientSeed ?? "").slice(0, 64) || crypto.randomUUID();

  const prizeTiers = (gameType.prizeTiers ?? []) as PrizeTier[];
  const { result, prizeSkz, isWin } = deriveResult(
    serverSeed,
    effectiveClientSeed,
    gameType.slug,
    priceSKZ,
    prizeTiers,
  );

  try {
    const ticket = await db.transaction(async (tx) => {
      // Atomic debit — guard: balance must cover the price
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

      // Ledger: debit ticket purchase
      const [txnRow] = await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "debit",
        currency: "skz",
        amount: String(priceSKZ),
        fee: "0",
        status: "completed",
        sourceBot: bot.slug,
        referenceId: `sweep_play_${user.id}_${Date.now()}`,
        description: `تذكرة ${gameType.nameAr || gameType.name}`,
        metadata: JSON.stringify({ gameTypeId, gameSlug: gameType.slug }),
      }).returning();

      // Credit prize if won
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
          sourceBot: bot.slug,
          referenceId: `sweep_prize_${user.id}_${Date.now()}`,
          description: `جائزة ${gameType.nameAr || gameType.name}`,
          metadata: JSON.stringify({ gameTypeId, gameSlug: gameType.slug }),
        });
      }

      // Add jackpot contribution
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

      // Insert ticket with revealed seed (played immediately)
      const [ticket] = await tx.insert(sweepTicketsTable).values({
        userId: user.id,
        gameTypeId,
        priceSKZ: String(priceSKZ),
        serverSeedHash,
        serverSeed,
        clientSeed: effectiveClientSeed,
        result: result as Record<string, unknown>,
        prizeSkz: String(prizeSkz),
        isWin,
        status: "played",
        transactionId: txnRow?.id ?? null,
        playedAt: new Date(),
      }).returning();

      return ticket;
    });

    res.json({
      ticket,
      prizeSkz: String(prizeSkz),
      isWin,
      result,
      serverSeed,
      serverSeedHash,
      clientSeed: effectiveClientSeed,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "رصيد SKZ غير كافٍ" });
      return;
    }
    req.log.error({ err }, "sweep play failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /internal/sweep/ticket/:id ───────────────────────────────────────────
router.get("/internal/sweep/ticket/:id", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ticket] = await db.select().from(sweepTicketsTable).where(eq(sweepTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const [user] = await db.select({ telegramId: usersTable.telegramId }).from(usersTable).where(eq(usersTable.id, ticket.userId));

  res.json({ ticket, telegramId: user?.telegramId?.toString() ?? null });
});

// ── GET /internal/sweep/my-tickets ───────────────────────────────────────────
router.get("/internal/sweep/my-tickets", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId } = req.query as { telegramId?: string };
  if (!telegramId) { res.status(400).json({ error: "telegramId is required" }); return; }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const tickets = await db
    .select()
    .from(sweepTicketsTable)
    .where(eq(sweepTicketsTable.userId, user.id))
    .orderBy(desc(sweepTicketsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: tickets, limit, offset });
});

// ── GET /internal/sweep/lotto/current ────────────────────────────────────────
router.get("/internal/sweep/lotto/current", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const [draw] = await db
    .select()
    .from(sweepLottoDrawsTable)
    .where(eq(sweepLottoDrawsTable.status, "open"))
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(1);

  const jackpot = await ensureJackpotPool();
  const lottoPriceSKZ = 5; // default price per lotto entry

  res.json({
    draw: draw ?? null,
    jackpotBalanceSkz: jackpot.balanceSkz,
    entryPriceSKZ: lottoPriceSKZ,
    closesAt: draw?.closesAt ?? null,
  });
});

// ── POST /internal/sweep/lotto/enter ─────────────────────────────────────────
router.post("/internal/sweep/lotto/enter", perUserCreateLimiter, async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId, chosenNumbers } = req.body as {
    telegramId?: string | number;
    chosenNumbers?: number[];
  };

  if (!telegramId || !chosenNumbers) {
    res.status(400).json({ error: "telegramId and chosenNumbers are required" });
    return;
  }

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

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(String(telegramId))));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (rejectIfBlocked(user, res)) return;

  // Find the current open draw
  const [draw] = await db
    .select()
    .from(sweepLottoDrawsTable)
    .where(eq(sweepLottoDrawsTable.status, "open"))
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(1);

  if (!draw) { res.status(400).json({ error: "لا يوجد سحب مفتوح حالياً" }); return; }

  const entryPrice = 5; // SKZ per lotto entry
  // Each lotto ticket feeds 100% of its price into the jackpot pool so the
  // displayed jackpot grows by exactly entryPrice per subscription.
  const jackpotContrib = entryPrice;

  try {
    const entry = await db.transaction(async (tx) => {
      // Atomic debit
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
        sourceBot: bot.slug,
        referenceId: `lotto_entry_${user.id}_${draw.id}_${Date.now()}`,
        description: `اشتراك اللوتو — سحب رقم ${draw.drawNumber}`,
        metadata: JSON.stringify({ drawId: draw.id, chosenNumbers }),
      }).returning();

      // Increment draw totalEntries
      await tx
        .update(sweepLottoDrawsTable)
        .set({ totalEntries: sql`${sweepLottoDrawsTable.totalEntries} + 1` })
        .where(eq(sweepLottoDrawsTable.id, draw.id));

      // Grow the jackpot pool — atomic upsert so GET /sweep/jackpot reflects
      // the real progressive total immediately after each subscription.
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

      const [entry] = await tx.insert(sweepLottoEntriesTable).values({
        drawId: draw.id,
        userId: user.id,
        telegramId: user.telegramId,
        chosenNumbers,
        priceSKZ: String(entryPrice),
        transactionId: txnRow?.id ?? null,
      }).returning();

      return entry;
    });

    res.json({ entry, drawId: draw.id, drawNumber: draw.drawNumber });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "رصيد SKZ غير كافٍ" });
      return;
    }
    req.log.error({ err }, "lotto enter failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /internal/sweep/lotto/my-entries ─────────────────────────────────────
router.get("/internal/sweep/lotto/my-entries", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  const { telegramId } = req.query as { telegramId?: string };
  if (!telegramId) { res.status(400).json({ error: "telegramId is required" }); return; }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.telegramId, BigInt(telegramId)));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const entries = await db
    .select({
      entry: sweepLottoEntriesTable,
      drawNumber: sweepLottoDrawsTable.drawNumber,
      drawStatus: sweepLottoDrawsTable.status,
      winningNumbers: sweepLottoDrawsTable.winningNumbers,
    })
    .from(sweepLottoEntriesTable)
    .leftJoin(sweepLottoDrawsTable, eq(sweepLottoDrawsTable.id, sweepLottoEntriesTable.drawId))
    .where(eq(sweepLottoEntriesTable.userId, user.id))
    .orderBy(desc(sweepLottoEntriesTable.createdAt))
    .limit(50);

  res.json({ data: entries });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUPERADMIN ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /superadmin/sweep/game-types ─────────────────────────────────────────
router.get("/superadmin/sweep/game-types", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(sweepGameTypesTable).orderBy(sweepGameTypesTable.sortOrder, sweepGameTypesTable.id);
  res.json({ data: rows });
});

// ── POST /superadmin/sweep/game-types ────────────────────────────────────────
router.post("/superadmin/sweep/game-types", requireSuperAdmin, async (req, res): Promise<void> => {
  const { slug, name, nameAr, description, emoji, theme, priceSKZ, prizeTiers, jackpotContributionRate, isActive, sortOrder } = req.body as {
    slug?: string;
    name?: string;
    nameAr?: string;
    description?: string;
    emoji?: string;
    theme?: string;
    priceSKZ?: string | number;
    prizeTiers?: unknown[];
    jackpotContributionRate?: string | number;
    isActive?: boolean;
    sortOrder?: number;
  };

  if (!slug || !name) {
    res.status(400).json({ error: "slug and name are required" });
    return;
  }

  const [row] = await db.insert(sweepGameTypesTable).values({
    slug,
    name,
    nameAr: nameAr ?? "",
    description: description ?? "",
    emoji: emoji ?? "🎰",
    theme: theme ?? "default",
    priceSKZ: String(priceSKZ ?? "10"),
    prizeTiers: prizeTiers ?? [],
    jackpotContributionRate: String(jackpotContributionRate ?? "0.1000"),
    isActive: isActive ?? true,
    sortOrder: sortOrder ?? 0,
  }).returning();

  await logAdminAction(req, "superadmin", {
    action: "sweep.game_type.create", targetType: "sweep_game_type", targetId: row!.id,
    payload: { slug, name },
  });
  res.status(201).json(row);
});

// ── PATCH /superadmin/sweep/game-types/:id ───────────────────────────────────
router.patch("/superadmin/sweep/game-types/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, nameAr, description, emoji, theme, priceSKZ, prizeTiers, jackpotContributionRate, isActive, sortOrder } = req.body as Record<string, unknown>;

  const updates: Partial<typeof sweepGameTypesTable.$inferInsert> = {};
  if (typeof name === "string") updates.name = name;
  if (typeof nameAr === "string") updates.nameAr = nameAr;
  if (typeof description === "string") updates.description = description;
  if (typeof emoji === "string") updates.emoji = emoji;
  if (typeof theme === "string") updates.theme = theme;
  if (priceSKZ !== undefined) updates.priceSKZ = String(priceSKZ);
  if (Array.isArray(prizeTiers)) updates.prizeTiers = prizeTiers;
  if (jackpotContributionRate !== undefined) updates.jackpotContributionRate = String(jackpotContributionRate);
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (typeof sortOrder === "number") updates.sortOrder = sortOrder;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  const [row] = await db.update(sweepGameTypesTable).set(updates).where(eq(sweepGameTypesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Game type not found" }); return; }

  await logAdminAction(req, "superadmin", {
    action: "sweep.game_type.update", targetType: "sweep_game_type", targetId: id,
    payload: { fields: Object.keys(updates) },
  });
  res.json(row);
});

// ── DELETE /superadmin/sweep/game-types/:id ──────────────────────────────────
router.delete("/superadmin/sweep/game-types/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await db.delete(sweepGameTypesTable).where(eq(sweepGameTypesTable.id, id)).returning();
  if (result.length === 0) { res.status(404).json({ error: "Game type not found" }); return; }

  await logAdminAction(req, "superadmin", {
    action: "sweep.game_type.delete", targetType: "sweep_game_type", targetId: id,
    payload: { slug: result[0]?.slug },
  });
  res.json({ ok: true });
});

// ── GET /superadmin/sweep/tickets ────────────────────────────────────────────
router.get("/superadmin/sweep/tickets", requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;
  const { gameTypeId, isWin, userId } = req.query as { gameTypeId?: string; isWin?: string; userId?: string };

  const conds = [];
  if (gameTypeId) conds.push(eq(sweepTicketsTable.gameTypeId, parseInt(gameTypeId, 10)));
  if (isWin === "true") conds.push(eq(sweepTicketsTable.isWin, true));
  if (isWin === "false") conds.push(eq(sweepTicketsTable.isWin, false));
  if (userId) conds.push(eq(sweepTicketsTable.userId, parseInt(userId, 10)));

  const where = conds.length ? and(...conds) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        ticket: sweepTicketsTable,
        telegramId: usersTable.telegramId,
        username: usersTable.username,
        firstName: usersTable.firstName,
        gameTypeName: sweepGameTypesTable.name,
        gameTypeNameAr: sweepGameTypesTable.nameAr,
        gameTypeSlug: sweepGameTypesTable.slug,
      })
      .from(sweepTicketsTable)
      .leftJoin(usersTable, eq(usersTable.id, sweepTicketsTable.userId))
      .leftJoin(sweepGameTypesTable, eq(sweepGameTypesTable.id, sweepTicketsTable.gameTypeId))
      .where(where)
      .orderBy(desc(sweepTicketsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(sweepTicketsTable).where(where),
  ]);

  res.json({ data: rows, total: Number(countResult[0]?.c ?? 0), page, limit });
});

// ── GET /superadmin/sweep/lotto/draws ────────────────────────────────────────
router.get("/superadmin/sweep/lotto/draws", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(sweepLottoDrawsTable)
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(50);

  res.json({ data: rows });
});

// ── PATCH /superadmin/sweep/lotto/draws/:id ──────────────────────────────────
router.patch("/superadmin/sweep/lotto/draws/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { winningNumbers, status, closesAt } = req.body as {
    winningNumbers?: number[];
    status?: string;
    closesAt?: string;
  };

  const updates: Partial<typeof sweepLottoDrawsTable.$inferInsert> = {};
  if (Array.isArray(winningNumbers) && winningNumbers.length === 6) updates.winningNumbers = winningNumbers;
  if (typeof status === "string") updates.status = status;
  if (closesAt) updates.closesAt = new Date(closesAt);

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  const [row] = await db.update(sweepLottoDrawsTable).set(updates).where(eq(sweepLottoDrawsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Draw not found" }); return; }

  await logAdminAction(req, "superadmin", {
    action: "sweep.lotto.draw_update", targetType: "sweep_lotto_draw", targetId: id,
    payload: { fields: Object.keys(updates) },
  });
  res.json(row);
});

// ── GET /superadmin/sweep/lotto/draws/:id/entries ────────────────────────────
router.get("/superadmin/sweep/lotto/draws/:id/entries", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
  const offset = (page - 1) * limit;

  const [draw] = await db.select().from(sweepLottoDrawsTable).where(eq(sweepLottoDrawsTable.id, id));
  if (!draw) { res.status(404).json({ error: "Draw not found" }); return; }

  const [entries, countResult] = await Promise.all([
    db
      .select({
        entry: sweepLottoEntriesTable,
        telegramId: usersTable.telegramId,
        username: usersTable.username,
        firstName: usersTable.firstName,
      })
      .from(sweepLottoEntriesTable)
      .leftJoin(usersTable, eq(usersTable.id, sweepLottoEntriesTable.userId))
      .where(eq(sweepLottoEntriesTable.drawId, id))
      .orderBy(desc(sweepLottoEntriesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(sweepLottoEntriesTable)
      .where(eq(sweepLottoEntriesTable.drawId, id)),
  ]);

  const total = Number(countResult[0]?.c ?? 0);
  const winnersCount = entries.filter((e) => (e.entry.matchCount ?? 0) >= 3).length;

  res.json({
    draw,
    data: entries.map((e) => ({
      ...e.entry,
      telegramId: e.telegramId?.toString() ?? null,
      username: e.username ?? null,
      firstName: e.firstName ?? null,
    })),
    total,
    page,
    limit,
    winnersCount,
  });
});

// ── Shared draw-execution logic ────────────────────────────────────────────────
async function executeLottoDraw(
  rawDraw: typeof sweepLottoDrawsTable.$inferSelect,
  logActorFn: (payload: Record<string, unknown>) => Promise<void>,
): Promise<{
  draw: typeof sweepLottoDrawsTable.$inferSelect;
  winningNumbers: number[];
  winners: Array<{ entryId: number; userId: number; matchCount: number; prizeSkz: number }>;
  totalPaidOut: number;
  jackpotWon: boolean;
}> {
  // ── STEP 1: Atomic CAS lock ─────────────────────────────────────────────────
  // Transition status open|closed → processing in one conditional UPDATE.
  // If 0 rows are returned, a concurrent trigger already claimed this draw.
  const [lockedDraw] = await db
    .update(sweepLottoDrawsTable)
    .set({ status: "processing" })
    .where(
      and(
        eq(sweepLottoDrawsTable.id, rawDraw.id),
        sql`${sweepLottoDrawsTable.status} IN ('open', 'closed')`,
      ),
    )
    .returning();

  if (!lockedDraw) {
    const [current] = await db.select({ status: sweepLottoDrawsTable.status })
      .from(sweepLottoDrawsTable).where(eq(sweepLottoDrawsTable.id, rawDraw.id));
    const currentStatus = current?.status ?? "unknown";
    if (currentStatus === "drawn") {
      throw Object.assign(new Error("ALREADY_DRAWN: this draw was already settled"), { status: 409 });
    }
    throw Object.assign(
      new Error(`DRAW_LOCKED: draw is currently in status '${currentStatus}' — concurrent trigger rejected`),
      { status: 409 },
    );
  }

  const targetDraw = lockedDraw;

  try {
    // ── STEP 2: Verify pre-committed seed ─────────────────────────────────────
    const storedSeed = targetDraw.serverSeed;
    if (!storedSeed) {
      throw Object.assign(
        new Error("MISSING_SERVER_SEED: draw was opened without a pre-committed seed; cannot guarantee fairness"),
        { status: 500 },
      );
    }
    // Integrity check: hash(storedSeed) must equal the publicly-committed hash
    const expectedHash = hashSeed(storedSeed);
    if (expectedHash !== targetDraw.serverSeedHash) {
      throw Object.assign(
        new Error("SEED_HASH_MISMATCH: stored seed does not match committed hash; refusing to draw"),
        { status: 500 },
      );
    }

    const winningNumbers = deriveUniqueNumbers(storedSeed, String(targetDraw.drawNumber), 6, 49);

    // ── STEP 3: Fetch all entries + snapshot jackpot ───────────────────────────
    const entries = await db
      .select()
      .from(sweepLottoEntriesTable)
      .where(eq(sweepLottoEntriesTable.drawId, targetDraw.id));

    const jackpot = await ensureJackpotPool();
    const jackpotBalance = parseFloat(jackpot.balanceSkz);

    interface PrizePayout { matchCount: number; prizeSkz: number; }
    const LOTTO_PRIZE_TIERS: PrizePayout[] = [
      { matchCount: 6, prizeSkz: jackpotBalance },
      { matchCount: 5, prizeSkz: 500 },
      { matchCount: 4, prizeSkz: 100 },
      { matchCount: 3, prizeSkz: 20 },
    ];

    // ── STEP 4: Per-entry payout with idempotency guard ────────────────────────
    let totalPaidOut = 0;
    const winners: Array<{ entryId: number; userId: number; matchCount: number; prizeSkz: number }> = [];

    for (const entry of entries) {
      const chosen = (entry.chosenNumbers ?? []) as number[];
      const matchCount = countLottoMatches(chosen, winningNumbers);
      const tier = LOTTO_PRIZE_TIERS.find((t) => t.matchCount === matchCount);
      const prizeSkz = tier?.prizeSkz ?? 0;
      const isJackpot = matchCount === 6;
      const payoutRef = `lotto_prize_${entry.id}_${targetDraw.id}`;

      if (prizeSkz > 0) {
        // Idempotency guard: skip if this payout transaction was already written
        const [existing] = await db
          .select({ id: transactionsTable.id })
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.userId, entry.userId),
              eq(transactionsTable.referenceId, payoutRef),
            ),
          )
          .limit(1);

        if (!existing) {
          await db.transaction(async (tx) => {
            await tx.update(walletsTable).set({
              balanceSkz: sql`${walletsTable.balanceSkz} + ${prizeSkz}`,
              totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${prizeSkz}`,
            }).where(eq(walletsTable.userId, entry.userId));

            await tx.insert(transactionsTable).values({
              userId: entry.userId,
              type: "credit",
              currency: "skz",
              amount: String(prizeSkz),
              fee: "0",
              status: "completed",
              sourceBot: "sweep-bot",
              referenceId: payoutRef,
              description: `جائزة اللوتو — ${matchCount} أرقام متطابقة`,
              metadata: JSON.stringify({ drawId: targetDraw.id, drawNumber: targetDraw.drawNumber, matchCount }),
            });
          });
        }

        winners.push({ entryId: entry.id, userId: entry.userId, matchCount, prizeSkz });
        totalPaidOut += prizeSkz;
      }

      // Always update match result on the entry (safe to re-run)
      await db.update(sweepLottoEntriesTable).set({
        matchCount,
        prizeSkz: String(prizeSkz),
        isJackpot,
      }).where(eq(sweepLottoEntriesTable.id, entry.id));
    }

    // ── STEP 5: Drain jackpot if a 6-match winner exists ──────────────────────
    const jackpotWon = winners.some((w) => w.matchCount === 6);
    if (jackpotWon && jackpotBalance > 0) {
      await db.update(sweepJackpotPoolTable).set({
        balanceSkz: "0",
        totalPaidOutSkz: sql`${sweepJackpotPoolTable.totalPaidOutSkz} + ${jackpotBalance}`,
      }).where(eq(sweepJackpotPoolTable.id, 1));
    }

    // ── STEP 6: Finalize draw — seed is now revealed (publicly verifiable) ────
    const [updatedDraw] = await db.update(sweepLottoDrawsTable).set({
      status: "drawn",
      winningNumbers,
      jackpotAmountSkz: String(jackpotBalance),
      totalPaidOutSkz: String(totalPaidOut),
      drawnAt: new Date(),
    }).where(eq(sweepLottoDrawsTable.id, targetDraw.id)).returning();

    // ── STEP 7: Auto-create next draw with fresh pre-committed seed ───────────
    const nextSeed = generateServerSeed();
    await db.insert(sweepLottoDrawsTable).values({
      drawNumber: targetDraw.drawNumber + 1,
      status: "open",
      serverSeed: nextSeed,
      serverSeedHash: hashSeed(nextSeed),
      jackpotAmountSkz: "0",
      opensAt: new Date(),
    }).onConflictDoNothing();

    await logActorFn({ winningNumbers, winnersCount: winners.length, totalPaidOut });

    return { draw: updatedDraw!, winningNumbers, winners, totalPaidOut, jackpotWon };
  } catch (err) {
    // Roll back the lock so the draw can be retried after the issue is fixed.
    // If the draw was already finalized to 'drawn' this no-ops (status won't be 'processing').
    await db
      .update(sweepLottoDrawsTable)
      .set({ status: "closed" })
      .where(
        and(
          eq(sweepLottoDrawsTable.id, targetDraw.id),
          eq(sweepLottoDrawsTable.status, "processing"),
        ),
      );
    throw err;
  }
}

// ── Helper: resolve and validate the draw to execute ─────────────────────────
async function resolveDrawableTarget(
  drawId: number | undefined,
): Promise<typeof sweepLottoDrawsTable.$inferSelect | null> {
  if (drawId != null && Number.isFinite(drawId)) {
    const [specific] = await db
      .select()
      .from(sweepLottoDrawsTable)
      .where(eq(sweepLottoDrawsTable.id, drawId));
    return specific ?? null;
  }
  // Find the most recent draw whose status is "open" or "closed" (not yet drawn)
  const [found] = await db
    .select()
    .from(sweepLottoDrawsTable)
    .where(sql`${sweepLottoDrawsTable.status} IN ('open', 'closed')`)
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(1);
  return found ?? null;
}

// ── POST /superadmin/sweep/lotto/trigger-draw ─────────────────────────────────
router.post("/superadmin/sweep/lotto/trigger-draw", requireSuperAdmin, async (req, res): Promise<void> => {
  const { drawId } = req.body as { drawId?: number };
  const targetDraw = await resolveDrawableTarget(drawId);
  if (!targetDraw) { res.status(400).json({ error: "لا يوجد سحب قابل للتشغيل" }); return; }

  try {
    const result = await executeLottoDraw(targetDraw, async (payload) => {
      await logAdminAction(req, "superadmin", {
        action: "sweep.lotto.trigger_draw", targetType: "sweep_lotto_draw", targetId: targetDraw.id,
        payload,
      });
    });
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number };
    req.log.error({ err }, "trigger-draw failed");
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /internal/sweep/lotto/draw ──────────────────────────────────────────
// Admin-only internal trigger callable by sweep-bot (or mother-bot for scheduling).
// Behaviour is identical to the superadmin trigger but authed via X-Bot-Api-Key.
router.post("/internal/sweep/lotto/draw", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;

  // Only sweep-bot or mother-bot may trigger a draw
  if (bot.slug !== "sweep-bot" && bot.slug !== "mother-bot") {
    res.status(403).json({ error: "Only sweep-bot or mother-bot may trigger a lotto draw" });
    return;
  }

  const { drawId } = req.body as { drawId?: number };
  const targetDraw = await resolveDrawableTarget(drawId);
  if (!targetDraw) { res.status(400).json({ error: "لا يوجد سحب قابل للتشغيل" }); return; }

  try {
    const result = await executeLottoDraw(targetDraw, async (payload) => {
      req.log.info({ payload, drawId: targetDraw.id, triggeredBy: bot.slug }, "lotto draw triggered via internal API");
    });
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number };
    req.log.error({ err }, "internal trigger-draw failed");
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /superadmin/sweep/lotto/open ─────────────────────────────────────────
router.post("/superadmin/sweep/lotto/open", requireSuperAdmin, async (req, res): Promise<void> => {
  const existing = await db
    .select()
    .from(sweepLottoDrawsTable)
    .where(eq(sweepLottoDrawsTable.status, "open"))
    .limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "يوجد سحب مفتوح بالفعل" });
    return;
  }

  const [last] = await db
    .select({ drawNumber: sweepLottoDrawsTable.drawNumber })
    .from(sweepLottoDrawsTable)
    .orderBy(desc(sweepLottoDrawsTable.drawNumber))
    .limit(1);

  const nextNumber = (last?.drawNumber ?? 0) + 1;
  // Generate and store the real serverSeed now so the hash commitment is
  // cryptographically locked to this exact seed. At draw time we reuse
  // this stored seed (never re-generate), then verify hash(seed)==hash
  // before deriving winning numbers. Any tampering between open and draw
  // would break the hash check and abort the draw.
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashSeed(serverSeed);
  const { closesAt } = req.body as { closesAt?: string };

  const [draw] = await db.insert(sweepLottoDrawsTable).values({
    drawNumber: nextNumber,
    status: "open",
    serverSeed,
    serverSeedHash,
    jackpotAmountSkz: "0",
    opensAt: new Date(),
    closesAt: closesAt ? new Date(closesAt) : null,
  }).returning();

  // Return the draw but strip the seed (only hash is public before draw)
  const { serverSeed: _seed, ...safeDrawOpen } = draw!;
  await logAdminAction(req, "superadmin", {
    action: "sweep.lotto.open_draw", targetType: "sweep_lotto_draw", targetId: draw!.id,
    payload: { drawNumber: nextNumber, serverSeedHash },
  });
  res.status(201).json(safeDrawOpen);
});

// ── GET /superadmin/sweep/jackpot ────────────────────────────────────────────
router.get("/superadmin/sweep/jackpot", requireSuperAdmin, async (_req, res): Promise<void> => {
  const pool = await ensureJackpotPool();
  res.json(pool);
});

// ── PATCH /superadmin/sweep/jackpot ──────────────────────────────────────────
router.patch("/superadmin/sweep/jackpot", requireSuperAdmin, async (req, res): Promise<void> => {
  const { balanceSkz } = req.body as { balanceSkz?: string | number };
  if (balanceSkz === undefined) {
    res.status(400).json({ error: "balanceSkz is required" });
    return;
  }
  const value = parseFloat(String(balanceSkz));
  if (!Number.isFinite(value) || value < 0) {
    res.status(400).json({ error: "Invalid balanceSkz" });
    return;
  }

  await ensureJackpotPool();
  const [pool] = await db
    .update(sweepJackpotPoolTable)
    .set({ balanceSkz: value.toFixed(2) })
    .where(eq(sweepJackpotPoolTable.id, 1))
    .returning();

  await logAdminAction(req, "superadmin", {
    action: "sweep.jackpot.adjust", targetType: "sweep_jackpot_pool", targetId: 1,
    payload: { balanceSkz: value },
  });
  res.json(pool);
});

// ── GET /superadmin/sweep/stats ───────────────────────────────────────────────
router.get("/superadmin/sweep/stats", requireSuperAdmin, async (_req, res): Promise<void> => {
  const [
    totalTickets,
    totalWinTickets,
    totalRevenue,
    totalPrizes,
    topGames,
    jackpot,
    recentDraws,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(sweepTicketsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(sweepTicketsTable).where(eq(sweepTicketsTable.isWin, true)),
    db.select({ s: sql<string>`coalesce(sum(price_skz::numeric), 0)::text` }).from(sweepTicketsTable),
    db.select({ s: sql<string>`coalesce(sum(prize_skz::numeric), 0)::text` }).from(sweepTicketsTable),
    db
      .select({
        gameTypeId: sweepTicketsTable.gameTypeId,
        name: sweepGameTypesTable.name,
        nameAr: sweepGameTypesTable.nameAr,
        slug: sweepGameTypesTable.slug,
        count: sql<number>`count(*)::int`,
        totalRevenue: sql<string>`coalesce(sum(${sweepTicketsTable.priceSKZ}::numeric), 0)::text`,
        totalPrizes: sql<string>`coalesce(sum(${sweepTicketsTable.prizeSkz}::numeric), 0)::text`,
        winCount: sql<number>`count(*) filter (where ${sweepTicketsTable.isWin} = true)::int`,
      })
      .from(sweepTicketsTable)
      .leftJoin(sweepGameTypesTable, eq(sweepGameTypesTable.id, sweepTicketsTable.gameTypeId))
      .groupBy(sweepTicketsTable.gameTypeId, sweepGameTypesTable.name, sweepGameTypesTable.nameAr, sweepGameTypesTable.slug)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    ensureJackpotPool(),
    db.select().from(sweepLottoDrawsTable).orderBy(desc(sweepLottoDrawsTable.drawNumber)).limit(5),
  ]);

  const total = Number(totalTickets[0]?.c ?? 0);
  const wins = Number(totalWinTickets[0]?.c ?? 0);

  res.json({
    totalTickets: total,
    totalWinTickets: wins,
    totalLoseTickets: total - wins,
    winRate: total > 0 ? parseFloat(((wins / total) * 100).toFixed(2)) : 0,
    totalRevenueSKZ: totalRevenue[0]?.s ?? "0",
    totalPrizesSKZ: totalPrizes[0]?.s ?? "0",
    topGames,
    jackpot,
    recentDraws,
  });
});

export default router;
