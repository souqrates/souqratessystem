/**
 * /api/subagents/* — SOUQRATES SUB-AGENTS public + agent-self endpoints.
 *
 * Auth:
 *   - /apply, /me, /sell, /tiers (public read) — Telegram initData
 *     (re-uses the same HMAC verify pattern as /api/games/*).
 *   - The applicant's telegramId is taken from the verified initData,
 *     never from the request body.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  subAgentsTable,
  subAgentTiersTable,
  subAgentSalesTable,
  usersTable,
  walletsTable,
  transactionsTable,
} from "@workspace/db";
import { z } from "zod";
import { perUserCreateLimiter } from "../lib/rate-limit";

const router: IRouter = Router();

// ── Telegram initData verification (mirrors games.ts) ──────────────────────
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

interface TgUser { id: number; first_name?: string; last_name?: string; username?: string }

function parseInitData(initData: string): { telegramId: bigint; tgUser: TgUser } | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    const tgUser: TgUser = JSON.parse(userStr);
    if (!tgUser?.id) return null;
    return { telegramId: BigInt(tgUser.id), tgUser };
  } catch { return null; }
}

const INIT_DATA_MAX_AGE = 24 * 60 * 60;
type AuthedReq = Request & { telegramId: bigint; tgUser: TgUser };

function requireTelegramAuth(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  if (!initData) { res.status(401).json({ error: "Missing X-Telegram-Init-Data" }); return; }
  const tokens = [
    process.env.SUBAGENTS_BOT_TOKEN,
    process.env.MOTHER_BOT_TOKEN,
  ].filter((t): t is string => typeof t === "string" && t.length > 0);
  if (tokens.length === 0) { res.status(503).json({ error: "No bot token configured" }); return; }
  const matched = tokens.some((tok) => verifyInitData(initData, tok));
  if (!matched) { res.status(403).json({ error: "Invalid initData signature" }); return; }
  const params = new URLSearchParams(initData);
  const authDate = parseInt(params.get("auth_date") ?? "", 10);
  if (!Number.isFinite(authDate)) { res.status(403).json({ error: "invalid auth_date" }); return; }
  if (Math.floor(Date.now() / 1000) - authDate > INIT_DATA_MAX_AGE) {
    res.status(403).json({ error: "initData expired — re-open the Mini App" }); return;
  }
  const parsed = parseInitData(initData);
  if (!parsed) { res.status(400).json({ error: "Could not parse user from initData" }); return; }
  (req as AuthedReq).telegramId = parsed.telegramId;
  (req as AuthedReq).tgUser = parsed.tgUser;
  next();
}

// ── Schemas ────────────────────────────────────────────────────────────────
// idPhotoPath must point inside the private namespace issued by
// /subagents/id-photo-upload-url — refuses arbitrary paths so a malicious
// applicant can't reference some other private object as their "ID".
const ID_PHOTO_PATH_PREFIX = "/objects/subagents/id-photos/";
const applyBodySchema = z.object({
  fullName: z.string().min(2).max(120),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dob must be YYYY-MM-DD"),
  country: z.string().min(2).max(80),
  phone: z.string().min(5).max(40),
  email: z.string().email().nullish(),
  address: z.string().min(5).max(500),
  idPhotoPath: z.string()
    .min(ID_PHOTO_PATH_PREFIX.length + 1)
    .max(400)
    .refine((p) => p.startsWith(ID_PHOTO_PATH_PREFIX), {
      message: `idPhotoPath must start with ${ID_PHOTO_PATH_PREFIX}`,
    }),
});

const sellBodySchema = z.object({
  customerTelegramId: z.string().regex(/^\d+$/),
  skzAmount: z.number().positive().max(1_000_000),
  note: z.string().max(200).optional(),
});

function maskTelegramId(tg: bigint): string {
  const s = String(tg);
  if (s.length <= 4) return s;
  return s.slice(0, 2) + "***" + s.slice(-2);
}

// ── GET /api/internal/subagent-status — bot-key auth, used by Python bot ─
// Restricted to subagents-bot and mother-bot slugs (cross-bot reads denied).
// Returns a MINIMAL status DTO only — never raw KYC PII (DOB/phone/email/
// address/idPhotoPath). KYC is admin-only via /api/superadmin/subagents/:id.
const ALLOWED_STATUS_BOTS = new Set(["subagents-bot", "mother-bot"]);
router.get("/internal/subagent-status", async (req, res): Promise<void> => {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) { res.status(401).json({ error: "missing X-Bot-Api-Key" }); return; }
  const { botsTable } = await import("@workspace/db");
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  if (!bot) { res.status(403).json({ error: "invalid bot key" }); return; }
  if (!ALLOWED_STATUS_BOTS.has(bot.slug)) {
    res.status(403).json({ error: "bot_not_authorised_for_subagent_status" }); return;
  }
  const telegramIdStr = String(req.query.telegramId ?? "");
  if (!/^\d+$/.test(telegramIdStr)) { res.status(400).json({ error: "bad telegramId" }); return; }
  const tg = BigInt(telegramIdStr);
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.telegramId, tg));
  if (!agent) { res.json({ status: "not_applied" }); return; }
  const [tier] = agent.tierLevel
    ? await db.select().from(subAgentTiersTable).where(eq(subAgentTiersTable.level, agent.tierLevel))
    : [null];
  // Minimal DTO — only non-PII operational fields the bot needs.
  res.json({
    status: agent.status,
    agent: {
      id: agent.id,
      telegramId: String(agent.telegramId),
      status: agent.status,
      tierLevel: agent.tierLevel,
      totalSalesSkz: agent.totalSalesSkz,
      totalCustomers: agent.totalCustomers,
      rejectedReason: agent.status === "rejected" ? agent.rejectedReason : null,
    },
    tier: tier ? { level: tier.level, name: tier.name, color: tier.color, discountRate: tier.discountRate } : null,
  });
});

// ── POST /api/subagents/id-photo-upload-url — signed PUT URL for ID photo ─
// Stored under a NON-public prefix so /api/objects/* refuses to serve it;
// only super-admin can view via /api/superadmin/subagents/:id/id-photo.
const ID_PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ID_PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const idPhotoSchema = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});
router.post("/subagents/id-photo-upload-url", requireTelegramAuth, async (req, res): Promise<void> => {
  const parsed = idPhotoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_failed" }); return; }
  const mime = parsed.data.contentType.toLowerCase().split(";")[0].trim();
  if (!ID_PHOTO_MIMES.has(mime)) {
    res.status(400).json({ error: "صيغة غير مسموحة. الأنواع المقبولة: JPG / PNG / WEBP" }); return;
  }
  if (parsed.data.sizeBytes > ID_PHOTO_MAX_BYTES) {
    res.status(413).json({ error: "حجم الصورة يتجاوز 8 ميجابايت" }); return;
  }
  const { ObjectStorageService } = await import("../lib/objectStorage");
  const storage = new ObjectStorageService();
  const uploadUrl = await storage.getNamedUploadURL("subagents/id-photos");
  const u = new URL(uploadUrl);
  const segs = u.pathname.split("/").filter(Boolean);
  const objectName = segs.slice(-3).join("/"); // subagents/id-photos/<uuid>
  res.json({ uploadUrl, objectPath: `/objects/${objectName}` });
});

// ── GET /api/subagents/tiers — public ladder (no auth) ────────────────────
router.get("/subagents/tiers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(subAgentTiersTable).orderBy(subAgentTiersTable.level);
  res.json({ data: rows });
});

// ── GET /api/subagents/me — current applicant/agent state ─────────────────
router.get("/subagents/me", requireTelegramAuth, async (req, res): Promise<void> => {
  const tg = (req as AuthedReq).telegramId;
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.telegramId, tg));
  if (!agent) { res.json({ status: "not_applied", agent: null }); return; }
  // Fetch wallet via users
  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tg));
  let wallet = null;
  if (user) {
    const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
    wallet = w ?? null;
  }
  const [tier] = agent.tierLevel
    ? await db.select().from(subAgentTiersTable).where(eq(subAgentTiersTable.level, agent.tierLevel))
    : [null];
  res.json({
    status: agent.status,
    agent: {
      ...agent,
      telegramId: String(agent.telegramId),
      idPhotoPath: undefined, // never expose to the agent
    },
    tier,
    wallet,
  });
});

// ── POST /api/subagents/apply — submit KYC application ────────────────────
router.post("/subagents/apply", requireTelegramAuth, async (req, res): Promise<void> => {
  const tg = (req as AuthedReq).telegramId;
  const tgUser = (req as AuthedReq).tgUser;
  const parsed = applyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_failed", details: parsed.error.issues });
    return;
  }
  // Refuse duplicate application unless prior was rejected (allow re-apply)
  const [existing] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.telegramId, tg));
  if (existing && existing.status !== "rejected") {
    res.status(409).json({ error: "already_applied", status: existing.status });
    return;
  }
  // Ensure user exists in users table (best-effort upsert)
  await db.insert(usersTable).values({
    telegramId: tg,
    firstName: tgUser.first_name ?? "Agent",
    lastName: tgUser.last_name ?? null,
    username: tgUser.username ?? null,
  }).onConflictDoNothing();

  const data = parsed.data;
  if (existing) {
    // Re-apply after rejection: reset to pending with new data
    const [u] = await db.update(subAgentsTable).set({
      fullName: data.fullName, dob: data.dob, country: data.country,
      phone: data.phone, email: data.email ?? null, address: data.address,
      idPhotoPath: data.idPhotoPath,
      status: "pending",
      rejectedAt: null, rejectedReason: null,
    }).where(eq(subAgentsTable.id, existing.id)).returning();
    res.json({ ok: true, status: u.status, id: u.id });
    return;
  }
  const [created] = await db.insert(subAgentsTable).values({
    telegramId: tg,
    fullName: data.fullName, dob: data.dob, country: data.country,
    phone: data.phone, email: data.email ?? null, address: data.address,
    idPhotoPath: data.idPhotoPath,
  }).returning();
  req.log.info({ subAgentId: created.id }, "subagent application submitted");
  res.json({ ok: true, status: created.status, id: created.id });
});

// ── POST /api/subagents/sell — agent sells SKZ to customer ────────────────
router.post("/subagents/sell", requireTelegramAuth, perUserCreateLimiter, async (req, res): Promise<void> => {
  const tg = (req as AuthedReq).telegramId;
  const parsed = sellBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_failed", details: parsed.error.issues });
    return;
  }
  const { customerTelegramId, skzAmount, note } = parsed.data;
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.telegramId, tg));
  if (!agent || agent.status !== "approved") {
    res.status(403).json({ error: "not_an_approved_agent" }); return;
  }
  const customerTg = BigInt(customerTelegramId);
  if (customerTg === tg) { res.status(400).json({ error: "cannot_sell_to_self" }); return; }

  const [agentUser] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tg));
  const [customer] = await db.select().from(usersTable).where(eq(usersTable.telegramId, customerTg));
  if (!agentUser) { res.status(404).json({ error: "agent_user_not_found" }); return; }
  if (!customer) { res.status(404).json({ error: "customer_not_found_in_platform" }); return; }
  // Block check on BOTH parties — a blocked agent must not move money either.
  if (agentUser.isBlocked) { res.status(403).json({ error: "agent_blocked" }); return; }
  if (customer.isBlocked) { res.status(403).json({ error: "customer_blocked" }); return; }

  const amt = parseFloat(skzAmount.toFixed(2));

  // Optional idempotency key (header). When provided, a replay returns the
  // original sale instead of double-charging the agent.
  const rawIdem = (req.headers["x-idempotency-key"] as string | undefined)?.trim();
  const idemKey = rawIdem && /^[\w.\-:]{8,128}$/.test(rawIdem) ? rawIdem : null;
  if (idemKey) {
    const [existing] = await db.select().from(subAgentSalesTable).where(and(
      eq(subAgentSalesTable.subAgentId, agent.id),
      eq(subAgentSalesTable.idempotencyKey, idemKey),
    ));
    if (existing) {
      const [aw] = await db.select().from(walletsTable).where(eq(walletsTable.userId, agentUser.id));
      const [a2] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.id, agent.id));
      res.json({
        ok: true, replayed: true, soldSkz: parseFloat(existing.skzAmount),
        agentBalanceSkz: aw?.balanceSkz, totalSalesSkz: a2?.totalSalesSkz,
        totalCustomers: a2?.totalCustomers,
      });
      return;
    }
  }

  // Atomic transfer: lock agent row → check new-customer BEFORE insert →
  // debit agent (guarded), credit customer, write 2 tx rows, log sale,
  // update agent aggregates — all in one DB transaction.
  let result;
  try {
    result = await db.transaction(async (tx) => {
      // Serialise concurrent sells for the SAME agent by taking a row lock.
      // Eliminates the new-customer-count race (post-insert count was wrong
      // when two sells to the same new customer landed concurrently).
      await tx.execute(sql`SELECT id FROM sub_agents WHERE id = ${agent.id} FOR UPDATE`);

      // New-customer detection — safe to do BEFORE insert thanks to row lock.
      const [prior] = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(subAgentSalesTable)
        .where(and(
          eq(subAgentSalesTable.subAgentId, agent.id),
          eq(subAgentSalesTable.customerTelegramId, customerTg),
        ));
      const isNewCustomer = (prior?.c ?? 0) === 0;

      // Debit agent SKZ (guarded — refuses if insufficient)
      const [agentWallet] = await tx
        .update(walletsTable)
        .set({ balanceSkz: sql`${walletsTable.balanceSkz} - ${amt}` })
        .where(and(
          eq(walletsTable.userId, agentUser.id),
          sql`${walletsTable.balanceSkz} >= ${amt}`,
        ))
        .returning();
      if (!agentWallet) throw Object.assign(new Error("INSUFFICIENT"), { status: 400 });

      // Credit customer SKZ
      const [customerWallet] = await tx
        .update(walletsTable)
        .set({
          balanceSkz: sql`${walletsTable.balanceSkz} + ${amt}`,
          totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${amt}`,
        })
        .where(eq(walletsTable.userId, customer.id))
        .returning();
      if (!customerWallet) throw Object.assign(new Error("CUSTOMER_NO_WALLET"), { status: 404 });

      // Ledger entries
      const refId = `subagent_sale_${agent.id}_${Date.now()}`;
      const [debit] = await tx.insert(transactionsTable).values({
        userId: agentUser.id,
        type: "debit",
        currency: "skz",
        amount: String(amt),
        fee: "0",
        status: "completed",
        sourceBot: "subagents-bot",
        referenceId: refId + "_debit",
        description: `بيع ${amt} SKZ إلى عميل ${maskTelegramId(customerTg)}`,
        metadata: JSON.stringify({ action: "subagent_sell", customerTelegramId: String(customerTg), note }),
      }).returning();
      await tx.insert(transactionsTable).values({
        userId: customer.id,
        type: "credit",
        currency: "skz",
        amount: String(amt),
        fee: "0",
        status: "completed",
        sourceBot: "subagents-bot",
        referenceId: refId + "_credit",
        description: `تحويل ${amt} SKZ من شريك معتمد`,
        metadata: JSON.stringify({ action: "subagent_receive", agentId: agent.id }),
      });

      // Sale log (carries idempotency key — unique per agent when set).
      await tx.insert(subAgentSalesTable).values({
        subAgentId: agent.id,
        customerTelegramId: customerTg,
        skzAmount: String(amt),
        transactionId: debit.id,
        note: note ?? null,
        idempotencyKey: idemKey,
      });

      const [updatedAgent] = await tx.update(subAgentsTable).set({
        totalSalesSkz: sql`${subAgentsTable.totalSalesSkz} + ${amt}`,
        totalCustomers: isNewCustomer
          ? sql`${subAgentsTable.totalCustomers} + 1`
          : subAgentsTable.totalCustomers,
      }).where(eq(subAgentsTable.id, agent.id)).returning();

      return { agentWallet, customerWallet, updatedAgent };
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.message === "INSUFFICIENT") {
      res.status(400).json({ error: "insufficient_skz" }); return;
    }
    if (e.message === "CUSTOMER_NO_WALLET") {
      res.status(404).json({ error: "customer_wallet_not_initialised" }); return;
    }
    // Idempotency-key race: another request with the same key won the insert.
    if (e.code === "23505" && idemKey) {
      const [existing] = await db.select().from(subAgentSalesTable).where(and(
        eq(subAgentSalesTable.subAgentId, agent.id),
        eq(subAgentSalesTable.idempotencyKey, idemKey),
      ));
      if (existing) {
        const [aw] = await db.select().from(walletsTable).where(eq(walletsTable.userId, agentUser.id));
        const [a2] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.id, agent.id));
        res.json({
          ok: true, replayed: true, soldSkz: parseFloat(existing.skzAmount),
          agentBalanceSkz: aw?.balanceSkz, totalSalesSkz: a2?.totalSalesSkz,
          totalCustomers: a2?.totalCustomers,
        });
        return;
      }
    }
    req.log.error({ err }, "subagent sell failed");
    res.status(500).json({ error: "internal" }); return;
  }

  // Re-evaluate tier asynchronously (don't block response)
  void recomputeTier(agent.id).catch(() => {});

  res.json({
    ok: true,
    soldSkz: amt,
    agentBalanceSkz: result.agentWallet.balanceSkz,
    totalSalesSkz: result.updatedAgent.totalSalesSkz,
    totalCustomers: result.updatedAgent.totalCustomers,
  });
});

// ── GET /api/subagents/sales — agent's own sales history ──────────────────
router.get("/subagents/sales", requireTelegramAuth, async (req, res): Promise<void> => {
  const tg = (req as AuthedReq).telegramId;
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.telegramId, tg));
  if (!agent) { res.status(404).json({ error: "not_an_agent" }); return; }
  const rows = await db
    .select()
    .from(subAgentSalesTable)
    .where(eq(subAgentSalesTable.subAgentId, agent.id))
    .orderBy(desc(subAgentSalesTable.createdAt))
    .limit(100);
  res.json({
    data: rows.map((r) => ({
      ...r,
      customerTelegramId: String(r.customerTelegramId),
      customerMasked: maskTelegramId(r.customerTelegramId),
    })),
  });
});

/**
 * Recompute the highest tier the agent qualifies for and persist it.
 * Tier qualification: both minSalesSkz AND minCustomers thresholds met.
 * Exported so superadmin routes can also trigger re-evaluation.
 */
export async function recomputeTier(agentId: number): Promise<number | null> {
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.id, agentId));
  if (!agent) return null;
  const tiers = await db.select().from(subAgentTiersTable).orderBy(desc(subAgentTiersTable.level));
  const sales = parseFloat(agent.totalSalesSkz);
  const customers = agent.totalCustomers;
  let qualifies: number | null = null;
  for (const t of tiers) {
    if (sales >= parseFloat(t.minSalesSkz) && customers >= t.minCustomers) {
      qualifies = t.level;
      break;
    }
  }
  // Persist EVERY change, including downgrades to null (e.g. when admin
  // raises tier thresholds and the agent no longer qualifies).
  if (agent.tierLevel !== qualifies) {
    await db.update(subAgentsTable).set({ tierLevel: qualifies }).where(eq(subAgentsTable.id, agentId));
  }
  return qualifies;
}

export default router;
