/*
  # Fix TON deposit status constraint and add missing sc_credited column

  1. Schema Changes
    - `ton_deposit_intents`: Add 'matched' to the status CHECK constraint
    - `ton_deposit_intents`: Add `sc_credited` column (numeric, nullable) to store actual credited SKZ amount

  2. Why
    - The `pay_apply_ton_deposit` function sets `status = 'matched'` but the CHECK constraint
      only allows ('awaiting','confirmed','expired','cancelled'), causing ALL deposit confirmations to fail
    - The frontend `checkDepositIntent` queries `sc_credited` which does not exist as a column,
      causing deposit status checks to fail or return null

  3. Impact
    - Fixes deposit flow: TON deposits will now be properly confirmed
    - Fixes deposit UI: credited amount will display correctly
*/

-- 1. Drop the old CHECK constraint and recreate with 'matched' included
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ton_deposit_intents'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE ton_deposit_intents DROP CONSTRAINT ' || quote_ident(constraint_name)
      FROM information_schema.table_constraints
      WHERE table_name = 'ton_deposit_intents'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%status%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE ton_deposit_intents
  ADD CONSTRAINT ton_deposit_intents_status_check
  CHECK (status IN ('awaiting','confirmed','expired','cancelled','matched'));

-- 2. Add sc_credited column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ton_deposit_intents' AND column_name = 'sc_credited'
  ) THEN
    ALTER TABLE ton_deposit_intents ADD COLUMN sc_credited numeric DEFAULT 0;
  END IF;
END $$;

-- 3. Update pay_apply_ton_deposit to also set sc_credited when matching
-- Find and update the function to populate sc_credited
CREATE OR REPLACE FUNCTION public.pay_apply_ton_deposit(
  p_intent_id   uuid,
  p_observed_ton numeric,
  p_tx_hash      text
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_intent       record;
  v_sc_rate      numeric;
  v_sc_amt       numeric;
  v_tg           bigint;
BEGIN
  -- Lock the intent row
  SELECT * INTO v_intent
  FROM ton_deposit_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intent_not_found');
  END IF;

  IF v_intent.status <> 'awaiting' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_processed');
  END IF;

  -- Check expiry
  IF now() > v_intent.expires_at THEN
    UPDATE ton_deposit_intents SET status = 'expired' WHERE id = p_intent_id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Allow 1% slippage
  IF p_observed_ton < v_intent.expected_amount_ton * 0.99 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_too_low',
      'expected', v_intent.expected_amount_ton, 'observed', p_observed_ton);
  END IF;

  -- Get current SC rate
  SELECT COALESCE(
    (SELECT (value->>'sc_per_ton')::numeric FROM economy_settings WHERE key = 'exchange_rates'),
    100
  ) INTO v_sc_rate;

  v_sc_amt := ROUND(p_observed_ton * v_sc_rate, 2);

  -- Mark as matched
  UPDATE ton_deposit_intents
  SET status       = 'matched',
      tx_hash      = p_tx_hash,
      observed_ton = p_observed_ton,
      sc_credited  = v_sc_amt,
      matched_at   = now()
  WHERE id = p_intent_id;

  -- Resolve user
  v_tg := v_intent.telegram_id;

  -- Credit balance
  UPDATE user_balances
  SET sc_balance = sc_balance + v_sc_amt
  WHERE telegram_id = v_tg;

  -- Ledger entry
  INSERT INTO ledger_entries (telegram_id, direction, amount_sc, category, reference_id, note)
  VALUES (v_tg, 'credit', v_sc_amt, 'deposit',
          p_intent_id::text, 'TON deposit ' || p_observed_ton || ' TON → ' || v_sc_amt || ' SKZ');

  RETURN jsonb_build_object(
    'ok', true,
    'sc_credited', v_sc_amt,
    'observed_ton', p_observed_ton,
    'tx_hash', p_tx_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_apply_ton_deposit(uuid, numeric, text) TO service_role;
