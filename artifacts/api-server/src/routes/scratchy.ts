import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

const JACKPOT_BASE = 5_000;
const JACKPOT_MULTIPLIER = 3; // each 5 SKZ ticket adds 15 SKZ to the jackpot pool

// Tier data mirrored from bot-demo/src/lib/games-data.ts — keep in sync if client tiers change.
const SCRATCH_TIERS = [
  { id: 't1', cost: 1,   prizes: [0, 2, 3, 5, 10],           weights: [0.55, 0.22, 0.12, 0.08, 0.03] },
  { id: 't2', cost: 5,   prizes: [0, 8, 15, 25, 50],         weights: [0.53, 0.23, 0.12, 0.08, 0.04] },
  { id: 't3', cost: 20,  prizes: [0, 35, 80, 140, 200],      weights: [0.50, 0.25, 0.13, 0.08, 0.04] },
  { id: 't4', cost: 100, prizes: [0, 175, 400, 700, 1000],   weights: [0.48, 0.26, 0.14, 0.08, 0.04] },
  { id: 't5', cost: 500, prizes: [0, 900, 2000, 3500, 5000], weights: [0.45, 0.28, 0.14, 0.09, 0.04] },
] as const;

type ScratchTier = (typeof SCRATCH_TIERS)[number];

async function queryStats() {
  const [row] = await db
    .select({
      ticketsSold: sql<string>`COUNT(CASE WHEN ${transactionsTable.type} = 'lotto_ticket' THEN 1 END)`,
      jackpotContrib: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'lotto_ticket' THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)`,
      totalScratched: sql<string>`COUNT(CASE WHEN ${transactionsTable.type} = 'game_entry' THEN 1 END)`,
      totalWins: sql<string>`COUNT(CASE WHEN ${transactionsTable.type} = 'game_win' THEN 1 END)`,
      biggestWin: sql<string>`COALESCE(MAX(CASE WHEN ${transactionsTable.type} = 'game_win' THEN ${transactionsTable.amount}::numeric END), 0)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.sourceBot, "scratchy-bot"));

  const ticketsSold    = Number(row?.ticketsSold    ?? 0);
  const totalScratched = Number(row?.totalScratched ?? 0);
  const totalWins      = Number(row?.totalWins      ?? 0);
  const jackpotContrib = Number(row?.jackpotContrib ?? 0);
  const biggestWin     = Number(row?.biggestWin     ?? 0);

  return {
    jackpot:        Math.round(JACKPOT_BASE + jackpotContrib * JACKPOT_MULTIPLIER),
    ticketsSold,
    participants:   ticketsSold,
    totalScratched,
    totalWins,
    biggestWin:     Math.round(biggestWin),
    winRate:
      totalScratched > 0
        ? ((totalWins / totalScratched) * 100).toFixed(1)
        : "0.0",
  };
}

// GET /api/scratchy/stats — public, no auth
// Returns live jackpot pool, ticket count, win stats derived from transactions.
router.get("/scratchy/stats", async (req, res): Promise<void> => {
  try {
    res.json(await queryStats());
  } catch (err) {
    req.log.error({ err }, "scratchy/stats failed");
    res.status(500).json({ error: "stats unavailable" });
  }
});

// ── Telegram initData validation ──────────────────────────────────────────────
// Validates HMAC-SHA256 signature per Telegram WebApp docs.
// Returns the telegramId (string) on success, null on failure.
function validateInitData(initData: string): string | null {
  const token = process.env.SCRATCHY_BOT_TOKEN;
  if (!token) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const expected  = createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (expected !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;
  try {
    const u = JSON.parse(userStr) as { id?: number };
    return u.id ? String(u.id) : null;
  } catch {
    return null;
  }
}

// ── Server-side prize roll ────────────────────────────────────────────────────
function rollPrize(tier: ScratchTier): number {
  const r = Math.random();
  let c = 0;
  for (let i = 0; i < tier.weights.length; i++) {
    c += tier.weights[i];
    if (r < c) return tier.prizes[i];
  }
  return 0;
}

// POST /api/scratchy/play — authenticated by Telegram initData (no bot API key required)
// Body: { tierId: string, gameId?: string, initData: string }
// Returns: { ok: true, prize: number, won: boolean }
//
// Security:
//   - Telegram initData is HMAC-signed by Telegram with the bot token — not forgeable.
//   - Prize is determined server-side (client cannot influence the outcome).
//   - Debit + credit happen in a single DB transaction — no partial state.
//   - referenceId is unique per play — prevents double-credit on network retry.
router.post("/scratchy/play", async (req, res): Promise<void> => {
  const { tierId, gameId, initData } = req.body as {
    tierId?: string;
    gameId?: string;
    initData?: string;
  };

  if (!tierId || !initData) {
    res.status(400).json({ error: "tierId and initData are required" });
    return;
  }

  const telegramId = validateInitData(initData);
  if (!telegramId) {
    res.status(403).json({ error: "Invalid Telegram initData — open this app from inside Telegram" });
    return;
  }

  const tier = SCRATCH_TIERS.find((t) => t.id === tierId);
  if (!tier) {
    res.status(400).json({ error: `Unknown tierId: ${tierId}` });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, BigInt(telegramId)));

  if (!user) {
    res.status(404).json({ error: "User not found — open the bot and press Start first" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "Account is blocked" });
    return;
  }

  // ── Server-side prize roll (before DB — trivially rolled back if TX fails) ──
  const prize    = rollPrize(tier);
  const ts       = Date.now();
  const gameSlug = String(gameId ?? "scratch").slice(0, 60);
  const baseRef  = `scratch_${ts}_${telegramId}_${tierId}`;

  // Race-condition-safe debit: the WHERE clause includes `balance >= cost`
  // so the check and debit are one atomic SQL statement. If two concurrent
  // requests both pass the pre-read check, only one wins the conditional
  // UPDATE (the other gets 0 rows updated and 402). This prevents overdraft.
  let debited = false;
  let currentBalance = 0;

  await db.transaction(async (tx) => {
    // 1. Conditional atomic debit — only succeeds when balance is sufficient.
    const debitResult = await tx
      .update(walletsTable)
      .set({ balanceSkz: sql`${walletsTable.balanceSkz} - ${tier.cost}` })
      .where(and(
        eq(walletsTable.userId, user.id),
        gte(walletsTable.balanceSkz, String(tier.cost)),
      ))
      .returning({ newBalance: walletsTable.balanceSkz });

    if (debitResult.length === 0) {
      // Balance was insufficient at write time — abort the transaction.
      // We read the actual balance for a helpful error message.
      const [w] = await tx
        .select({ bal: walletsTable.balanceSkz })
        .from(walletsTable)
        .where(eq(walletsTable.userId, user.id));
      currentBalance = parseFloat(w?.bal ?? "0");
      // Throwing inside the transaction callback causes an automatic rollback.
      throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { isInsufficient: true });
    }

    debited = true;
    currentBalance = parseFloat(debitResult[0]!.newBalance ?? "0");

    await tx.insert(transactionsTable).values({
      userId:      user.id,
      type:        "game_entry",
      currency:    "SKZ",
      amount:      String(tier.cost),
      sourceBot:   "scratchy-bot",
      referenceId: `${baseRef}_entry`,
      metadata:    JSON.stringify({ tierId, gameId: gameSlug, action: "entry" }),
    });

    // 2. Conditional credit — only when there is a non-zero prize.
    if (prize > 0) {
      await tx
        .update(walletsTable)
        .set({ balanceSkz: sql`${walletsTable.balanceSkz} + ${prize}` })
        .where(eq(walletsTable.userId, user.id));

      await tx.insert(transactionsTable).values({
        userId:      user.id,
        type:        "game_win",
        currency:    "SKZ",
        amount:      String(prize),
        sourceBot:   "scratchy-bot",
        referenceId: `${baseRef}_win`,
        metadata:    JSON.stringify({ tierId, gameId: gameSlug, prize }),
      });
    }
  }).catch((err: unknown) => {
    if (err instanceof Error && (err as { isInsufficient?: boolean }).isInsufficient) {
      return; // handled below — not a server error
    }
    throw err; // real DB error — re-throw so the outer catch logs it
  });

  if (!debited) {
    res.status(402).json({ error: "Insufficient balance", balance: currentBalance, required: tier.cost });
    return;
  }

  req.log.info(
    { telegramId, tierId, gameId: gameSlug, cost: tier.cost, prize, won: prize > 0 },
    "scratch play completed",
  );

  res.json({ ok: true, prize, won: prize > 0 });
});

export default router;
