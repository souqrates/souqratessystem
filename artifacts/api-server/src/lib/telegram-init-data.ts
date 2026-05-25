import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Telegram Mini App initData verification.
 *
 * Telegram signs the initData payload using HMAC-SHA256 with a secret key
 * derived from the bot token. We verify the signature on every authenticated
 * request from the Mini App so we can trust `user.id` (telegramId).
 *
 * The client sends the raw initData string in the `X-Telegram-Init-Data` header.
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24h — reasonable for a session

export type TgInitUser = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
  isPremium?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      tgInitUser?: TgInitUser;
    }
  }
}

function verifyInitData(
  initData: string,
  botToken: string,
): { ok: true; user: TgInitUser } | { ok: false; reason: string } {
  if (!initData) return { ok: false, reason: "empty" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing hash" };

  // Build data_check_string: all params (except `hash`) sorted, joined by \n.
  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computed !== hash) return { ok: false, reason: "bad signature" };

  // Optional: auth_date freshness
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (Number.isFinite(authDate) && authDate > 0) {
    const age = Math.floor(Date.now() / 1000) - authDate;
    if (age > MAX_AUTH_AGE_SECONDS) return { ok: false, reason: "expired" };
  }

  const userJson = params.get("user");
  if (!userJson) return { ok: false, reason: "missing user" };
  try {
    const raw = JSON.parse(userJson) as Record<string, unknown>;
    const id = typeof raw.id === "number" ? raw.id : Number(raw.id);
    if (!Number.isFinite(id) || id <= 0) {
      return { ok: false, reason: "bad user id" };
    }
    return {
      ok: true,
      user: {
        id,
        firstName: String(raw.first_name ?? "User"),
        lastName: raw.last_name ? String(raw.last_name) : undefined,
        username: raw.username ? String(raw.username) : undefined,
        languageCode: raw.language_code ? String(raw.language_code) : undefined,
        photoUrl: raw.photo_url ? String(raw.photo_url) : undefined,
        isPremium: Boolean(raw.is_premium),
      },
    };
  } catch {
    return { ok: false, reason: "bad user json" };
  }
}

/**
 * Express middleware: requires a valid Telegram Mini App initData header.
 * On success: req.tgUser is populated. On failure: 401.
 *
 * Accepts MOTHER_BOT_TOKEN (primary) OR any registered bot token via
 * environment vars (TOKENS list). For now only MOTHER_BOT_TOKEN is used
 * because the Mini App is launched from the mother bot.
 *
 * Development bypass: if header `X-Dev-User-Id` is set AND NODE_ENV !== "production",
 * trust that id without signature checks (lets us preview the Mini App in a browser).
 */
export function requireTelegramUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Dev bypass for browser preview
  if (process.env.NODE_ENV !== "production") {
    const devId = req.header("X-Dev-User-Id");
    if (devId && /^\d+$/.test(devId)) {
      req.tgInitUser = {
        id: parseInt(devId, 10),
        firstName: req.header("X-Dev-User-Name") || "DevUser",
      };
      next();
      return;
    }
  }

  const initData = req.header("X-Telegram-Init-Data") || "";
  const botToken = process.env.MOTHER_BOT_TOKEN || "";
  if (!botToken) {
    res.status(503).json({ error: "MOTHER_BOT_TOKEN not configured" });
    return;
  }

  const result = verifyInitData(initData, botToken);
  if (!result.ok) {
    res.status(401).json({ error: `Invalid Telegram initData: ${result.reason}` });
    return;
  }

  req.tgInitUser = result.user;
  next();
}
