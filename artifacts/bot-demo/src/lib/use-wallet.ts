import { useQuery } from "@tanstack/react-query";

export interface WalletData {
  user: {
    id: number;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    isPremium: boolean;
    isBlocked: boolean;
    referrerId: number | null;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  wallet: {
    id: number;
    userId: number;
    balanceSkz: string;
    balanceUsdt: string;
    balanceStars: string;
    balanceTon: string;
    totalEarnedSkz: string;
    totalWithdrawnSkz: string;
    totalEarned: string;
    totalWithdrawn: string;
  } | null;
}

export function getTelegramId(): string | null {
  if (typeof window === "undefined") return null;
  const uid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return uid ? String(uid) : null;
}

async function fetchWallet(telegramId: string): Promise<WalletData> {
  const res = await fetch(`/api/users/${telegramId}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useWallet() {
  const telegramId = getTelegramId();

  const query = useQuery<WalletData>({
    queryKey: ["wallet", telegramId],
    queryFn: () => fetchWallet(telegramId!),
    enabled: !!telegramId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const w = query.data?.wallet;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    telegramId,
    user: query.data?.user ?? null,
    wallet: w ?? null,
    balanceSkz: w ? Math.floor(parseFloat(w.balanceSkz)) : 0,
    balanceUsdt: w ? parseFloat(w.balanceUsdt) : 0,
    balanceStars: w ? Math.floor(parseFloat(w.balanceStars)) : 0,
    balanceTon: w ? parseFloat(w.balanceTon) : 0,
    totalEarnedSkz: w ? Math.floor(parseFloat(w.totalEarnedSkz)) : 0,
    totalWithdrawnSkz: w ? Math.floor(parseFloat(w.totalWithdrawnSkz)) : 0,
    refetch: query.refetch,
    internalUserId: query.data?.user?.id ?? null,
  };
}
