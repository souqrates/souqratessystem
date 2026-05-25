/**
 * Cryptomus payment gateway integration helpers.
 *
 * Cryptomus accepts card payments on its hosted checkout, settles to the
 * merchant directly in crypto (USDT/TON/etc.), and notifies our backend via
 * an IPN webhook. We never touch the customer's card data — this stays a
 * Telegram-only, crypto-settled platform.
 *
 * Auth scheme (per https://doc.cryptomus.com/business/general/request-builder):
 *   sign = md5( base64( json_body_utf8 ) + PAYMENT_API_KEY )
 *
 * The same signing scheme is reused for IPN verification: Cryptomus sends a
 * `sign` field inside the payload; we recompute the digest from the
 * remaining fields and compare in constant time.
 *
 * IMPORTANT: To verify the IPN signature reliably we need the *exact* bytes
 * Cryptomus signed. Re-serializing parsed JSON can subtly reorder keys.
 * `routes/payments.ts` reads `req.rawBody` (captured by the express.json
 * verify hook in `app.ts`) and passes it here.
 */

import crypto from "crypto";
import { logger } from "./logger";
import { getActiveConfig } from "./integrations";

/** Default API host. Override via CRYPTOMUS_API_BASE for staging. */
const API_BASE = process.env.CRYPTOMUS_API_BASE ?? "https://api.cryptomus.com";

export interface CryptomusEnv {
  merchantId: string;
  paymentApiKey: string;
  /**
   * Some merchants use a separate webhook-signing key. Falls back to the
   * payment API key when unset (matches the default Cryptomus behaviour).
   */
  webhookApiKey: string;
  /** Optional — set only if the merchant uses a separate Payout API key. */
  payoutApiKey?: string;
  /** Default network for new deposit invoices (`tron`, `ton`, `eth`, `bsc`). */
  defaultNetwork: string;
  /** Public HTTPS base for IPN callbacks. Required by Cryptomus. */
  publicWebhookBase: string | null;
}

/**
 * Resolve Cryptomus configuration with the /integrations panel as the
 * canonical source of truth and env vars as a backward-compat fallback.
 *
 * Returns null when neither source has the minimum needed (merchant +
 * payment key + webhook base). Callers respond 503 in that case.
 *
 * Why prefer the panel: it's the single place an operator manages all
 * service keys, with encryption-at-rest and audit. Env vars stay for
 * legacy installs and local dev.
 */
export async function getCryptomusEnv(): Promise<CryptomusEnv | null> {
  // ── Source 1: /integrations panel (admin-managed, encrypted in DB) ──
  try {
    const cfg = await getActiveConfig("cryptomus");
    if (cfg && cfg["merchant_id"] && cfg["payment_api_key"]) {
      const paymentApiKey = cfg["payment_api_key"];
      return {
        merchantId: cfg["merchant_id"],
        paymentApiKey,
        webhookApiKey: cfg["webhook_api_key"] || paymentApiKey,
        ...(cfg["payout_api_key"] ? { payoutApiKey: cfg["payout_api_key"] } : {}),
        defaultNetwork: cfg["default_network"] || "tron",
        publicWebhookBase: cfg["public_webhook_base"] ?? process.env.PUBLIC_WEBHOOK_BASE ?? null,
      };
    }
  } catch (err) {
    logger.warn({ err }, "cryptomus: panel config load failed, falling back to env");
  }

  // ── Source 2: env vars (legacy fallback for early installs) ──
  const merchantId = process.env.CRYPTOMUS_MERCHANT_ID;
  const paymentApiKey = process.env.CRYPTOMUS_PAYMENT_API_KEY;
  if (!merchantId || !paymentApiKey) return null;
  return {
    merchantId,
    paymentApiKey,
    webhookApiKey: process.env.CRYPTOMUS_WEBHOOK_API_KEY ?? paymentApiKey,
    ...(process.env.CRYPTOMUS_PAYOUT_API_KEY ? { payoutApiKey: process.env.CRYPTOMUS_PAYOUT_API_KEY } : {}),
    defaultNetwork: process.env.CRYPTOMUS_NETWORK ?? "tron",
    publicWebhookBase: process.env.PUBLIC_WEBHOOK_BASE ?? null,
  };
}

/**
 * Compute Cryptomus signature over a JSON string.
 * `bodyJson` must be the exact UTF-8 bytes that will be (or were) sent on
 * the wire — NOT a re-serialized object.
 */
export function cryptomusSign(bodyJson: string, apiKey: string): string {
  const b64 = Buffer.from(bodyJson, "utf8").toString("base64");
  return crypto.createHash("md5").update(b64 + apiKey).digest("hex");
}

/**
 * Verify an IPN webhook signature.
 *
 * Cryptomus puts the `sign` field inside the JSON payload itself. We strip
 * it and recompute the digest over the remaining payload, matching the
 * official PHP reference implementation which signs
 *   md5( base64( json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ) + key )
 * after removing `sign`. Node's JSON.stringify preserves insertion order
 * and emits unescaped slashes / non-escaped unicode by default, matching
 * those PHP flags.
 *
 * Returns true on match. Uses constant-time comparison on the digest bytes.
 */
const HEX32_RE = /^[a-f0-9]{32}$/i;

export function verifyCryptomusWebhook(
  rawBody: string,
  webhookApiKey: string,
): { ok: boolean; payload: Record<string, unknown> | null } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, payload: null };
  }
  const providedSign = typeof parsed["sign"] === "string" ? (parsed["sign"] as string) : "";
  // Strict shape check before any hash math — defeats sign smuggling /
  // length-extension fishing and gives timingSafeEqual two equal-length
  // buffers to work with.
  if (!HEX32_RE.test(providedSign)) {
    return { ok: false, payload: parsed };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sign: _drop, ...withoutSign } = parsed;
  const canonical = JSON.stringify(withoutSign);
  const expected = cryptomusSign(canonical, webhookApiKey);

  const a = Buffer.from(providedSign.toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    return { ok: true, payload: parsed };
  }
  return { ok: false, payload: parsed };
}

/**
 * Create a hosted payment. Returns the checkout URL and the gateway's
 * internal `uuid` so we can correlate the IPN back to our pending tx row.
 *
 * `orderId` MUST be unique per attempt — we use a UUID generated by the
 * caller and persist it on the pending transaction as the idempotency
 * fingerprint, so a duplicate IPN cannot double-credit.
 */
export async function createCryptomusPayment(
  env: CryptomusEnv,
  params: {
    amount: string;          // e.g. "10.00"
    currency: string;        // e.g. "USDT"
    orderId: string;         // our internal UUID
    network?: string;        // e.g. "tron" for USDT TRC20, "ton" for TON
    urlCallback: string;     // our public webhook URL
    urlReturn?: string;      // optional success redirect (e.g. Telegram deep-link)
    urlSuccess?: string;
    isPaymentMultiple?: boolean;
    lifetime?: number;       // seconds, 300..43200
  },
): Promise<{ ok: true; uuid: string; url: string; raw: Record<string, unknown> } | { ok: false; error: string }> {
  const body = {
    amount: params.amount,
    currency: params.currency,
    order_id: params.orderId,
    url_callback: params.urlCallback,
    ...(params.urlReturn ? { url_return: params.urlReturn } : {}),
    ...(params.urlSuccess ? { url_success: params.urlSuccess } : {}),
    ...(params.network ? { network: params.network } : {}),
    is_payment_multiple: params.isPaymentMultiple ?? false,
    lifetime: params.lifetime ?? 3600,
  };
  const json = JSON.stringify(body);
  const sign = cryptomusSign(json, env.paymentApiKey);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        merchant: env.merchantId,
        sign,
      },
      body: json,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.warn({ err }, "cryptomus: network error creating payment");
    return { ok: false, error: "gateway_unreachable" };
  }

  const data = (await res.json().catch(() => ({}))) as {
    state?: number;
    message?: string;
    result?: { uuid?: string; url?: string };
  };
  if (!res.ok || data.state !== 0 || !data.result?.uuid || !data.result?.url) {
    logger.warn({ status: res.status, data }, "cryptomus: create payment rejected");
    return { ok: false, error: data.message ?? `gateway_error_${res.status}` };
  }
  return { ok: true, uuid: data.result.uuid, url: data.result.url, raw: data as Record<string, unknown> };
}

/**
 * Create a crypto payout (on-chain transfer to a user-supplied address).
 *
 * Uses the merchant's *payout* API key — distinct from the payment key
 * because Cryptomus enforces separate scopes. Falls back to the payment
 * key only if no payout key is configured (some accounts share one key
 * for both endpoints).
 *
 * `orderId` MUST be unique per attempt — we use a UUID generated by the
 * caller and persist it on the withdrawal row so the IPN can resolve
 * back to the right ledger entry without trusting any field the user
 * controls.
 *
 * Returns:
 *   - `{ok: true, uuid}` when Cryptomus accepted the payout for processing.
 *     The actual on-chain settlement comes later via the payout webhook.
 *   - `{ok: false, error}` for any rejection. Caller MUST roll back the
 *     wallet deduction in this case — Cryptomus has NOT taken our funds.
 */
export async function createCryptomusPayout(
  env: CryptomusEnv,
  params: {
    amount: string;          // e.g. "5.00" — net amount the user receives
    currency: string;        // e.g. "USDT"
    network: string;         // "tron" for USDT TRC20, "ton" for TON
    address: string;         // already-validated destination address
    orderId: string;         // our internal UUID
    urlCallback: string;     // payout webhook URL
    /** If true, Cryptomus deducts the network fee from `amount`; if false
     *  (default) we pay the fee on top. We default to true so the user
     *  receives exactly the net they were quoted. */
    isSubtract?: boolean;
  },
): Promise<{ ok: true; uuid: string; raw: Record<string, unknown> } | { ok: false; error: string }> {
  const key = env.payoutApiKey ?? env.paymentApiKey;
  const body = {
    amount: params.amount,
    currency: params.currency,
    network: params.network,
    order_id: params.orderId,
    address: params.address,
    is_subtract: params.isSubtract ?? true,
    url_callback: params.urlCallback,
  };
  const json = JSON.stringify(body);
  const sign = cryptomusSign(json, key);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        merchant: env.merchantId,
        sign,
      },
      body: json,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.warn({ err }, "cryptomus: network error creating payout");
    return { ok: false, error: "gateway_unreachable" };
  }

  const data = (await res.json().catch(() => ({}))) as {
    state?: number;
    message?: string;
    result?: { uuid?: string };
    errors?: Record<string, unknown>;
  };
  if (!res.ok || data.state !== 0 || !data.result?.uuid) {
    logger.warn({ status: res.status, data }, "cryptomus: create payout rejected");
    return { ok: false, error: data.message ?? `gateway_error_${res.status}` };
  }
  return { ok: true, uuid: data.result.uuid, raw: data as Record<string, unknown> };
}
