---
name: Withdrawal double-spend guard
description: How to prevent double-spending via concurrent pending withdrawals in the financial API.
---

## Rule

Available balance = `wallets.balanceSkz` − SUM of all `withdrawals.amount` WHERE `status IN ('pending','processing')` for that user.

This check MUST happen at both:
1. **Creation** (`POST /internal/withdraw`) — refuse if `availableSkz < requestedAmount`; also cap at 3 concurrent pending withdrawals (429).
2. **Approval** (`POST /superadmin/withdrawals/:id/approve`) — re-check balance because it may have changed since creation; return 422 `insufficient_funds_at_approval` if now insufficient; notify user via Telegram.

## Why

Without the pending lock, a user can submit N parallel withdrawal requests each individually passing the balance check, resulting in N × amount actually being debited on approval — direct theft of platform liability.

## How to apply

- In `internal.ts` withdrawal creation: query `db.select({ sum: sql<string>`SUM(${withdrawalsTable.amount})` }).from(withdrawalsTable).where(and(eq(...telegramId), inArray(...status, ['pending','processing'])))`. Then `availableSkz = balanceSkz - pendingSum`. Refuse if `availableSkz < amount`.
- In `superadmin.ts` withdrawal approval: inside the DB transaction, re-fetch balance + recompute pendingSum (excluding current withdrawal), then compare. On failure: rollback, return 422, fire async Telegram notification to user.
- `InsufficientFundsAtApprovalError` class in superadmin.ts is caught in the outer try/catch to distinguish this case from generic 500 errors.

## API response for approval failure

```json
{ "error": "insufficient_funds_at_approval", "message": "..." }
```

Frontend (`Withdrawals.tsx`) detects `e.status === 422 && e.message === "insufficient_funds_at_approval"` and shows amber warning + "رفض الطلب الآن" shortcut instead of generic red error.

## Balance endpoint

`GET /internal/balance/:telegramId` now returns `pendingWithdrawalSkz` and `availableSkz` fields. `client.py wallet_summary_text` displays the breakdown when `pendingWithdrawalSkz > 0`.
