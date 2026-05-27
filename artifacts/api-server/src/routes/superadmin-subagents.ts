/**
 * /api/superadmin/subagents/* — Admin CRUD for the SOUQRATES SUB-AGENTS
 * program (applications + tier configuration).
 */
import { Router, type IRouter } from "express";
import { eq, desc, and, sql, or, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  subAgentsTable,
  subAgentTiersTable,
  subAgentSalesTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import { requireSuperAdmin } from "../lib/super-admin-auth";
import { logAdminAction } from "../lib/audit-log";
import { notifyUser } from "../lib/notify-user";
import { recomputeTier } from "./subagents";
import { z } from "zod";

const router: IRouter = Router();

// ── GET /api/superadmin/subagents — list applications ─────────────────────
router.get("/superadmin/subagents", requireSuperAdmin, async (req, res): Promise<void> => {
  const status = (req.query.status as string | undefined)?.trim();
  const search = (req.query.search as string | undefined)?.trim();
  const conds = [];
  if (status && ["pending", "approved", "rejected", "suspended"].includes(status)) {
    conds.push(eq(subAgentsTable.status, status));
  }
  if (search) {
    conds.push(or(
      ilike(subAgentsTable.fullName, `%${search}%`),
      ilike(subAgentsTable.country, `%${search}%`),
      ilike(subAgentsTable.phone, `%${search}%`),
      sql`${subAgentsTable.telegramId}::text LIKE ${`%${search}%`}`,
    ));
  }
  const rows = await db
    .select()
    .from(subAgentsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(subAgentsTable.createdAt))
    .limit(200);
  res.json({
    data: rows.map((r) => ({ ...r, telegramId: String(r.telegramId) })),
  });
});

// ── GET /api/superadmin/subagents/:id — full detail (incl. ID photo) ──────
router.get("/superadmin/subagents/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.id, id));
  if (!agent) { res.status(404).json({ error: "not_found" }); return; }
  const [tier] = agent.tierLevel
    ? await db.select().from(subAgentTiersTable).where(eq(subAgentTiersTable.level, agent.tierLevel))
    : [null];
  const sales = await db
    .select()
    .from(subAgentSalesTable)
    .where(eq(subAgentSalesTable.subAgentId, id))
    .orderBy(desc(subAgentSalesTable.createdAt))
    .limit(50);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, agent.telegramId));
  const [wallet] = user
    ? await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id))
    : [null];
  res.json({
    agent: { ...agent, telegramId: String(agent.telegramId) },
    tier,
    sales: sales.map((s) => ({ ...s, customerTelegramId: String(s.customerTelegramId) })),
    wallet,
  });
});

// ── GET /api/superadmin/subagents/:id/id-photo — streams private ID photo ─
router.get("/superadmin/subagents/:id/id-photo", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [agent] = await db.select({ idPhotoPath: subAgentsTable.idPhotoPath })
    .from(subAgentsTable).where(eq(subAgentsTable.id, id));
  if (!agent) { res.status(404).json({ error: "not_found" }); return; }
  const { ObjectStorageService, ObjectNotFoundError } = await import("../lib/objectStorage");
  const storage = new ObjectStorageService();
  try {
    const file = await storage.getObjectEntityFile(agent.idPhotoPath);
    const fetchResp = await storage.downloadObject(file, 300);
    res.status(fetchResp.status);
    fetchResp.headers.forEach((value, key) => res.setHeader(key, value));
    if (fetchResp.body) {
      const reader = fetchResp.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } else { res.end(); }
  } catch (e) {
    if (e instanceof ObjectNotFoundError) { res.status(404).json({ error: "photo_missing" }); return; }
    req.log.error({ err: e }, "subagent id-photo download failed");
    res.status(500).json({ error: "download_failed" });
  }
});

// ── POST /api/superadmin/subagents/:id/approve ────────────────────────────
router.post("/superadmin/subagents/:id/approve", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.id, id));
  if (!agent) { res.status(404).json({ error: "not_found" }); return; }
  if (agent.status === "approved") { res.json({ ok: true, alreadyApproved: true }); return; }

  // Ensure wallet exists for the agent's user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, agent.telegramId));
  if (user) {
    await db.insert(walletsTable).values({ userId: user.id }).onConflictDoNothing();
  }

  const [updated] = await db.update(subAgentsTable).set({
    status: "approved",
    tierLevel: 1,
    approvedAt: new Date(),
    approvedBy: "superadmin",
    rejectedAt: null,
    rejectedReason: null,
  }).where(eq(subAgentsTable.id, id)).returning();

  await logAdminAction(req, "superadmin", {
    action: "subagent.approve", targetType: "subagent", targetId: String(id),
  });
  try {
    await notifyUser(
      String(agent.telegramId),
      `🎉 تهانينا! تمّت الموافقة على طلبك في برنامج SOUQRATES SUB-AGENTS. افتح البوت لاستلام لوحة الشريك.`,
    );
  } catch (e) { req.log.warn({ err: e }, "subagent approve notify failed"); }
  res.json({ ok: true, agent: { ...updated, telegramId: String(updated.telegramId) } });
});

// ── POST /api/superadmin/subagents/:id/reject ─────────────────────────────
const rejectSchema = z.object({ reason: z.string().min(1).max(500) });
router.post("/superadmin/subagents/:id/reject", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "reason required" }); return; }
  const [agent] = await db.select().from(subAgentsTable).where(eq(subAgentsTable.id, id));
  if (!agent) { res.status(404).json({ error: "not_found" }); return; }
  const [updated] = await db.update(subAgentsTable).set({
    status: "rejected",
    rejectedAt: new Date(),
    rejectedReason: parsed.data.reason,
    tierLevel: null,
  }).where(eq(subAgentsTable.id, id)).returning();
  await logAdminAction(req, "superadmin", {
    action: "subagent.reject", targetType: "subagent", targetId: String(id),
    payload: { reason: parsed.data.reason },
  });
  try {
    await notifyUser(
      String(agent.telegramId),
      `للأسف، لم يتم قبول طلبك حالياً. السبب: ${parsed.data.reason}\nيمكنك تحديث بياناتك وإعادة التقديم.`,
    );
  } catch (e) { req.log.warn({ err: e }, "subagent reject notify failed"); }
  res.json({ ok: true, agent: { ...updated, telegramId: String(updated.telegramId) } });
});

// ── POST /api/superadmin/subagents/:id/suspend ────────────────────────────
router.post("/superadmin/subagents/:id/suspend", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [updated] = await db.update(subAgentsTable).set({
    status: "suspended",
  }).where(eq(subAgentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }
  await logAdminAction(req, "superadmin", { action: "subagent.suspend", targetType: "subagent", targetId: String(id) });
  res.json({ ok: true });
});

// ── POST /api/superadmin/subagents/:id/recompute-tier ─────────────────────
router.post("/superadmin/subagents/:id/recompute-tier", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const newTier = await recomputeTier(id);
  res.json({ ok: true, tierLevel: newTier });
});

// ── Tiers CRUD ────────────────────────────────────────────────────────────
router.get("/superadmin/subagent-tiers", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(subAgentTiersTable).orderBy(subAgentTiersTable.level);
  res.json({ data: rows });
});

const tierUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().min(1).max(20).optional(),
  minSalesSkz: z.union([z.string(), z.number()]).optional(),
  minCustomers: z.number().int().min(0).optional(),
  discountRate: z.union([z.string(), z.number()]).optional(),
  perks: z.array(z.string()).optional(),
});

router.put("/superadmin/subagent-tiers/:level", requireSuperAdmin, async (req, res): Promise<void> => {
  const level = parseInt(String(req.params.level), 10);
  if (!Number.isFinite(level) || level < 1 || level > 7) {
    res.status(400).json({ error: "level must be 1..7" }); return;
  }
  const parsed = tierUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_failed", details: parsed.error.issues }); return;
  }
  const u: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) u.name = d.name;
  if (d.color !== undefined) u.color = d.color;
  if (d.minSalesSkz !== undefined) {
    const n = typeof d.minSalesSkz === "number" ? d.minSalesSkz : parseFloat(d.minSalesSkz);
    if (!Number.isFinite(n) || n < 0) { res.status(400).json({ error: "bad minSalesSkz" }); return; }
    u.minSalesSkz = n.toFixed(2);
  }
  if (d.minCustomers !== undefined) u.minCustomers = d.minCustomers;
  if (d.discountRate !== undefined) {
    const n = typeof d.discountRate === "number" ? d.discountRate : parseFloat(d.discountRate);
    if (!Number.isFinite(n) || n < 0 || n > 1) { res.status(400).json({ error: "discountRate must be 0..1" }); return; }
    u.discountRate = n.toFixed(4);
  }
  if (d.perks !== undefined) u.perks = d.perks;
  if (Object.keys(u).length === 0) { res.status(400).json({ error: "no fields" }); return; }

  const [updated] = await db.update(subAgentTiersTable).set(u).where(eq(subAgentTiersTable.level, level)).returning();
  if (!updated) { res.status(404).json({ error: "tier not found — run /seed-tiers first" }); return; }
  await logAdminAction(req, "superadmin", {
    action: "subagent_tier.update", targetType: "subagent_tier", targetId: String(level), payload: u,
  });
  res.json({ ok: true, tier: updated });
});

// ── POST /api/superadmin/subagent-tiers/seed — idempotent default seed ────
router.post("/superadmin/subagent-tiers/seed", requireSuperAdmin, async (req, res): Promise<void> => {
  const defaults = [
    { level: 1, name: "Bronze",    color: "#cd7f32", minSalesSkz: "0",      minCustomers: 0,   discountRate: "0.0000", perks: ["لوحة شريك أساسية"] },
    { level: 2, name: "Silver",    color: "#c0c0c0", minSalesSkz: "1000",   minCustomers: 5,   discountRate: "0.0200", perks: ["خصم 2% عند الشراء"] },
    { level: 3, name: "Gold",      color: "#FFD700", minSalesSkz: "5000",   minCustomers: 20,  discountRate: "0.0400", perks: ["خصم 4%", "شارة ذهبية"] },
    { level: 4, name: "Platinum",  color: "#e5e4e2", minSalesSkz: "15000",  minCustomers: 50,  discountRate: "0.0600", perks: ["خصم 6%", "أولوية الدعم"] },
    { level: 5, name: "Diamond",   color: "#b9f2ff", minSalesSkz: "40000",  minCustomers: 120, discountRate: "0.0800", perks: ["خصم 8%", "شعار ماسي"] },
    { level: 6, name: "Master",    color: "#8a2be2", minSalesSkz: "100000", minCustomers: 250, discountRate: "0.1000", perks: ["خصم 10%", "دعم مخصّص"] },
    { level: 7, name: "Sovereign", color: "#D4AF37", minSalesSkz: "250000", minCustomers: 500, discountRate: "0.1300", perks: ["خصم 13%", "اجتماعات حصرية"] },
  ];
  for (const t of defaults) {
    await db.insert(subAgentTiersTable).values(t).onConflictDoNothing();
  }
  res.json({ ok: true, seeded: defaults.length });
});

export default router;
