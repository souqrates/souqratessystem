/**
 * SOUQRATES STAGE — contests-bot routes.
 *
 * Public (no auth):
 *   GET  /contests/active                    → single active contest + leaderboard + active packs
 *   GET  /contests/:id                       → contest detail + contestants
 *   GET  /contests/:id/leaderboard           → sorted contestants by voteCount
 *   GET  /contests/packs                     → active vote packs (for storefront display)
 *
 * Internal (X-Bot-Api-Key, must be contests-bot):
 *   POST /internal/contests/vote             { telegramId, contestId, contestantId, votes, ipHash? }
 *                                            → uses free vote if available + requested, else
 *                                              draws from oldest grant; atomic.
 *   POST /internal/contests/purchase-pack    { telegramId, packId }
 *                                            → debits SKZ, creates vote_grant, returns balance.
 *   GET  /internal/contests/my?telegramId    → { freeAvailableToday, paidAvailable, grants[] }
 *   GET  /internal/contests/grants/:grantId/download?telegramId
 *                                            → 302 to bonus file (only if buyer owns the grant).
 *
 * Super-admin (Bearer):
 *   GET    /superadmin/contests              ?status=&limit=&offset=
 *   POST   /superadmin/contests              { title, description?, coverUrl?, startsAt?, endsAt? }
 *   PATCH  /superadmin/contests/:id          → status transitions enforce single-active rule
 *   DELETE /superadmin/contests/:id          hard delete (cascades contestants + votes)
 *   GET    /superadmin/contests/:id/contestants
 *   POST   /superadmin/contests/:id/contestants
 *   PATCH  /superadmin/contestants/:cid
 *   DELETE /superadmin/contestants/:cid
 *
 *   GET    /superadmin/contests/packs
 *   POST   /superadmin/contests/packs
 *   PATCH  /superadmin/contests/packs/:id
 *   DELETE /superadmin/contests/packs/:id
 *
 *   GET    /superadmin/contests/:id/votes    ?limit=&offset=     (audit log)
 *   POST   /superadmin/contests/votes/:voteId/void  { reason? } → restores counters
 *   GET    /superadmin/contests/stats        → totals + revenue + fraud signals
 *
 * Financial rules (mirror books-bot pattern):
 *   - rejectIfBlocked(user) on every mutating endpoint.
 *   - Atomic SKZ debit via guarded UPDATE (balance >= price).
 *   - Pack revenue accrues to the platform (no second-party publisher to credit).
 *     bots.totalVolumeUsdt / totalCommissionUsdt are bumped for reporting parity
 *     with other bots; commissionsTable row uses platform user (id=null is not
 *     allowed → we record on the buyer with userId=buyer.id and net=0, gross=price
 *     so superadmin commission reports include contests revenue).
 *   - Vote-grant decrement uses a guarded UPDATE that only succeeds while
 *     votesUsed + N <= votesGranted, preventing concurrent over-spend.
 */
import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, sql, and, desc, asc, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  commissionsTable,
  commissionOverridesTable,
  contestsTable,
  contestantsTable,
  votePacksTable,
  voteGrantsTable,
  votesTable,
  dailyFreeVoteUsageTable,
} from "@workspace/db";
import { requireSuperAdmin } from "../lib/super-admin-auth";
import { getEffectiveCommissionRate } from "../lib/finance";

const router: IRouter = Router();
const BOT_SLUG = "contests-bot";

// ── Helpers (mirror books.ts; intentionally inlined for isolation) ──────────
async function requireBot(req: any, res: any) {
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
  if (bot.slug !== BOT_SLUG) {
    res.status(403).json({ error: "Forbidden: contests-bot API key required" });
    return null;
  }
  return bot;
}

function rejectIfBlocked(user: { isBlocked: boolean | null }, res: any): boolean {
  if (user.isBlocked === true) {
    res.status(403).json({ error: "هذا المستخدم محظور — لا يمكن إجراء عمليات مالية" });
    return true;
  }
  return false;
}

async function getContestsBotRecord() {
  const [b] = await db.select().from(botsTable).where(eq(botsTable.slug, BOT_SLUG));
  return b ?? null;
}

// getEffectiveCommissionRate is imported from ../lib/finance (cached + DRY).

function todayUtcStr(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC (no auth)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/contests/active", async (_req, res): Promise<void> => {
  // App-enforced single active contest: pick the most recently updated one.
  const [contest] = await db
    .select()
    .from(contestsTable)
    .where(eq(contestsTable.status, "active"))
    .orderBy(desc(contestsTable.updatedAt))
    .limit(1);

  if (!contest) {
    res.json({ contest: null, contestants: [], packs: [] });
    return;
  }

  const contestants = await db
    .select()
    .from(contestantsTable)
    .where(eq(contestantsTable.contestId, contest.id))
    .orderBy(desc(contestantsTable.voteCount), asc(contestantsTable.sortOrder));

  const packs = await db
    .select()
    .from(votePacksTable)
    .where(eq(votePacksTable.isActive, true))
    .orderBy(asc(votePacksTable.sortOrder), asc(votePacksTable.priceSkz));

  res.json({ contest, contestants, packs });
});

router.get("/contests/packs", async (_req, res): Promise<void> => {
  const packs = await db
    .select()
    .from(votePacksTable)
    .where(eq(votePacksTable.isActive, true))
    .orderBy(asc(votePacksTable.sortOrder), asc(votePacksTable.priceSkz));
  res.json(packs);
});

router.get("/contests/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [contest] = await db.select().from(contestsTable).where(eq(contestsTable.id, id));
  if (!contest) { res.status(404).json({ error: "Contest not found" }); return; }
  const contestants = await db
    .select()
    .from(contestantsTable)
    .where(eq(contestantsTable.contestId, id))
    .orderBy(desc(contestantsTable.voteCount), asc(contestantsTable.sortOrder));
  res.json({ contest, contestants });
});

router.get("/contests/:id/leaderboard", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const contestants = await db
    .select({
      id: contestantsTable.id,
      name: contestantsTable.name,
      photoUrl: contestantsTable.photoUrl,
      voteCount: contestantsTable.voteCount,
      isDisqualified: contestantsTable.isDisqualified,
    })
    .from(contestantsTable)
    .where(eq(contestantsTable.contestId, id))
    .orderBy(desc(contestantsTable.voteCount));
  const [agg] = await db
    .select({ total: contestsTable.totalVotes })
    .from(contestsTable)
    .where(eq(contestsTable.id, id));
  res.json({ contestants, totalVotes: agg?.total ?? 0 });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL (X-Bot-Api-Key, contests-bot only)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/internal/contests/my", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res); if (!bot) return;
  const telegramIdStr = String(req.query.telegramId ?? "");
  if (!telegramIdStr) { res.status(400).json({ error: "telegramId required" }); return; }
  const tg = BigInt(telegramIdStr);

  const grants = await db
    .select()
    .from(voteGrantsTable)
    .where(eq(voteGrantsTable.telegramId, tg))
    .orderBy(desc(voteGrantsTable.createdAt));
  const paidAvailable = grants.reduce(
    (sum, g) => sum + Math.max(0, g.votesGranted - g.votesUsed),
    0,
  );
  const [usedToday] = await db
    .select({ id: dailyFreeVoteUsageTable.id })
    .from(dailyFreeVoteUsageTable)
    .where(and(
      eq(dailyFreeVoteUsageTable.telegramId, tg),
      eq(dailyFreeVoteUsageTable.voteDateUtc, todayUtcStr()),
    ))
    .limit(1);
  res.json({
    freeAvailableToday: !usedToday,
    paidAvailable,
    grants: grants.map((g) => ({
      id: g.id,
      source: g.source,
      packId: g.packId,
      votesGranted: g.votesGranted,
      votesUsed: g.votesUsed,
      votesRemaining: Math.max(0, g.votesGranted - g.votesUsed),
      bonusFileName: g.bonusFileName,
      hasBonusFile: !!g.bonusFileUrl,
      createdAt: g.createdAt,
    })),
  });
});

router.post("/internal/contests/vote", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res); if (!bot) return;
  const { telegramId, contestId, contestantId, votes } = req.body as {
    telegramId: string; contestId: number; contestantId: number; votes: number;
  };
  if (!telegramId || !contestId || !contestantId || !Number.isFinite(votes) || votes < 1) {
    res.status(400).json({ error: "telegramId, contestId, contestantId, votes(>=1) required" });
    return;
  }
  const voteCount = Math.floor(votes);
  if (voteCount > 1000) { res.status(400).json({ error: "Max 1000 votes per call" }); return; }

  const tg = BigInt(String(telegramId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tg));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (rejectIfBlocked(user, res)) return;

  const [contest] = await db.select().from(contestsTable).where(eq(contestsTable.id, contestId));
  if (!contest || contest.status !== "active") {
    res.status(404).json({ error: "Contest not active" }); return;
  }
  if (contest.endsAt && new Date(contest.endsAt) <= new Date()) {
    res.status(400).json({ error: "Contest has ended" }); return;
  }
  const [contestant] = await db.select().from(contestantsTable).where(eq(contestantsTable.id, contestantId));
  if (!contestant || contestant.contestId !== contestId) {
    res.status(404).json({ error: "Contestant not found" }); return;
  }
  if (contestant.isDisqualified) {
    res.status(400).json({ error: "Contestant disqualified" }); return;
  }

  const ipHash = hashIp((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip);
  const today = todayUtcStr();

  // Resolve which "lane" we consume: free (1 vote/day global) OR a paid grant.
  // Caller asks for N votes; we allocate from free (max 1) then from paid grants.
  let freeRemaining = 0;
  const [usedToday] = await db
    .select({ id: dailyFreeVoteUsageTable.id })
    .from(dailyFreeVoteUsageTable)
    .where(and(
      eq(dailyFreeVoteUsageTable.telegramId, tg),
      eq(dailyFreeVoteUsageTable.voteDateUtc, today),
    ))
    .limit(1);
  if (!usedToday) freeRemaining = 1;

  const grantsAvailable = await db
    .select()
    .from(voteGrantsTable)
    .where(and(
      eq(voteGrantsTable.telegramId, tg),
      gt(sql`${voteGrantsTable.votesGranted} - ${voteGrantsTable.votesUsed}`, 0),
    ))
    .orderBy(asc(voteGrantsTable.createdAt));
  const paidAvailable = grantsAvailable.reduce(
    (s, g) => s + (g.votesGranted - g.votesUsed),
    0,
  );

  if (freeRemaining + paidAvailable < voteCount) {
    res.status(402).json({
      error: "INSUFFICIENT_VOTES",
      freeAvailableToday: freeRemaining > 0,
      paidAvailable,
      requested: voteCount,
    });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const inserted: Array<{ id: number; source: string; count: number; grantId: number | null }> = [];
      let remaining = voteCount;

      // 1) Consume the free vote first (atomic via unique idx on (telegramId, voteDateUtc)).
      //    Race-safe: detect unique violation by PG SQLSTATE 23505, not by message text.
      if (freeRemaining > 0 && remaining > 0) {
        try {
          const [freeRow] = await tx.insert(dailyFreeVoteUsageTable).values({
            telegramId: tg,
            voteDateUtc: today,
            contestId,
          }).returning();
          const [v] = await tx.insert(votesTable).values({
            contestId,
            contestantId,
            voterTelegramId: tg,
            voteCount: 1,
            source: "free",
            grantId: null,
            ipHash,
          }).returning();
          await tx.update(dailyFreeVoteUsageTable)
            .set({ voteId: v.id })
            .where(eq(dailyFreeVoteUsageTable.id, freeRow.id));
          inserted.push({ id: v.id, source: "free", count: 1, grantId: null });
          remaining -= 1;
        } catch (e: any) {
          // 23505 = unique_violation. Another concurrent request claimed today's free slot;
          // swallow and fall through to paid grants.
          if (e?.code !== "23505") throw e;
        }
      }

      // 2) Drain paid grants in FIFO order using guarded UPDATEs.
      for (const g of grantsAvailable) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, g.votesGranted - g.votesUsed);
        if (take <= 0) continue;
        const [upd] = await tx.update(voteGrantsTable)
          .set({ votesUsed: sql`${voteGrantsTable.votesUsed} + ${take}` })
          .where(and(
            eq(voteGrantsTable.id, g.id),
            sql`${voteGrantsTable.votesUsed} + ${take} <= ${voteGrantsTable.votesGranted}`,
          ))
          .returning();
        if (!upd) continue; // lost the race; try next grant
        const [v] = await tx.insert(votesTable).values({
          contestId,
          contestantId,
          voterTelegramId: tg,
          voteCount: take,
          source: "paid",
          grantId: g.id,
          ipHash,
        }).returning();
        inserted.push({ id: v.id, source: "paid", count: take, grantId: g.id });
        remaining -= take;
      }

      if (remaining > 0) {
        // Couldn't allocate — concurrent spend stole our votes. Rollback.
        throw Object.assign(new Error("INSUFFICIENT_VOTES_RACE"), { code: "INSUFFICIENT_VOTES_RACE" });
      }

      // 3) Bump denormalized counters with GUARDED UPDATEs that re-validate state
      //    inside the transaction. If the contestant got disqualified or the contest
      //    got ended between our outer check and this point, the UPDATE affects 0
      //    rows and we roll the whole transaction back — preventing ledger drift.
      const [cBump] = await tx.update(contestantsTable)
        .set({ voteCount: sql`${contestantsTable.voteCount} + ${voteCount}` })
        .where(and(
          eq(contestantsTable.id, contestantId),
          eq(contestantsTable.contestId, contestId),
          eq(contestantsTable.isDisqualified, false),
        ))
        .returning({ id: contestantsTable.id });
      if (!cBump) throw Object.assign(new Error("CONTESTANT_STATE_CHANGED"), { code: "CONTESTANT_STATE_CHANGED" });

      const [contestBump] = await tx.update(contestsTable)
        .set({ totalVotes: sql`${contestsTable.totalVotes} + ${voteCount}` })
        .where(and(
          eq(contestsTable.id, contestId),
          eq(contestsTable.status, "active"),
        ))
        .returning({ id: contestsTable.id });
      if (!contestBump) throw Object.assign(new Error("CONTEST_STATE_CHANGED"), { code: "CONTEST_STATE_CHANGED" });

      return inserted;
    });

    req.log.info({ telegramId, contestId, contestantId, voteCount }, "contests: vote cast");
    res.status(201).json({ ok: true, votesCast: voteCount, breakdown: result });
  } catch (e: any) {
    if (
      e?.code === "INSUFFICIENT_VOTES_RACE" ||
      e?.code === "CONTESTANT_STATE_CHANGED" ||
      e?.code === "CONTEST_STATE_CHANGED"
    ) {
      res.status(409).json({ error: e.code });
      return;
    }
    req.log.error({ err: e }, "contests: vote failed");
    res.status(500).json({ error: "Vote failed" });
  }
});

router.post("/internal/contests/purchase-pack", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res); if (!bot) return;
  const { telegramId, packId } = req.body as { telegramId: string; packId: number };
  if (!telegramId || !packId) { res.status(400).json({ error: "telegramId, packId required" }); return; }

  const tg = BigInt(String(telegramId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tg));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (rejectIfBlocked(user, res)) return;

  const [pack] = await db.select().from(votePacksTable).where(eq(votePacksTable.id, packId));
  if (!pack || !pack.isActive) { res.status(404).json({ error: "Pack not available" }); return; }

  const price = parseFloat(pack.priceSkz);
  if (!Number.isFinite(price) || price <= 0) {
    res.status(400).json({ error: "Invalid pack price" }); return;
  }
  const totalVotes = pack.votes + pack.bonusVotes;

  // Commission accounting: platform is the seller. We still record a commission row
  // so superadmin reports include contests revenue in the same shape as other bots.
  const rate = await getEffectiveCommissionRate(tg, BOT_SLUG, bot.commissionRate);
  const commission = +(price * rate).toFixed(2);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Atomic guarded debit.
      const [debited] = await tx.update(walletsTable)
        .set({ balanceSkz: sql`${walletsTable.balanceSkz} - ${price}` })
        .where(and(
          eq(walletsTable.userId, user.id),
          sql`${walletsTable.balanceSkz} >= ${price}`,
        ))
        .returning();
      if (!debited) throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { code: "INSUFFICIENT_BALANCE" });

      // 2. Buyer debit ledger row.
      const [debitTx] = await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "purchase",
        currency: "skz",
        amount: String(price.toFixed(2)),
        fee: "0",
        status: "completed",
        sourceBot: BOT_SLUG,
        referenceId: `votepack_${packId}`,
        description: `شراء باقة أصوات: ${pack.name}`,
        metadata: JSON.stringify({ packId, votes: pack.votes, bonusVotes: pack.bonusVotes }),
      }).returning();

      // 3. Issue the grant (snapshots bonus file so future pack changes don't strip access).
      const [grant] = await tx.insert(voteGrantsTable).values({
        telegramId: tg,
        source: "pack",
        packId: pack.id,
        refId: `tx_${debitTx.id}`,
        votesGranted: totalVotes,
        votesUsed: 0,
        pricePaid: String(price.toFixed(2)),
        bonusFileUrl: pack.bonusFileUrl,
        bonusFileName: pack.bonusFileName,
      }).returning();

      // 4. Commission ledger (platform revenue).
      await tx.insert(commissionsTable).values({
        transactionId: debitTx.id,
        botSlug: BOT_SLUG,
        userId: user.id,
        grossAmount: String(price.toFixed(2)),
        commissionRate: String(rate),
        commissionAmount: String(commission.toFixed(2)),
        netAmount: String((price - commission).toFixed(2)),
        currency: "skz",
      });

      // 5. Bot-level aggregates.
      await tx.update(botsTable).set({
        totalVolumeUsdt: sql`${botsTable.totalVolumeUsdt} + ${price}`,
        totalCommissionUsdt: sql`${botsTable.totalCommissionUsdt} + ${commission}`,
      }).where(eq(botsTable.id, bot.id));

      return { grant, debitTxId: debitTx.id };
    });

    req.log.info(
      { telegramId, packId, price, votes: totalVotes },
      "contests: pack purchased",
    );
    res.status(201).json({
      ok: true,
      grantId: result.grant.id,
      votesGranted: result.grant.votesGranted,
      hasBonusFile: !!result.grant.bonusFileUrl,
      bonusFileName: result.grant.bonusFileName,
    });
  } catch (e: any) {
    if (e?.code === "INSUFFICIENT_BALANCE") {
      res.status(402).json({ error: "INSUFFICIENT_BALANCE" });
      return;
    }
    req.log.error({ err: e }, "contests: purchase-pack failed");
    res.status(500).json({ error: "Purchase failed" });
  }
});

router.get("/internal/contests/grants/:grantId/download", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res); if (!bot) return;
  const grantId = parseInt(String(req.params.grantId), 10);
  const telegramIdStr = String(req.query.telegramId ?? "");
  if (!Number.isFinite(grantId) || !telegramIdStr) {
    res.status(400).json({ error: "grantId and telegramId required" }); return;
  }
  const [g] = await db.select().from(voteGrantsTable).where(eq(voteGrantsTable.id, grantId));
  if (!g || g.telegramId !== BigInt(telegramIdStr)) {
    res.status(404).json({ error: "Grant not found" }); return;
  }
  if (!g.bonusFileUrl) { res.status(404).json({ error: "No bonus file" }); return; }
  res.redirect(302, g.bonusFileUrl);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN — contests CRUD
// ─────────────────────────────────────────────────────────────────────────────

router.get("/superadmin/contests", requireSuperAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
  const rows = await db.select().from(contestsTable)
    .orderBy(desc(contestsTable.updatedAt))
    .limit(limit).offset(offset);
  res.json({ contests: rows });
});

router.post("/superadmin/contests", requireSuperAdmin, async (req, res): Promise<void> => {
  const { title, description, coverUrl, status, startsAt, endsAt } = req.body as {
    title: string; description?: string; coverUrl?: string; status?: string;
    startsAt?: string | null; endsAt?: string | null;
  };
  if (!title || !title.trim()) { res.status(400).json({ error: "title required" }); return; }
  const desiredStatus = status === "active" || status === "ended" || status === "draft" ? status : "draft";

  // Enforce single active contest: if activating, end any other active ones.
  await db.transaction(async (tx) => {
    if (desiredStatus === "active") {
      await tx.update(contestsTable).set({ status: "ended" })
        .where(eq(contestsTable.status, "active"));
    }
    await tx.insert(contestsTable).values({
      title: title.trim().slice(0, 200),
      description: (description ?? "").slice(0, 4000),
      coverUrl: coverUrl ?? null,
      status: desiredStatus,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    });
  });
  const [row] = await db.select().from(contestsTable).orderBy(desc(contestsTable.id)).limit(1);
  res.status(201).json(row);
});

router.patch("/superadmin/contests/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = req.body as Partial<{
    title: string; description: string; coverUrl: string | null; status: string;
    startsAt: string | null; endsAt: string | null;
  }>;
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 4000);
  if ("coverUrl" in body) patch.coverUrl = body.coverUrl ?? null;
  if (body.status && ["draft", "active", "ended"].includes(body.status)) patch.status = body.status;
  if ("startsAt" in body) patch.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if ("endsAt" in body) patch.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  await db.transaction(async (tx) => {
    if (patch.status === "active") {
      await tx.update(contestsTable).set({ status: "ended" })
        .where(and(eq(contestsTable.status, "active"), sql`${contestsTable.id} <> ${id}`));
    }
    await tx.update(contestsTable).set(patch).where(eq(contestsTable.id, id));
  });
  const [row] = await db.select().from(contestsTable).where(eq(contestsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/superadmin/contests/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.transaction(async (tx) => {
    await tx.delete(votesTable).where(eq(votesTable.contestId, id));
    await tx.delete(dailyFreeVoteUsageTable).where(eq(dailyFreeVoteUsageTable.contestId, id));
    await tx.delete(contestantsTable).where(eq(contestantsTable.contestId, id));
    await tx.delete(contestsTable).where(eq(contestsTable.id, id));
  });
  res.json({ ok: true });
});

// ── Contestants ──
router.get("/superadmin/contests/:id/contestants", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(contestantsTable)
    .where(eq(contestantsTable.contestId, id))
    .orderBy(asc(contestantsTable.sortOrder), desc(contestantsTable.voteCount));
  res.json({ contestants: rows });
});

router.post("/superadmin/contests/:id/contestants", requireSuperAdmin, async (req, res): Promise<void> => {
  const contestId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(contestId)) { res.status(400).json({ error: "Invalid contest id" }); return; }
  const { name, bio, photoUrl, sortOrder } = req.body as {
    name: string; bio?: string; photoUrl?: string | null; sortOrder?: number;
  };
  if (!name || !name.trim()) { res.status(400).json({ error: "name required" }); return; }
  const [contest] = await db.select({ id: contestsTable.id }).from(contestsTable).where(eq(contestsTable.id, contestId));
  if (!contest) { res.status(404).json({ error: "Contest not found" }); return; }
  const [row] = await db.insert(contestantsTable).values({
    contestId,
    name: name.trim().slice(0, 150),
    bio: (bio ?? "").slice(0, 2000),
    photoUrl: photoUrl ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(row);
});

router.patch("/superadmin/contestants/:cid", requireSuperAdmin, async (req, res): Promise<void> => {
  const cid = parseInt(String(req.params.cid), 10);
  if (!Number.isFinite(cid)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = req.body as Partial<{
    name: string; bio: string; photoUrl: string | null; sortOrder: number; isDisqualified: boolean;
  }>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 150);
  if (typeof body.bio === "string") patch.bio = body.bio.slice(0, 2000);
  if ("photoUrl" in body) patch.photoUrl = body.photoUrl ?? null;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  if (typeof body.isDisqualified === "boolean") patch.isDisqualified = body.isDisqualified;
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [row] = await db.update(contestantsTable).set(patch).where(eq(contestantsTable.id, cid)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/superadmin/contestants/:cid", requireSuperAdmin, async (req, res): Promise<void> => {
  const cid = parseInt(String(req.params.cid), 10);
  if (!Number.isFinite(cid)) { res.status(400).json({ error: "Invalid id" }); return; }
  // The votes_contestant_fk has NO ACTION on delete — we refuse hard delete if any
  // votes reference this contestant, so the financial/audit log can never go orphan.
  // Admins should soft-disqualify (PATCH isDisqualified=true) instead.
  const [hasVotes] = await db
    .select({ id: votesTable.id })
    .from(votesTable)
    .where(eq(votesTable.contestantId, cid))
    .limit(1);
  if (hasVotes) {
    res.status(409).json({
      error: "CONTESTANT_HAS_VOTES",
      hint: "استخدم تعطيل المتسابق (isDisqualified) بدل الحذف للحفاظ على سجل التصويت.",
    });
    return;
  }
  await db.delete(contestantsTable).where(eq(contestantsTable.id, cid));
  res.json({ ok: true });
});

// ── Vote packs ──
router.get("/superadmin/contests/packs", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(votePacksTable)
    .orderBy(asc(votePacksTable.sortOrder), asc(votePacksTable.priceSkz));
  res.json({ packs: rows });
});

router.post("/superadmin/contests/packs", requireSuperAdmin, async (req, res): Promise<void> => {
  const { name, description, votes, bonusVotes, priceSkz, bonusFileUrl, bonusFileName, bonusDescription, coverUrl, sortOrder, isActive } = req.body as {
    name: string; description?: string; votes: number; bonusVotes?: number; priceSkz: string | number;
    bonusFileUrl?: string | null; bonusFileName?: string | null; bonusDescription?: string | null;
    coverUrl?: string | null; sortOrder?: number; isActive?: boolean;
  };
  if (!name || !name.trim()) { res.status(400).json({ error: "name required" }); return; }
  if (!Number.isFinite(votes) || votes < 1) { res.status(400).json({ error: "votes >= 1 required" }); return; }
  const price = typeof priceSkz === "number" ? priceSkz : parseFloat(String(priceSkz));
  if (!Number.isFinite(price) || price < 0) { res.status(400).json({ error: "Invalid priceSkz" }); return; }
  const [row] = await db.insert(votePacksTable).values({
    name: name.trim().slice(0, 150),
    description: (description ?? "").slice(0, 2000),
    votes: Math.floor(votes),
    bonusVotes: Math.max(0, Math.floor(bonusVotes ?? 0)),
    priceSkz: String(price.toFixed(2)),
    bonusFileUrl: bonusFileUrl ?? null,
    bonusFileName: bonusFileName ?? null,
    bonusDescription: bonusDescription ?? null,
    coverUrl: coverUrl ?? null,
    sortOrder: sortOrder ?? 0,
    isActive: isActive ?? true,
  }).returning();
  res.status(201).json(row);
});

router.patch("/superadmin/contests/packs/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = req.body as Partial<{
    name: string; description: string; votes: number; bonusVotes: number; priceSkz: string | number;
    bonusFileUrl: string | null; bonusFileName: string | null; bonusDescription: string | null;
    coverUrl: string | null; sortOrder: number; isActive: boolean;
  }>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 150);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 2000);
  if (typeof body.votes === "number" && body.votes >= 1) patch.votes = Math.floor(body.votes);
  if (typeof body.bonusVotes === "number") patch.bonusVotes = Math.max(0, Math.floor(body.bonusVotes));
  if (body.priceSkz !== undefined) {
    const p = typeof body.priceSkz === "number" ? body.priceSkz : parseFloat(String(body.priceSkz));
    if (Number.isFinite(p) && p >= 0) patch.priceSkz = String(p.toFixed(2));
  }
  if ("bonusFileUrl" in body) patch.bonusFileUrl = body.bonusFileUrl ?? null;
  if ("bonusFileName" in body) patch.bonusFileName = body.bonusFileName ?? null;
  if ("bonusDescription" in body) patch.bonusDescription = body.bonusDescription ?? null;
  if ("coverUrl" in body) patch.coverUrl = body.coverUrl ?? null;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [row] = await db.update(votePacksTable).set(patch).where(eq(votePacksTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/superadmin/contests/packs/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(votePacksTable).where(eq(votePacksTable.id, id));
  res.json({ ok: true });
});

// ── Vote audit / anti-fraud ──
router.get("/superadmin/contests/:id/votes", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
  const rows = await db.select().from(votesTable)
    .where(eq(votesTable.contestId, id))
    .orderBy(desc(votesTable.createdAt))
    .limit(limit).offset(offset);
  res.json({ votes: rows });
});

router.post("/superadmin/contests/votes/:voteId/void", requireSuperAdmin, async (req, res): Promise<void> => {
  const voteId = parseInt(String(req.params.voteId), 10);
  if (!Number.isFinite(voteId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { reason } = req.body as { reason?: string };

  await db.transaction(async (tx) => {
    // Race-safe void: single guarded UPDATE flips the row from not-void → void.
    // If two admins click "void" concurrently, only one UPDATE returns a row;
    // the other gets nothing and we throw 409 without applying compensations twice.
    const [v] = await tx.update(votesTable).set({
      isVoid: true,
      voidedAt: new Date(),
      voidReason: (reason ?? "").slice(0, 500) || null,
    }).where(and(
      eq(votesTable.id, voteId),
      eq(votesTable.isVoid, false),
    )).returning();
    if (!v) {
      // Either not found or already voided. Distinguish for the admin.
      const [exists] = await tx.select({ id: votesTable.id }).from(votesTable).where(eq(votesTable.id, voteId));
      throw Object.assign(new Error(exists ? "Already void" : "Not found"), { status: exists ? 409 : 404 });
    }

    // Restore denormalized counters (single row each → compensations applied exactly once).
    await tx.update(contestantsTable)
      .set({ voteCount: sql`GREATEST(${contestantsTable.voteCount} - ${v.voteCount}, 0)` })
      .where(eq(contestantsTable.id, v.contestantId));
    await tx.update(contestsTable)
      .set({ totalVotes: sql`GREATEST(${contestsTable.totalVotes} - ${v.voteCount}, 0)` })
      .where(eq(contestsTable.id, v.contestId));

    // If from a paid grant, give the votes back.
    if (v.grantId) {
      await tx.update(voteGrantsTable)
        .set({ votesUsed: sql`GREATEST(${voteGrantsTable.votesUsed} - ${v.voteCount}, 0)` })
        .where(eq(voteGrantsTable.id, v.grantId));
    }
    // If it was the free daily vote, free up that slot for the user.
    if (v.source === "free") {
      await tx.delete(dailyFreeVoteUsageTable).where(eq(dailyFreeVoteUsageTable.voteId, voteId));
    }
  }).then(
    () => res.json({ ok: true }),
    (e) => {
      if (e?.status) res.status(e.status).json({ error: e.message });
      else { req.log.error({ err: e }, "void-vote failed"); res.status(500).json({ error: "Void failed" }); }
    },
  );
});

router.get("/superadmin/contests/stats", requireSuperAdmin, async (_req, res): Promise<void> => {
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.slug, BOT_SLUG));
  const [contestsAgg] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contestsTable);
  const [activeAgg] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contestsTable).where(eq(contestsTable.status, "active"));
  const [votesAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      voided: sql<number>`count(*) filter (where ${votesTable.isVoid} = true)::int`,
      freeCount: sql<number>`count(*) filter (where ${votesTable.source} = 'free')::int`,
      paidCount: sql<number>`count(*) filter (where ${votesTable.source} = 'paid')::int`,
    })
    .from(votesTable);
  const [grantsAgg] = await db
    .select({
      totalGrants: sql<number>`count(*)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(${voteGrantsTable.pricePaid}),'0')`,
    })
    .from(voteGrantsTable);
  res.json({
    contestsTotal: contestsAgg?.total ?? 0,
    contestsActive: activeAgg?.total ?? 0,
    votesTotal: votesAgg?.total ?? 0,
    votesVoided: votesAgg?.voided ?? 0,
    votesFree: votesAgg?.freeCount ?? 0,
    votesPaid: votesAgg?.paidCount ?? 0,
    grantsTotal: grantsAgg?.totalGrants ?? 0,
    revenueSkz: grantsAgg?.totalRevenue ?? "0",
    bot: bot ? {
      slug: bot.slug,
      name: bot.name,
      commissionRate: bot.commissionRate,
      totalVolumeUsdt: bot.totalVolumeUsdt,
      totalCommissionUsdt: bot.totalCommissionUsdt,
    } : null,
  });
});

export default router;
