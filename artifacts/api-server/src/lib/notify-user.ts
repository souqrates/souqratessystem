import { logger } from "./logger";

/**
 * Send a plain-text Telegram message to a user via the mother-bot token.
 *
 * Used for transactional notifications (deposit confirmed, withdrawal
 * approved/rejected, security alerts). Failures are logged but never thrown
 * — a Telegram outage must not break the underlying financial operation.
 *
 * The user must have started the mother-bot at least once. We catch the
 * common "bot was blocked / chat not found" errors silently because they
 * are not actionable from the server side.
 *
 * NOTE: Telegram-only project — we deliberately do not have an email/SMS
 * fallback path. If the user blocked the bot they will see the change
 * the next time they open it (transactions/withdrawals lists).
 */
export async function notifyUser(
  telegramId: string | number | bigint,
  text: string,
  opts?: { parseMode?: "Markdown" | "HTML"; silent?: boolean },
): Promise<boolean> {
  const token = process.env.MOTHER_BOT_TOKEN;
  if (!token) {
    logger.warn(
      { telegramId: String(telegramId) },
      "notifyUser skipped: MOTHER_BOT_TOKEN not configured",
    );
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(telegramId),
        text,
        parse_mode: opts?.parseMode,
        disable_notification: opts?.silent ?? false,
      }),
      // Hard cap so a slow Telegram never holds a DB request handler.
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      // 403 = bot blocked by user, 400 = chat not found. Both unactionable.
      const benign =
        data.description?.includes("blocked") ||
        data.description?.includes("chat not found") ||
        data.description?.includes("user is deactivated");
      if (!benign) {
        logger.warn(
          { telegramId: String(telegramId), desc: data.description },
          "notifyUser: Telegram rejected message",
        );
      }
      return false;
    }
    return true;
  } catch (err) {
    logger.warn(
      { err, telegramId: String(telegramId) },
      "notifyUser: send failed",
    );
    return false;
  }
}
