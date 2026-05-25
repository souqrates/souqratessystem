import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";
import { requireAdmin } from "../lib/admin-auth";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  skz_per_usdt: "100",
  skz_per_star: "1",
  skz_per_ton: "500",
  min_deposit_usdt: "5",
  min_deposit_ton: "0.5",
  min_deposit_stars: "50",
  min_withdrawal_skz: "100",
  withdrawal_fee_usdt_percent: "2",
  withdrawal_fee_ton_percent: "1.5",
  usdt_deposit_address: "",
  ton_deposit_address: "",
  withdrawal_eta_hours: "24",
  referral_bonus_percent: "5",
  platform_name: "البوت الأم",
  platform_tagline: "منصة البوتات المالية الأولى",
  welcome_message: "مرحباً! أنا البوت الأم 🎉 منصتك الموحدة لإدارة أرباحك من جميع البوتات بعملة SKZ.",
  support_username: "souqrates_support",
  referral_message: "انضم إلي في البوت الأم واكسب SKZ من 6 بوتات! استخدم رابط الدعوة الخاص بي.",
};

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
  return row?.value ?? DEFAULTS[key] ?? "";
}

async function getAllSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(platformSettingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

async function buildSettingsResponse() {
  const map = await getAllSettingsMap();
  const updatedRow = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "skz_per_usdt"));

  return {
    skzRates: {
      skzPerUsdt: map["skz_per_usdt"],
      skzPerStar: map["skz_per_star"],
      skzPerTon: map["skz_per_ton"],
      updatedAt: updatedRow[0]?.updatedAt ?? new Date(),
    },
    financial: {
      minDepositUsdt: map["min_deposit_usdt"],
      minDepositTon: map["min_deposit_ton"],
      minDepositStars: map["min_deposit_stars"],
      minWithdrawalSkz: map["min_withdrawal_skz"],
      withdrawalFeeUsdtPercent: map["withdrawal_fee_usdt_percent"],
      withdrawalFeeTonPercent: map["withdrawal_fee_ton_percent"],
      usdtDepositAddress: map["usdt_deposit_address"] ?? "",
      tonDepositAddress: map["ton_deposit_address"] ?? "",
      withdrawalEtaHours: map["withdrawal_eta_hours"] ?? "24",
      referralBonusPercent: map["referral_bonus_percent"],
      referralL2Percent: map["referral_l2_percent"] ?? "2",
      referralL3Percent: map["referral_l3_percent"] ?? "1",
    },
    content: {
      platformName: map["platform_name"],
      platformTagline: map["platform_tagline"],
      welcomeMessage: map["welcome_message"],
      supportUsername: map["support_username"],
      referralMessage: map["referral_message"],
    },
  };
}

async function upsertSetting(key: string, value: string) {
  await db
    .insert(platformSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

// GET /settings — all settings
router.get("/settings", async (_req, res): Promise<void> => {
  res.json(await buildSettingsResponse());
});

// PUT /settings — batch update any settings (admin-only)
router.put("/settings", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, string | undefined>;

  const keyMap: Record<string, string> = {
    skzPerUsdt: "skz_per_usdt",
    skzPerStar: "skz_per_star",
    skzPerTon: "skz_per_ton",
    minDepositUsdt: "min_deposit_usdt",
    minDepositTon: "min_deposit_ton",
    minDepositStars: "min_deposit_stars",
    minWithdrawalSkz: "min_withdrawal_skz",
    withdrawalFeeUsdtPercent: "withdrawal_fee_usdt_percent",
    withdrawalFeeTonPercent: "withdrawal_fee_ton_percent",
    usdtDepositAddress: "usdt_deposit_address",
    tonDepositAddress: "ton_deposit_address",
    withdrawalEtaHours: "withdrawal_eta_hours",
    referralBonusPercent: "referral_bonus_percent",
    referralL2Percent: "referral_l2_percent",
    referralL3Percent: "referral_l3_percent",
    platformName: "platform_name",
    platformTagline: "platform_tagline",
    welcomeMessage: "welcome_message",
    supportUsername: "support_username",
    referralMessage: "referral_message",
  };

  // Fields that may be deliberately blanked (e.g. admin disables a deposit
  // address in an emergency). For these, an empty string is a valid update.
  const blankable = new Set(["usdt_deposit_address", "ton_deposit_address"]);

  const updates: Array<[string, string]> = [];
  for (const [field, dbKey] of Object.entries(keyMap)) {
    const val = body[field];
    if (val === undefined || val === null) continue;
    const trimmed = String(val).trim();
    if (trimmed === "" && !blankable.has(dbKey)) continue;
    updates.push([dbKey, trimmed]);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  await Promise.all(updates.map(([key, value]) => upsertSetting(key, value)));

  req.log.info({ updatedKeys: updates.map(([k]) => k) }, "Platform settings updated");
  res.json(await buildSettingsResponse());
});

// GET /settings/skz-rates
router.get("/settings/skz-rates", async (_req, res): Promise<void> => {
  const [perUsdt, perStar, perTon, updatedRow] = await Promise.all([
    getSetting("skz_per_usdt"),
    getSetting("skz_per_star"),
    getSetting("skz_per_ton"),
    db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "skz_per_usdt")),
  ]);

  res.json({
    skzPerUsdt: perUsdt,
    skzPerStar: perStar,
    skzPerTon: perTon,
    updatedAt: updatedRow[0]?.updatedAt ?? new Date(),
  });
});

// PUT /settings/skz-rates (admin-only)
router.put("/settings/skz-rates", requireAdmin, async (req, res): Promise<void> => {
  const { skzPerUsdt, skzPerStar, skzPerTon } = req.body as {
    skzPerUsdt?: string;
    skzPerStar?: string;
    skzPerTon?: string;
  };

  const updates: Array<[string, string]> = [];
  if (skzPerUsdt) updates.push(["skz_per_usdt", skzPerUsdt]);
  if (skzPerStar) updates.push(["skz_per_star", skzPerStar]);
  if (skzPerTon) updates.push(["skz_per_ton", skzPerTon]);

  await Promise.all(updates.map(([key, value]) => upsertSetting(key, value)));

  const [perUsdtFinal, perStarFinal, perTonFinal, updatedRow] = await Promise.all([
    getSetting("skz_per_usdt"),
    getSetting("skz_per_star"),
    getSetting("skz_per_ton"),
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
