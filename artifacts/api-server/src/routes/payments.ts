/**
 * Card-to-crypto top-up via Cryptomus.
 *
 * Flow:
 *  1. Mother-bot calls POST /api/internal/payments/cryptomus/create with the
 *     user's telegramId and the desired USDT amount.
 *  2. We generate a fresh order_id (UUID), insert a *pending* deposit
 *     transaction with that UUID as `referenceId` AND as the idempotency
 *     fingerprint, then hand it to Cryptomus to mint a hosted-checkout URL.
 *  3. User pays by card on Cryptomus's page → Cryptomus settles to our
 *     merchant wallet in USDT → Cryptomus posts an IPN to
 *     POST /api/payments/cryptomus/webhook with a signed payload.
 *  4. Webhook verifies the signature, looks up the pending tx by order_id,
 *     atomically marks it completed and credits SKZ to the user's wallet,
 *     then DMs the user.
 *
 * Guarantees:
 *  - Signature verified with HMAC-MD5 over the raw request bytes (see
 *    lib/cryptomus.ts). Any tamper attempt → 401.
 *  - Atomic update via db.transaction: the wallet credit and the ledger
 *    flip from pending→completed commit together or not at all.
 *  - Idempotent: a duplicate IPN finds the row already `completed` and
 *    returns 200 without re-crediting.
 *  - Mother-bot is the only caller permitted to mint payment URLs
 *    (X-Bot-Api-Key on the create endpoint). The webhook is public on
 *    purpose — anyone can POST, but only Cryptomus has the secret to sign.
 */
import { Router, type IRouter, type Request } from "express";
import crypto from "crypto";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  walletsTable,
  transactionsTable,
  botsTable,
  withdrawalsTable,
} from "@workspace/db";
import { getSkzRates } from "../lib/finance";
import { notifyUser } from "../lib/notify-user";
import {
  getCryptomusEnv,
  createCryptomusPayment,
  verifyCryptomusWebhook,
} from "../lib/cryptomus";

const router: IRouter = Router();

/** Reuse the same bot-auth gate used by /internal — but we expose this as
 *  /api/internal/payments/* so the rate-limiter that already covers
 *  /api/internal protects us too. */
async function requireBot(req: Request, res: Parameters<Parameters<typeof router.post>[1]>[1]): Promise<typeof botsTable.$inferSelect | null> {
  const apiKey = req.headers["x-bot-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Bot-Api-Key header" });
    return null;
  }
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.apiKey, apiKey));
  if (!bot || !bot.isActive) {
    res.status(403).json({ error: "Invalid or inactive bot API key" });
    return null;
  }
  return bot;
}

/**
 * POST /api/internal/payments/cryptomus/create
 * Body: { telegramId, amountUsdt, returnUrl? }
 * Auth: X-Bot-Api-Key
 */
router.post("/internal/payments/cryptomus/create", async (req, res): Promise<void> => {
  const bot = await requireBot(req, res);
  if (!bot) return;
  // Card top-up is a mother-bot-only surface — the wallet UI lives there.
  // Other child bots have valid API keys for their own financial calls but
  // are NOT authorized to mint hosted-checkout URLs against a user's wallet.
  if (bot.slug !== "mother-bot") {
    res.status(403).json({ error: "Only mother-bot may create card top-up invoices" });
    return;
  }

  const env = await getCryptomusEnv();
  if (!env) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  const { telegramId, amountUsdt, returnUrl } = (req.body ?? {}) as {
    telegramId?: string | number;
    amountUsdt?: string | number;
    returnUrl?: string;
  };

  if (!telegramId) { res.status(400).json({ error: "telegramId is required" }); return; }
  const amt = parseFloat(String(amountUsdt ?? ""));
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ error: "amountUsdt must be a positive number" });
    return;
  }
  if (amt < 1) { res.status(400).json({ error: "Minimum top-up is 1 USDT" }); return; }
  if (amt > 10_000) { res.status(400).json({ error: "Maximum top-up is 10,000 USDT" }); return; }

  let tid: bigint;
  try { tid = BigInt(String(telegramId)); }
  catch { res.status(400).json({ error: "Invalid telegramId" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, tid));
  if (!user) { res.status(404).json({ error: "User not found — open the bot first" }); return; }
  if (user.isBlocked) { res.status(403).json({ error: "Account is blocked" }); return; }

  // Build the public URL Cryptomus should POST the IPN to. Sourced from
  // the /integrations panel (or PUBLIC_WEBHOOK_BASE env as fallback) so
  // the URL is identical across restarts — Cryptomus rejects callbacks
  // to localhost or non-https.
  const webhookBase = env.publicWebhookBase;
  if (!webhookBase) {
    res.status(503).json({ error: "public_webhook_base not configured in /integrations" });
    return;
  }
  const urlCallback = `${webhookBase.replace(/\/$/, "")}/api/payments/cryptomus/webhook`;

  // Unique per-attempt order id. Stored as referenceId on the pending tx so
  // the IPN can resolve it without trusting any field the user supplied.
  const orderId = crypto.randomUUID();
  const amountStr = amt.toFixed(2);

  // Pre-insert a pending row. If Cryptomus call fails we'll mark it failed.
  // Using idempotencyKey = orderId means an accidental retry with the same
  // order_id replays cleanly instead of stacking pending rows.
  const [pending] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    currency: "usdt",
    amount: amountStr,
    fee: "0",
    status: "pending",
    sourceBot: bot.slug,
    referenceId: orderId,
    idempotencyKey: orderId,
    description: `شحن الرصيد بالبطاقة عبر Cryptomus — ${amountStr} USDT`,
    metadata: JSON.stringify({ gateway: "cryptomus", paymentMethod: "card", orderId }),
  }).returning();

  const gw = await createCryptomusPayment(env, {
    amount: amountStr,
    currency: "USDT",
    orderId,
    network: env.defaultNetwork,
    urlCallback,
    ...(returnUrl ? { urlReturn: returnUrl, urlSuccess: returnUrl } : {}),
    lifetime: 3600,
  });

  if (!gw.ok) {
    // Best-effort: mark the pending row as failed so it doesn't dangle.
    await db.update(transactionsTable)
      .set({
        status: "failed",
        metadata: JSON.stringify({ gateway: "cryptomus", error: gw.error, orderId }),
      })
      .where(eq(transactionsTable.id, pending.id));
    req.log.warn({ err: gw.error, orderId }, "cryptomus: payment creation failed");
    res.status(502).json({ error: `Gateway error: ${gw.error}` });
    return;
  }

  // Attach the gateway uuid so we can debug missing IPNs later.
  await db.update(transactionsTable)
    .set({
      metadata: JSON.stringify({
        gateway: "cryptomus", paymentMethod: "card",
        orderId, gatewayUuid: gw.uuid,
      }),
    })
    .where(eq(transactionsTable.id, pending.id));

  req.log.info({ orderId, gatewayUuid: gw.uuid, amount: amountStr, telegramId }, "cryptomus: payment created");
  res.json({
    success: true,
    orderId,
    paymentUrl: gw.url,
    amountUsdt: amountStr,
    transactionId: pending.id,
  });
});

/**
 * POST /api/payments/cryptomus/webhook  (public, signature-verified)
 *
 * Cryptomus retries failed IPNs for ~24h, so we MUST be idempotent: a
 * duplicate POST for a tx we already credited must reply 200 without
 * touching the wallet. We achieve this by transitioning the row from
 * `pending` → `completed` inside a guarded UPDATE — only the first POST
 * that wins the WHERE status='pending' clause will do the credit.
 */
router.post("/payments/cryptomus/webhook", async (req, res): Promise<void> => {
  const env = await getCryptomusEnv();
  if (!env) {
    req.log.warn("cryptomus webhook: gateway not configured");
    res.status(503).json({ error: "not configured" });
    return;
  }

  // Raw body is captured by the express.json verify hook in app.ts and
  // exposed via (req as any).rawBody. Falling back to a re-stringified body
  // only as a last resort.
  const raw = (req as Request & { rawBody?: string }).rawBody
    ?? (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

  const v = verifyCryptomusWebhook(raw, env.webhookApiKey);
  if (!v.ok) {
    req.log.warn({ ip: req.ip }, "cryptomus webhook: invalid signature");
    res.status(401).json({ error: "invalid signature" });
    return;
  }
  const payload = v.payload as {
    type?: string;
    uuid?: string;
    order_id?: string;
    status?: string;
    payment_status?: string;
    amount?: string;
    currency?: string;
    payer_amount?: string;
    payer_currency?: string;
    is_final?: boolean;
    txid?: string;
  };

  const orderId = payload.order_id;
  if (!orderId) {
    res.status(400).json({ error: "missing order_id" });
    return;
  }

  // We trust ONLY these two terminal-success statuses to credit. Cryptomus
  // also sends interim states (process, confirm_check, paid_over) which we
  // ignore — only `paid` or `paid_over` mean funds settled.
  const status = payload.status ?? payload.payment_status ?? "";
  const isSuccess = status === "paid" || status === "paid_over";

  // Look up the pending row by orderId.
  const [pending] = await db.select().from(transactionsTable)
    .where(and(
      eq(transactionsTable.referenceId, orderId),
      eq(transactionsTable.type, "deposit"),
    ))
    .limit(1);

  if (!pending) {
    // Either an order that never existed in our DB, or a long-deleted one.
    // Returning 200 OK so Cryptomus stops retrying. Logged for forensics.
    req.log.warn({ orderId, status }, "cryptomus webhook: unknown order");
    res.json({ ok: true, ignored: "unknown_order" });
    return;
  }

  // Already credited (e.g. retry / out-of-order delivery). Idempotent ack.
  if (pending.status === "completed") {
    req.log.info({ orderId }, "cryptomus webhook: duplicate, already completed");
    res.json({ ok: true, replayed: true });
    return;
  }

  if (!isSuccess) {
    // Non-terminal or failure — record the state but don't credit. Cryptomus
    // will send another IPN if/when the payment finalises.
    if (payload.is_final === true && status !== "paid" && status !== "paid_over") {
      await db.update(transactionsTable)
        .set({
          status: "failed",
          metadata: JSON.stringify({
            ...(safeParseMetadata(pending.metadata)),
            finalStatus: status,
          }),
        })
        .where(and(
          eq(transactionsTable.id, pending.id),
          eq(transactionsTable.status, "pending"),
        ));
      req.log.info({ orderId, status }, "cryptomus webhook: payment failed (final)");
    } else {
      req.log.info({ orderId, status }, "cryptomus webhook: non-terminal status");
    }
    res.json({ ok: true });
    return;
  }

  // ── Credit path ────────────────────────────────────────────────────────
  // Convert paid USDT amount → SKZ using the live rate.
  const paidUsdt = parseFloat(payload.amount ?? pending.amount);
  if (!Number.isFinite(paidUsdt) || paidUsdt <= 0) {
    req.log.warn({ orderId, payload }, "cryptomus webhook: invalid amount");
    res.status(400).json({ error: "invalid amount" });
    return;
  }
  const rates = await getSkzRates();
  const skzAmount = parseFloat((paidUsdt * rates.perUsdt).toFixed(2));

  // Guarded atomic transition: pending → completed AND credit wallet, OR
  // nothing. The WHERE status='pending' clause makes the UPDATE a CAS —
  // only one concurrent IPN can win, the others see 0 rows updated and exit
  // the idempotent-replay branch below.
  let newSkzBalance: string | null = null;
  let creditedTx: typeof transactionsTable.$inferSelect | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      const [flipped] = await tx.update(transactionsTable)
        .set({
          status: "completed",
          // Switch the ledger row to record what was actually credited (SKZ),
          // keeping the original USDT amount in metadata for traceability.
          currency: "skz",
          amount: String(skzAmount.toFixed(2)),
          metadata: JSON.stringify({
            ...(safeParseMetadata(pending.metadata)),
            paidUsdt: String(paidUsdt),
            payerCurrency: payload.payer_currency ?? null,
            payerAmount: payload.payer_amount ?? null,
            txid: payload.txid ?? null,
            gatewayStatus: status,
            skzRate: rates.perUsdt,
          }),
        })
        .where(and(
          eq(transactionsTable.id, pending.id),
          eq(transactionsTable.status, "pending"),
        ))
        .returning();
      if (!flipped) return { winner: false as const };

      const [w] = await tx.update(walletsTable).set({
        balanceSkz:     sql`${walletsTable.balanceSkz}     + ${skzAmount}`,
        totalEarnedSkz: sql`${walletsTable.totalEarnedSkz} + ${skzAmount}`,
      }).where(eq(walletsTable.userId, flipped.userId)).returning();
      if (!w) throw new Error("WALLET_NOT_FOUND");
      return { winner: true as const, tx: flipped, balance: w.balanceSkz };
    });

    if (!result.winner) {
      // The guarded UPDATE matched zero rows: either a concurrent IPN
      // already flipped pending→completed (idempotent replay — return 200),
      // OR the row was previously marked failed by an earlier final-failure
      // IPN that has now been superseded by a success. Acking the latter as
      // "replayed" would silently lose the credit, so we re-read and branch.
      const [current] = await db.select().from(transactionsTable)
        .where(eq(transactionsTable.id, pending.id)).limit(1);
      if (current?.status === "completed") {
        req.log.info({ orderId }, "cryptomus webhook: lost race, idempotent ok");
        res.json({ ok: true, replayed: true });
        return;
      }
      // Out-of-order: previous IPN finalised as failed but now we're told it
      // settled. Log loudly and 409 so Cryptomus retries — the row will need
      // manual review / a separate credit path. We never silently credit
      // around a `failed` state because that erases the audit trail.
      req.log.error(
        { orderId, currentStatus: current?.status ?? "missing" },
        "cryptomus webhook: success IPN arrived after non-pending state — manual review required",
      );
      res.status(409).json({ ok: false, error: "tx_not_pending", currentStatus: current?.status ?? "missing" });
      return;
    }
    creditedTx = result.tx;
    newSkzBalance = result.balance;
  } catch (err) {
    req.log.error({ err, orderId }, "cryptomus webhook: credit failed");
    res.status(500).json({ error: "credit_failed" });
    return;
  }

  // Best-effort confirmation DM. We've already committed — never block on this.
  const [u] = await db.select({ tid: usersTable.telegramId })
    .from(usersTable).where(eq(usersTable.id, creditedTx.userId));
  if (u) {
    void notifyUser(
      String(u.tid),
      `✅ تم شحن رصيدك بنجاح!\n` +
      `المبلغ المدفوع: ${paidUsdt.toFixed(2)} USDT\n` +
      `أُضيف إلى محفظتك: ${skzAmount.toFixed(2)} SKZ\n` +
      `الرصيد الجديد: ${newSkzBalance} SKZ`,
    );
  }

  req.log.info({ orderId, skzAmount, paidUsdt, userId: creditedTx.userId }, "cryptomus webhook: credited");
  res.json({ ok: true, credited: true });
});

function safeParseMetadata(meta: string | null): Record<string, unknown> {
  if (!meta) return {};
  try { return JSON.parse(meta) as Record<string, unknown>; }
  catch { return {}; }
}

/**
 * POST /api/payments/cryptomus/payout-webhook  (public, signature-verified)
 *
 * Cryptomus notifies us asynchronously when a payout settles or fails on
 * chain. Until this IPN arrives the withdrawal row stays in `processing`
 * (set by /superadmin/withdrawals/:id/auto-payout) with the wallet
 * already deducted.
 *
 *   payout settled (`paid`, `complete`, `success`) → status `approved`,
 *     txHash replaced with the real on-chain hash. User notified.
 *   payout failed  (`fail`, `cancel`, `system_fail`) → status back to
 *     `pending`, wallet refunded, txHash cleared, admin can retry.
 *
 * Idempotent: a duplicate IPN finds the row already approved or already
 * refunded and returns 200 without touching the wallet.
 */
router.post("/payments/cryptomus/payout-webhook", async (req, res): Promise<void> => {
  const env = await getCryptomusEnv();
  if (!env) {
    req.log.warn("cryptomus payout webhook: gateway not configured");
    res.status(503).json({ error: "not configured" });
    return;
  }

  const raw = (req as Request & { rawBody?: string }).rawBody
    ?? (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

  const v = verifyCryptomusWebhook(raw, env.webhookApiKey);
  if (!v.ok) {
    req.log.warn({ ip: req.ip }, "cryptomus payout webhook: invalid signature");
    res.status(401).json({ error: "invalid signature" });
    return;
  }
  const payload = v.payload as {
    type?: string;
    uuid?: string;
    order_id?: string;
    status?: string;
    amount?: string;
    currency?: string;
    network?: string;
    is_final?: boolean;
    txid?: string;
  };

  const orderId = payload.order_id;
  if (!orderId) {
    res.status(400).json({ error: "missing order_id" });
    return;
  }

  // Cryptomus payout terminal statuses. We treat `paid`, `complete`, and
  // `success` as wins (the docs and dashboard each use slightly different
  // wording over time). `fail`, `cancel`, and `system_fail` are losses.
  const status = (payload.status ?? "").toLowerCase();
  const isWin = status === "paid" || status === "complete" || status === "success";
  const isLoss = status === "fail" || status === "cancel" || status === "system_fail" || status === "canceled";

  // Resolve the withdrawal: txHash is stamped as `cm:<orderId>` (pre-call)
  // or `cm:<orderId>:<gatewayUuid>` (post-call). Use SQL LIKE to match
  // either form without parsing the suffix.
  const [row] = await db.select().from(withdrawalsTable)
    .where(sql`${withdrawalsTable.txHash} LIKE ${'cm:' + orderId + '%'}`)
    .limit(1);

  if (!row) {
    req.log.warn({ orderId, status }, "cryptomus payout webhook: unknown order");
    res.json({ ok: true, ignored: "unknown_order" });
    return;
  }

  // Idempotent replays — terminal states already handled.
  if (row.status === "approved" || row.status === "rejected") {
    req.log.info({ orderId, currentStatus: row.status }, "cryptomus payout webhook: duplicate, terminal");
    res.json({ ok: true, replayed: true });
    return;
  }

  if (!isWin && !isLoss) {
    // Non-terminal (processing/check). Cryptomus will retry later.
    req.log.info({ orderId, status }, "cryptomus payout webhook: non-terminal status");
    res.json({ ok: true });
    return;
  }

  if (isWin) {
    // ── Settled. Replace marker txHash with the real on-chain txid. ──
    const [flipped] = await db.update(withdrawalsTable)
      .set({
        status: "approved",
        txHash: payload.txid ?? `cm-paid:${orderId}`,
        processedAt: new Date(),
      })
      .where(and(
        eq(withdrawalsTable.id, row.id),
        eq(withdrawalsTable.status, "processing"),
      ))
      .returning();
    if (!flipped) {
      // Lost the race to another IPN or to an admin override. Re-read.
      const [current] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, row.id));
      req.log.info({ orderId, currentStatus: current?.status }, "cryptomus payout webhook: win lost race");
      res.json({ ok: true, replayed: true });
      return;
    }
    void (async () => {
      try {
        const [u] = await db.select({ tid: usersTable.telegramId })
          .from(usersTable).where(eq(usersTable.id, flipped.userId));
        if (u) {
          await notifyUser(
            String(u.tid),
            `✅ تم إرسال السحب #${flipped.id} بنجاح\n` +
            `المبلغ: ${flipped.netAmount} ${flipped.currency.toUpperCase()}\n` +
            `هاش العملية: ${flipped.txHash}`,
          );
        }
      } catch (err) {
        req.log.warn({ err, id: flipped.id }, "post-payout-win notify failed");
      }
    })();
    req.log.info({ orderId, id: flipped.id, txid: payload.txid }, "cryptomus payout: settled");
    res.json({ ok: true, settled: true });
    return;
  }

  // ── Loss path: refund wallet, return row to pending so admin can retry. ──
  const amt = parseFloat(row.amount);
  try {
    const result = await db.transaction(async (tx) => {
      const [reverted] = await tx.update(withdrawalsTable)
        .set({
          status: "pending",
          txHash: null,
          processedAt: null,
          rejectedReason: `payout_failed:${status}`,
        })
        .where(and(eq(withdrawalsTable.id, row.id), eq(withdrawalsTable.status, "processing")))
        .returning();
      if (!reverted) return { refunded: false as const };

      if (reverted.currency === "usdt") {
        await tx.update(walletsTable).set({
          balanceUsdt:    sql`${walletsTable.balanceUsdt}    + ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} - ${amt}`,
        }).where(eq(walletsTable.userId, reverted.userId));
      } else if (reverted.currency === "ton") {
        await tx.update(walletsTable).set({
          balanceTon:     sql`${walletsTable.balanceTon}     + ${amt}`,
          totalWithdrawn: sql`${walletsTable.totalWithdrawn} - ${amt}`,
        }).where(eq(walletsTable.userId, reverted.userId));
      }
      return { refunded: true as const, row: reverted };
    });

    if (!result.refunded) {
      req.log.info({ orderId }, "cryptomus payout webhook: loss lost race");
      res.json({ ok: true, replayed: true });
      return;
    }

    void (async () => {
      try {
        const [u] = await db.select({ tid: usersTable.telegramId })
          .from(usersTable).where(eq(usersTable.id, result.row.userId));
        if (u) {
          await notifyUser(
            String(u.tid),
            `⚠️ فشل تنفيذ السحب #${result.row.id}\n` +
            `تمت إعادة الرصيد إلى محفظتك. يمكنك إعادة المحاولة من قائمة السحب.\n` +
            `السبب: ${status}`,
          );
        }
      } catch (err) {
        req.log.warn({ err, id: result.row.id }, "post-payout-loss notify failed");
      }
    })();

    req.log.warn({ orderId, status, id: row.id }, "cryptomus payout: failed, refunded");
    res.json({ ok: true, refunded: true });
  } catch (err) {
    req.log.error({ err, orderId }, "cryptomus payout webhook: refund failed");
    res.status(500).json({ error: "refund_failed" });
  }
});

export default router;
