import { assertPublicUrl } from "./ssrf";

/**
 * Tiny fetch wrapper used by integration adapters. Adds a hard timeout so
 * a hung provider never wedges the admin "Test" button, and an SSRF guard
 * that refuses to fetch any URL that resolves to a private/loopback/cloud-
 * metadata address.
 *
 * Pass `allowPrivate: true` ONLY for hard-coded provider endpoints (e.g.
 * api.cloudflare.com); never for URLs derived from admin input.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; allowPrivate?: boolean } = {},
): Promise<Response> {
  const { timeoutMs = 8000, allowPrivate = false, ...rest } = init;
  if (!allowPrivate) {
    await assertPublicUrl(url);
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Convert any thrown value into a short string error for IntegrationTestResult. */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") return "timeout (>8s)";
    return err.message;
  }
  return String(err);
}
