import { useState, useEffect, useCallback, useRef } from 'react';

const BASE     = import.meta.env.BASE_URL?.replace(/\/$/, '') || '/scratchy-bot-web';
const API_BASE = BASE.replace('/scratchy-bot-web', '') || '';

export interface JackpotStats {
  jackpot:        number;
  ticketsSold:    number;
  participants:   number;
  totalScratched: number;
  totalWins:      number;
  biggestWin:     number;
  winRate:        string;
}

const DEFAULTS: JackpotStats = {
  jackpot:        5_000,
  ticketsSold:    0,
  participants:   0,
  totalScratched: 0,
  totalWins:      0,
  biggestWin:     0,
  winRate:        '0.0',
};

export function useJackpotStats(pollMs = 12_000) {
  const [stats, setStats] = useState<JackpotStats>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scratchy/stats`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json() as JackpotStats;
      setStats(data);
    } catch {
      // keep previous values on network failure
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    timer.current = setInterval(fetchStats, pollMs);
    return () => clearInterval(timer.current);
  }, [fetchStats, pollMs]);

  // Called when user buys a lotto ticket in the web app.
  // Applies a local optimistic jump (+15 SKZ per ticket) that gets corrected
  // on the next poll. Real jackpot growth only comes from scratchy-bot
  // Telegram purchases recorded through the internal API.
  const recordLottoTicket = useCallback((_picks: number[]): void => {
    setStats(prev => ({
      ...prev,
      jackpot:      prev.jackpot + 15,   // 5 SKZ ticket × 3 multiplier
      ticketsSold:  prev.ticketsSold + 1,
      participants: prev.participants + 1,
    }));
  }, []);

  return { stats, ready, fetchStats, recordLottoTicket };
}
