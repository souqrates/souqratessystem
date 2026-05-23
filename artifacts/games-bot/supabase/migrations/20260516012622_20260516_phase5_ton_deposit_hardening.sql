/*
  # TON Deposit Security Hardening

  ## Summary
  Closes the memo-only deposit matching vulnerability in the TON watcher.

  ## Changes

  1. `ton_deposit_intents`
     - Add `tx_hash` column to record the matched on-chain transaction
     - Add `expected_amount_ton` column to enforce exact-amount matching
     - Add unique index on `tx_hash` to prevent replay attacks

  2. `pay_apply_ton_deposit`
     - Rewritten to validate observed amount >= expected amount (within 1% tolerance)
     - Stores tx_hash, marks intent as matched — unique constraint blocks replays
     - Returns `already_matched` for duplicate tx_hash calls (idempotent)

  3. `pay_buy_with_ton`
     - Stores `expected_amount_ton` in the intent row for downstream validation
     - Caps active intents at 5 per user to prevent spam

  ## Security
  - tx_hash unique index: same blockchain transaction cannot credit two different intents
  - Amount validation: sending less TON than requested is rejected
  - Active intent cap: prevents deposit-intent spam
*/

-- ─── 1. Schema additions ─────────────────────────────────────────────────────

ALTER TABLE ton_deposit_intents
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS expected_amount_ton numeric;

CREATE UNIQUE INDEX IF NOT EXISTS uix_ton_deposit_intents_tx_hash
  ON ton_deposit_intents (tx_hash)
  WHERE tx_hash IS NOT NULL;

-- ─── 2. Rewrite pay_apply_ton_deposit with tx_hash dedup + amount check ──────

CREATE OR REPLACE FUNCTION pay_apply_ton_deposit(
  p_intent_id uuid,
  p_tx_hash   text,
  p_observed_ton numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent  ton_deposit_intents%ROWTYPE;
  v_sc_rate numeric;
  v_sc_amt  numeric;
  v_new_bal numeric;
BEGIN
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

  -- Amount validation: observed must be >= 99% of expected (1% slippage tolerance for gas)
  IF v_intent.expected_amount_ton IS NOT NULL AND v_intent.expected_amount_ton > 0 THEN
    IF p_observed_ton < v_intent.expected_amount_ton * 0.99 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'amount_too_low',
        'expected', v_intent.expected_amount_ton,
        'observed', p_observed_ton
      );
    END IF;
  END IF;

  -- Get SC rate
  SELECT COALESCE(value::numeric, 500) INTO v_sc_rate
  FROM economy_settings WHERE key = 'sc_per_ton';

  v_sc_amt := ROUND(p_observed_ton * v_sc_rate, 2);

  -- Mark intent matched with tx_hash
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
    v_sc_amt, p_observed_ton, 'TON',
    v_new_bal, 'ton_deposit', p_intent_id::text,
    'TON deposit: ' || p_observed_ton || ' TON → ' || v_sc_amt || ' SKZ',
    jsonb_build_object(
      'tx_hash',       p_tx_hash,
      'ton_amount',    p_observed_ton,
      'sc_rate',       v_sc_rate,
      'intent_id',     p_intent_id
    )
  );

  RETURN jsonb_build_object(
    'ok',        true,
    'sc_credited', v_sc_amt,
    'new_balance', v_new_bal,
    'tx_hash',   p_tx_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pay_apply_ton_deposit(uuid, text, numeric) TO service_role;


-- ─── 3. Rewrite pay_buy_with_ton: store expected_amount_ton + cap active intents ──

CREATE OR REPLACE FUNCTION pay_buy_with_ton(
  p_session_id  uuid,
  p_amount_ton  numeric,
  p_source      text DEFAULT 'wallet'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg       bigint;
  v_min_ton  numeric;
  v_max_ton  numeric;
  v_sc_rate  numeric;
  v_sc_amt   numeric;
  v_address  text;
  v_memo     text;
  v_intent_id uuid;
  v_active_count int;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  v_min_ton := COALESCE(
    (SELECT value::numeric FROM economy_settings WHERE key = 'ton_deposit_min'),
    0.1
  );
  v_max_ton := COALESCE(
    (SELECT value::numeric FROM economy_settings WHERE key = 'ton_deposit_max'),
    10000
  );

  IF p_amount_ton < v_min_ton THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = '22023';
  END IF;
  IF p_amount_ton > v_max_ton THEN
    RAISE EXCEPTION 'above_maximum' USING ERRCODE = '22023';
  END IF;

  -- Cap active intents at 5 per user (anti-spam)
  SELECT COUNT(*) INTO v_active_count
  FROM ton_deposit_intents
  WHERE user_telegram_id = v_tg
    AND status = 'awaiting'
    AND expires_at > now();

  IF v_active_count >= 5 THEN
    RAISE EXCEPTION 'too_many_active_intents' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(value, '') INTO v_address
  FROM economy_settings WHERE key = 'ton_deposit_address';

  IF v_address = '' OR v_address IS NULL THEN
    RAISE EXCEPTION 'deposit_not_configured' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(value::numeric, 500) INTO v_sc_rate
  FROM economy_settings WHERE key = 'sc_per_ton';

  v_sc_amt := ROUND(p_amount_ton * v_sc_rate, 2);

  -- Generate unique memo: 12-char hex
  v_memo := upper(encode(gen_random_bytes(6), 'hex'));

  INSERT INTO ton_deposit_intents (
    user_telegram_id,
    memo,
    amount_ton,
    expected_amount_ton,
    expected_sc,
    status,
    source,
    expires_at
  ) VALUES (
    v_tg,
    v_memo,
    p_amount_ton,
    p_amount_ton,
    v_sc_amt,
    'awaiting',
    p_source,
    now() + interval '30 minutes'
  ) RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'intent_id',       v_intent_id,
    'amount_ton',      p_amount_ton,
    'expected_sc',     v_sc_amt,
    'expected_address', v_address,
    'memo',            v_memo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pay_buy_with_ton(uuid, numeric, text) TO anon;
GRANT EXECUTE ON FUNCTION pay_buy_with_ton(uuid, numeric, text) TO authenticated;


-- ─── 4. Add matched_at column if missing ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ton_deposit_intents' AND column_name = 'matched_at'
  ) THEN
    ALTER TABLE ton_deposit_intents ADD COLUMN matched_at timestamptz;
  END IF;
END $$;
