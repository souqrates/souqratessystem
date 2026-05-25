/**
 * Profile + policies + platform links + leaderboards routes.
 *
 * Mini-App (auth: X-Telegram-Init-Data):
 *   GET  /profile/me             → wallet + level + xp + nextLevelXp + rank
 *   PATCH /profile/me            → { displayName?, avatarUrl? }
 *   POST /profile/avatar/upload  → multipart "avatar"; returns { url }
 *
 * Public:
 *   GET  /policies               → published policies
 *   GET  /platform-links         → visible links
 *   GET  /leaderboard?scope=xp|spend|votes|games&limit=
 *   GET  /ranks                  → all 100 rank titles (for client progress UI)
 *   GET  /profile/avatar/:id     → serve uploaded avatar
 *
 * Super-admin (Bearer):
 *   GET/POST/PATCH/DELETE /superadmin/policies
 *   GET/POST/PATCH/DELETE /superadmin/platform-links
 *   GET/PATCH             /superadmin/xp-rules
 *   GET/PATCH             /superadmin/rank-titles
 *   GET                   /superadmin/profile/xp-events?telegramId=
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, desc, asc, and } from "drizzle-orm";
import multer from "multer";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  policiesTable,
  platformLinksTable,
  xpRulesTable,
  rankTitlesTable,
  xpEventsTable,
  transactionsTable,
  votesTable,
} from "@workspace/db";
import { requireTelegramUser } from "../lib/telegram-init-data";
import { requireSuperAdmin } from "../lib/super-admin-auth";
import { objectStorageClient } from "../lib/objectStorage";
import { getNextLevelInfo, invalidateXpRuleCache } from "../lib/xp";

const router: IRouter = Router();

// ─── Avatar upload (Telegram users only) ────────────────────────
const AVATAR_PREFIX = "user-avatars";
const AVATAR_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const AVATAR_ALLOWED: Record<string, string> = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/webp": "webp",
};
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
});

function getAvatarBucketAndPrefix(): { bucketName: string; prefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const trimmed = dir.startsWith("/") ? dir.slice(1) : dir;
  const parts = trimmed.split("/");
  const bucketName = parts[0];
  const sub = parts.slice(1).join("/");
  const prefix = sub ? `${sub}/${AVATAR_PREFIX}` : AVATAR_PREFIX;
  return { bucketName, prefix };
}

// ─── Public: serve avatar ───────────────────────────────────────
router.get("/profile/avatar/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id ?? "");
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/i.test(id)) {
    res.status(400).json({ error: "Invalid avatar id" });
    return;
  }
  try {
    const { bucketName, prefix } = getAvatarBucketAndPrefix();
    const file = objectStorageClient.bucket(bucketName).file(`${prefix}/${id}`);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", (metadata.contentType as string) || "image/png");
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    res.setHeader("Cache-Control", "public, max-age=86400");
    file.createReadStream().on("error", (err) => {
      req.log.error({ err }, "avatar stream error");
      if (!res.headersSent) res.status(500).end();
    }).pipe(res);
  } catch (err) {
    req.log.error({ err }, "avatar serve failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── Mini App: GET /profile/me ──────────────────────────────────
router.get("/profile/me", requireTelegramUser, async (req: Request, res: Response): Promise<void> => {
  const tg = BigInt(req.tgInitUser!.id);
  // Upsert minimal user row so first-open works
  await db.insert(usersTable).values({
    telegramId: tg,
    firstName: req.tgInitUser!.firstName,
    lastName: req.tgInitUser!.lastName ?? null,
    username: req.tgInitUser!.username ?? null,
    languageCode: req.tgInitUser!.languageCode ?? "ar",
    isPremium: req.tgInitUser!.isPremium ?? false,
  }).onConflictDoNothing();

  const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tg));
  const [w] = u
    ? await db.select().from(walletsTable).where(eq(walletsTable.userId, u.id))
    : [undefined];
  if (!u) {
    res.status(500).json({ error: "User upsert failed" });
    return;
  }
  const rank = await getNextLevelInfo(u.xp);
  res.json({
    profile: {
      telegramId: String(u.telegramId),
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      languageCode: u.languageCode,
      xp: u.xp,
      level: u.level,
      isBlocked: u.isBlocked,
    },
    wallet: w ?? {
      balanceSkz: "0",
      balanceUsdt: "0",
      balanceStars: 0,
      balanceTon: "0",
    },
    rank,
  });
});

// ─── Mini App: PATCH /profile/me ────────────────────────────────
router.patch("/profile/me", requireTelegramUser, async (req: Request, res: Response): Promise<void> => {
  const tg = BigInt(req.tgInitUser!.id);
  const { displayName, avatarUrl } = (req.body ?? {}) as { displayName?: string; avatarUrl?: string };
  const patch: Record<string, unknown> = {};
  if (typeof displayName === "string") {
    const trimmed = displayName.trim();
    if (trimmed.length > 40) {
      res.status(400).json({ error: "displayName must be ≤ 40 chars" });
      return;
    }
    patch.displayName = trimmed || null;
  }
  if (typeof avatarUrl === "string") {
    if (avatarUrl && !/^\/api\/profile\/avatar\/[a-f0-9-]{36}\.(png|jpg|webp)$/i.test(avatarUrl)) {
      res.status(400).json({ error: "Invalid avatarUrl" });
      return;
    }
    patch.avatarUrl = avatarUrl || null;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  await db.update(usersTable).set(patch).where(eq(usersTable.telegramId, tg));
  res.json({ ok: true });
});

// ─── Mini App: POST /profile/avatar/upload ──────────────────────
router.post(
  "/profile/avatar/upload",
  requireTelegramUser,
  (req: Request, res: Response, next): void => {
    uploadAvatar.single("avatar")(req, res, (err: unknown) => {
      if (err) {
        const e = err as { code?: string; message?: string };
        if (e?.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: `حجم الصورة يتجاوز ${AVATAR_MAX_BYTES / 1024 / 1024} ميجابايت` });
          return;
        }
        res.status(400).json({ error: e?.message ?? "Upload failed" });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "لم يتم إرفاق صورة (field: avatar)" });
      return;
    }
    const ext = AVATAR_ALLOWED[file.mimetype];
    if (!ext) {
      res.status(415).json({ error: "صيغة غير مدعومة. PNG, JPG, WEBP فقط" });
      return;
    }
    try {
      const { bucketName, prefix } = getAvatarBucketAndPrefix();
      const id = `${crypto.randomUUID()}.${ext}`;
      const objectName = `${prefix}/${id}`;
      await objectStorageClient.bucket(bucketName).file(objectName).save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        metadata: { cacheControl: "public, max-age=86400" },
      });
      res.json({ url: `/api/profile/avatar/${id}` });
    } catch (err) {
      req.log.error({ err }, "avatar upload failed");
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  },
);

// ─── Public: policies ───────────────────────────────────────────
router.get("/policies", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(policiesTable)
    .where(eq(policiesTable.isPublished, true))
    .orderBy(asc(policiesTable.sortOrder), asc(policiesTable.id));
  res.json({ data: rows });
});

// ─── Public: platform links ─────────────────────────────────────
router.get("/platform-links", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(platformLinksTable)
    .where(eq(platformLinksTable.isVisible, true))
    .orderBy(asc(platformLinksTable.sortOrder), asc(platformLinksTable.id));
  res.json({ data: rows });
});

// ─── Public: ranks list ─────────────────────────────────────────
router.get("/ranks", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(rankTitlesTable)
    .orderBy(asc(rankTitlesTable.level));
  res.json({ data: rows });
});

// ─── Public: leaderboard ────────────────────────────────────────
router.get("/leaderboard", async (req: Request, res: Response): Promise<void> => {
  const scope = String(req.query.scope ?? "xp");
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));

  // Common user projection
  type Row = {
    telegramId: string;
    displayName: string | null;
    firstName: string;
    username: string | null;
    avatarUrl: string | null;
    level: number;
    xp: number;
    metric: string;
  };
  let rows: Row[] = [];

  if (scope === "xp") {
    const r = await db
      .select({
        telegramId: usersTable.telegramId,
        displayName: usersTable.displayName,
        firstName: usersTable.firstName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        level: usersTable.level,
        xp: usersTable.xp,
      })
      .from(usersTable)
      .where(eq(usersTable.isBlocked, false))
      .orderBy(desc(usersTable.xp))
      .limit(limit);
    rows = r.map((x) => ({
      telegramId: String(x.telegramId),
      displayName: x.displayName,
      firstName: x.firstName,
      username: x.username,
      avatarUrl: x.avatarUrl,
      level: x.level,
      xp: x.xp,
      metric: String(x.xp),
    }));
  } else if (scope === "spend") {
    // Sum of debit transactions in SKZ (currency = 'SKZ' or 'skz')
    const r = await db.execute<{
      telegram_id: bigint; display_name: string | null; first_name: string; username: string | null;
      avatar_url: string | null; level: number; xp: number; total: string;
    }>(sql`
      SELECT u.telegram_id, u.display_name, u.first_name, u.username, u.avatar_url, u.level, u.xp,
             COALESCE(SUM(CASE WHEN t.kind = 'debit' THEN CAST(t.amount AS NUMERIC) ELSE 0 END), 0)::text AS total
      FROM users u
      LEFT JOIN transactions t
        ON t.telegram_id = u.telegram_id
       AND LOWER(COALESCE(t.currency, '')) = 'skz'
      WHERE u.is_blocked = false
      GROUP BY u.telegram_id, u.display_name, u.first_name, u.username, u.avatar_url, u.level, u.xp
      HAVING COALESCE(SUM(CASE WHEN t.kind = 'debit' THEN CAST(t.amount AS NUMERIC) ELSE 0 END), 0) > 0
      ORDER BY total DESC
      LIMIT ${limit}
    `);
    rows = (r.rows as any[]).map((x) => ({
      telegramId: String(x.telegram_id),
      displayName: x.display_name,
      firstName: x.first_name,
      username: x.username,
      avatarUrl: x.avatar_url,
      level: x.level,
      xp: x.xp,
      metric: x.total,
    }));
  } else if (scope === "votes") {
    const r = await db.execute<any>(sql`
      SELECT u.telegram_id, u.display_name, u.first_name, u.username, u.avatar_url, u.level, u.xp,
             COALESCE(SUM(v.votes), 0)::text AS total
      FROM users u
      JOIN votes v ON v.telegram_id = u.telegram_id
      WHERE u.is_blocked = false
      GROUP BY u.telegram_id, u.display_name, u.first_name, u.username, u.avatar_url, u.level, u.xp
      ORDER BY total DESC
      LIMIT ${limit}
    `);
    rows = (r.rows as any[]).map((x) => ({
      telegramId: String(x.telegram_id),
      displayName: x.display_name,
      firstName: x.first_name,
      username: x.username,
      avatarUrl: x.avatar_url,
      level: x.level,
      xp: x.xp,
      metric: x.total,
    }));
  } else if (scope === "games") {
    const r = await db
      .select({
        telegramId: usersTable.telegramId,
        displayName: usersTable.displayName,
        firstName: usersTable.firstName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        level: usersTable.level,
        xp: usersTable.xp,
        total: usersTable.totalGamesPlayed,
      })
      .from(usersTable)
      .where(and(eq(usersTable.isBlocked, false), sql`${usersTable.totalGamesPlayed} > 0`))
      .orderBy(desc(usersTable.totalGamesPlayed))
      .limit(limit);
    rows = r.map((x) => ({
      telegramId: String(x.telegramId),
      displayName: x.displayName,
      firstName: x.firstName,
      username: x.username,
      avatarUrl: x.avatarUrl,
      level: x.level,
      xp: x.xp,
      metric: String(x.total),
    }));
  } else {
    res.status(400).json({ error: "scope must be one of: xp, spend, votes, games" });
    return;
  }
  res.json({ scope, data: rows });
});

// ════════════════════════════════════════════════════════════════
// SUPER-ADMIN
// ════════════════════════════════════════════════════════════════

// Policies CRUD
router.get("/superadmin/policies", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(policiesTable).orderBy(asc(policiesTable.sortOrder), asc(policiesTable.id));
  res.json({ data: rows });
});
router.post("/superadmin/policies", requireSuperAdmin, async (req, res): Promise<void> => {
  const { slug, title, body, sortOrder, isPublished } = req.body as any;
  if (!slug || !title || !body) {
    res.status(400).json({ error: "slug, title, body required" });
    return;
  }
  try {
    const [row] = await db.insert(policiesTable).values({
      slug: String(slug).trim(),
      title: String(title).trim(),
      body: String(body),
      sortOrder: Number(sortOrder) || 0,
      isPublished: isPublished !== false,
    }).returning();
    res.status(201).json({ data: row });
  } catch (e: any) {
    res.status(409).json({ error: e?.message || "Insert failed" });
  }
});
router.patch("/superadmin/policies/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Bad id" });
    return;
  }
  const { title, body, sortOrder, isPublished, slug } = req.body as any;
  const patch: Record<string, unknown> = {};
  if (typeof slug === "string") patch.slug = slug.trim();
  if (typeof title === "string") patch.title = title.trim();
  if (typeof body === "string") patch.body = body;
  if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);
  if (typeof isPublished === "boolean") patch.isPublished = isPublished;
  if (!Object.keys(patch).length) {
    res.status(400).json({ error: "No fields" });
    return;
  }
  const [row] = await db.update(policiesTable).set(patch).where(eq(policiesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ data: row });
});
router.delete("/superadmin/policies/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(policiesTable).where(eq(policiesTable.id, id));
  res.json({ ok: true });
});

// Platform links CRUD
const LINK_KINDS = ["tiktok", "instagram", "telegram", "whatsapp", "youtube", "twitter", "facebook", "email", "phone", "website", "custom"];
router.get("/superadmin/platform-links", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(platformLinksTable).orderBy(asc(platformLinksTable.sortOrder), asc(platformLinksTable.id));
  res.json({ data: rows });
});
router.post("/superadmin/platform-links", requireSuperAdmin, async (req, res): Promise<void> => {
  const { kind, label, url, sortOrder, isVisible } = req.body as any;
  if (!LINK_KINDS.includes(kind)) {
    res.status(400).json({ error: `kind must be one of: ${LINK_KINDS.join(", ")}` });
    return;
  }
  if (!label || !url) {
    res.status(400).json({ error: "label and url required" });
    return;
  }
  const [row] = await db.insert(platformLinksTable).values({
    kind, label: String(label).trim(), url: String(url).trim(),
    sortOrder: Number(sortOrder) || 0,
    isVisible: isVisible !== false,
  }).returning();
  res.status(201).json({ data: row });
});
router.patch("/superadmin/platform-links/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { kind, label, url, sortOrder, isVisible } = req.body as any;
  const patch: Record<string, unknown> = {};
  if (kind && LINK_KINDS.includes(kind)) patch.kind = kind;
  if (typeof label === "string") patch.label = label.trim();
  if (typeof url === "string") patch.url = url.trim();
  if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);
  if (typeof isVisible === "boolean") patch.isVisible = isVisible;
  if (!Object.keys(patch).length) {
    res.status(400).json({ error: "No fields" });
    return;
  }
  const [row] = await db.update(platformLinksTable).set(patch).where(eq(platformLinksTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ data: row });
});
router.delete("/superadmin/platform-links/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(platformLinksTable).where(eq(platformLinksTable.id, id));
  res.json({ ok: true });
});

// XP rules
router.get("/superadmin/xp-rules", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(xpRulesTable).orderBy(asc(xpRulesTable.id));
  res.json({ data: rows });
});
router.patch("/superadmin/xp-rules/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { xpPerUnit, isActive, description } = req.body as any;
  const patch: Record<string, unknown> = {};
  if (xpPerUnit !== undefined) {
    const n = Number(xpPerUnit);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({ error: "xpPerUnit must be ≥ 0" });
      return;
    }
    patch.xpPerUnit = Math.floor(n);
  }
  if (typeof isActive === "boolean") patch.isActive = isActive;
  if (typeof description === "string") patch.description = description;
  if (!Object.keys(patch).length) {
    res.status(400).json({ error: "No fields" });
    return;
  }
  const [row] = await db.update(xpRulesTable).set(patch).where(eq(xpRulesTable.id, id)).returning();
  invalidateXpRuleCache();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ data: row });
});

// Rank titles (bulk-editable)
router.get("/superadmin/rank-titles", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(rankTitlesTable).orderBy(asc(rankTitlesTable.level));
  res.json({ data: rows });
});
router.patch("/superadmin/rank-titles/:level", requireSuperAdmin, async (req, res): Promise<void> => {
  const level = parseInt(String(req.params.level), 10);
  if (!Number.isFinite(level) || level < 1 || level > 100) {
    res.status(400).json({ error: "level must be 1..100" });
    return;
  }
  const { title, minXp, color, icon } = req.body as any;
  const patch: Record<string, unknown> = {};
  if (typeof title === "string") patch.title = title.trim();
  if (minXp !== undefined) {
    const n = Number(minXp);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({ error: "minXp must be ≥ 0" });
      return;
    }
    patch.minXp = Math.floor(n);
  }
  if (typeof color === "string") patch.color = color;
  if (typeof icon === "string") patch.icon = icon;
  if (!Object.keys(patch).length) {
    res.status(400).json({ error: "No fields" });
    return;
  }
  const [row] = await db.update(rankTitlesTable).set(patch).where(eq(rankTitlesTable.level, level)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ data: row });
});

// XP events audit
router.get("/superadmin/profile/xp-events", requireSuperAdmin, async (req, res): Promise<void> => {
  const tg = req.query.telegramId ? BigInt(String(req.query.telegramId)) : null;
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
  const rows = tg
    ? await db.select().from(xpEventsTable).where(eq(xpEventsTable.telegramId, tg)).orderBy(desc(xpEventsTable.createdAt)).limit(limit)
    : await db.select().from(xpEventsTable).orderBy(desc(xpEventsTable.createdAt)).limit(limit);
  res.json({
    data: rows.map((r) => ({ ...r, telegramId: String(r.telegramId) })),
  });
});

export default router;
