import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: { id?: number };
        };
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '/scratchy-bot-web';
const API_BASE = BASE.replace('/scratchy-bot-web', '') || '';

export function getTelegramUserId(): string | null {
  try {
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

export interface BalanceState {
  skz: number;
  loading: boolean;
  error: string | null;
  telegramId: string | null;
  refresh: () => Promise<void>;
  applyDeduct: (n: number) => void;
  applyCredit: (n: number) => void;
}

export function useBalance(): BalanceState {
  const [skz, setSkz] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const telegramId = getTelegramUserId();

  const fetchBalance = useCallback(async () => {
    if (!telegramId) {
      setSkz(0);
      setLoading(false);
      setError('no_telegram_user');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/users/${telegramId}`, {
        headers: { 'Accept': 'application/json' },
      });
      // 404 = user not yet registered (will be created on first play) — treat as 0 balance
      if (res.status === 404) {
        setSkz(0);
        setError(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const balance = parseFloat(data?.wallet?.balanceSkz ?? data?.user?.balanceSkz ?? '0');
      setSkz(isNaN(balance) ? 0 : balance);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [telegramId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const applyDeduct = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    setSkz(b => +(Math.max(0, b - n)).toFixed(2));
  }, []);

  const applyCredit = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    setSkz(b => +(b + n).toFixed(2));
  }, []);

  return { skz, loading, error, telegramId, refresh: fetchBalance, applyDeduct, applyCredit };
}
