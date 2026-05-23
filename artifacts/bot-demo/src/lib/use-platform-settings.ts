import { useQuery } from "@tanstack/react-query";

export interface PlatformSettingsData {
  platformName: string;
  platformTagline: string;
  welcomeMessage: string;
  supportUsername: string;
  referralMessage: string;
  skzPerUsdt: number;
  skzPerStar: number;
  skzPerTon: number;
  minDepositUsdt: string;
  minDepositTon: string;
  minDepositStars: string;
  minWithdrawalSkz: string;
  withdrawalFeeUsdtPercent: string;
  withdrawalFeeTonPercent: string;
  referralBonusPercent: string;
  referralL2Percent: string;
  referralL3Percent: string;
}

const DEFAULTS: PlatformSettingsData = {
  platformName: "البوت الأم",
  platformTagline: "منصة البوتات المالية الأولى",
  welcomeMessage: "مرحباً بك!",
  supportUsername: "souqrates_support",
  referralMessage: "انضم إلينا واكسب SKZ!",
  skzPerUsdt: 100,
  skzPerStar: 1,
  skzPerTon: 500,
  minDepositUsdt: "5",
  minDepositTon: "0.5",
  minDepositStars: "50",
  minWithdrawalSkz: "100",
  withdrawalFeeUsdtPercent: "2",
  withdrawalFeeTonPercent: "1.5",
  referralBonusPercent: "5",
  referralL2Percent: "2",
  referralL3Percent: "1",
};

async function fetchSettings(): Promise<PlatformSettingsData> {
  // Use relative path — both bot-demo and API are served through the proxy
  const res = await fetch("/api/settings", { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error("Failed to fetch settings");
  const data = await res.json();

  return {
    platformName: data.content?.platformName ?? DEFAULTS.platformName,
    platformTagline: data.content?.platformTagline ?? DEFAULTS.platformTagline,
    welcomeMessage: data.content?.welcomeMessage ?? DEFAULTS.welcomeMessage,
    supportUsername: data.content?.supportUsername ?? DEFAULTS.supportUsername,
    referralMessage: data.content?.referralMessage ?? DEFAULTS.referralMessage,
    skzPerUsdt: parseFloat(data.skzRates?.skzPerUsdt) || DEFAULTS.skzPerUsdt,
    skzPerStar: parseFloat(data.skzRates?.skzPerStar) || DEFAULTS.skzPerStar,
    skzPerTon: parseFloat(data.skzRates?.skzPerTon) || DEFAULTS.skzPerTon,
    minDepositUsdt: data.financial?.minDepositUsdt ?? DEFAULTS.minDepositUsdt,
    minDepositTon: data.financial?.minDepositTon ?? DEFAULTS.minDepositTon,
    minDepositStars: data.financial?.minDepositStars ?? DEFAULTS.minDepositStars,
    minWithdrawalSkz: data.financial?.minWithdrawalSkz ?? DEFAULTS.minWithdrawalSkz,
    withdrawalFeeUsdtPercent: data.financial?.withdrawalFeeUsdtPercent ?? DEFAULTS.withdrawalFeeUsdtPercent,
    withdrawalFeeTonPercent: data.financial?.withdrawalFeeTonPercent ?? DEFAULTS.withdrawalFeeTonPercent,
    referralBonusPercent: data.financial?.referralBonusPercent ?? DEFAULTS.referralBonusPercent,
    referralL2Percent: data.financial?.referralL2Percent ?? DEFAULTS.referralL2Percent,
    referralL3Percent: data.financial?.referralL3Percent ?? DEFAULTS.referralL3Percent,
  };
}

export function usePlatformSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,        // cache 1 min
    refetchOnWindowFocus: true,
    placeholderData: DEFAULTS,
    retry: 1,
  });

  return { settings: data ?? DEFAULTS, isLoading };
}
