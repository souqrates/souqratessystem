import { useQuery } from "@tanstack/react-query";

export interface Transaction {
  id: number;
  userId: number;
  type: string;
  currency: string;
  amount: string;
  fee: string;
  status: string;
  sourceBot: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

async function fetchTransactions(userId: number, limit = 20): Promise<Transaction[]> {
  const res = await fetch(`/api/transactions?userId=${userId}&limit=${limit}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data ?? [];
}

export function useTransactions(userId: number | null, limit = 20) {
  const query = useQuery<Transaction[]>({
    queryKey: ["transactions", userId, limit],
    queryFn: () => fetchTransactions(userId!, limit),
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 24) {
    return `اليوم ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diffH < 48) {
    return `أمس ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `منذ ${Math.floor(diffH / 24)} أيام`;
}

const BOT_ICON_MAP: Record<string, string> = {
  "games-bot":    "🎮",
  "video-bot":    "🎬",
  "voice-bot":    "🎙️",
  "ai-bot":       "🤖",
  "store-bot":    "🛒",
  "contests-bot": "🏆",
  "mother-bot":   "🏦",
  superadmin:     "⚙️",
};

export function txBotIcon(sourceBot: string | null): string {
  if (!sourceBot) return "💫";
  return BOT_ICON_MAP[sourceBot] ?? "💫";
}
