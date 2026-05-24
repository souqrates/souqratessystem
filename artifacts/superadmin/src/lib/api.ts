const TOKEN_KEY = "superadmin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, withAuth = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withAuth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  loginUnauthed: <T>(path: string, body: unknown) => request<T>("POST", path, body, false),
};

// ─── Domain types ───────────────────────────────────────────────
export interface Bot {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  commissionRate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommissionOverride {
  id: number;
  telegramId: string | number;
  botSlug: string;
  commissionRate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  userFirstName?: string | null;
  userUsername?: string | null;
}

export interface SkzRates {
  skzPerUsdt: string;
  skzPerStar: string;
  skzPerTon: string;
  updatedAt: string;
}
