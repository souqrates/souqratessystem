/**
 * Adapter contract for an external integration (Sentry, Upstash, etc.).
 *
 * Each integration is a single, self-contained file under `./adapters/` that
 * exports an `IntegrationAdapter` and registers itself in `./registry.ts`.
 * Adding a new provider should be ~50 lines and require zero changes to the
 * generic route or UI — the registry drives both.
 */
export type IntegrationCategory =
  | "infra" // Redis, queues, CDN
  | "monitoring" // Sentry, BetterStack, error/log/uptime
  | "comms" // Email, SMS, push
  | "security" // Captcha, WAF
  | "payments" // Crypto, cards
  | "analytics" // PostHog, etc.
  | "ai" // OpenRouter, Groq
  | "storage"; // R2, Bunny, S3-compat

export type IntegrationTier = 1 | 2 | 3 | 4;

export interface IntegrationField {
  key: string;
  label: string;
  /** "text" | "password" (masked) | "url" | "select" */
  type: "text" | "password" | "url" | "select";
  required?: boolean;
  secret?: boolean; // true ⇒ encrypted at rest, masked on read
  placeholder?: string;
  help?: string;
  default?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface IntegrationTestResult {
  ok: boolean;
  error?: string;
  /** Free-form provider-specific info shown next to the badge, e.g. plan/quota. */
  metadata?: Record<string, unknown>;
}

export interface IntegrationAdapter {
  slug: string;
  name: string;
  brand: string; // provider's brand name (for the cap on the card)
  category: IntegrationCategory;
  tier: IntegrationTier;
  description: string; // 1-2 sentences in Arabic for the admin card
  signupUrl: string;
  docsUrl: string;
  /** Short pricing summary in Arabic (e.g. "مجاني 10k req/يوم"). */
  pricing: string;
  fields: IntegrationField[];
  /**
   * Probe the provider with the given config. Should not throw for expected
   * provider errors (401 from the provider, bad key, etc.) — return
   * `{ ok: false, error }` instead. Throwing is reserved for bugs in the
   * adapter itself.
   *
   * Implementations SHOULD use a short timeout (≤8s) so the admin UI is
   * responsive even when the provider is down.
   */
  test(config: Record<string, string>): Promise<IntegrationTestResult>;
}
