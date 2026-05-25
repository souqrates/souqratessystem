/**
 * Runtime config endpoints — let non-Node services (Python bots) discover
 * which observability/feature integrations are enabled and how to use them,
 * without duplicating credentials in env vars.
 *
 * Auth: X-Bot-Api-Key (same pattern as /internal/*).
 *
 * Sentry DSNs are designed to be embeddable (they ship in mobile/web SDK
 * bundles), so handing the DSN to an authenticated bot is safe.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, botsTable } from "@workspace/db";
import { getActiveConfig } from "../lib/integrations";

const router: IRouter = Router();

async function requireBot(req: Parameters<typeof router.get>[1] extends infer _ ? Parameters<Parameters<typeof router.get>[1]>[0] : never, res: Parameters<Parameters<typeof router.get>[1]>[1]): Promise<boolean> {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) { res.status(401).json({ error: "Missing X-Bot-Api-Key header" }); return false; }
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  if (!bot || !bot.isActive) { res.status(403).json({ error: "Invalid or inactive bot API key" }); return false; }
  return true;
}

router.get("/internal/runtime/sentry", async (req, res): Promise<void> => {
  if (!(await requireBot(req, res))) return;
  const cfg = await getActiveConfig("sentry");
  if (!cfg || !cfg["dsn"]) { res.json({ enabled: false }); return; }
  res.json({
    enabled: true,
    dsn: cfg["dsn"],
    environment: cfg["environment"] || "production",
    traces_sample_rate: Number(cfg["traces_sample_rate"] ?? "0"),
  });
});

export default router;
