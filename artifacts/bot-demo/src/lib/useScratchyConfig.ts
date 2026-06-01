import { useEffect, useState } from 'react';
import { TIERS, type TierDef } from './games-data';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '/scratchy-bot-web';
const API_BASE = BASE.replace('/scratchy-bot-web', '') || '';

interface ConfigTier {
  id: string;
  label: string;
  icon: string;
  cost: number;
  prizes: number[];
  weights: number[];
}

interface ScratchyConfigResponse {
  tiers: ConfigTier[];
  jackpotBase: number;
  jackpotMultiplier: number;
}

function toTierDef(t: ConfigTier): TierDef {
  return {
    id: t.id,
    label: t.label,
    icon: t.icon,
    cost: t.cost,
    maxPrize: t.prizes.length ? Math.max(...t.prizes) : 0,
    prizes: t.prizes,
    weights: t.weights,
  };
}

// Fetches the live economy from the server so the displayed ticket prices and
// prizes always match what /api/scratchy/play will actually charge and pay.
// Falls back to the bundled static TIERS if the server is unreachable.
export function useScratchyConfig(): { tiers: TierDef[]; loaded: boolean } {
  const [tiers, setTiers] = useState<TierDef[]>(TIERS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scratchy/config`);
        if (!res.ok) throw new Error(`config ${res.status}`);
        const data = (await res.json()) as ScratchyConfigResponse;
        if (!cancelled && Array.isArray(data.tiers) && data.tiers.length > 0) {
          setTiers(data.tiers.map(toTierDef));
        }
      } catch {
        // keep static fallback
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { tiers, loaded };
}
