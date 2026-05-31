import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { transactionsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

const JACKPOT_BASE = 5_000;
const JACKPOT_MULTIPLIER = 3; // each 5 SKZ ticket adds 15 SKZ to the jackpot pool

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

  const ticketsSold  = Number(row?.ticketsSold   ?? 0);
  const totalScratched = Number(row?.totalScratched ?? 0);
  const totalWins    = Number(row?.totalWins      ?? 0);
  const jackpotContrib = Number(row?.jackpotContrib ?? 0);
  const biggestWin   = Number(row?.biggestWin     ?? 0);

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

// POST /api/scratchy/lotto-ticket
// Records a web-app lotto ticket purchase for jackpot tracking.
// Does NOT deduct balance (handled client-side / via Telegram bot).
// Requires the user to exist in the DB (registered via Telegram); guests get
// the current stats without recording.
router.post("/scratchy/lotto-ticket", async (req, res): Promise<void> => {
  const { telegramId, picks } = req.body as {
    telegramId?: string;
    picks?: number[];
  };

  if (!telegramId || !Array.isArray(picks) || picks.length !== 6) {
    res.status(400).json({ error: "telegramId and exactly 6 picks are required" });
    return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.telegramId, BigInt(telegramId)));

    if (user) {
      await db.insert(transactionsTable).values({
        userId:      user.id,
        type:        "lotto_ticket",
        currency:    "SKZ",
        amount:      "5",
        status:      "completed",
        sourceBot:   "scratchy-bot",
        description: "Lotto ticket — web app",
        metadata:    JSON.stringify({ picks, source: "web" }),
      });
    }

    res.json(await queryStats());
  } catch (err) {
    req.log.error({ err }, "scratchy/lotto-ticket failed");
    res.status(500).json({ error: "ticket recording failed" });
  }
});

export default router;
