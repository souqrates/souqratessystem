const STORAGE_KEY = "souqrates_admin_token";

export function getAdminToken(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); }
  catch { return null; }
}

export function setAdminToken(token: string): void {
  try { localStorage.setItem(STORAGE_KEY, token); }
  catch { /* storage disabled — caller will see no auth */ }
}

export function clearAdminToken(): void {
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { /* ignore */ }
}

/**
 * Trade a candidate admin token for a verified session. Returns true on
 * success (token now stored), false on auth failure.
 *
 * We do not surface 5xx as "wrong token" — those bubble up so the caller
 * can render a real error message instead of asking the admin to retype
 * a token that was probably correct.
 */
export async function loginAsAdmin(token: string): Promise<boolean> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (res.status === 200) {
    setAdminToken(token);
    return true;
  }
  if (res.status === 401 || res.status === 403) return false;
  const detail = await res.text().catch(() => "");
  throw new Error(`Admin login failed (${res.status}): ${detail || res.statusText}`);
}

/**
 * Decorate a `fetch` init object with an Authorization bearer header
 * built from the current admin token. Used by direct fetch calls in
 * pages that aren't going through the generated react-query client.
 */
export function withAdminAuth(init: RequestInit = {}): RequestInit {
  const token = getAdminToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}
