import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";

/**
 * Read the idempotency key from either the standard HTTP header
 * (`Idempotency-Key`, lowercase by Express) or the JSON body field
 * `idempotencyKey`. Returns `null` when none is provided — in that case
 * the financial route is free to proceed without dedupe (legacy callers).
 */
export function readIdempotencyKey(req: Request): string | null {
  const headerVal = req.header("Idempotency-Key");
  if (typeof headerVal === "string" && headerVal.trim().length > 0) {
    return headerVal.trim().slice(0, 128);
  }
  const body = (req.body ?? {}) as { idempotencyKey?: unknown };
  if (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0) {
    return body.idempotencyKey.trim().slice(0, 128);
  }
  return null;
}

/**
 * If a transaction with this (sourceBot, idempotencyKey) pair already exists,
 * return it so the caller can replay the original response. The unique partial
 * index `tx_idempotency_uniq` enforces that no two writes can ever both
 * succeed for the same pair, so a retry after a partial failure will see the
 * winner here.
 */
export async function findExistingByIdempotencyKey(
  sourceBot: string,
  idempotencyKey: string,
): Promise<typeof transactionsTable.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.sourceBot, sourceBot),
        eq(transactionsTable.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Postgres unique_violation. Used to detect the race where two concurrent
 *  requests hit the same idempotency key between SELECT and INSERT. */
export const PG_UNIQUE_VIOLATION = "23505";

/**
 * Verify that a replayed request matches the original write that claimed the
 * idempotency key. Bots MUST NOT reuse keys across different operations — if
 * we silently replayed a mismatched request we'd return a misleading success
 * payload and drop the new intended write entirely.
 *
 * Returns `true` when the new request is consistent with the stored tx, or
 * `false` when the caller is reusing the key for a different operation.
 */
export function idempotencyFingerprintMatches(
  existing: typeof transactionsTable.$inferSelect,
  candidate: { type: string; userId: number; amount: string | number },
): boolean {
  if (existing.type !== candidate.type) return false;
  if (existing.userId !== candidate.userId) return false;
  // Compare magnitudes — debits store amount negative so we normalise.
  const a = Math.abs(parseFloat(String(existing.amount)));
  const b = Math.abs(parseFloat(String(candidate.amount)));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 0.0001;
}
