import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";

const router: IRouter = Router();

async function getRate(key: string, defaultVal: string): Promise<string> {
  const [setting] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
  return setting?.value ?? defaultVal;
}

router.get("/settings/skz-rates", async (_req, res): Promise<void> => {
  const [perUsdt, perStar, perTon, updatedRow] = await Promise.all([
    getRate("skz_per_usdt", "100"),
    getRate("skz_per_star", "1"),
    getRate("skz_per_ton", "500"),
    db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "skz_per_usdt")),
  ]);

  res.json({
    skzPerUsdt: perUsdt,
    skzPerStar: perStar,
    skzPerTon: perTon,
    updatedAt: updatedRow[0]?.updatedAt ?? new Date(),
  });
});

router.put("/settings/skz-rates", async (req, res): Promise<void> => {
  const { skzPerUsdt, skzPerStar, skzPerTon } = req.body as {
    skzPerUsdt?: string;
    skzPerStar?: string;
    skzPerTon?: string;
  };

  const updates: Array<{ key: string; value: string }> = [];
  if (skzPerUsdt) updates.push({ key: "skz_per_usdt", value: skzPerUsdt });
  if (skzPerStar) updates.push({ key: "skz_per_star", value: skzPerStar });
  if (skzPerTon)  updates.push({ key: "skz_per_ton",  value: skzPerTon });

  for (const { key, value } of updates) {
    await db
      .insert(platformSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }

  const [perUsdtFinal, perStarFinal, perTonFinal, updatedRow] = await Promise.all([
    getRate("skz_per_usdt", "100"),
    getRate("skz_per_star", "1"),
    getRate("skz_per_ton", "500"),
    db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "skz_per_usdt")),
  ]);

  res.json({
    skzPerUsdt: perUsdtFinal,
    skzPerStar: perStarFinal,
    skzPerTon: perTonFinal,
    updatedAt: updatedRow[0]?.updatedAt ?? new Date(),
  });
});

export default router;
