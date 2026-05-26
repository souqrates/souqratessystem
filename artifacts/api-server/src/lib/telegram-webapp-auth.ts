/**
 * Telegram WebApp initData validation.
 *
 * When a user opens a Telegram WebApp (Mini App) via a bot button, the
 * platform injects `window.Telegram.WebApp.initData` — a URL-encoded
 * string signed by the bot's token. The signature lets us verify on the
 * server that the request really comes from a Telegram user opening our
 * mini app, without any extra OAuth round-trip.
 *
 * Signature scheme (per https://core.telegram.org/bots/webapps):
 *   secret_key   = HMAC_SHA256(key=bot_token, msg="WebAppData")
 *   data_check   = sort(params except hash) joined by "\n" as `k=v`
 *   expected     = HMAC_SHA256(key=secret_key, msg=data_check).hex
 *   valid IFF expected === params.hash
 *
 * We also enforce a 24h freshness window so a leaked initData can't be
 * replayed indefinitely.
 *
 * Bot key selection: each mini-app artifact has a designated bot whose
 * token signs its initData. Pass the matching env var name to
 * `requireTelegramUser(envVarName)`. For contests-bot-web that's
 * `CONTESTS_BOT_TOKEN`.
 */
import crypto from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";

export interface TelegramWebAppUser {
  id: bigint;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  photoUrl?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    telegramUser?: TelegramWebAppUser;
  }
}

const MAX_INIT_DATA_AGE_SEC = 24 * 60 * 60; // 24h

function timingSafeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify a Telegram WebApp initData string and return the parsed user.
 * Returns null on any failure (bad hash, expired, malformed, missing user).
 */
export function verifyInitData(
  initData: string,
  botToken: string,
): TelegramWebAppUser | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash) return null;

  // Build data_check_string: all params except `hash`, sorted by key,
  // joined as `key=value` with literal "\n".
  const entries: [string, string][] = [];
  params.forEach((v, k) => {
    if (k !== "hash") entries.push([k, v]);
  });
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqHex(expectedHash, hash)) return null;

  // Freshness check.
  const authDateStr = params.get("auth_date");
  if (!authDateStr) return null;
  const authDate = parseInt(authDateStr, 10);
  if (!Number.isFinite(authDate)) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > MAX_INIT_DATA_AGE_SEC) return null;
  if (authDate - nowSec > 60) return null; // clock skew tolerance

  // Parse user JSON.
  const userJson = params.get("user");
  if (!userJson) return null;
  let userObj: any;
  try {
    userObj = JSON.parse(userJson);
  } catch {
    return null;
  }
  if (!userObj || typeof userObj.id !== "number") return null;

  return {
    id: BigInt(userObj.id),
    firstName: String(userObj.first_name ?? ""),
    lastName: userObj.last_name ? String(userObj.last_name) : undefined,
    username: userObj.username ? String(userObj.username) : undefined,
    languageCode: userObj.language_code
      ? String(userObj.language_code)
      : undefined,
    isPremium: userObj.is_premium === true,
    photoUrl: userObj.photo_url ? String(userObj.photo_url) : undefined,
  };
}

/**
 * Express middleware factory: gate a route by Telegram WebApp initData.
 *
 *   router.post("/foo", requireTelegramUser("CONTESTS_BOT_TOKEN"), ...);
 *
 * Reads initData from header `X-Telegram-Init-Data` (preferred — keeps it
 * out of URLs/logs) and rejects with 401 on any failure. On success,
 * `req.telegramUser` is populated.
 */
export function requireTelegramUser(envVarName: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = process.env[envVarName];
    if (!token) {
      req.log?.error(
        { envVarName },
        "telegram-webapp-auth: bot token env var missing",
      );
      res.status(500).json({ error: "Server misconfigured" });
      return;
    }
    const initData = req.header("X-Telegram-Init-Data");
    if (!initData) {
      res.status(401).json({ error: "Missing X-Telegram-Init-Data header" });
      return;
    }
    const user = verifyInitData(initData, token);
    if (!user) {
      res.status(401).json({ error: "Invalid Telegram initData" });
      return;
    }
    req.telegramUser = user;
    next();
  };
}
