
/*
  # Fix three bugs discovered during stress testing and payment testing

  ## Bug 1: match_submit_all_bot_scores — wrong result type
  The function declared `v_result jsonb` but `match_submit_bot_score` returns
  `match_rooms` (a composite row type), causing "invalid input syntax for type json".
  Fix: use a match_rooms variable to capture the return value.

  ## Bug 2: testnet_simulate_withdrawal — wrong session table
  The function queried `sessions` with column `session_id`, but the actual table
  is `telegram_sessions` with primary key column `id`.
  Also referenced a non-existent `amount_sc` column on `user_withdrawal_requests`
  (the column is `amount_usd`). Fixed to use correct table/column names.

  ## Bug 3: ton_deposit_intents sc_credited not updated on match
  pay_apply_ton_deposit updates status and tx_hash but never writes to sc_credited.
  Fixed by updating sc_credited in the same UPDATE statement.
*/

-- ─── Fix 1: match_submit_all_bot_scores ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_submit_all_bot_scores(
  p_room_id text,
  p_scores  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     jsonb;
  v_bot_id   bigint;
  v_score    int;
  v_count    int := 0;
  v_result   match_rooms;
BEGIN
  IF jsonb_array_length(p_scores) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'submitted', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores)
  LOOP
    v_bot_id := (v_item->>'bot_id')::bigint;
    v_score  := (v_item->>'score')::int;

    IF v_bot_id IS NULL OR v_score IS NULL THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_result
    FROM public.match_submit_bot_score(p_room_id, v_bot_id, v_score);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'submitted', v_count);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'submitted', v_count);
END;
$$;

-- ─── Fix 2: testnet_simulate_withdrawal — correct session table ───────────────
CREATE OR REPLACE FUNCTION public.testnet_simulate_withdrawal(
  p_session_id  text,
  p_amount_sc   numeric,
  p_ton_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg_id            bigint;
  v_balance          numeric;
  v_fee_pct          numeric := 2;
  v_fee_min          numeric := 50;
  v_fee              numeric;
  v_net_sc           numeric;
  v_ton_per_sc       numeric := 0.0018;
  v_ton_out          numeric;
  v_l1_pct           numeric := 5;
  v_l2_pct           numeric := 2;
  v_l1_commission    numeric := 0;
  v_l2_commission    numeric := 0;
  v_l1_referrer      bigint;
  v_l2_referrer      bigint;
  v_tx_hash          text;
  v_block_height     bigint;
  v_request_id       uuid;
  v_sim_id           uuid;
  v_testnet_wallet   text := 'EQDtestNetHotWallet7f3k9mX2pQr4vL8nB5cJ1dZ6wY0uI';
BEGIN
  -- Resolve session → telegram_id (fixed: use telegram_sessions.id)
  SELECT telegram_id INTO v_tg_id
  FROM telegram_sessions
  WHERE id = p_session_id::uuid
  AND expires_at > now()
  LIMIT 1;

  IF v_tg_id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  IF p_amount_sc < 500 THEN
    RAISE EXCEPTION 'below_minimum: min 500 SKZ';
  END IF;

  SELECT sc_balance INTO v_balance
  FROM user_balances
  WHERE telegram_id = v_tg_id;

  IF v_balance IS NULL OR v_balance < p_amount_sc THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_fee    := GREATEST(v_fee_min, p_amount_sc * v_fee_pct / 100.0);
  v_net_sc := p_amount_sc - v_fee;
  v_ton_out := ROUND(v_net_sc * v_ton_per_sc, 8);

  -- Commission calculation
  SELECT referrer_id INTO v_l1_referrer
  FROM manager_visitors
  WHERE telegram_id = v_tg_id
  LIMIT 1;

  IF v_l1_referrer IS NOT NULL AND v_l1_referrer != v_tg_id THEN
    v_l1_commission := ROUND(p_amount_sc * v_l1_pct / 100.0, 4);

    UPDATE user_balances
    SET referral_balance = COALESCE(referral_balance, 0) + v_l1_commission
    WHERE telegram_id = v_l1_referrer;

    INSERT INTO referral_earnings
    (referrer_telegram_id, referred_telegram_id, source, amount_skz, base_amount_skz, pct_applied, code)
    VALUES
    (v_l1_referrer, v_tg_id, 'testnet_withdrawal', v_l1_commission, p_amount_sc, v_l1_pct, 'L1')
    ON CONFLICT DO NOTHING;

    SELECT referrer_id INTO v_l2_referrer
    FROM manager_visitors
    WHERE telegram_id = v_l1_referrer
    LIMIT 1;

    IF v_l2_referrer IS NOT NULL AND v_l2_referrer != v_l1_referrer AND v_l2_referrer != v_tg_id THEN
      v_l2_commission := ROUND(v_l1_commission * v_l2_pct / 100.0, 4);

      UPDATE user_balances
      SET referral_balance = COALESCE(referral_balance, 0) + v_l2_commission
      WHERE telegram_id = v_l2_referrer;

      INSERT INTO referral_earnings
      (referrer_telegram_id, referred_telegram_id, source, amount_skz, base_amount_skz, pct_applied, code)
      VALUES
      (v_l2_referrer, v_tg_id, 'testnet_withdrawal', v_l2_commission, v_l1_commission, v_l2_pct, 'L2')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE user_balances
  SET sc_balance = sc_balance - p_amount_sc
  WHERE telegram_id = v_tg_id;

  v_tx_hash      := 'TNT-' || upper(substring(md5(v_tg_id::text || now()::text || p_amount_sc::text || random()::text), 1, 32));
  v_block_height := 40000000 + floor(random() * 5000000)::bigint;

  -- Fixed: removed non-existent amount_sc column, use amount_usd for SC amount
  INSERT INTO user_withdrawal_requests
  (user_telegram_id, token, amount, amount_usd, destination_address, fee_usd, status, tx_hash, admin_note, processed_at)
  VALUES
  (v_tg_id, 'TON', v_ton_out, p_amount_sc, p_ton_address, v_fee, 'sent', v_tx_hash,
   'TESTNET SIMULATION — No real funds transferred', now())
  RETURNING id INTO v_request_id;

  INSERT INTO ledger_entries
  (user_telegram_id, direction, category, amount_usd, amount_token, token,
   balance_after_usd, reference_type, reference_id, description)
  SELECT
    v_tg_id, 'debit', 'withdrawal',
    ROUND(p_amount_sc * 0.0018 * 6.0, 4),
    p_amount_sc, 'SKZ',
    sc_balance,
    'testnet_withdrawal', v_request_id::text,
    '[TESTNET] ' || p_amount_sc || ' SKZ → ' || v_ton_out || ' TON (simulated, no real funds)'
  FROM user_balances
  WHERE telegram_id = v_tg_id;

  INSERT INTO testnet_simulated_txs
  (withdrawal_request_id, user_telegram_id, from_address, to_address,
   amount_ton, amount_skz, tx_hash, block_height, status,
   l1_commission_skz, l2_commission_skz,
   l1_referrer_telegram_id, l2_referrer_telegram_id,
   l1_pct_applied, l2_pct_applied, notes)
  VALUES
  (v_request_id, v_tg_id, v_testnet_wallet, p_ton_address,
   v_ton_out, p_amount_sc, v_tx_hash, v_block_height, 'confirmed',
   v_l1_commission, v_l2_commission,
   v_l1_referrer, v_l2_referrer,
   v_l1_pct, CASE WHEN v_l2_referrer IS NOT NULL THEN v_l2_pct ELSE 0 END,
   'Testnet simulation — no real funds')
  RETURNING id INTO v_sim_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'testnet',       true,
    'sim_id',        v_sim_id,
    'request_id',    v_request_id,
    'tx_hash',       v_tx_hash,
    'block_height',  v_block_height,
    'amount_skz',    p_amount_sc,
    'fee_skz',       v_fee,
    'net_skz',       v_net_sc,
    'ton_out',       v_ton_out,
    'to_address',    p_ton_address,
    'from_address',  v_testnet_wallet,
    'l1_commission', v_l1_commission,
    'l2_commission', v_l2_commission,
    'l1_referrer',   v_l1_referrer,
    'l2_referrer',   v_l2_referrer,
    'explorer_url',  'https://testnet.tonscan.org/tx/' || v_tx_hash
  );
END;
$$;

-- ─── Fix 3: pay_apply_ton_deposit — update sc_credited ───────────────────────
CREATE OR REPLACE FUNCTION public.pay_apply_ton_deposit(
  p_intent_id   uuid,
  p_tx_hash     text,
  p_observed_ton numeric,
  p_currency    text DEFAULT 'TON'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Amount validation: observed must be >= 99% of expected (1% slippage tolerance)
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

  SELECT COALESCE(value::numeric, 500) INTO v_sc_rate
  FROM economy_settings WHERE key = 'sc_per_ton';

  v_sc_amt := ROUND(p_observed_ton * v_sc_rate, 2);

  -- Mark intent matched with tx_hash and sc_credited (fixed: now updates sc_credited)
  UPDATE ton_deposit_intents
  SET status     = 'matched',
      tx_hash    = p_tx_hash,
      matched_at = now(),
      sc_credited = v_sc_amt
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
      'tx_hash',    p_tx_hash,
      'ton_amount', p_observed_ton,
      'sc_rate',    v_sc_rate,
      'intent_id',  p_intent_id,
      'currency',   p_currency
    )
  );

  RETURN jsonb_build_object(
    'ok',         true,
    'sc_credited', v_sc_amt,
    'new_balance', v_new_bal,
    'tx_hash',    p_tx_hash,
    'sc_rate',    v_sc_rate,
    'currency',   p_currency
  );
END;
$$;

-- Also drop the old overload without p_currency to avoid ambiguity
DROP FUNCTION IF EXISTS public.pay_apply_ton_deposit(uuid, text, numeric);
