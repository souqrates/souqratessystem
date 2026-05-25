import * as Sentry from "@sentry/node";
import { getActiveConfig } from "./integrations";
import { logger } from "./logger";

let initialized = false;

/**
 * Initialise Sentry from the integrations panel config (if enabled).
 *
 * Why read from DB instead of env var: the whole point of the integrations
 * framework is that the admin pastes the DSN once in /integrations, toggles
 * it on, and it just works — no redeploy, no env-var management.
 *
 * Sentry's SDK MUST be initialised before any module that might throw, so
 * this is called at the very top of index.ts (before app import).
 *
 * Safe to call multiple times — second call is a no-op.
 */
export async function initSentryFromIntegration(): Promise<boolean> {
  if (initialized) return true;
  try {
    const cfg = await getActiveConfig("sentry");
    if (!cfg || !cfg["dsn"]) {
      logger.info("Sentry not configured/enabled — skipping init");
      return false;
    }
    const tracesSampleRate = Number(cfg["traces_sample_rate"] ?? "0");
    Sentry.init({
      dsn: cfg["dsn"],
      environment: cfg["environment"] || "production",
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
      // Strip query strings and auth tokens from URLs sent to Sentry.
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
          delete event.request.headers["x-bot-api-key"];
        }
        return event;
      },
    });
    initialized = true;
    logger.info({ env: cfg["environment"] }, "Sentry initialised from integration");
    return true;
  } catch (err) {
    logger.error({ err }, "Sentry init failed");
    return false;
  }
}

export { Sentry };
