import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import multer from "multer";
import { db } from "@workspace/db";
import { gameConfigsTable, type GameConfig } from "@workspace/db";
import gamesCatalog from "@workspace/db/games-catalog.json" with { type: "json" };
import { requireSuperAdmin } from "../lib/super-admin-auth";
import { normalizeTiers, DEFAULT_TIER_LABELS, DEFAULT_TIER_MULTIPLIERS } from "../lib/game-tiers";
import { objectStorageClient } from "../lib/objectStorage";

// ─── Image upload constants ─────────────────────────────────────
// Admin-only game cover images. Stored under a dedicated prefix inside
// the private bucket dir and served back unconditionally via
// GET /api/games/image/:id (no auth — these are public game covers).
const IMAGE_PREFIX = "game-images";
const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const IMAGE_ALLOWED_MIME: Record<string, string> = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/webp": "webp",
};

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
});

function getImageBucketAndPrefix(): { bucketName: string; prefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  // dir is like "/<bucketName>/<sub>/..."
  const trimmed = dir.startsWith("/") ? dir.slice(1) : dir;
  const parts = trimmed.split("/");
  const bucketName = parts[0];
  const sub = parts.slice(1).join("/");
  const prefix = sub ? `${sub}/${IMAGE_PREFIX}` : IMAGE_PREFIX;
  return { bucketName, prefix };
}

const router: IRouter = Router();

interface CatalogEntry {
  gameId: number;
  name: string;
  emoji: string;
  difficulty: string;
  color: string;
  desc: string;
  entryFee: number | null;
  prize: number | null;
  targetScore: number | null;
}

const CATALOG = gamesCatalog as CatalogEntry[];

// ─── Auto-seed: on first read, populate from games-catalog.json ──
let _seedChecked = false;
async function ensureSeeded(req: Request): Promise<void> {
  if (_seedChecked) return;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gameConfigsTable);
  if (count > 0) {
    _seedChecked = true;
    return;
  }
  req.log.info({ catalog: CATALOG.length }, "Seeding game_configs from catalog");
  const rows = CATALOG.map((g) => {
    const fee = (g.entryFee ?? 10).toString();
    const prize = (g.prize ?? Math.round((g.entryFee ?? 10) * 3)).toString();
    const tgt = g.targetScore ?? 0;
    const tiers = DEFAULT_TIER_MULTIPLIERS.map((m, i) => ({
      label: DEFAULT_TIER_LABELS[i],
      entryFee: +((g.entryFee ?? 10) * m).toFixed(2),
      winAmount: +((g.prize ?? Math.round((g.entryFee ?? 10) * 3)) * m).toFixed(2),
    }));
    return {
      gameId: g.gameId,
      name: g.name,
      emoji: g.emoji ?? "",
      difficulty: g.difficulty ?? "Medium",
      color: g.color ?? "",
      draftIsVisible: true,
      draftImageUrl: "",
      draftDescription: g.desc ?? "",
      draftEntryFee: fee,
      draftWinAmount: prize,
      draftTargetScore: tgt,
      draftMaxScore: 0,
      draftScorePerCorrect: 1,
      draftScorePerWrong: 0,
      draftDurationSeconds: 60,
      draftPriceTiers: tiers,
      draftTexts: {},
      draftParams: {},
      publishedIsVisible: true,
      publishedImageUrl: "",
      publishedDescription: g.desc ?? "",
      publishedEntryFee: fee,
      publishedWinAmount: prize,
      publishedTargetScore: tgt,
      publishedMaxScore: 0,
      publishedScorePerCorrect: 1,
      publishedScorePerWrong: 0,
      publishedDurationSeconds: 60,
      publishedPriceTiers: tiers,
      publishedTexts: {},
      publishedParams: {},
      hasUnpublishedChanges: false,
      publishedAt: new Date(),
    };
  });
  // Chunk insert to avoid huge single statement
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(gameConfigsTable).values(rows.slice(i, i + 50));
  }
  _seedChecked = true;
}

// normalizeTiers + DEFAULT_TIER_* live in ../lib/game-tiers so the SAME
// normalization is applied by /internal/game/charge-entry. Without shared
// logic, the client renders 5 fallback-filled tiers (×1, ×5, ×10, ×25, ×100)
// but the server only accepts whatever raw rows were saved — causing "only
// the first tier works" bugs for games that never had tiers edited.

function serialize(g: GameConfig) {
  const draftTiers = normalizeTiers(g.draftPriceTiers, Number(g.draftEntryFee), Number(g.draftWinAmount));
  const pubTiers   = normalizeTiers(g.publishedPriceTiers, Number(g.publishedEntryFee), Number(g.publishedWinAmount));
  return {
    id: g.id,
    gameId: g.gameId,
    name: g.name,
    emoji: g.emoji,
    difficulty: g.difficulty,
    color: g.color,
    draft: {
      isVisible: g.draftIsVisible,
      imageUrl: g.draftImageUrl,
      description: g.draftDescription,
      entryFee: g.draftEntryFee,
      winAmount: g.draftWinAmount,
      priceTiers: draftTiers,
      targetScore: g.draftTargetScore,
      maxScore: g.draftMaxScore,
      scorePerCorrect: g.draftScorePerCorrect,
      scorePerWrong: g.draftScorePerWrong,
      durationSeconds: g.draftDurationSeconds,
      texts: g.draftTexts,
      params: g.draftParams,
    },
    published: {
      isVisible: g.publishedIsVisible,
      imageUrl: g.publishedImageUrl,
      description: g.publishedDescription,
      entryFee: g.publishedEntryFee,
      winAmount: g.publishedWinAmount,
      priceTiers: pubTiers,
      targetScore: g.publishedTargetScore,
      maxScore: g.publishedMaxScore,
      scorePerCorrect: g.publishedScorePerCorrect,
      scorePerWrong: g.publishedScorePerWrong,
      durationSeconds: g.publishedDurationSeconds,
      texts: g.publishedTexts,
      params: g.publishedParams,
    },
    hasUnpublishedChanges: g.hasUnpublishedChanges,
    updatedAt: g.updatedAt,
    publishedAt: g.publishedAt,
  };
}

// ─── LIST: all games with draft+published states ────────────────
router.get(
  "/superadmin/games",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    await ensureSeeded(req);
    const rows = await db
      .select()
      .from(gameConfigsTable)
      .orderBy(asc(gameConfigsTable.gameId));
    res.json({ data: rows.map(serialize) });
  },
);

// ─── GET ONE ────────────────────────────────────────────────────
router.get(
  "/superadmin/games/:gameId",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    await ensureSeeded(req);
    const gameId = Number(req.params.gameId);
    if (!Number.isInteger(gameId)) {
      res.status(400).json({ error: "gameId must be integer" });
      return;
    }
    const [row] = await db
      .select()
      .from(gameConfigsTable)
      .where(eq(gameConfigsTable.gameId, gameId));
    if (!row) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    res.json({ data: serialize(row) });
  },
);

// ─── UPDATE DRAFT ───────────────────────────────────────────────
router.put(
  "/superadmin/games/:gameId/draft",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const gameId = Number(req.params.gameId);
    if (!Number.isInteger(gameId)) {
      res.status(400).json({ error: "gameId must be integer" });
      return;
    }
    const b = req.body as Record<string, unknown>;

    const num = (v: unknown, d: number): number => {
      const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
      return Number.isFinite(n) ? n : d;
    };
    const int = (v: unknown, d: number): number => {
      const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
      return Number.isInteger(n) ? n : d;
    };
    const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
    const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);

    const [existing] = await db
      .select()
      .from(gameConfigsTable)
      .where(eq(gameConfigsTable.gameId, gameId));
    if (!existing) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // Normalize 5 price tiers (fill missing with defaults)
    const baseFee = Number(existing.draftEntryFee) || 10;
    const baseWin = Number(existing.draftWinAmount) || 30;
    const tiers = normalizeTiers(b.priceTiers, baseFee, baseWin);
    // Legacy single fee mirrors tier 1 for backward compatibility
    const entryFee = tiers[0].entryFee;
    const winAmount = tiers[0].winAmount;

    const draft = {
      draftIsVisible: bool(b.isVisible, existing.draftIsVisible),
      draftImageUrl: str(b.imageUrl, existing.draftImageUrl),
      draftDescription: str(b.description, existing.draftDescription),
      draftEntryFee: entryFee.toString(),
      draftWinAmount: winAmount.toString(),
      draftPriceTiers: tiers as unknown as Record<string, unknown>,
      draftTargetScore: int(b.targetScore, existing.draftTargetScore),
      draftMaxScore: int(b.maxScore, existing.draftMaxScore),
      draftScorePerCorrect: int(b.scorePerCorrect, existing.draftScorePerCorrect),
      draftScorePerWrong: int(b.scorePerWrong, existing.draftScorePerWrong),
      draftDurationSeconds: Math.max(0, int(b.durationSeconds, existing.draftDurationSeconds)),
      draftTexts: (b.texts ?? existing.draftTexts) as Record<string, unknown>,
      draftParams: (b.params ?? existing.draftParams) as Record<string, unknown>,
      hasUnpublishedChanges: true,
    };

    const [updated] = await db
      .update(gameConfigsTable)
      .set(draft)
      .where(eq(gameConfigsTable.gameId, gameId))
      .returning();

    req.log.info({ gameId }, "game_config draft updated");
    res.json({ data: serialize(updated) });
  },
);

// ─── PUBLISH ────────────────────────────────────────────────────
router.post(
  "/superadmin/games/:gameId/publish",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const gameId = Number(req.params.gameId);
    if (!Number.isInteger(gameId)) {
      res.status(400).json({ error: "gameId must be integer" });
      return;
    }
    const [existing] = await db
      .select()
      .from(gameConfigsTable)
      .where(eq(gameConfigsTable.gameId, gameId));
    if (!existing) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const [updated] = await db
      .update(gameConfigsTable)
      .set({
        publishedIsVisible: existing.draftIsVisible,
        publishedImageUrl: existing.draftImageUrl,
        publishedDescription: existing.draftDescription,
        publishedEntryFee: existing.draftEntryFee,
        publishedWinAmount: existing.draftWinAmount,
        publishedPriceTiers: existing.draftPriceTiers,
        publishedTargetScore: existing.draftTargetScore,
        publishedMaxScore: existing.draftMaxScore,
        publishedScorePerCorrect: existing.draftScorePerCorrect,
        publishedScorePerWrong: existing.draftScorePerWrong,
        publishedDurationSeconds: existing.draftDurationSeconds,
        publishedTexts: existing.draftTexts,
        publishedParams: existing.draftParams,
        hasUnpublishedChanges: false,
        publishedAt: new Date(),
      })
      .where(eq(gameConfigsTable.gameId, gameId))
      .returning();

    req.log.info({ gameId }, "game_config PUBLISHED");
    res.json({ data: serialize(updated) });
  },
);

// ─── RESET DRAFT (discard pending changes) ──────────────────────
router.post(
  "/superadmin/games/:gameId/discard-draft",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const gameId = Number(req.params.gameId);
    if (!Number.isInteger(gameId)) {
      res.status(400).json({ error: "gameId must be integer" });
      return;
    }
    const [existing] = await db
      .select()
      .from(gameConfigsTable)
      .where(eq(gameConfigsTable.gameId, gameId));
    if (!existing) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    const [updated] = await db
      .update(gameConfigsTable)
      .set({
        draftIsVisible: existing.publishedIsVisible,
        draftImageUrl: existing.publishedImageUrl,
        draftDescription: existing.publishedDescription,
        draftEntryFee: existing.publishedEntryFee,
        draftWinAmount: existing.publishedWinAmount,
        draftPriceTiers: existing.publishedPriceTiers,
        draftTargetScore: existing.publishedTargetScore,
        draftMaxScore: existing.publishedMaxScore,
        draftScorePerCorrect: existing.publishedScorePerCorrect,
        draftScorePerWrong: existing.publishedScorePerWrong,
        draftDurationSeconds: existing.publishedDurationSeconds,
        draftTexts: existing.publishedTexts,
        draftParams: existing.publishedParams,
        hasUnpublishedChanges: false,
      })
      .where(eq(gameConfigsTable.gameId, gameId))
      .returning();
    res.json({ data: serialize(updated) });
  },
);

// ─── IMAGE UPLOAD: admin only, multipart/form-data ──────────────
// POST /superadmin/games/upload-image  (field name: "image")
// Returns { url: "/api/games/image/<id>.<ext>" } — store in draftImageUrl.
// Constraints:
//   - PNG / JPG / WEBP only
//   - Max 2 MB
//   - Recommended ~ 1024×1024 (1:1) or 1280×720 (16:9)
router.post(
  "/superadmin/games/upload-image",
  requireSuperAdmin,
  (req: Request, res: Response, next): void => {
    uploadImage.single("image")(req, res, (err: unknown) => {
      if (err) {
        const e = err as { code?: string; message?: string };
        if (e?.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: `حجم الصورة يتجاوز ${IMAGE_MAX_BYTES / 1024 / 1024} ميجابايت` });
          return;
        }
        req.log.warn({ err }, "game image upload: multer error");
        res.status(400).json({ error: e?.message ?? "Upload failed" });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "لم يتم إرفاق ملف صورة (field name: image)" });
      return;
    }
    const ext = IMAGE_ALLOWED_MIME[file.mimetype];
    if (!ext) {
      res.status(415).json({ error: "صيغة غير مدعومة. المسموح: PNG, JPG, WEBP" });
      return;
    }
    try {
      const { bucketName, prefix } = getImageBucketAndPrefix();
      const id = `${randomUUID()}.${ext}`;
      const objectName = `${prefix}/${id}`;
      const bucket = objectStorageClient.bucket(bucketName);
      await bucket.file(objectName).save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        metadata: {
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      req.log.info({ id, size: file.size, mime: file.mimetype }, "game image uploaded");
      res.json({ url: `/api/games/image/${id}` });
    } catch (err) {
      req.log.error({ err }, "game image upload failed");
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  },
);

// ─── PUBLIC: serve uploaded game image ──────────────────────────
// GET /api/games/image/:id  — unauthenticated; long cache.
router.get(
  "/games/image/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? "");
    // Allow only safe filenames: <uuid>.<png|jpg|webp>
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/i.test(id)) {
      res.status(400).json({ error: "Invalid image id" });
      return;
    }
    try {
      const { bucketName, prefix } = getImageBucketAndPrefix();
      const file = objectStorageClient.bucket(bucketName).file(`${prefix}/${id}`);
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: "Image not found" });
        return;
      }
      const [metadata] = await file.getMetadata();
      res.setHeader("Content-Type", (metadata.contentType as string) || "application/octet-stream");
      if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      file.createReadStream().on("error", (err: unknown) => {
        req.log.error({ err }, "game image stream error");
        if (!res.headersSent) res.status(500).end();
      }).pipe(res);
    } catch (err) {
      req.log.error({ err }, "game image serve failed");
      res.status(500).json({ error: "Internal error" });
    }
  },
);

// ─── PUBLIC: bulk fetch for games-bot client ────────────────────
// Returns ONLY published values. Hidden games are EXCLUDED.
// No auth required — this is the runtime feed the games-bot consumes.
router.get(
  "/games/configs",
  async (req: Request, res: Response): Promise<void> => {
    await ensureSeeded(req);
    const rows = await db
      .select()
      .from(gameConfigsTable)
      .where(eq(gameConfigsTable.publishedIsVisible, true))
      .orderBy(asc(gameConfigsTable.gameId));
    const data = rows.map((g) => ({
      gameId: g.gameId,
      name: g.name,
      emoji: g.emoji,
      difficulty: g.difficulty,
      color: g.color,
      imageUrl: g.publishedImageUrl,
      description: g.publishedDescription,
      entryFee: Number(g.publishedEntryFee),
      winAmount: Number(g.publishedWinAmount),
      priceTiers: normalizeTiers(g.publishedPriceTiers, Number(g.publishedEntryFee), Number(g.publishedWinAmount)),
      targetScore: g.publishedTargetScore,
      maxScore: g.publishedMaxScore,
      scorePerCorrect: g.publishedScorePerCorrect,
      scorePerWrong: g.publishedScorePerWrong,
      durationSeconds: g.publishedDurationSeconds,
      texts: g.publishedTexts,
      params: g.publishedParams,
    }));
    // Short cache to allow live updates within ~60s
    res.set("Cache-Control", "public, max-age=60");
    res.json({ data });
  },
);

export default router;
