import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function authHeaders(): Record<string, string> {
  const initData = window.Telegram?.WebApp?.initData ?? "";
  return initData ? { "X-Telegram-Init-Data": initData } : {};
}

async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`/api${path}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
  return r.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    let parsed: { error?: string } = {};
    try { parsed = JSON.parse(txt); } catch {}
    throw new Error(parsed.error || `POST ${path} ${r.status}`);
  }
  return r.json();
}

export interface SubAgentMe {
  status: "not_applied" | "pending" | "approved" | "rejected" | "suspended";
  agent: null | {
    id: number;
    telegramId: string;
    fullName: string;
    country: string;
    tierLevel: number | null;
    totalSalesSkz: string;
    totalCustomers: number;
    rejectedReason: string | null;
  };
  tier: null | {
    level: number;
    name: string;
    color: string;
    minSalesSkz: string;
    minCustomers: number;
    discountRate: string;
    perks: string[];
  };
  wallet: null | { balanceSkz: string };
}

export function useSubAgentMe() {
  return useQuery({
    queryKey: ["subagent-me"],
    queryFn: () => apiGet<SubAgentMe>("/subagents/me"),
    refetchOnWindowFocus: true,
  });
}

export function useSubAgentTiers() {
  return useQuery({
    queryKey: ["subagent-tiers"],
    queryFn: () => apiGet<{ data: SubAgentMe["tier"][] }>("/subagents/tiers"),
  });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      fullName: string;
      dob: string;
      country: string;
      phone: string;
      email?: string | null;
      address: string;
      idPhotoPath: string;
    }) => apiPost("/subagents/apply", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subagent-me"] }),
  });
}

export function useSell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { customerTelegramId: string; skzAmount: number; note?: string }) =>
      apiPost<{ ok: boolean; agentBalanceSkz: string; totalSalesSkz: string; totalCustomers: number }>(
        "/subagents/sell", body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subagent-me"] }),
  });
}

export function useMySales() {
  return useQuery({
    queryKey: ["subagent-sales"],
    queryFn: () => apiGet<{ data: Array<{
      id: number; customerMasked: string; skzAmount: string; note: string | null; createdAt: string;
    }> }>("/subagents/sales"),
  });
}

/**
 * Upload an ID photo. Returns the persistent /objects/<path> string to put
 * into the apply form's idPhotoPath field.
 */
export async function uploadIdPhoto(file: File): Promise<string> {
  const meta = await apiPost<{ uploadUrl: string; objectPath: string }>(
    "/subagents/id-photo-upload-url",
    { contentType: file.type, sizeBytes: file.size },
  );
  const put = await fetch(meta.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`upload failed: ${put.status}`);
  return meta.objectPath;
}
