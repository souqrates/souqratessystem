/**
 * Resend transactional email helper.
 *
 * Used for admin alerts on high-signal events (new withdrawal request,
 * failed approval, etc). NOT for bulk/marketing — those live elsewhere.
 *
 * Design:
 *   - Lazy 60s-cached config from /integrations (same pattern as
 *     analytics.ts) — admin can flip on/off without restart.
 *   - Fire-and-forget by default (`void sendEmail(...)`). Email send
 *     failures are logged but never propagate to the calling handler.
 *   - Admin recipient comes from `platform_settings.admin_alert_email`
 *     if present; otherwise we silently no-op (no global env var so the
 *     panel stays the single source of truth).
 */
import { eq } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";
import { getActiveConfig } from "./integrations";
import { logger } from "./logger";

type Cfg = { apiKey: string; from: string } | null;

const CACHE_TTL_MS = 60_000;
let cached: { value: Cfg; at: number } | null = null;
let cacheLock: Promise<Cfg> | null = null;

async function loadCfg(): Promise<Cfg> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  if (cacheLock) return cacheLock;
  cacheLock = (async (): Promise<Cfg> => {
    try {
      const cfg = await getActiveConfig("resend");
      const value: Cfg =
        cfg && cfg["api_key"] && cfg["from_email"]
          ? { apiKey: cfg["api_key"], from: cfg["from_email"] }
          : null;
      cached = { value, at: Date.now() };
      return value;
    } catch (err) {
      logger.warn({ err }, "Resend config load failed");
      cached = { value: null, at: Date.now() };
      return null;
    } finally {
      cacheLock = null;
    }
  })();
  return cacheLock;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

/**
 * Send a single email via Resend. Returns true on accepted, false on
 * any failure (disabled, network, API error). Never throws.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const cfg = await loadCfg();
  if (!cfg) return false;
  if (!params.html && !params.text) {
    logger.warn("sendEmail called without html or text body");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        ...(params.html ? { html: params.html } : {}),
        ...(params.text ? { text: params.text } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: body.slice(0, 200) }, "Resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Resend send threw");
    return false;
  }
}

/**
 * Fire an admin alert (fire-and-forget). Reads recipient from
 * platform_settings.admin_alert_email — no-ops if unset so the panel
 * stays the single source of truth for ops contacts.
 */
export function notifyAdmin(subject: string, html: string): void {
  void (async () => {
    try {
      const [row] = await db
        .select({ value: platformSettingsTable.value })
        .from(platformSettingsTable)
        .where(eq(platformSettingsTable.key, "admin_alert_email"));
      const to = row?.value;
      if (typeof to !== "string" || !to.includes("@")) return;
      await sendEmail({ to, subject: `[SOUQRATES] ${subject}`, html });
    } catch (err) {
      logger.debug({ err }, "notifyAdmin failed");
    }
  })();
}
