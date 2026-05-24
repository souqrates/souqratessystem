import { Router, type IRouter, json as bodyJson } from "express";
import { db, agreementSettingsTable, agreementSignaturesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-auth";
import { requireSuperAdmin } from "../lib/super-admin-auth";

const router: IRouter = Router();

// Bound the signature payload (data: URL string length). Decoded PNG must
// also pass a stricter byte check below.
const MAX_SIGNATURE_BYTES = 200_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PNG magic bytes — first 8 bytes of every valid PNG.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function getClientIp(req: import("express").Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip ?? "";
}

// Per-IP token bucket — 5 signatures / hour / IP. In-memory is fine here
// because the public form is low-volume and we just want to stop trivial
// scripted spam. Survives across requests in the single Node process.
const signAttempts = new Map<string, number[]>();
const SIGN_WINDOW_MS = 60 * 60 * 1000;
const SIGN_MAX       = 5;
function signRateAvailable(ip: string): boolean {
  const now = Date.now();
  const arr = (signAttempts.get(ip) ?? []).filter(t => now - t < SIGN_WINDOW_MS);
  signAttempts.set(ip, arr);
  return arr.length < SIGN_MAX;
}
function signRateConsume(ip: string): void {
  const now = Date.now();
  const arr = (signAttempts.get(ip) ?? []).filter(t => now - t < SIGN_WINDOW_MS);
  arr.push(now);
  signAttempts.set(ip, arr);
  if (signAttempts.size > 5000) {
    for (const [k, v] of signAttempts) {
      if (!v.some(t => now - t < SIGN_WINDOW_MS)) signAttempts.delete(k);
    }
  }
}

// ── Public: get current agreement text ────────────────────────────────────
router.get("/agreement", async (_req, res) => {
  const [row] = await db.select().from(agreementSettingsTable).where(eq(agreementSettingsTable.id, 1));
  res.json({ content: row?.content ?? "", updatedAt: row?.updatedAt ?? null });
});

// ── Public: submit a signed agreement ─────────────────────────────────────
// Route-local body parser raised to 300KB so a 200KB signature payload
// isn't rejected by the global default (100KB).
router.post("/agreement/sign", bodyJson({ limit: "300kb" }), async (req, res) => {
  const ip = getClientIp(req) || "unknown";
  // Check availability up-front so spammers can't pre-flood with valid
  // payloads. Quota is consumed only on successful insert below so a
  // legit user mistyping their email won't get locked out.
  if (!signRateAvailable(ip)) {
    res.status(429).json({ error: "حاولت كثيرًا — انتظر قليلًا ثم أعد المحاولة" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name      = typeof body.name === "string" ? body.name.trim() : "";
  const email     = typeof body.email === "string" ? body.email.trim() : "";
  const phone     = typeof body.phone === "string" ? body.phone.trim() : "";
  const notes     = typeof body.notes === "string" ? body.notes.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (name.length < 2 || name.length > 120) {
    res.status(400).json({ error: "الاسم مطلوب (٢ حتى ١٢٠ حرفًا)" }); return;
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    res.status(400).json({ error: "البريد الإلكتروني غير صالح" }); return;
  }
  if (phone && phone.length > 40) {
    res.status(400).json({ error: "رقم الهاتف طويل جدًا" }); return;
  }
  if (notes && notes.length > 2000) {
    res.status(400).json({ error: "الملاحظات طويلة جدًا (الحد ٢٠٠٠ حرف)" }); return;
  }
  const PREFIX = "data:image/png;base64,";
  if (!signature.startsWith(PREFIX) || signature.length > MAX_SIGNATURE_BYTES) {
    res.status(400).json({ error: "التوقيع مطلوب" }); return;
  }
  const b64 = signature.slice(PREFIX.length);
  if (b64.length < 100) { // empty / near-empty payload
    res.status(400).json({ error: "التوقيع فارغ — الرجاء التوقيع داخل المربع" }); return;
  }
  let pngBuf: Buffer;
  try { pngBuf = Buffer.from(b64, "base64"); }
  catch { res.status(400).json({ error: "صيغة التوقيع غير صالحة" }); return; }
  if (pngBuf.length < 67 || pngBuf.length > 150_000) {
    // 67 = min viable 1x1 PNG; cap matches realistic finger-signature size.
    res.status(400).json({ error: "حجم التوقيع غير صالح" }); return;
  }
  if (!pngBuf.subarray(0, 8).equals(PNG_MAGIC)) {
    res.status(400).json({ error: "التوقيع ليس صورة PNG صالحة" }); return;
  }

  // Capture the agreement text AS-OF signing time so future edits to the
  // master text never alter what an individual user actually agreed to.
  const [settings] = await db.select().from(agreementSettingsTable).where(eq(agreementSettingsTable.id, 1));
  const agreementContent = settings?.content ?? "";

  const [row] = await db.insert(agreementSignaturesTable).values({
    name, email, phone: phone || null, notes: notes || null,
    signatureDataUrl: signature,
    agreementContent,
    ipAddress: getClientIp(req) || null,
    userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
  }).returning({ id: agreementSignaturesTable.id, createdAt: agreementSignaturesTable.createdAt });

  signRateConsume(ip);
  req.log.info({ agreementId: row?.id, email }, "Agreement signed");
  res.json({ success: true, id: row?.id, createdAt: row?.createdAt });
});

// ── Admin: list signatures ────────────────────────────────────────────────
router.get("/admin/agreements", requireAdmin, async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const limit  = Math.min(Math.max(parseInt(String(q.limit  ?? "100"), 10) || 100, 1), 500);
  const offset = Math.max(parseInt(String(q.offset ?? "0"),   10) || 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agreementSignaturesTable);

  // Don't ship signature_data_url in the list — it can be ~100KB each.
  const rows = await db
    .select({
      id: agreementSignaturesTable.id,
      name: agreementSignaturesTable.name,
      email: agreementSignaturesTable.email,
      phone: agreementSignaturesTable.phone,
      createdAt: agreementSignaturesTable.createdAt,
    })
    .from(agreementSignaturesTable)
    .orderBy(desc(agreementSignaturesTable.createdAt))
    .limit(limit).offset(offset);

  res.json({ total: count, rows });
});

// ── Admin: fetch one full signed agreement ────────────────────────────────
router.get("/admin/agreements/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "bad id" }); return; }
  const [row] = await db.select().from(agreementSignaturesTable).where(eq(agreementSignaturesTable.id, id));
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json(row);
});

// ── Admin: get current master agreement text ──────────────────────────────
router.get("/admin/agreement-text", requireAdmin, async (_req, res) => {
  const [row] = await db.select().from(agreementSettingsTable).where(eq(agreementSettingsTable.id, 1));
  res.json({ content: row?.content ?? "", updatedAt: row?.updatedAt ?? null });
});

// ── Admin: update master agreement text ───────────────────────────────────
router.put("/admin/agreement-text", requireAdmin, async (req, res) => {
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  if (content.length < 10) { res.status(400).json({ error: "النص قصير جدًا" }); return; }
  if (content.length > 50_000) { res.status(400).json({ error: "النص طويل جدًا (الحد ٥٠٠٠٠ حرف)" }); return; }

  await db.insert(agreementSettingsTable)
    .values({ id: 1, content, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: agreementSettingsTable.id,
      set: { content, updatedAt: new Date() },
    });

  req.log.info({ length: content.length }, "Agreement text updated");
  res.json({ success: true });
});

// ── Super-admin parallel routes ───────────────────────────────────────────
// Same handlers, gated by MASTER_ADMIN_CODE instead of ADMIN_TOKEN, so the
// /superadmin panel (which doesn't carry ADMIN_TOKEN) can manage agreements.
router.get("/superadmin/agreements", requireSuperAdmin, async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const limit  = Math.min(Math.max(parseInt(String(q.limit  ?? "100"), 10) || 100, 1), 500);
  const offset = Math.max(parseInt(String(q.offset ?? "0"),   10) || 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agreementSignaturesTable);

  const rows = await db
    .select({
      id: agreementSignaturesTable.id,
      name: agreementSignaturesTable.name,
      email: agreementSignaturesTable.email,
      phone: agreementSignaturesTable.phone,
      createdAt: agreementSignaturesTable.createdAt,
    })
    .from(agreementSignaturesTable)
    .orderBy(desc(agreementSignaturesTable.createdAt))
    .limit(limit).offset(offset);

  res.json({ total: count, rows });
});

router.get("/superadmin/agreements/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "bad id" }); return; }
  const [row] = await db.select().from(agreementSignaturesTable).where(eq(agreementSignaturesTable.id, id));
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json(row);
});

router.get("/superadmin/agreement-text", requireSuperAdmin, async (_req, res) => {
  const [row] = await db.select().from(agreementSettingsTable).where(eq(agreementSettingsTable.id, 1));
  res.json({ content: row?.content ?? "", updatedAt: row?.updatedAt ?? null });
});

router.put("/superadmin/agreement-text", requireSuperAdmin, async (req, res) => {
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  if (content.length < 10) { res.status(400).json({ error: "النص قصير جدًا" }); return; }
  if (content.length > 50_000) { res.status(400).json({ error: "النص طويل جدًا (الحد ٥٠٠٠٠ حرف)" }); return; }

  await db.insert(agreementSettingsTable)
    .values({ id: 1, content, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: agreementSettingsTable.id,
      set: { content, updatedAt: new Date() },
    });

  req.log.info({ length: content.length }, "Agreement text updated (superadmin)");
  res.json({ success: true });
});

export default router;
