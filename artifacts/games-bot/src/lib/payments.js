import {
  getBalance as mbGetBalance,
  getLedger as mbGetLedger,
  chargeEntry as mbChargeEntry,
  creditReward as mbCreditReward,
  validateResult as mbValidateResult,
  refundEntry as mbRefundEntry,
  requestWithdrawal as mbRequestWithdrawal,
  getTiers as mbGetTiers,
  createStarsInvoice as mbCreateStarsInvoice,
  createTonDepositIntent as mbCreateTonDepositIntent,
} from './motherBot';

export async function getBalance() {
  try {
    const data = await mbGetBalance();
    return {
      sc_balance:         Number(data.balanceSkz)   || 0,
      sc_pending:         0,
      sc_free:            0,
      trial_active:       false,
      trial_seconds_left: 0,
      trial_expires_at:   null,
      is_paid:            true,
      loaded:             true,
      balanceSkz:         data.balanceSkz,
      balanceStars:       data.balanceStars,
      balanceTon:         data.balanceTon,
      balanceUsdt:        data.balanceUsdt,
      totalEarnedSkz:     data.totalEarnedSkz,
    };
  } catch {
    return null;
  }
}

export async function listLedger({ limit = 50, offset = 0 } = {}) {
  try {
    const res = await mbGetLedger({ limit, offset });
    return (res.data || []).map(tx => ({
      id:          tx.id,
      type:        tx.type,
      amount_sc:   Math.abs(Number(tx.amount)),
      amount_ton:  0,
      amount_usd:  0,
      description: tx.description || tx.type,
      created_at:  tx.createdAt,
      status:      tx.status,
      category:    tx.type,
      source_bot:  tx.sourceBot,
    }));
  } catch {
    return [];
  }
}

export async function chargeSoloEntry(gameId, amount) {
  const data = await mbChargeEntry(gameId, amount);
  if (!data.success) throw new Error('charge_failed');
  return {
    ok:            true,
    new_balance:   Number(data.newSkzBalance),
    transactionId: data.transactionId,
    expectedPrize: data.expectedPrize,
  };
}

/**
 * Validate game completion — must be called before creditSoloReward.
 * Server verifies score >= win threshold and enough time elapsed since charge.
 * Returns { ok, resultToken } or throws if win conditions not met.
 */
export async function validateGameResult(chargeTransactionId, score) {
  return mbValidateResult(chargeTransactionId, score);
}

/**
 * Credit a game win reward.
 * @param {string|number} gameId               - for logging only
 * @param {number}        chargeTransactionId  - returned by chargeSoloEntry
 * @param {number}        score
 * @param {string}        resultToken          - from validateGameResult
 */
export async function creditSoloReward(gameId, chargeTransactionId, score, resultToken) {
  void gameId; // gameId is embedded in the charge transaction server-side
  const data = await mbCreditReward(chargeTransactionId, score, resultToken);
  if (!data.success) throw new Error('credit_failed');
  return {
    ok:           true,
    new_balance:  Number(data.newSkzBalance),
    net_rewarded: Number(data.netRewarded),
  };
}

/**
 * Refund a game entry fee — called when the player legitimately won but
 * the server could not credit the reward. Server is idempotent.
 */
export async function refundSoloEntry(chargeTransactionId) {
  if (!chargeTransactionId) throw new Error('missing_charge_transaction_id');
  const data = await mbRefundEntry(chargeTransactionId);
  return {
    ok:              !!data?.success,
    transactionId:   data?.transactionId,
    refundedAmount:  Number(data?.refundedAmount ?? 0),
    new_balance:     Number(data?.newSkzBalance ?? 0),
    alreadyRefunded: !!data?.alreadyRefunded,
  };
}

export async function requestTonWithdrawal({ amountSc, tonAddress }) {
  return mbRequestWithdrawal('ton', amountSc, { tonAddress });
}

export async function getSoloFeeTiers() {
  try {
    const res = await mbGetTiers();
    return (res.tiers || []).map(t => ({
      entryFee:   t.entryFee,
      multiplier: t.multiplier,
      difficulty: t.difficulty,
      isDefault:  t.isDefault,
    }));
  } catch {
    return [];
  }
}

export async function getEconomySettings() {
  return {
    currency_symbol:     'SKZ',
    currency_name:       'SKZ',
    sc_per_ton:          500,
    sc_per_usdt:         100,
    ton_per_sc_withdraw: 0.002,
    withdraw_min_sc:     100,
    withdraw_fee_percent: 1,
    withdraw_fee_min_sc: 0,
  };
}

export async function convertTrialToPaid() { return { ok: true }; }
export async function cancelWithdrawal()    { return { ok: false }; }
export async function getPendingWithdrawals() { return { ok: true, requests: [] }; }
export async function checkDepositIntent()  { return null; }

export async function listPaymentMethods() {
  return [
    { code: 'ton',   label: 'TON',            kind: 'crypto' },
    { code: 'stars', label: 'Telegram Stars', kind: 'stars'  },
  ];
}

export async function testerIsEnrolled()  { return false; }
export async function testerSelfEnroll()  { return null; }
export async function testerSelfDisable() { return null; }

/**
 * Create a TON deposit intent.
 * Accepts raw number OR object { amountTon }.
 * Returns { ok, depositAddress, memo, amountTon, expectedSkz }.
 */
export async function createTonDepositIntent(amountTonOrObj) {
  const amountTon = typeof amountTonOrObj === 'number'
    ? amountTonOrObj
    : (amountTonOrObj?.amountTon ?? amountTonOrObj);
  return mbCreateTonDepositIntent(amountTon);
}

/**
 * Create a Telegram Stars deposit invoice via Mother Bot.
 * Accepts raw number OR object { amountStars }.
 * Returns { ok, invoiceLink, expectedSkz, payload }.
 */
export async function createStarsInvoice(amountStarsOrObj) {
  const amountStars = typeof amountStarsOrObj === 'number'
    ? amountStarsOrObj
    : (amountStarsOrObj?.amountStars ?? amountStarsOrObj);
  return mbCreateStarsInvoice(amountStars);
}

export async function openStarsInvoice(invoiceLink) {
  const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  return new Promise((resolve) => {
    if (wa?.openInvoice) {
      wa.openInvoice(invoiceLink, (status) => resolve(status));
    } else {
      window.open(invoiceLink, '_blank');
      resolve('opened_external');
    }
  });
}
