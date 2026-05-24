import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { gameConfigsTable, type GameConfig } from "@workspace/db";
import gamesCatalog from "@workspace/db/games-catalog.json" with { type: "json" };
import { requireSuperAdmin } from "../lib/super-admin-auth";

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

interface PriceTier { label: string; entryFee: number; winAmount: number }
const DEFAULT_TIER_LABELS = ["مبتدئ", "عادي", "متقدم", "محترف", "VIP"];
const DEFAULT_TIER_MULTIPLIERS = [1, 5, 10, 25, 100];

function normalizeTiers(raw: unknown, baseFee: number, baseWin: number): PriceTier[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: PriceTier[] = [];
  for (let i = 0; i < 5; i++) {
    const t = (arr[i] ?? {}) as Record<string, unknown>;
    const fallbackFee = +(baseFee * DEFAULT_TIER_MULTIPLIERS[i]).toFixed(2);
    const fallbackWin = +(baseWin * DEFAULT_TIER_MULTIPLIERS[i]).toFixed(2);
    const fee = typeof t.entryFee === "number" ? t.entryFee
              : typeof t.entryFee === "string" ? parseFloat(t.entryFee) : fallbackFee;
    const win = typeof t.winAmount === "number" ? t.winAmount
              : typeof t.winAmount === "string" ? parseFloat(t.winAmount) : fallbackWin;
    const label = typeof t.label === "string" && t.label.trim()
                ? t.label.trim() : DEFAULT_TIER_LABELS[i];
    out.push({
      label,
      entryFee: Number.isFinite(fee) && fee >= 0 ? fee : fallbackFee,
      winAmount: Number.isFinite(win) && win >= 0 ? win : fallbackWin,
    });
  }
  return out;
}

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
