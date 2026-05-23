/*
  # Fix pay_apply_ton_deposit to support multiple currencies

  ## Problem
  The function always uses sc_per_ton rate regardless of whether the deposit
  was TON or USDT, causing incorrect SKZ credits for USDT deposits.

  ## Changes
  - Add p_currency parameter (default 'TON' for backwards compatibility)
  - Fetch sc_per_usdt rate separately when currency is USDT
  - Use correct rate per currency in SKZ calculation
  - Fix ledger description to show correct currency
*/

CREATE OR REPLACE FUNCTION public.pay_apply_ton_deposit(
  p_intent_id   uuid,
  p_tx_hash     text,
  p_observed_ton numeric,
  p_currency    text DEFAULT 'TON'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_intent   ton_deposit_intents%ROWTYPE;
  v_sc_rate  numeric;
  v_sc_amt   numeric;
  v_new_bal  numeric;
  v_currency text;
BEGIN
  v_currency := UPPER(COALESCE(p_currency, 'TON'));

  -- Dedup: if this tx_hash is already recorded, return idempotent OK
  IF EXISTS (
    SELECT 1 FROM ton_deposit_intents WHERE tx_hash = p_tx_hash
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_matched', true);
  END IF;

  SELECT * INTO v_intent
  FROM ton_deposit_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intent_not_found');
  END IF;

  IF v_intent.status <> 'awaiting' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intent_not_awaiting', 'status', v_intent.status);
  END IF;

  IF now() > v_intent.expires_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intent_expired');
  END IF;

  -- Amount validation: observed must be >= 99% of expected (1% slippage tolerance)
  IF v_intent.expected_amount_ton IS NOT NULL AND v_intent.expected_amount_ton > 0 THEN
    IF p_observed_ton < v_intent.expected_amount_ton * 0.99 THEN
      RETURN jsonb_build_object(
        'ok',       false,
        'error',    'amount_too_low',
        'expected', v_intent.expected_amount_ton,
        'observed', p_observed_ton,
        'currency', v_currency
      );
    END IF;
  END IF;

  -- Get correct SC rate based on currency
  IF v_currency = 'USDT' THEN
    SELECT COALESCE(value::numeric, 500) INTO v_sc_rate
    FROM economy_settings WHERE key = 'sc_per_usdt';
  ELSE
    SELECT COALESCE(value::numeric, 500) INTO v_sc_rate
    FROM economy_settings WHERE key = 'sc_per_ton';
  END IF;

  -- Fallback if setting not found
  IF v_sc_rate IS NULL OR v_sc_rate <= 0 THEN
    v_sc_rate := 500;
  END IF;

  v_sc_amt := ROUND(p_observed_ton * v_sc_rate, 2);

  -- Mark intent matched
  UPDATE ton_deposit_intents
  SET status     = 'matched',
      tx_hash    = p_tx_hash,
      matched_at = now()
  WHERE id = p_intent_id;

  -- Credit user balance
  INSERT INTO user_balances (telegram_id, sc_balance, is_paid, total_deposited_usd)
  VALUES (v_intent.user_telegram_id, v_sc_amt, true, v_sc_amt)
  ON CONFLICT (telegram_id) DO UPDATE
  SET sc_balance          = user_balances.sc_balance + v_sc_amt,
      is_paid             = true,
      total_deposited_usd = user_balances.total_deposited_usd + v_sc_amt,
      updated_at          = now()
  RETURNING sc_balance INTO v_new_bal;

  -- Ledger entry
  INSERT INTO ledger_entries (
    user_telegram_id, direction, category,
    amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id,
    description, metadata
  ) VALUES (
    v_intent.user_telegram_id, 'credit', 'deposit',
    v_sc_amt, p_observed_ton, v_currency,
    v_new_bal, 'ton_deposit', p_intent_id::text,
    v_currency || ' deposit: ' || p_observed_ton || ' ' || v_currency || ' → ' || v_sc_amt || ' SKZ',
    jsonb_build_object(
      'tx_hash',    p_tx_hash,
      'amount',     p_observed_ton,
      'currency',   v_currency,
      'sc_rate',    v_sc_rate,
      'intent_id',  p_intent_id
    )
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'sc_credited', v_sc_amt,
    'new_balance', v_new_bal,
    'tx_hash',     p_tx_hash,
    'currency',    v_currency,
    'sc_rate',     v_sc_rate
  );
END;
$$;
