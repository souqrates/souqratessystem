/**
 * Mother Bot SDK for SOUQRATESSKILLZ (Games Bot)
 *
 * Authentication: Telegram Mini App initData is sent as X-Telegram-Init-Data
 * header. The api-server verifies the HMAC-SHA256 signature server-side using
 * GAMES_BOT_TOKEN. No bot API key ever leaves the server.
 *
 * All calls go to /api/games/* — a secure backend-for-frontend proxy that:
 *   1. Validates the Telegram initData signature
 *   2. Resolves the user from the embedded Telegram user ID
 *   3. Performs financial operations server-side with the games-bot API key
 */

function getInitData() {
  try { return window.Telegram?.WebApp?.initData ?? ''; }
  catch { return ''; }
}

async function call(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ── Exported SDK functions ────────────────────────────────────────────────────

/** Provision the calling Telegram user (idempotent, safe to call every launch). */
export async function upsertUser({ referrerTelegramId } = {}) {
  return call('POST', '/api/games/upsert-user', { referrerTelegramId });
}

/** Fetch wallet balances for the calling user. */
export async function getBalance() {
  return call('GET', '/api/games/balance');
}

/** Fetch bot-scoped transaction history. */
export async function getLedger({ limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return call('GET', `/api/games/ledger?${params}`);
}

/** Fetch solo fee tiers from platform settings. */
export async function getTiers() {
  return call('GET', '/api/games/tiers');
}

/**
 * Deduct entry fee for a solo game.
 * Returns { success, transactionId, entryFee, expectedPrize, newSkzBalance }.
 * Amount is validated server-side against configured tier fees.
 */
export async function chargeEntry(gameId, amount) {
  return call('POST', '/api/games/charge-entry', {
    gameId: String(gameId),
    amount: String(amount),
  });
}

/**
 * Validate game completion and obtain a short-lived signed resultToken.
 * Must be called after the game ends (win), before creditReward.
 * Server checks: score >= minWinScore AND elapsed time >= minDurationMs.
 * Returns { ok, resultToken } — token expires in 10 minutes.
 */
export async function validateResult(chargeTransactionId, score) {
  return call('POST', '/api/games/validate-result', {
    chargeTransactionId: Number(chargeTransactionId),
    score:               Math.round(Number(score)),
  });
}

/**
 * Credit a game-win reward.
 * @param {number} chargeTransactionId  — ID returned by chargeEntry
 * @param {number|null} score           — final game score
 * @param {string} resultToken          — token from validateResult (proves game was played)
 *
 * Prize is derived server-side from stored charge metadata — never from client.
 */
export async function creditReward(chargeTransactionId, score, resultToken) {
  return call('POST', '/api/games/credit-reward', {
    chargeTransactionId: Number(chargeTransactionId),
    resultToken,
    score: score != null ? Math.round(Number(score)) : undefined,
  });
}

/**
 * Create a Telegram Stars deposit invoice.
 * Returns { ok, invoiceLink, expectedSkz, payload }.
 */
export async function createStarsInvoice(amountStars) {
  return call('POST', '/api/games/stars-invoice', {
    amountStars: Number(amountStars),
  });
}

/**
 * Create a TON deposit intent (unique memo + pending record).
 * Returns { ok, intentId, memo, depositAddress, amountTon, expectedSkz }.
 */
export async function createTonDepositIntent(amountTon) {
  return call('POST', '/api/games/ton-deposit-intent', {
    amountTon: Number(amountTon),
  });
}

/**
 * Request a SKZ withdrawal.
 * @param {string} methodCode     — 'ton' | 'stars' | etc.
 * @param {string|number} amountSkz
 * @param {object} destination    — e.g. { tonAddress: '...' }
 */
export async function requestWithdrawal(methodCode, amountSkz, destination = {}) {
  return call('POST', '/api/games/withdraw', {
    methodCode,
    amountSkz: String(amountSkz),
    destination,
  });
}
